import { cn } from "@/lib/utils";
import { Link as RouterLink } from "@tanstack/react-router";
import { cva, type VariantProps } from 'class-variance-authority';

// Define link variants using cva
const linkVariants = cva(
    'p-0 hover:underline', // Default styles
    {
        variants: {
            variant: {
                // Underlined, not just recoloured: inside a paragraph, colour alone is not enough
                // to mark a link (WCAG 1.4.1).
                primary: 'text-link underline underline-offset-4',
                foreground: 'text-foreground', // Uses your CSS variable for foreground
            },
        },
        defaultVariants: {
            variant: 'primary', // Default variant is primary
        },
    }
);

type LinkProps = {
    to: string;
    className?: string;
    children: React.ReactNode;
    variant?: VariantProps<typeof linkVariants>['variant']; // Include variant as a prop
    target?: React.HTMLAttributeAnchorTarget;
    rel?: string;
};

const isExternal = (to: string) => /^[a-z][a-z0-9+.-]*:/i.test(to);

/** In-app routes navigate in place; only off-site links open a tab. */
const Link = ({ children, variant, className, target, rel, ...props }: LinkProps) => {
    const external = isExternal(props.to);

    return (
        <RouterLink
            className={cn(linkVariants({ variant }), className)}
            target={target ?? (external ? '_blank' : undefined)}
            rel={rel ?? (external ? 'noopener noreferrer' : undefined)}
            {...props}
        >
            {children}
        </RouterLink>
    );
};

export { Link };
