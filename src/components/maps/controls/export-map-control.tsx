import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useControl, useMap } from 'react-map-gl/maplibre'
import { Popover } from '@base-ui/react/popover'
import { useMutation } from '@tanstack/react-query'
import { Printer, X } from 'lucide-react'
import { toast } from 'sonner'
import { PortalControl } from './portal-control'
import {
  DEFAULT_EXPORT_SETTINGS,
  MapExporter,
  type ExportSettings,
  type GetLegendData,
} from './export-control'

type SettingOption<K extends keyof ExportSettings> = { value: ExportSettings[K]; label: string }

const PAGE_SIZE_OPTIONS: SettingOption<'pageSize'>[] = [
  { value: 'A4', label: 'A4' },
  { value: 'A3', label: 'A3' },
  { value: 'Letter', label: 'Letter' },
  { value: 'Tabloid', label: 'Tabloid' },
]
const ORIENTATION_OPTIONS: SettingOption<'pageOrientation'>[] = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
]
const FORMAT_OPTIONS: SettingOption<'format'>[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'pdf', label: 'PDF' },
]
const DPI_OPTIONS: SettingOption<'dpi'>[] = [
  { value: 96, label: '96' },
  { value: 150, label: '150' },
  { value: 200, label: '200' },
  { value: 300, label: '300' },
]
const SCALE_UNIT_OPTIONS: SettingOption<'scaleUnit'>[] = [
  { value: 'imperial', label: 'mi/ft' },
  { value: 'metric', label: 'km/m' },
]
const LEGEND_MODE_OPTIONS: SettingOption<'legendMode'>[] = [
  { value: 'on-map', label: 'On Map' },
  { value: 'separate', label: 'Separate' },
  { value: 'none', label: 'None' },
]

function SettingSelect<K extends keyof ExportSettings>({ label, setting, options, settings, onChange }: {
  label: string
  setting: K
  options: SettingOption<K>[]
  settings: ExportSettings
  onChange: (next: ExportSettings) => void
}) {
  const id = `export-${setting}`
  return (
    <div className='mb-1.5 flex items-center justify-between gap-3'>
      <label htmlFor={id} className='text-xs text-foreground'>{label}</label>
      <select
        id={id}
        value={String(settings[setting])}
        onChange={(e) => {
          const picked = options.find(o => String(o.value) === e.target.value)
          if (picked) onChange({ ...settings, [setting]: picked.value })
        }}
        className='cursor-pointer rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground'
      >
        {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </div>
  )
}

/**
 * The print/export button, lazy-loaded so its PDF code stays out of the main bundle. The
 * options panel is portaled out of the control: the control chip clips its children.
 */
export default function ExportMapControl({ getLegendData }: { getLegendData?: GetLegendData }) {
  const control = useControl<PortalControl>(() => new PortalControl(), { position: 'top-left' })
  const container = control?.getContainer()
  const { current: map } = useMap()
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<ExportSettings>(DEFAULT_EXPORT_SETTINGS)

  const exportMap = useMutation({
    mutationFn: async () => {
      if (!map) throw new Error('Map not available')
      await new MapExporter(settings, 'ugs-map', getLegendData).run(map.getMap())
    },
    onSuccess: () => setOpen(false),
    onError: (error) => {
      console.error('Export failed:', error)
      toast.error('Export failed. Please try again.')
    },
  })

  if (!container) return null

  return createPortal(
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className='flex size-[29px] items-center justify-center'
        title='Export map'
        aria-label='Export map'
        data-tour='print-map'
      >
        <Printer size={20} strokeWidth={2} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side='right' align='start' sideOffset={8} className='z-50'>
          <Popover.Popup className='min-w-[200px] rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md outline-none'>
            <div className='mb-1.5 flex items-center justify-between border-b border-border pb-1'>
              <Popover.Title className='text-xs font-medium leading-none text-foreground'>Export Map</Popover.Title>
              <Popover.Close
                aria-label='Close'
                className='flex size-4 items-center justify-center text-muted-foreground hover:text-foreground'
              >
                <X size={14} />
              </Popover.Close>
            </div>
            <SettingSelect label='Size' setting='pageSize' options={PAGE_SIZE_OPTIONS} settings={settings} onChange={setSettings} />
            <SettingSelect label='Orientation' setting='pageOrientation' options={ORIENTATION_OPTIONS} settings={settings} onChange={setSettings} />
            <SettingSelect label='Format' setting='format' options={FORMAT_OPTIONS} settings={settings} onChange={setSettings} />
            <SettingSelect label='Quality' setting='dpi' options={DPI_OPTIONS} settings={settings} onChange={setSettings} />
            <SettingSelect label='Scale' setting='scaleUnit' options={SCALE_UNIT_OPTIONS} settings={settings} onChange={setSettings} />
            {getLegendData && (
              <SettingSelect label='Legend' setting='legendMode' options={LEGEND_MODE_OPTIONS} settings={settings} onChange={setSettings} />
            )}
            <button
              type='button'
              onClick={() => exportMap.mutate()}
              disabled={exportMap.isPending}
              className='mt-2 w-full rounded bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60'
            >
              {exportMap.isPending ? 'Exporting...' : 'Export'}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>,
    container,
  )
}
