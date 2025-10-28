import { Button } from '@/components/ui/button';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';

interface RouteErrorBoundaryProps {
    error: Error;
}

/**
 * RouteErrorBoundary - Displays errors that occur during route loading or rendering
 * Used as the errorComponent for TanStack Router routes
 */
export function RouteErrorBoundary({ error }: RouteErrorBoundaryProps) {
    const isNotFound = error instanceof Error && error.message.includes('404');
    const rawErrorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const errorDetails = error instanceof Error ? error.stack : '';

    // Map error messages to human-readable descriptions
    const getErrorInfo = () => {
        if (isNotFound) {
            return {
                title: 'Page Not Found',
                message: 'The page you\'re looking for doesn\'t exist. It may have been moved or deleted.',
            };
        }

        if (rawErrorMessage.toLowerCase().includes('network') || rawErrorMessage.toLowerCase().includes('fetch')) {
            return {
                title: 'Connection Error',
                message: 'Unable to connect to the server. Please check your internet connection and try again.',
            };
        }

        if (rawErrorMessage.toLowerCase().includes('auth') || rawErrorMessage.toLowerCase().includes('unauthorized')) {
            return {
                title: 'Access Denied',
                message: 'You don\'t have permission to access this page. Please log in or contact support.',
            };
        }

        if (rawErrorMessage.toLowerCase().includes('timeout')) {
            return {
                title: 'Request Timed Out',
                message: 'The request took too long to complete. Please try again.',
            };
        }

        return {
            title: 'Something Went Wrong',
            message: 'An unexpected error occurred while loading this page. Please try again or contact support if the problem persists.',
        };
    };

    const { title, message } = getErrorInfo();

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
                    {/* Error Icon */}
                    <div className="mb-4 flex justify-center">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>

                    {/* Error Title */}
                    <h1 className="mb-2 text-center text-xl font-bold text-foreground">
                        {title}
                    </h1>

                    {/* Error Message */}
                    <p className="mb-4 text-center text-sm text-muted-foreground">
                        {message}
                    </p>

                    {/* Error Details (Dev mode) */}
                    {process.env.NODE_ENV === 'development' && rawErrorMessage && (
                        <div className="mb-4 rounded bg-muted p-3">
                            <p className="text-xs font-mono text-muted-foreground">
                                {rawErrorMessage}
                            </p>
                            {errorDetails && (
                                <details className="mt-2">
                                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                                        Stack trace
                                    </summary>
                                    <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                                        {errorDetails}
                                    </pre>
                                </details>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => window.history.back()}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Go Back
                        </Button>
                        <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => window.location.href = '/'}
                        >
                            <Home className="mr-2 h-4 w-4" />
                            Home
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RouteErrorBoundary;
