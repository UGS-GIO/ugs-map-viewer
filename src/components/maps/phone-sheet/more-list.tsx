import { Switch } from '@base-ui/react/switch'
import { ChevronRight, CircleHelp, ExternalLink, Moon } from 'lucide-react'
import type { SideLink } from '@/lib/types/sidelink-types'
import { useDarkTheme } from '@/hooks/use-dark-theme'
import { TOUR_ROUTE_BY_PAGE, useTour } from '@/lib/tour'
import { usePhoneSheetActions } from './use-phone-sheet'

// Covered by their own tabs, or by the map itself.
const ON_TABS = new Set(['Home', 'Info', 'Layers'])

const row = 'flex min-h-11 w-full items-center gap-3 py-2 text-left text-base'
const icon = 'shrink-0 text-muted-foreground [&_svg]:h-5 [&_svg]:w-5'

/** The More tab, as an iOS list: the route's other panels and links, the tour, and the theme. */
export function MoreList({ links, page, onOpen }: { links: SideLink[]; page: string; onOpen: (tab: string) => void }) {
  const { startTour } = useTour({ route: TOUR_ROUTE_BY_PAGE[page] })
  const { peek } = usePhoneSheetActions()
  const { isDark, setDark } = useDarkTheme()
  const items = links.filter((l) => !ON_TABS.has(l.title))
  return (
    <ul className='divide-y'>
      {items.map((link) => (
        <li key={link.title}>
          {link.href ? (
            <a href={link.href} target='_blank' rel='noopener noreferrer' className={row}>
              <span className={icon} aria-hidden='true'>{link.icon}</span>
              {link.title}
              <ExternalLink className='ml-auto h-4 w-4 text-muted-foreground' aria-hidden='true' />
              <span className='sr-only'>(opens in a new tab)</span>
            </a>
          ) : (
            <button type='button' onClick={() => onOpen(link.title.toLowerCase())} className={row}>
              <span className={icon} aria-hidden='true'>{link.icon}</span>
              {link.title}
              <ChevronRight className='ml-auto h-5 w-5 text-muted-foreground' aria-hidden='true' />
            </button>
          )}
        </li>
      ))}
      <li>
        <button type='button' onClick={() => { peek(); startTour() }} className={row}>
          <CircleHelp className='h-5 w-5 shrink-0 text-muted-foreground' aria-hidden='true' />
          Take the tour
          <ChevronRight className='ml-auto h-5 w-5 text-muted-foreground' aria-hidden='true' />
        </button>
      </li>
      <li>
        {/* A settings row: the whole row toggles, with the switch at the end. */}
        <label className={row}>
          <Moon className='h-5 w-5 shrink-0 text-muted-foreground' aria-hidden='true' />
          <span className='flex-1'>Dark mode</span>
          <Switch.Root
            checked={isDark}
            onCheckedChange={setDark}
            className='relative flex h-7 w-12 shrink-0 rounded-full bg-muted p-0.5 transition-colors data-[checked]:bg-primary'
          >
            <Switch.Thumb className='h-6 w-6 rounded-full bg-background shadow transition-transform data-[checked]:translate-x-5' />
          </Switch.Root>
        </label>
      </li>
    </ul>
  )
}
