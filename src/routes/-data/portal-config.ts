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

export type AppCategory =
  | 'Energy Resources'
  | 'Geologic + Topographic Maps'
  | 'Groundwater & Wetlands'
  | 'Hazards'
  | 'Minerals & Mining'
  | 'Popular Geology'

export const APP_CATEGORIES: AppCategory[] = [
  'Energy Resources',
  'Geologic + Topographic Maps',
  'Groundwater & Wetlands',
  'Hazards',
  'Minerals & Mining',
  'Popular Geology',
]

export interface AppEntry {
  title: string
  description: string
  href: string
  image?: string
  categories?: AppCategory[]
  imageCredit?: ImageCredit
  isNew?: boolean
  status?: 'stable' | 'beta' | 'in-progress'
  public?: boolean
}

const isProd = import.meta.env.MODE === 'production'

const UGS_UPLOADS = 'https://geology.utah.gov/wp-content/uploads'

const templateApps: AppEntry[] = ([
  { ...hazardsMeta, categories: ['Hazards'] },
  { ...carbonMeta, categories: ['Energy Resources'] },
  { ...geophysicsMeta, categories: ['Energy Resources', 'Hazards'] },
  { ...mineralsMeta, categories: ['Minerals & Mining'] },
  { ...wetlandsMeta, categories: ['Groundwater & Wetlands'] },
  { ...wetlandplantsMeta, categories: ['Groundwater & Wetlands'] },
  hazardsReviewMeta,
] satisfies AppEntry[])
  .filter((p) => p.public || !isProd)
  .map((p) => ({ ...p, isNew: true }))

