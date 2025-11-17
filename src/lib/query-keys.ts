/**
 * Query Key Factory for TanStack Query
 * Provides type-safe, hierarchical query keys for easy invalidation and deduplication
 *
 * @see https://tkdodo.eu/blog/effective-react-query-keys
 */

export const queryKeys = {
  // Layer-related queries
  layers: {
    all: ['layers'] as const,
    lists: () => [...queryKeys.layers.all, 'list'] as const,
    list: (filters?: string) => [...queryKeys.layers.lists(), { filters }] as const,
    details: () => [...queryKeys.layers.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.layers.details(), id] as const,
    descriptions: () => [...queryKeys.layers.all, 'descriptions'] as const,
    description: (page: string, tables?: string) =>
      [...queryKeys.layers.descriptions(), page, tables] as const,
    legend: (layerId: string, url?: string) =>
      [...queryKeys.layers.detail(layerId), 'legend', url] as const,
    wmsLegend: (layerName: string, wmsUrl: string) =>
      [...queryKeys.layers.all, 'wms-legend', layerName, wmsUrl] as const,
    extent: (url: string, layerName: string) =>
      [...queryKeys.layers.all, 'extent', url, layerName] as const,
    reviewable: (config: unknown) => [...queryKeys.layers.all, 'reviewable', config] as const,
  },

  // Map-related queries
  map: {
    all: ['map'] as const,
    screenshots: () => [...queryKeys.map.all, 'screenshot'] as const,
    screenshot: (polygon: string, width: string, height: string) =>
      [...queryKeys.map.screenshots(), { polygon, width, height }] as const,
  },

  // Page info queries
  page: {
    all: ['page-info'] as const,
    info: (page: string) => [...queryKeys.page.all, page] as const,
  },

  // Sidebar queries
  sidebar: {
    all: ['sidebar'] as const,
    links: (page: string) => [...queryKeys.sidebar.all, 'links', page] as const,
    search: (url: string, type: string, searchTerm: string, index?: number) =>
      [...queryKeys.sidebar.all, 'search', url, type, searchTerm, index] as const,
  },

  // Feature queries
  features: {
    all: ['features'] as const,
    relatedTable: (url: string, featureId: string, tableName: string) =>
      [...queryKeys.features.all, 'related', url, featureId, tableName] as const,
    wmsInfo: (mapPoint: Record<string, unknown> | null, polygonRings: number[][][] | null, clickId: number | null) =>
      [...queryKeys.features.all, 'wms-info', mapPoint, polygonRings, clickId] as const,
  },

  // Utility queries
  modules: {
    all: ['modules'] as const,
    dompurify: () => [...queryKeys.modules.all, 'dompurify'] as const,
  },

  // Carbon storage specific queries
  carbonStorage: {
    all: ['carbon-storage'] as const,
    formations: () => [...queryKeys.carbonStorage.all, 'formations'] as const,
  },

  // Hazards queries
  hazards: {
    all: ['hazards'] as const,
    reports: () => [...queryKeys.hazards.all, 'report'] as const,
    report: (polygon: string) => [...queryKeys.hazards.reports(), polygon] as const,
  },
} as const;

/**
 * Helper to invalidate all queries for a specific layer
 */
export const invalidateLayer = (queryClient: any, layerId: string) => {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.layers.detail(layerId)
  });
};

/**
 * Helper to invalidate all layer-related queries
 */
export const invalidateAllLayers = (queryClient: any) => {
  return queryClient.invalidateQueries({
    queryKey: queryKeys.layers.all
  });
};
