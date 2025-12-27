import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-16 w-16',
}

/**
 * Inline spinner - use directly in buttons or next to text
 */
export function Spinner({ className, size = 'sm' }: SpinnerProps) {
    return (
        <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
    )
}

interface LoadingOverlayProps {
    className?: string
    size?: 'sm' | 'md' | 'lg'
    /** Show semi-transparent backdrop */
    backdrop?: boolean
}

/**
 * Centered loading overlay - use for loading states over content
 */
export function LoadingOverlay({ className, size = 'md', backdrop = true }: LoadingOverlayProps) {
    return (
        <div className={cn(
            'absolute inset-0 flex items-center justify-center z-10',
            backdrop && 'bg-background/50',
            className
        )}>
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
        </div>
    )
}