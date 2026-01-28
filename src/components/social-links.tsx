import { Link } from "@/components/ui/link";
import { FacebookIcon, InstagramIcon, XIcon, LinkedinIcon, GithubIcon } from "@/assets/social-icons";
import { cn } from "@/lib/utils";

interface SocialLinksProps {
    className?: string;
    iconClassName?: string;
    githubUrl?: string;
}

export const SocialLinks = ({
    className,
    iconClassName = "h-4 w-4 text-muted-foreground hover:text-foreground transition-colors",
    githubUrl = "https://github.com/UGS-GIO"
}: SocialLinksProps) => {
    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            <Link to="https://www.facebook.com/pages/Utah-Geological-Survey/251490738585">
                <FacebookIcon className={iconClassName} />
                <span className="sr-only">Facebook</span>
            </Link>
            <Link to="https://x.com/utahgeological">
                <XIcon className={iconClassName} />
                <span className="sr-only">X</span>
            </Link>
            <Link to="https://www.instagram.com/utahgeologicalsurvey/">
                <InstagramIcon className={iconClassName} />
                <span className="sr-only">Instagram</span>
            </Link>
            <Link to="http://www.linkedin.com/company/utah-geological-survey">
                <LinkedinIcon className={iconClassName} />
                <span className="sr-only">LinkedIn</span>
            </Link>
            <Link to={githubUrl}>
                <GithubIcon className={iconClassName} />
                <span className="sr-only">GitHub</span>
            </Link>
        </div>
    );
};
