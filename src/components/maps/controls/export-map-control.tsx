import { useControl } from 'react-map-gl/maplibre'
import { ExportControl, type ExportControlOptions } from './export-control'

/** The print/export button, lazy-loaded so its PDF code stays out of the main bundle. */
export default function ExportMapControl({ getLegendData }: Pick<ExportControlOptions, 'getLegendData'>) {
  useControl(() => new ExportControl({
    pageSize: 'A4',
    pageOrientation: 'landscape',
    format: 'png',
    dpi: 300,
    filename: 'ugs-map',
    getLegendData,
  }), { position: 'top-left' })
  return null
}
