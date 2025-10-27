import { createLazyFileRoute } from '@tanstack/react-router'
import Map from '@/pages/wetlandplants'

export const Route = createLazyFileRoute('/_map/wetlandplants/')({
  component: () => <Map />,
})