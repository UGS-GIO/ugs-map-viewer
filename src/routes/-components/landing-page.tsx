import { Link } from '@tanstack/react-router'
import { Link as ExternalLink } from '@/components/ui/link'
import { Badge } from '@/components/ui/badge'
import { Image } from '@/components/ui/image'
import { SocialLinks } from '@/components/social-links'
import { portals } from '@/routes/-data/portal-config'
import ThemeSwitch from '@/components/theme-switch'
import { ArrowRight, MapPin, Phone } from 'lucide-react'
import heroBg from '@/assets/geologic-hazards-banner-alstrom-point-1920px.webp'

function StateBar() {
  return (
    <div className="bg-accent text-accent-foreground text-xs py-1.5 px-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <span>An official website of the State of Utah</span>
        <ExternalLink
          to="https://utah.gov"
          className="text-accent-foreground/80 hover:text-accent-foreground text-xs"
        >
          utah.gov
        </ExternalLink>
      </div>
    </div>
  )
}

function SiteHeader() {
  return (
    <header className="bg-background border-b border-border py-4 px-4">
      <div className="max-w-6xl mx-auto flex items-center gap-4">
        <Image
          src="/logo_main.png"
          alt="Utah Geological Survey"
          className="h-12 w-auto"
        />
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">
            Utah Geological Survey
          </h1>
          <p className="text-sm text-muted-foreground">Interactive Maps & Data</p>
        </div>
        <nav aria-label="Main" className="ml-auto flex items-center gap-4 text-sm">
          <ExternalLink
            to="https://geology.utah.gov"
            className="text-muted-foreground hover:text-primary hidden sm:inline"
          >
            Main Site
          </ExternalLink>
          <ExternalLink
            to="https://geology.utah.gov/about/"
            className="text-muted-foreground hover:text-primary hidden sm:inline"
          >
            About UGS
          </ExternalLink>
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section aria-label="Hero" className="relative h-[50vh] min-h-[400px] overflow-hidden">
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover motion-safe:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
      <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col justify-end pb-12">
        <p className="text-primary-foreground/70 text-sm font-semibold uppercase tracking-widest mb-2">
          Utah Geological Survey
        </p>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white max-w-2xl leading-[1.1]">
          Explore Utah's Geology
        </h2>
        <p className="mt-4 text-lg sm:text-xl text-white/80 max-w-lg">
          Interactive maps and data for hazards, energy, minerals, and natural resources across the state.
        </p>
      </div>
    </section>
  )
}

