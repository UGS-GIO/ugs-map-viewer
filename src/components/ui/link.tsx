import { cn } from "@/lib/utils";
import { Link as RouterLink } from "@tanstack/react-router";
import { cva, type VariantProps } from 'class-variance-authority';

// Define link variants using cva
const linkVariants = cva(
    'p-0 hover:underline', // Default styles
    {
        variants: {
            variant: {
                primary: 'text-primary', // Uses your CSS variable for primary
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
