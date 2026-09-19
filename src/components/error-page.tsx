import { ReactNode } from 'react';

/**
 * Full-viewport centered card for terminal states (404, route errors). Owns its own
 * scroller because #root is overflow: clip; min-h-full on the centered flex lets a tall
 * card scroll instead of being clipped by align-items: center on a short viewport.
 */
export function ErrorPage({ children }: { children: ReactNode }) {
    return (
        <div className="h-full overflow-y-auto">
            <div className="flex min-h-full w-full items-center justify-center bg-background px-4">
                <div className="w-full max-w-md">
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
