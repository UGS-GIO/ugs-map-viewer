import type * as maplibregl from 'maplibre-gl'
import type { QueryClient } from '@tanstack/react-query'
import type { MapStep } from '@/lib/map/map-steps'
import { toStopHref } from '@/lib/map/shared-stops'
import { DEFAULT_EXPORT_SETTINGS, MapExporter, type GetLegendData } from './export-control'

const MARGIN_MM = 10
const HEADER_MM = 14
const FOOTER_MM = 8
// Selection and layer queries can take a while; past this, export what's drawn
const SETTLE_TIMEOUT_MS = 15000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Waits until the map has stopped, drawn its tiles, and no feature queries are in flight. */
async function settled(map: maplibregl.Map, queryClient: QueryClient) {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS
  // A few quiet checks in a row: a query's result can start the next draw
  for (let quiet = 0; quiet < 3 && Date.now() < deadline;) {
    await sleep(300)
    const idle = map.loaded() && !map.isMoving() && queryClient.isFetching() === 0 && queryClient.isMutating() === 0
    quiet = idle ? quiet + 1 : 0
  }
}

interface StepsPdfOptions {
  map: maplibregl.Map
  steps: MapStep[]
  /** Goes to a step and resolves once the browser has landed on it */
  goTo: (step: MapStep) => Promise<void>
  queryClient: QueryClient
  origin: string
  getLegendData?: GetLegendData
  onProgress?: (done: number, total: number) => void
}

/**
 * One page per step: its label, the map as the exporter prints it, and a link back to that view.
 * Visits each step in turn, so the map steps through them while it runs.
 */
export async function exportStepsPdf({ map, steps, goTo, queryClient, origin, getLegendData, onProgress }: StepsPdfOptions) {
  const { jsPDF } = await import('jspdf')
  const exporter = new MapExporter({ ...DEFAULT_EXPORT_SETTINGS, dpi: 150 }, 'ugs-map-stops', getLegendData)
  let pdf: InstanceType<typeof jsPDF> | undefined

  for (const [i, step] of steps.entries()) {
    onProgress?.(i, steps.length)
    await goTo(step)
    await settled(map, queryClient)
    const { canvas, widthMm, heightMm } = await exporter.renderPage(map)
    if (!pdf) pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [widthMm, heightMm] })
    else pdf.addPage([widthMm, heightMm], 'landscape')

    pdf.setFontSize(14)
    pdf.text(`${String.fromCharCode(65 + (i % 26))}. ${step.label ?? step.summary}`, MARGIN_MM, MARGIN_MM + 4)

    // Fit the rendered page between header and footer, keeping its shape
    const areaWidth = widthMm - MARGIN_MM * 2
    const areaHeight = heightMm - MARGIN_MM - HEADER_MM - FOOTER_MM
    const scale = Math.min(areaWidth / widthMm, areaHeight / heightMm)
    const imageWidth = widthMm * scale
    const imageHeight = heightMm * scale
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', (widthMm - imageWidth) / 2, MARGIN_MM + HEADER_MM - 4, imageWidth, imageHeight)

    pdf.setFontSize(9)
    pdf.textWithLink('Open this view in the interactive map', MARGIN_MM, heightMm - MARGIN_MM / 2 - 1, { url: new URL(toStopHref(step.href), origin).toString() })
  }

  onProgress?.(steps.length, steps.length)
  pdf?.save('ugs-map-stops.pdf')
}
