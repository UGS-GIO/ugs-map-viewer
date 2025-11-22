import { Layout } from '@/components/custom/layout'
import { ReactNode } from 'react'

interface ReportLayoutProps {
    header: ReactNode
    hero: ReactNode
    tabs?: ReactNode
    banner?: ReactNode
    children: ReactNode
    footer?: ReactNode
}

export function ReportLayout({
    header,
    hero,
    tabs,
    banner,
    children,
    footer,
}: ReportLayoutProps) {
    return (
        <>
            <Layout.Header sticky className='p-0'>
                {header}
            </Layout.Header>

            <Layout.Body className="overflow-y-auto">
                {/* Hero Section */}
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-b">
                    {hero}
                </div>

                {/* Tabs/Section Selectors */}
                {tabs && (
                    <div className="sticky top-0 z-20 bg-background border-b pt-1">
                        {tabs}
                    </div>
                )}

                {/* Banner Section */}
                <div className='flex justify-center m-2'>
                    {banner}
                </div>

                {/* Main Content */}
                <div className="container mx-auto py-6">
                    {children}
                </div>
            </Layout.Body>

            {footer && (
                <Layout.Footer>
                    {footer}
                </Layout.Footer>
            )}
        </>
    )
}