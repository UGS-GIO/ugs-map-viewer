import type * as maplibregl from 'maplibre-gl'
import type { QueryClient } from '@tanstack/react-query'
import { stopLetter, toStopHref } from '@/lib/map/shared-stops'
import { DEFAULT_EXPORT_SETTINGS, MapExporter, type GetLegendData } from './export-control'

const MARGIN_MM = 10
const HEADER_MM = 14
const FOOTER_MM = 8
const NOTE_LINE_MM = 4.5
// Selection and layer queries can take a while; past this, export what's drawn
const SETTLE_TIMEOUT_MS = 15000

export interface PdfPage {
  label: string
  note?: string
  href: string
  /** Puts the map in this page's state; resolves once the URL is there */
  visit: () => Promise<void>
  /** Visit before pages without it, e.g. history steps before anything that pushes over them */
  visitFirst?: boolean
}

/** Resolves once TanStack Query has nothing fetching or mutating, or when `signal` aborts. */
function queriesQuiet(queryClient: QueryClient, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribers: (() => void)[] = []
    const done = () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      resolve()
    }
    const check = () => { if (queryClient.isFetching() === 0 && queryClient.isMutating() === 0) done() }
    unsubscribers.push(queryClient.getQueryCache().subscribe(check), queryClient.getMutationCache().subscribe(check))
    signal.addEventListener('abort', done, { once: true })
    check()
  })
}

/** The map stopped and drawn, its feature queries done, and drawn again with their results. */
async function settled(map: maplibregl.Map, queryClient: QueryClient) {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), SETTLE_TIMEOUT_MS)
  const aborted = new Promise<void>((resolve) => timeout.signal.addEventListener('abort', () => resolve(), { once: true }))
  await Promise.race([
    (async () => {
      await map.once('idle')
      await queriesQuiet(queryClient, timeout.signal)
      await map.once('idle')
    })(),
    aborted,
  ])
  clearTimeout(timer)
  timeout.abort()
}

interface StepsPdfOptions {
  map: maplibregl.Map
  pages: PdfPage[]
  queryClient: QueryClient
  origin: string
  getLegendData?: GetLegendData
  onProgress?: (done: number, total: number) => void
}

/**
 * One page per labeled step or shared stop: its label, the map as the exporter prints it, and a link
 * back to that view. Visits each in turn, so the map moves through them while it runs.
 * @returns how many pages printed before every tile had drawn
 */
export async function exportStepsPdf({ map, pages, queryClient, origin, getLegendData, onProgress }: StepsPdfOptions): Promise<number> {
  const { jsPDF } = await import('jspdf')
  const exporter = new MapExporter({ ...DEFAULT_EXPORT_SETTINGS, dpi: 150 }, 'ugs-map-stops', getLegendData, true)
  const rendered: { canvas: HTMLCanvasElement; widthMm: number; heightMm: number }[] = []
  let partialPages = 0

  const visitOrder = pages.map((page, i) => ({ page, i })).sort((a, b) => Number(!!b.page.visitFirst) - Number(!!a.page.visitFirst))
  for (const [done, { page, i }] of visitOrder.entries()) {
    onProgress?.(done, pages.length)
    await page.visit()
    // The camera eases after the URL changes, so this waits on the map, not the URL
    map.triggerRepaint()
    await settled(map, queryClient)
    rendered[i] = await exporter.renderPage(map)
    if (exporter.partial) partialPages++
  }

  let pdf: InstanceType<typeof jsPDF> | undefined
  for (const [i, { canvas, widthMm, heightMm }] of rendered.entries()) {
    if (!pdf) pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [widthMm, heightMm] })
    else pdf.addPage([widthMm, heightMm], 'landscape')

    pdf.setFontSize(14)
    pdf.text(`${stopLetter(i)}. ${pages[i].label}`, MARGIN_MM, MARGIN_MM + 4)
    pdf.setFontSize(10)
    const noteLines: string[] = pages[i].note ? pdf.splitTextToSize(pages[i].note, widthMm - MARGIN_MM * 2) : []
    pdf.text(noteLines, MARGIN_MM, MARGIN_MM + 10)
    const headerMm = HEADER_MM + noteLines.length * NOTE_LINE_MM

    // Fit the rendered page between header and footer, keeping its shape
    const scale = Math.min((widthMm - MARGIN_MM * 2) / widthMm, (heightMm - MARGIN_MM - headerMm - FOOTER_MM) / heightMm)
    const imageWidth = widthMm * scale
    const imageHeight = heightMm * scale
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (widthMm - imageWidth) / 2, MARGIN_MM + headerMm - 4, imageWidth, imageHeight)

    pdf.setFontSize(9)
    pdf.textWithLink('Open this view in the interactive map', MARGIN_MM, heightMm - MARGIN_MM / 2 - 1, { url: new URL(toStopHref(pages[i].href), origin).toString() })
  }

  onProgress?.(pages.length, pages.length)
  pdf?.save('ugs-map-stops.pdf')
  return partialPages
}
