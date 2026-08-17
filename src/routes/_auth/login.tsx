import { createFileRoute, stripSearchParams, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { useState } from 'react'
import { useAuth } from '@/context/auth-provider'
import { signInWithOIDC } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Shield } from 'lucide-react'
import { UgsLogo } from '@/components/ugs-logo'

const loginSearchSchema = z.object({
    redirectTo: z.string().optional(),
})

function LoginPage() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    const { redirectTo } = useSearch({ from: '/_auth/login' })
    const [isAuthenticating, setIsAuthenticating] = useState(false)
    const [authError, setAuthError] = useState<string | null>(null)

    if (!loading && user) {
        navigate({ to: redirectTo || '/hazards-review/' })
        return null
    }

    const handleLogin = async () => {
        if (isAuthenticating) return

        setIsAuthenticating(true)
        setAuthError(null)

        try {
            await signInWithOIDC()
            navigate({ to: redirectTo || '/hazards-review/' })
        } catch (error: unknown) {
            console.error('Login failed:', error)
            if (error && typeof error === 'object' && 'code' in error) {
                const authError = error as { code: string; message: string }
                if (authError.code === 'auth/popup-closed-by-user') {
                    setAuthError('Login was cancelled. Please try again.')
                } else if (authError.code === 'auth/popup-blocked') {
                    setAuthError('Popup was blocked by your browser. Please allow popups and try again.')
                } else {
                    setAuthError(`Login failed: ${authError.message || 'Unknown error'}`)
                }
            } else {
                setAuthError('Login failed: Unknown error occurred')
            }
            setIsAuthenticating(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-full">
                <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-center min-h-full bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <UgsLogo className="h-12 w-auto max-w-full" />
                    </div>
                    {/* The lockup already says "Utah Geological Survey" — the title
                        names the app instead of repeating the agency. */}
                    <CardTitle className="font-display text-2xl">Hazards Review Portal</CardTitle>
                    <CardDescription>Sign in to review and comment on hazard mapping.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                    <div className="text-center space-y-2">
                        <Shield className="h-8 w-8 mx-auto text-muted-foreground" />
                        <h3 className="text-lg font-semibold">Authentication Required</h3>
                        <p className="text-sm text-muted-foreground">
                            You need to sign in with Utah ID to access the Hazards Review section.
                        </p>
                    </div>

                    {authError && (
                        <Alert variant="destructive">
                            <AlertDescription>
                                <strong>Error:</strong> {authError}
                            </AlertDescription>
                        </Alert>
                    )}

                    <Button
                        onClick={handleLogin}
                        disabled={isAuthenticating}
                        className="w-full"
                        size="lg"
                    >
                        {isAuthenticating ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign in with Utah ID'
                        )}
                    </Button>

                    <div className="text-xs text-muted-foreground text-center space-y-1">
                        <p>This will open a popup window for authentication.</p>
                        <p>Please ensure popups are enabled for this site.</p>
                    </div>

                    {redirectTo && (
                        <Alert>
                            <AlertDescription className="overflow-hidden text-ellipsis break-words">
                                You will be redirected to:
                                <code className="bg-muted px-1 rounded text-xs break-all">
                                    {redirectTo}
                                </code>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export const Route = createFileRoute('/_auth/login')({
    component: LoginPage,
    validateSearch: loginSearchSchema,
    search: {
        // remove all search params
        middlewares: [stripSearchParams(true)],
    },
})

// /src/routes/_auth/login.tsx