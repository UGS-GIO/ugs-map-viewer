import { FileText, House, Info as InfoIcon, Layers as LayersIcon, MessageSquare, Ruler, Settings } from 'lucide-react'
import Info from '@/components/sidebar/info'
import Layers from '@/components/sidebar/layers'
import Measure from '@/components/sidebar/measure'
import MapConfigurations from '../-components/sidebar/map-configurations/map-configurations'
import ReportGenerator from '../-components/sidebar/report-generator'
export interface NavLink {
  title: string
  label?: string
  href?: string
  icon: JSX.Element
  component?: () => JSX.Element
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
    component: () => <Layers disableExport />,
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
  {
    title: 'Measure',
    label: '',
    icon: <Ruler className='stroke-foreground' />,
    component: Measure,
  },
  {
    title: 'Report Generator',
    label: '',
    icon: <FileText className='stroke-foreground' />,
    component: ReportGenerator,
  },
  {
    title: 'Feedback',
    label: '',
    href: 'https://forms.gle/RnwEi6a92grdqqFk9',
    icon: <MessageSquare className='text-ring' />,
  }
];
