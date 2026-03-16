import { Link } from '@tanstack/react-router'
import { Link as ExternalLink } from '@/components/ui/link'
import { Badge } from '@/components/ui/badge'
import { Image } from '@/components/ui/image'
import { SocialLinks } from '@/components/social-links'
import { portals } from '@/routes/-data/portal-config'
import ThemeSwitch from '@/components/theme-switch'
import { ArrowRight, MapPin, Phone } from 'lucide-react'
import heroBg from '@/assets/geologic-hazards-banner-alstrom-point-1920px.webp'

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
            <li>
              <ExternalLink to="https://www.utah.gov/index.html" className="text-white/70 hover:text-white transition-colors text-xs">
                Utah.gov Home
              </ExternalLink>
            </li>
            <li>
              <ExternalLink to="https://www.utah.gov/support/disclaimer.html" className="text-white/70 hover:text-white transition-colors text-xs">
                Terms of Use
              </ExternalLink>
            </li>
            <li>
              <ExternalLink to="https://www.utah.gov/support/privacypolicy.html" className="text-white/70 hover:text-white transition-colors text-xs">
                Privacy Policy
              </ExternalLink>
            </li>
            <li>
              <ExternalLink to="https://www.utah.gov/support/accessibility.html" className="text-white/70 hover:text-white transition-colors text-xs">
                Accessibility
              </ExternalLink>
            </li>
            <li>
              <ExternalLink to="https://www.utah.gov/support/translate.html" className="text-white/70 hover:text-white transition-colors text-xs">
                Translate
              </ExternalLink>
            </li>
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
        <Image
          src="/logo_main.png"
          alt="Utah Geological Survey"
          className="h-12 w-auto"
        />
        <div>
          <h1 className="text-lg font-bold leading-tight">
            Utah Geological Survey
          </h1>
          <p className="text-sm text-accent-foreground/70">Interactive Maps & Data</p>
        </div>
        <nav aria-label="Main" className="ml-auto flex items-center gap-4 text-sm">
          <ExternalLink
            to="https://geology.utah.gov"
            className="text-accent-foreground/80 hover:text-accent-foreground hidden sm:inline transition-colors"
          >
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
      <img
        src={heroBg}
        alt="Alstrom Point, Utah"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="relative h-full max-w-6xl mx-auto px-4 flex flex-col justify-end pb-12">
        <div className="bg-background/90 backdrop-blur-sm rounded-lg p-6 max-w-xl shadow-lg">
          <p className="text-muted-foreground text-sm font-semibold uppercase tracking-widest mb-2">
            Utah Geological Survey
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground leading-[1.1]">
            Explore Utah's Geology
          </h2>
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            Interactive maps and data for hazards, energy, minerals, and natural resources across the state.
          </p>
        </div>
      </div>
    </section>
  )
}

function PortalCard({ portal }: { portal: typeof portals[number] }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm motion-safe:transition-shadow motion-safe:hover:shadow-md">
      <div className="relative h-48 w-full overflow-hidden">
        {portal.image ? (
          <img
            src={portal.image}
            alt={`${portal.title} preview`}
            className="absolute inset-0 w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-secondary" />
        )}

        {portal.imageCredit && (
          <div className="absolute bottom-0 inset-x-0 z-20 bg-black/70 px-2.5 py-1">
            <a
              href={portal.imageCredit.url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative text-[10px] text-white hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
            >
              Image: {portal.imageCredit.article}
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 mb-1.5">
          {portal.status === 'beta' && (
            <Badge variant="outline" className="text-xs">
              Beta
            </Badge>
          )}
          {portal.status === 'in-progress' && (
            <Badge variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
              In Progress
            </Badge>
          )}
        </div>
        <h3 className="text-lg font-bold text-foreground leading-tight">
          {portal.title}
        </h3>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed line-clamp-2">
          {portal.description}
        </p>
        <Link
          to={portal.href}
          aria-label={`Open ${portal.title}`}
          className="inline-flex items-center gap-1.5 mt-auto pt-4 text-sm font-semibold text-primary motion-safe:group-hover:gap-3 motion-safe:transition-all before:absolute before:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Open map <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

function PortalCards() {
  return (
    <section aria-labelledby="map-apps-heading" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <h2 id="map-apps-heading" className="text-2xl font-bold text-foreground mb-2">
        Map Applications
      </h2>
      <p className="text-muted-foreground mb-8 max-w-2xl">
        Access geologic data through our suite of interactive mapping tools, built for planners, researchers, industry professionals, and the public.
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {portals.map((portal) => (
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
          <h2 id="about-heading" className="text-2xl font-bold text-foreground mb-4">
            About the Utah Geological Survey
          </h2>
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
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid gap-8 sm:grid-cols-2">
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
            </ul>
          </nav>

        </div>

        <div className="mt-4 pt-4 border-t border-accent-foreground/20 flex flex-col sm:flex-row items-center justify-between gap-4">
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
        <PortalCards />
        <About />
      </main>
      <SiteFooter />
      <StateBar />
    </div>
  )
}
