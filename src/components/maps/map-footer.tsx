import { Link } from "@/components/ui/link"
import { SocialLinks } from "@/components/social-links"
import { MapCoordinates } from "@/components/maps/map-coordinates"
import { ShoppingCart } from "lucide-react"

const MapFooter = () => {
    return (
        <>
            <div className="flex items-center space-x-1 md:space-x-1.5 xl:space-x-2" data-tour="footer-links">
                <Link to="https://geology.utah.gov/" variant='foreground' className="hidden xl:block">
                    <span className="text-xs md:text-sm text-muted-foreground">Utah Geological Survey</span>
                </Link>
                <div className="hidden xl:block h-4 w-px bg-border" aria-hidden="true" />
                <SocialLinks
                    className="space-x-1 md:space-x-1.5 gap-0"
                    iconClassName="stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4"
                    githubUrl="https://github.com/UGS-GIO/ugs-map-viewer"
                />
                <Link to="https://utahmapstore.com/">
                    <span className="sr-only">Utah Map Store</span>
                    <ShoppingCart className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                </Link>
            </div>
            <MapCoordinates />
        </>
    )
}

export { MapFooter }