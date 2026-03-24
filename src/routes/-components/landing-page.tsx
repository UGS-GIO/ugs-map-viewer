import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Link as ExternalLink } from '@/components/ui/link'
import { Badge } from '@/components/ui/badge'
import { Image } from '@/components/ui/image'
import { SocialLinks } from '@/components/social-links'
import { portals, legacyApps, storyMaps, APP_CATEGORIES } from '@/routes/-data/portal-config'
import type { AppCategory, ImageCredit } from '@/routes/-data/portal-config'
import ThemeSwitch from '@/components/theme-switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toTitleCase } from '@/lib/utils'
import { ArrowRight, ExternalLinkIcon, MapPin, Phone } from 'lucide-react'
import heroBg from '@/assets/geologic-hazards-banner-alstrom-point-1920px.webp'

const STATE_LINKS = [
  { label: 'Utah.gov Home', href: 'https://www.utah.gov/index.html' },
  { label: 'Terms of Use', href: 'https://www.utah.gov/support/disclaimer.html' },
  { label: 'Privacy Policy', href: 'https://www.utah.gov/support/privacypolicy.html' },
  { label: 'Accessibility', href: 'https://www.utah.gov/support/accessibility.html' },
  { label: 'Translate', href: 'https://www.utah.gov/support/translate.html' },
]

const RESOURCE_LINKS = [
  { label: 'Utah Geological Survey', href: 'https://geology.utah.gov' },
  { label: 'Department of Natural Resources', href: 'https://naturalresources.utah.gov' },
  { label: 'The Natural Resources Map & Bookstore', href: 'https://utahmapstore.com' },
]

function UtahLogo() {
  return (
    <svg viewBox="0 0 107 30.51" role="presentation" className="h-6 w-auto fill-white">
      <path d="m12.44,30.51c-4.21,0-7.33-1.22-9.38-3.66C1.02,24.4,0,20.61,0,15.48V0h7.93v16.4c0,2.67.36,4.55,1.08,5.65.77,1.12,2.08,1.74,3.43,1.64,1.36.1,2.68-.52,3.48-1.63.75-1.09,1.13-2.97,1.13-5.65V0h7.65v15.48c0,5.13-1,8.92-3,11.36-2,2.44-5.09,3.66-9.26,3.66Zm24.42-.56V6.64h-7.93V0h23.78v6.64h-7.93v23.31h-7.92Zm26.17-14.56l-.51,2.07h5.53l-.51-2.07c-.37-1.44-.74-3.01-1.11-4.7-.37-1.69-.74-3.29-1.11-4.79h-.18c-.34,1.53-.68,3.14-1.04,4.82-.35,1.68-.71,3.24-1.08,4.68Zm-11.52,14.56L60.64,0h9.58l9.12,29.95h-8.39l-1.48-6.36h-8.38l-1.47,6.36h-8.11Zm30.69,0V0h7.93v11.15h8.94V0h7.93v29.95h-7.93v-11.89h-8.94v11.89h-7.93Z" />
    </svg>
  )
}

