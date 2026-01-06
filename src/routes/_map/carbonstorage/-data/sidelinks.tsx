import { House, Info as InfoIcon, Layers as LayersIcon, Settings, ExternalLink, MessageSquare } from 'lucide-react'
import Info from '@/components/sidebar/info'
import Layers from '@/components/sidebar/layers'
import MapConfigurations from '../-components/sidebar/map-configurations/map-configurations'

export interface NavLink {
  title: string
  label?: string
  href?: string
  icon: JSX.Element
  component?: React.ComponentType;
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
    component: Layers, // Direct component reference
  },
  {
    title: 'Map Configurations',
    label: '',
    icon: <Settings className='stroke-foreground' />,
    component: MapConfigurations, // Direct component reference
  },
  {
    title: 'Learn More',
    label: '',
    href: 'https://geology.utah.gov/energy-minerals/ccus/',
    icon: <ExternalLink className='stroke-foreground' />,
    // This link is external and does not need a component
  },
  {
    title: 'Feedback',
    label: '',
    href: 'https://docs.google.com/forms/d/e/1FAIpQLSca4G-LogxiNrJUTTtlxyqMutgFVyh2jtNB-tozlQ4D4QOvPA/viewform',
    icon: <MessageSquare className='text-ring' />,
  }
];
