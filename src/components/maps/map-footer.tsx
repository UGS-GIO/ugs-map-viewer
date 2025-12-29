import { Link } from "@/components/ui/link"
import { FacebookIcon, InstagramIcon, XIcon, LinkedinIcon, GithubIcon } from "@/assets/social-icons"
import { MapCoordinates } from "@/components/maps/map-coordinates"
import { ShoppingCart } from "lucide-react"

const MapFooter = () => {
    return (
        <>
            <div className="flex items-center space-x-1 md:space-x-1.5 xl:space-x-2">
                <Link to="https://geology.utah.gov/" variant='foreground' className="hidden xl:block">
                    <span className="text-sm font-medium">Utah Geological Survey</span>
                </Link>
                <div className="hidden xl:block h-4 w-px bg-border" aria-hidden="true" />
                <div className="flex items-center space-x-1 md:space-x-1.5">
                    <Link to="https://www.facebook.com/pages/Utah-Geological-Survey/251490738585">
                        <FacebookIcon className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                        <span className="sr-only">Facebook</span>
                    </Link>
                    <Link to="https://x.com/utahgeological">
                        <XIcon className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                        <span className="sr-only">X</span>
                    </Link>
                    <Link to="https://www.instagram.com/utahgeologicalsurvey/">
                        <InstagramIcon className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                        <span className="sr-only">Instagram</span>
                    </Link>
                    <Link to="http://www.linkedin.com/company/utah-geological-survey">
                        <span className="sr-only">LinkedIn</span>
                        <LinkedinIcon className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                    </Link>
                    <Link to="https://github.com/UGS-GIO/ugs-map-viewer">
                        <GithubIcon className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                        <span className="sr-only">GitHub</span>
                    </Link>
                    <Link to="https://utahmapstore.com/">
                        <span className="sr-only">Utah Geological Survey</span>
                        <ShoppingCart className='stroke-foreground h-3.5 w-3.5 md:h-4 md:w-4' />
                    </Link>
                </div>
            </div>
            <MapCoordinates />
        </>
    )
}

export { MapFooter }