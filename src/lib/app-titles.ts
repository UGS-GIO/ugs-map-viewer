/**
 * App titles for each portal page
 * Lightweight constant mapping to avoid loading page-info in sidebar header
 */
export const APP_TITLES: Record<string, string> = {
  'hazards': 'Geologic Hazards Portal',
  'hazards-review': 'Hazards Data Review (Internal Use Only)',
  'minerals': 'Utah Mineral Resources: Metals and Industrial Minerals',
  'wetlands': 'Utah Wetlands Portal',
  'wetlandplants': 'Wetland and Riparian Plants of Utah',
  'geophysics': 'Geophysical & Geothermal Data Portal',
  'carbonstorage': 'Carbon Storage Portal (beta)',
};

export function getAppTitle(page: string): string {
  return APP_TITLES[page] || 'Utah Geological Survey';
}
