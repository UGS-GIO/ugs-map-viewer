import { Ruler } from 'lucide-react'
import Measure from './measure'

/** The Measure sidebar tab, shared by every app. */
export const measureSidelink = {
  title: 'Measure',
  label: '',
  icon: <Ruler className='stroke-foreground' />,
  component: Measure,
}