const apps: AppEntry[] = [
  {
    title: 'Abandoned Coal Mine Maps',
    description: "For 58% of Utah's abandoned coal mines.",
    href: 'https://geology.utah.gov/?p=19461',
    image: `${UGS_UPLOADS}/Coal_Pile-710x375c.jpg`,
    categories: ['Minerals & Mining'],
    imageCredit: {
      article: "Glad You Asked: Is Utah's State Rock Good, Bad, or Ugly?",
      url: 'https://geology.utah.gov/map-pub/survey-notes/glad-you-asked/glad-you-asked-is-utahs-state-rock-good-bad-or-ugly/',
    },
  },
  {
    title: 'Aerial Imagery Collection',
    description: 'Aerial photographs and imagery of Utah.',
    href: 'https://imagery.geology.utah.gov/',
    image: `${UGS_UPLOADS}/AAL_1-321-710x375c.jpg`,
    categories: ['Hazards'],
  },
  {
    title: 'Geochronology Database',
    description: 'Rock and other geologic deposit ages.',
    href: 'https://geochron.geology.utah.gov',
    image: `${UGS_UPLOADS}/geo_hazards_fault_trench-710x375c.jpg`,
    categories: ['Hazards'],
    imageCredit: {
      article: 'Evaluating the seismic relation between the West Valley fault zone and Salt Lake City segment of the Wasatch fault zone',
      url: 'https://geology.utah.gov/map-pub/survey-notes/evaluating-the-seismic-relation-between-the-west-valley-fault-zone-and-salt-lake-city-segment-of-the-wasatch-fault-zone/',
    },
  },
  {
    title: 'Geologic Map Portal',
    description: 'Navigate and download Utah geologic maps.',
    href: 'https://geomap.geology.utah.gov/',
    image: `${UGS_UPLOADS}/Screen-Shot-2018-11-26-at-5.21.38-PM-710x375c.png`,
    categories: ['Geologic + Topographic Maps', 'Popular Geology'],
  },
  {
    title: 'Great Salt Lake Density and Chemistry Hub',
    description: 'Visualize sampling data and trends.',
    href: 'https://gsldata.geology.utah.gov',
    image: `${UGS_UPLOADS}/09-06-2013-September_Carole_McCalla_Antelope-Island8-710x375c.jpg`,
    categories: ['Minerals & Mining', 'Popular Geology'],
  },
  {
    title: 'Groundwater Monitoring Portal',
    description: 'Data from West Desert and Wasatch Front.',
    href: 'https://gwportal.geology.utah.gov',
    image: `${UGS_UPLOADS}/site07-1115-710x375c.jpg`,
    categories: ['Groundwater & Wetlands'],
  },
  {
    title: 'Non-Petroleum Well Data',
    description: 'Old paper data for wells drilled in Utah.',
    href: 'https://geology.utah.gov/?page_id=22759',
    image: `${UGS_UPLOADS}/snt41-1_well-southern-sanpete-710x375c.jpg`,
    categories: ['Energy Resources', 'Minerals & Mining'],
  },
  {
    title: 'Putting Down Roots in Earthquake Country',
    description: 'Interactive guide to living with earthquakes in Utah.',
    href: 'https://roots.geology.utah.gov',
    image: `${UGS_UPLOADS}/roots-image-710x375c.jpg`,
    categories: ['Hazards'],
    isNew: true,
  },
  {
    title: 'Subsurface Geotechnical Database',
    description: 'Digital database of subsurface geologic data.',
    href: 'https://borehole.geology.utah.gov',
    image: `${UGS_UPLOADS}/drilling24_lg-1-1.jpg`,
    categories: ['Hazards'],
  },
  {
    title: 'Utah Core Research Center',
    description: 'Inventory of geologic samples from Utah.',
    href: 'https://geology.utah.gov/apps/rockcore/index.html',
    image: `${UGS_UPLOADS}/snt50-2-PR-15-7c-core2-710x375c.jpg`,
    categories: ['Energy Resources'],
  },
  {
    title: 'Utah Flux Network',
    description: 'Evapotranspiration monitoring stations around Utah.',
    href: 'https://geology.utah.gov/?page_id=58583',
    image: `${UGS_UPLOADS}/20210421_125606-scaled-710x375c.jpg`,
    categories: ['Groundwater & Wetlands'],
  },
  {
    title: 'Utah Groundwater Data Hub',
    description: 'Groundwater data from numerous UGS studies.',
    href: 'https://geology.utah.gov/apps/gw-data-hub/',
    image: `${UGS_UPLOADS}/Bicknell_Marsh-1-scaled-710x375c.jpg`,
    categories: ['Groundwater & Wetlands'],
  },
  {
    title: 'Utah Mineral Resource Reports',
    description: 'Technical reports from Canadian NI.',
    href: 'https://geology.utah.gov/apps/reportviewer/index.html',
    image: `${UGS_UPLOADS}/snt48-2_point-mountain-google-earth-1993-710x375c.jpg`,
    categories: ['Minerals & Mining'],
    imageCredit: {
      article: 'GeoSights: Point of the Mountain, Salt Lake and Utah Counties',
      url: 'https://geology.utah.gov/map-pub/survey-notes/geosights/point-of-the-mountain/',
    },
  },
  {
    title: 'Utah Rockhounder',
    description: 'Collect rocks, minerals, fossils, and landscape rocks.',
    href: 'https://geology.utah.gov/apps/rockhounder',
    image: `${UGS_UPLOADS}/1_2019_Mineral_Mtns_Christian_Hardwick-e1550011108258-710x375.jpg`,
    categories: ['Popular Geology', 'Minerals & Mining'],
  },
  {
    title: "Utah's Energy Resources",
    description: "Explore Utah's diverse energy portfolio.",
    href: 'https://geology.utah.gov/apps/energy-resources/',
    image: `${UGS_UPLOADS}/utah-energy-resources-tile-e1699889707302-710x375.jpg`,
    categories: ['Energy Resources', 'Popular Geology'],
  },
]

