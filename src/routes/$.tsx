import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'

const NotFoundComponent = () => {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background px-4">
            <div className="w-full max-w-md">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6">
                    {/* 404 Icon */}
                    <div className="mb-4 flex justify-center">
                        <AlertCircle className="h-12 w-12 text-destructive" />
                    </div>

                    {/* Error Title */}
                    <h1 className="mb-2 text-center text-3xl font-bold text-foreground">
                        404
                    </h1>

                    {/* Error Message */}
                    <p className="mb-2 text-center text-sm font-semibold text-foreground">
                        Page Not Found
                    </p>
                    <p className="mb-6 text-center text-sm text-muted-foreground">
                        The page you are looking for does not exist or has been moved.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-3">
                        <Button
                            asChild
                            className="w-full"
                        >
                            <Link to="/">
                                <Home className="mr-2 h-4 w-4" />
                                Back to Home
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => window.history.back()}
                        >
                            Go Back
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export const Route = createFileRoute('/$')({
    component: NotFoundComponent,
})
