import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'
import { ErrorPage } from '@/components/error-page'

const NotFoundComponent = () => {
    return (
        <ErrorPage>
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
            <p className="mb-6 text-center text-sm text-foreground/90">
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
        </ErrorPage>
    )
}

export const Route = createFileRoute('/$')({
    component: NotFoundComponent,
})
