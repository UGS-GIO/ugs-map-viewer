import { LandingPage } from '@/routes/-components/landing-page'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: LandingPage,
})
