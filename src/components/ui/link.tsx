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
};

const Link = ({ children, variant, className, ...props }: LinkProps) => {

    return (
        <RouterLink
            className={cn(linkVariants({ variant }), className)}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
        >
            {children}
        </RouterLink>
    );
};

export { Link };
