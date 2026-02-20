import { Link } from "@/components/ui/link";
import { SocialLinks } from "@/components/social-links";

export const ReportFooter = () => {
    return (
        <div className="flex items-center justify-between w-full text-sm text-muted-foreground print:hidden">
            <SocialLinks />
            <Link
                to="https://geology.utah.gov/"
                className="hover:text-foreground transition-colors"
            >
                Utah Geological Survey
            </Link>
        </div>
    );
};