export const storyMaps: AppEntry[] = [
  {
    title: 'Bonneville Salt Flats Storymap',
    description: 'A changing landscape and modern research.',
    href: 'https://storymaps.arcgis.com/collections/8564b2c0182d495b8e3c66f19e261c46',
    image: `${UGS_UPLOADS}/bb767823-110c-4780-a591-4fdcd0715741-710x375c.jpg`,
    categories: ['Groundwater & Wetlands', 'Minerals & Mining', 'Popular Geology'],
  },
  {
    title: 'Building Stones of Downtown SLC',
    description: 'Walking tour starting at the Utah State Capitol.',
    href: 'https://geology.utah.gov/apps/slc_bldg_stone_tour/index.html',
    image: `${UGS_UPLOADS}/mashup_slc_stone-710x375c.jpg`,
    categories: ['Popular Geology'],
  },
  {
    title: 'G.K. Gilbert Geologic View Park',
    description: 'Guide to the park and its unique features.',
    href: 'https://geology.utah.gov/docs/storymap/gk-gilbert/?appid=41cd89cb680e4a82b0c192448d619dd4',
    image: `${UGS_UPLOADS}/gk_gilbert_park_entrance-710x375c.jpg`,
    categories: ['Popular Geology'],
  },
  {
    title: 'Geologic Canyon Tour',
    description: 'Tour the canyons of the Wasatch Front.',
    href: 'https://geology.utah.gov/docs/storymap/canyon-tour/?appid=5cf1570b998346d98478a5abd50bf096',
    image: `${UGS_UPLOADS}/1-19-16-710x375c.jpg`,
    categories: ['Popular Geology'],
  },
  {
    title: 'GeoSights',
    description: "Explore Utah's lesser-known geologic wonders.",
    href: 'https://geology.utah.gov/apps/geosights/',
    image: `${UGS_UPLOADS}/DevilsPG41-710x375c.jpg`,
    categories: ['Popular Geology'],
    imageCredit: {
      article: "GeoSights: Devil's Playground, Box Elder County, Utah",
      url: 'https://geology.utah.gov/map-pub/survey-notes/geosights/devils-playground/',
    },
  },
  {
    title: 'Lake Bonneville Storymap',
    description: '30,000 years of lake levels in the Bonneville basin.',
    href: 'https://arcg.is/1yaCLy0',
    image: `${UGS_UPLOADS}/12-16-14-1-e1616106186932-709x375.jpg`,
    categories: ['Groundwater & Wetlands', 'Popular Geology'],
  },
  {
    title: "Utah's Montane Ecoregion Wetlands",
    description: 'Stressors, conditions, and vegetation communities.',
    href: 'https://storymaps.arcgis.com/stories/079efa99ef60453b8d03261acd617b30',
    image: `${UGS_UPLOADS}/fishlake-710x375c.jpg`,
    categories: ['Groundwater & Wetlands'],
  },
  {
    title: 'Virtual Field Guides',
    description: '3-D map tours of St. George and Panguitch.',
    href: 'https://geology.utah.gov/?page_id=24941',
    image: `${UGS_UPLOADS}/snt41-2_beaver-dam-mts-geology-map-710x375c.gif`,
    categories: ['Geologic + Topographic Maps'],
  },
  {
    title: 'Visitor Guide to Utah Fossils',
    description: "Where to see Utah's fossils and dinosaurs.",
    href: 'https://geology.utah.gov/apps/fossil_guide/',
    image: `${UGS_UPLOADS}/potd_07-01-2013-dino-track-copper-ridge-710x375c.jpg`,
    categories: ['Popular Geology'],
  },
  {
    title: 'Wetland Mapping Storymap',
    description: "A guide to Utah's National Wetland Inventory.",
    href: 'https://storymaps.arcgis.com/collections/581ac0b202154028bb27bbc3f75c765b',
    image: `${UGS_UPLOADS}/wetland-mapping-cover-710x375c.jpg`,
    categories: ['Groundwater & Wetlands'],
  },
]

export const allApps: AppEntry[] = [...templateApps, ...apps]
  .sort((a, b) => (a.isNew === b.isNew ? 0 : a.isNew ? -1 : 1))