function PortalCard({ portal, featured }: { portal: typeof portals[number]; featured?: boolean }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-lg ${featured ? 'md:col-span-2 md:row-span-2' : ''}`}
    >
      <div className={`relative ${featured ? 'h-80 md:h-full' : 'h-64'} w-full`}>
        {portal.image ? (
          <img
            src={portal.image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {portal.imageCredit && (
          <a
            href={portal.imageCredit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 z-10 text-[10px] text-white/50 hover:text-white/80 bg-black/30 hover:bg-black/50 backdrop-blur-sm rounded px-1.5 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
          >
            Image: {portal.imageCredit.article}
          </a>
        )}

        <div className="relative h-full flex flex-col justify-end p-6">
          <div className="flex items-center gap-2 mb-2">
            {portal.status === 'beta' && (
              <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs backdrop-blur-sm">
                Beta
              </Badge>
            )}
            {portal.status === 'in-progress' && (
              <Badge variant="outline" className="bg-amber-500/20 border-amber-400/40 text-amber-100 text-xs backdrop-blur-sm">
                In Progress
              </Badge>
            )}
          </div>
          <h3 className={`font-bold text-white leading-tight ${featured ? 'text-2xl md:text-3xl' : 'text-xl'}`}>
            {portal.title}
          </h3>
          <p className={`mt-2 text-white/70 leading-relaxed line-clamp-2 ${featured ? 'text-base' : 'text-sm'}`}>
            {portal.description}
          </p>
          <Link
            to={portal.href}
            className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-white motion-safe:group-hover:gap-3 motion-safe:transition-all before:absolute before:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Open map <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

function PortalCards() {
  const [first, ...rest] = portals

  return (
    <section aria-labelledby="map-apps-heading" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <h3 id="map-apps-heading" className="text-2xl font-bold text-foreground mb-2">
        Map Applications
      </h3>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Access geologic data through our suite of interactive mapping tools, built for planners, researchers, industry professionals, and the public.
      </p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-auto">
        <PortalCard portal={first} featured />
        {rest.map((portal) => (
          <PortalCard key={portal.href} portal={portal} />
        ))}
      </div>
    </section>
  )
}

function About() {
  return (
    <section aria-labelledby="about-heading" className="bg-muted border-t border-border">
      <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <div className="max-w-2xl">
          <h3 id="about-heading" className="text-2xl font-bold text-foreground mb-4">
            About the Utah Geological Survey
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The Utah Geological Survey (UGS) provides timely scientific information about Utah's geologic environment, resources, and hazards. As a division of the Utah Department of Natural Resources, the UGS serves the citizens of Utah and the scientific community through geologic mapping, applied research, and public outreach.
          </p>
          <ExternalLink
            to="https://geology.utah.gov"
            className="inline-flex items-center gap-1 text-primary font-medium"
          >
            Visit geology.utah.gov <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </ExternalLink>
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="bg-accent text-accent-foreground">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <h4 className="font-semibold mb-3">Contact</h4>
            <address className="not-italic text-sm text-accent-foreground/80 space-y-2">
              <p className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="h-4 w-4 mt-0.5 shrink-0" />
                1594 West North Temple, Suite 3110
                <br />
                Salt Lake City, Utah 84116
              </p>
              <p className="flex items-center gap-2">
                <Phone aria-hidden="true" className="h-4 w-4 shrink-0" />
                <a href="tel:+18015373300" className="hover:underline">
                  801-537-3300
                </a>
              </p>
            </address>
          </div>

          <nav aria-label="Resources">
            <h4 className="font-semibold mb-3">Resources</h4>
            <ul className="text-sm text-accent-foreground/80 space-y-1.5">
              <li>
                <ExternalLink to="https://geology.utah.gov" className="text-accent-foreground/80 hover:text-accent-foreground text-sm">
                  Utah Geological Survey
                </ExternalLink>
              </li>
              <li>
                <ExternalLink to="https://naturalresources.utah.gov" className="text-accent-foreground/80 hover:text-accent-foreground text-sm">
                  Department of Natural Resources
                </ExternalLink>
              </li>
              <li>
                <ExternalLink to="https://utah.gov" className="text-accent-foreground/80 hover:text-accent-foreground text-sm">
                  Utah.gov
                </ExternalLink>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal">
            <h4 className="font-semibold mb-3">Legal</h4>
            <ul className="text-sm text-accent-foreground/80 space-y-1.5">
              <li>
                <ExternalLink to="https://www.utah.gov/support/accessibility.html" className="text-accent-foreground/80 hover:text-accent-foreground text-sm">
                  Nondiscrimination & Accessibility
                </ExternalLink>
              </li>
              <li>
                <ExternalLink to="https://www.utah.gov/support/privacypolicy.html" className="text-accent-foreground/80 hover:text-accent-foreground text-sm">
                  Privacy Policy
                </ExternalLink>
              </li>
              <li>
                <ExternalLink to="https://www.utah.gov/support/disclaimer.html" className="text-accent-foreground/80 hover:text-accent-foreground text-sm">
                  Disclaimer
                </ExternalLink>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-accent-foreground/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <SocialLinks
            iconClassName="h-5 w-5 text-accent-foreground/60 hover:text-accent-foreground transition-colors"
          />
          <p className="text-xs text-accent-foreground/70">
            &copy; {new Date().getFullYear()} Utah Geological Survey
          </p>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="landing h-full overflow-y-auto flex flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <StateBar />
      <SiteHeader />
      <main id="main-content" className="flex-1">
        <Hero />
        <PortalCards />
        <About />
      </main>
      <SiteFooter />
    </div>
  )
}
