import { portalMeta as hazardsMeta } from '@/routes/_map/hazards/-data/page-info'
import { portalMeta as carbonMeta } from '@/routes/_map/carbonstorage/-data/page-info'
import { portalMeta as geophysicsMeta } from '@/routes/_map/geophysics/-data/page-info'
import { portalMeta as mineralsMeta } from '@/routes/_map/minerals/-data/page-info'
import { portalMeta as wetlandsMeta } from '@/routes/_map/wetlands/-data/page-info'
import { portalMeta as wetlandplantsMeta } from '@/routes/_map/wetlandplants/-data/page-info'
import { portalMeta as hazardsReviewMeta } from '@/routes/_map/hazards-review/-data/page-info'

export interface ImageCredit {
  author?: string
  article: string
  url: string
}

export interface PortalMeta {
  title: string
  description: string
  href: string
  status: 'stable' | 'beta'
  public: boolean
  image?: string
  imageCredit?: ImageCredit
}

const allPortals: PortalMeta[] = [
  hazardsMeta,
  carbonMeta,
  geophysicsMeta,
  mineralsMeta,
  wetlandsMeta,
  wetlandplantsMeta,
  hazardsReviewMeta,
]

export const portals = allPortals.filter((p) => p.public)
