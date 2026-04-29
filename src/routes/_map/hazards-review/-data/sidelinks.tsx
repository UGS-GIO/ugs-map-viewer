import { House, Info as InfoIcon, Layers as LayersIcon, Settings, BarChart3 } from 'lucide-react'
import Info from '@/components/sidebar/info'
import MapConfigurations from '../-components/sidebar/map-configurations/map-configurations'
import { LayersWithReview } from '../-components/sidebar/layers/layers-with-review'
import { Insights } from '../-components/sidebar/insights/insights'
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
    component: Info, // Direct component reference
    componentPath: 'src/components/sidebar/info.tsx',
  },
  {
    title: 'Layers',
    label: '',
    icon: <LayersIcon className='stroke-foreground' />,
    component: LayersWithReview, // Direct component reference
  },
  {
    title: 'Insights',
    label: '',
    icon: <BarChart3 className='stroke-foreground' />,
    component: Insights,
  },
  {
    title: 'Map Configurations',
    label: '',
    icon: <Settings className='stroke-foreground' />,
    component: MapConfigurations, // Direct component reference
  },
  // {
  //   title: 'Geological Unit Search',
  //   label: '',
  //   icon: <Database />,
  //   component: GeologicalUnitSearch, // Direct component reference
  // },
];
