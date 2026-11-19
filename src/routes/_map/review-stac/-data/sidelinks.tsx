import { House, Info as InfoIcon, Layers as LayersIcon, MessageSquare, Settings } from 'lucide-react'
import Info from '@/components/sidebar/info'
import MapConfigurations from '@/routes/_map/hazards-review/-components/sidebar/map-configurations/map-configurations'
import ReviewPanel from '@/routes/_map/hazards-review/-components/sidebar/review/review-panel'
import { ReviewStacLayers } from '../-components/review-stac-layers'

export interface NavLink {
  title: string
  label?: string
  href?: string
  icon: JSX.Element
  component?: React.ComponentType
  componentPath?: string
}

export interface SideLink extends NavLink {
  sub?: NavLink[]
}

export const sidelinks: SideLink[] = [
  {
    title: 'Home',
    label: '',
    icon: <House className='stroke-foreground' />,
  },
  {
    title: 'Info',
    label: '',
    icon: <InfoIcon className='stroke-foreground' />,
    component: Info,
  },
  {
    title: 'Layers',
    label: '',
    icon: <LayersIcon className='stroke-foreground' />,
    component: ReviewStacLayers,
  },
  {
    title: 'Review Comments',
    label: '',
    icon: <MessageSquare className='stroke-foreground' />,
    component: ReviewPanel,
  },
  {
    title: 'Map Configurations',
    label: '',
    icon: <Settings className='stroke-foreground' />,
    component: MapConfigurations,
  },
]
