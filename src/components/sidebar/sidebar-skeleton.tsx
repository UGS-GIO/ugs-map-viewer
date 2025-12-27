import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '../custom/loading-spinner';

interface NavSkeletonProps {
    className?: string;
}

export function NavSkeleton({ className }: NavSkeletonProps) {
    return (
        <div className={cn('flex flex-1 overflow-hidden', className)}>
            {/* Skeleton for the Left Icon Bar (Desktop) */}
            <div className='hidden md:flex flex-col items-center gap-4 pt-2 border-r p-2'>
                {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className='h-10 w-10 rounded' />
                ))}
            </div>

            {/* Skeleton for the Right Content/Links Area */}
            <div className='w-full p-4 md:py-2 md:px-6'>
                <Spinner className='my-20 mx-auto' />
            </div>
        </div>
    );
}