function StateBar() {
  return (
    <div className="bg-[#474747] text-white text-xs">
      <hr className="border-white/20 m-0" />
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-y-3">
        <div className="flex items-center gap-3">
          <ExternalLink to="https://utah.gov" className="text-white hover:text-white/80 flex items-center" aria-label="Utah.gov">
            <UtahLogo />
          </ExternalLink>
          <div className="w-px h-6 bg-white/30" role="separator" aria-orientation="vertical" />
          <div>
            <div className="text-white/90">An official website of the <span className="whitespace-nowrap">state of Utah</span></div>
            <div className="text-white/50">&copy; {new Date().getFullYear()} State of Utah</div>
          </div>
        </div>
        <nav aria-label="State of Utah">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 list-none m-0 p-0">
            {STATE_LINKS.map(({ label, href }) => (
              <li key={href}>
                <ExternalLink to={href} className="text-white/70 hover:text-white transition-colors text-xs">
                  {label}
                </ExternalLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="bg-accent text-accent-foreground py-4 px-4">
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <Image src="/logo_main.png" alt="Utah Geological Survey" className="h-12 w-auto" />
        <div>
          <h1 className="text-lg font-bold leading-tight">Utah Geological Survey</h1>
          <p className="text-sm text-accent-foreground/70">Interactive Maps & Data</p>
        </div>
        <nav aria-label="Main" className="ml-auto flex items-center gap-4 text-sm">
          <ExternalLink to="https://geology.utah.gov" className="text-accent-foreground/80 hover:text-accent-foreground hidden sm:inline transition-colors">
            geology.utah.gov
          </ExternalLink>
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section aria-label="Welcome" className="relative h-[50vh] min-h-[400px] overflow-hidden">
      <img src={heroBg} alt="Alstrom Point, Utah" className="absolute inset-0 w-full h-full object-cover" />
      <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col justify-end pb-12">
        <div className="bg-background/90 backdrop-blur-sm rounded-lg p-6 max-w-xl shadow-lg">
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest mb-2">Utah Geological Survey</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.1]">Explore Utah's Geology</h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            Interactive maps and data for hazards, energy, minerals, and natural resources across the state.
          </p>
        </div>
      </div>
    </section>
  )
}

function ImageCreditOverlay({ imageCredit }: { imageCredit: ImageCredit }) {
  return (
    <div className="absolute bottom-0 inset-x-0 z-20 bg-black/70 px-2.5 py-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={imageCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block truncate text-[10px] text-white hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
            >
              Image: {imageCredit.article}
            </a>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">
            Image: {imageCredit.article}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

interface AppCardProps {
  title: string
  description: string
  image?: string
  imageCredit?: ImageCredit
  href: string
  external?: boolean
  status?: 'stable' | 'beta' | 'in-progress'
  featured?: boolean
}

function AppCard({ title, description, image, imageCredit, href, external, status, featured }: AppCardProps) {
  const linkClasses = "inline-flex items-center gap-1.5 mt-auto pt-4 text-sm font-semibold text-primary motion-safe:group-hover:gap-3 motion-safe:transition-all before:absolute before:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm motion-safe:transition-shadow motion-safe:hover:shadow-md">
      <div className={`relative w-full overflow-hidden ${featured ? 'h-48' : 'h-40'}`}>
        {image ? (
          <img
            src={image}
            alt={`${title} preview`}
            className="absolute inset-0 w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}
        {imageCredit && <ImageCreditOverlay imageCredit={imageCredit} />}
      </div>

      <div className={`flex flex-1 flex-col ${featured ? 'p-5' : 'p-4'}`}>
        {status && status !== 'stable' && (
          <Badge
            variant="outline"
            className={`text-xs mb-1.5 ${status === 'in-progress' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400' : ''}`}
          >
            {toTitleCase(status.replace('-', ' '))}
          </Badge>
        )}
        <h3 className={`font-bold text-foreground leading-tight ${featured ? 'text-lg' : 'text-base'}`}>{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
        {external ? (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${title}`} className={linkClasses}>
            Visit <ExternalLinkIcon aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        ) : (
          <Link to={href} aria-label={`Open ${title}`} className={linkClasses}>
            Open map <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}

interface AppSectionProps {
  id: string
  heading: string
  description: string
  children: React.ReactNode
  className?: string
}

function AppSection({ id, heading, description, children, className }: AppSectionProps) {
  return (
    <section aria-labelledby={id} className={className}>
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <h2 id={id} className="text-2xl font-bold text-foreground mb-2">{heading}</h2>
        <p className="text-muted-foreground mb-8 max-w-2xl">{description}</p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      </div>
    </section>
  )
}

function CategoryFilter({ active, onChange }: { active: AppCategory | null, onChange: (cat: AppCategory | null) => void }) {
  const chipClass = (isActive: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${isActive ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:bg-accent/50'}`

  return (
    <div className="max-w-6xl mx-auto px-4 pt-10 md:pt-14">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button onClick={() => onChange(null)} className={chipClass(active === null)}>All</button>
        {APP_CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => onChange(active === cat ? null : cat)} className={chipClass(active === cat)}>
            {cat}
          </button>
        ))}
      </div>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="bg-accent text-accent-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Image src="/logo_main.png" alt="Utah Geological Survey" className="h-10 w-auto" />
              <h4 className="font-semibold leading-tight">Utah Geological Survey</h4>
            </div>
            <p className="text-sm text-accent-foreground/80 leading-relaxed mb-3">
              The UGS provides timely scientific information about Utah's geologic environment, resources, and hazards. A division of the Utah Department of Natural Resources.
            </p>
            <ExternalLink to="https://geology.utah.gov" className="inline-flex items-center gap-1 text-sm text-accent-foreground/80 hover:text-accent-foreground font-medium">
              geology.utah.gov <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </ExternalLink>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <address className="not-italic text-sm text-accent-foreground/80 space-y-2">
              <p className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0" />
                <span>1594 West North Temple, Suite 3110<br />Salt Lake City, Utah 84116</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                <a href="tel:+18015373300" className="hover:underline">801-537-3300</a>
              </p>
            </address>
          </div>

          <nav aria-label="Resources">
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="text-sm text-accent-foreground/80 space-y-1.5">
              {RESOURCE_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <ExternalLink to={href} className="text-accent-foreground/80 hover:text-accent-foreground text-sm">{label}</ExternalLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-6 pt-4 border-t border-accent-foreground/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <SocialLinks iconClassName="h-5 w-5 text-accent-foreground/60 hover:text-accent-foreground transition-colors" />
          <p className="text-xs text-accent-foreground/70">&copy; {new Date().getFullYear()} Utah Geological Survey</p>
        </div>
      </div>
    </footer>
  )
}

function matchesCategory(categories: AppCategory[] | undefined, filter: AppCategory | null): boolean {
  if (!filter) return true
  return categories?.includes(filter) ?? false
}

export function LandingPage() {
  const [categoryFilter, setCategoryFilter] = useState<AppCategory | null>(null)

  const filteredPortals = portals.filter((p) => matchesCategory(p.categories, categoryFilter))
  const filteredLegacy = legacyApps.filter((a) => matchesCategory(a.categories, categoryFilter))
  const filteredStoryMaps = storyMaps.filter((a) => matchesCategory(a.categories, categoryFilter))

  return (
    <div className="landing h-full flex flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <Hero />
        <CategoryFilter active={categoryFilter} onChange={setCategoryFilter} />
        {filteredPortals.length > 0 && (
          <AppSection id="new-maps-heading" heading="New Interactive Maps" description="Access geologic data through our suite of interactive mapping tools, built for planners, researchers, industry professionals, and the public.">
            {filteredPortals.map((p) => (
              <AppCard key={p.href} title={p.title} description={p.description} image={p.image} imageCredit={p.imageCredit} href={p.href} status={p.status} featured />
            ))}
          </AppSection>
        )}
        {filteredLegacy.length > 0 && (
          <AppSection id="legacy-maps-heading" heading="Interactive Maps" description="Discover additional mapped content through these interactive web applications. Take a virtual tour of Utah geology, find rockhounding destinations, or access databases of field data." className="bg-muted/50 border-t border-border">
            {filteredLegacy.map((a) => <AppCard key={a.href} title={a.title} description={a.description} image={a.image} imageCredit={a.imageCredit} href={a.href} external />)}
          </AppSection>
        )}
        {filteredStoryMaps.length > 0 && (
          <AppSection id="storymaps-heading" heading="StoryMaps & Tours" description="Explore narrative-driven guides, virtual tours, and in-depth photo essays about Utah's geology and natural history." className="border-t border-border">
            {filteredStoryMaps.map((a) => <AppCard key={a.href} title={a.title} description={a.description} image={a.image} imageCredit={a.imageCredit} href={a.href} external />)}
          </AppSection>
        )}
      </main>
      <SiteFooter />
      <StateBar />
    </div>
  )
}
