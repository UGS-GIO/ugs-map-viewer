import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Layout } from '@/components/layout/layout'

export const Route = createFileRoute('/_report')({
  component: ReportRootLayout,
})

function ReportRootLayout() {
  return (
    <Layout className="h-screen">
      <Outlet />
    </Layout>
  )
}