import { Link } from "@/components/ui/link"
import { SocialLinks } from "@/components/social-links"
import { MapCoordinates } from "@/components/maps/map-coordinates"
import { ShoppingCart } from "lucide-react"

const LEGAL_LINKS = [
    { href: "https://dts.utah.gov/accessibility", label: "Accessibility" },
    { href: "https://www.utah.gov/support/privacypolicy.html", label: "Privacy" },
    { href: "https://www.utah.gov/support/disclaimer.html", label: "Terms" },
]

const MapFooter = () => {
    return (
        <>
            <div className="flex min-w-0 items-center gap-x-2 overflow-hidden" data-tour="footer-links">
                <Link to="https://geology.utah.gov/" variant='foreground' className="hidden shrink-0 whitespace-nowrap 2xl:block">
                    <span className="text-xs md:text-sm text-muted-foreground">Utah Geological Survey</span>
                </Link>
                <div className="hidden h-4 w-px shrink-0 bg-border 2xl:block" aria-hidden="true" />
                <SocialLinks
                    className="shrink-0 space-x-1 gap-0 md:space-x-1.5"
                    iconClassName="stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4"
                    githubUrl="https://github.com/UGS-GIO/ugs-map-viewer"
                />
                <Link to="https://utahmapstore.com/" className="shrink-0">
                    <span className="sr-only">Utah Map Store</span>
                    <ShoppingCart className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                </Link>
                <div className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
                <div className="flex shrink-0 items-center gap-x-2 whitespace-nowrap">
                    <span className="hidden text-xs text-muted-foreground xl:inline">&copy; State of Utah</span>
                    {LEGAL_LINKS.map(({ href, label }) => (
                        <Link key={label} to={href} variant='foreground'>
                            <span className="text-xs text-muted-foreground hover:text-foreground">{label}</span>
                        </Link>
                    ))}
                </div>
            </div>
            <MapCoordinates />
        </>
    )
}

export { MapFooter }
