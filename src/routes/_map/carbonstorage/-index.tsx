import { useMemo, useEffect, useRef } from 'react'
import { useSearch } from '@tanstack/react-router'
import GenericMapContainer from '@/components/maps/generic-map-container'
import { MapShell } from '@/components/maps/map-shell'
import { useLayerUrl } from '@/context/layer-url-provider'
import { wellWithTopsWMSTitle, seamlessGeolunitsWMSTitle, sectionsTitle, powerplantsTitle } from './-data/layers/layers'
import { useMapContextState } from '@/hooks/use-map-context-state'
import { MapContext } from '@/context/map-context'
import { TourAutoStart } from '@/components/tour-auto-start'
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, type SearchComboboxHandle } from '@/components/sidebar/filter/search-combobox'
import { parquetUrl } from '@/lib/constants'
import { powerplantsFilterSchema } from './-data/layers/powerplants-schema'
import { toMaplibreFilter } from '@/lib/filter/generators'
import { fromCql } from '@/lib/filter/parse'
import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'

// Carbon Storage specific filter mapping
const CCS_FILTER_MAPPING: Record<string, string> = {
  [wellWithTopsWMSTitle]: wellWithTopsWMSTitle,
}

const searchConfig: SearchSourceConfig[] = [
  defaultMasqueradeConfig,
  {
    type: 'parquet',
    parquetUrl: parquetUrl('enmin_ccs_wells_formation'),
    sourceName: 'Wells Database',
    layerName: wellWithTopsWMSTitle,
    displayField: 'api',
    secondaryDisplayField: 'wellname',
    idField: 'api',
    params: {
      targetFields: ['api', 'wellname', 'operator'],
    },
  },
  {
    type: 'parquet',
    parquetUrl: parquetUrl('enmin_plss_sections'),
    sourceName: 'Utah Township, Range & Section',
    layerName: sectionsTitle,
    displayField: 'label',
    secondaryDisplayField: 'section',
    idField: 'frstdivid',
    params: {
      targetFields: ['label', 'section'],
    },
  },
  {
    type: 'parquet',
    // `search_scale: 'small'` selected the 500k units; that scale is its own warehouse item.
    parquetUrl: parquetUrl('geolmap_geolunits_500k'),
    sourceName: 'Geologic Units',
    layerName: seamlessGeolunitsWMSTitle,
    // The RPC returned a pre-joined label; the warehouse keeps name and symbol apart.
    derivedFields: {
      unit_label: `unitname || ' (' || unitsymbol || ')'`,
    },
    displayField: 'unit_label',
    idField: 'geology_id',
    params: { targetFields: ['unitname', 'unitsymbol', 'notes'] },
    // Stands in for the RPC's `match_type`: which column the term hit, in the same
    // precedence the groups are listed. `notes` is the description column here.
    groupByField: 'match_type',
    groupByMatch: [
      { key: 'name', field: 'unitname' },
      { key: 'symbol', field: 'unitsymbol' },
      { key: 'description', field: 'notes' },
    ],
    groupLabels: {
      name: 'Name Matches',
      symbol: 'Symbol Matches',
      description: 'Description Matches',
    },
  },
]

/**
 * Translate the CQL filter produced by MapConfigurations (hascore, has_las, and
 * formation presence with AND/OR) into a MapLibre filter expression for the
 * Wells Database PMTiles layer.
 */
function wellsCqlToMaplibreFilter(cql: string): FilterSpecification | null {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < cql.length; i++) {
    if (cql[i] === '(') depth++
    else if (cql[i] === ')') depth--
    else if (depth === 0 && cql.slice(i, i + 5).toUpperCase() === ' AND ') {
      parts.push(cql.slice(start, i).trim())
      i += 4
      start = i + 1
    }
  }
  parts.push(cql.slice(start).trim())

  const parseClause = (clause: string): ExpressionSpecification | null => {
    const trimmed = clause.replace(/^\(+|\)+$/g, '').trim()
    const isNotNull = trimmed.match(/^([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL$/i)
    if (isNotNull) return ['has', isNotNull[1]]

    const eqMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*=\s*'([^']+)'$/)
    if (eqMatch) {
      const [, field, value] = eqMatch
      if (field === 'has_las') return ['==', ['get', field], value === 'True']
      return ['==', ['get', field], value]
    }
    return null
  }

  const conditions: ExpressionSpecification[] = []
  for (const rawPart of parts) {
    const inner = rawPart.replace(/^\(+|\)+$/g, '').trim()
    if (/\s+OR\s+/i.test(inner)) {
      const orExprs = inner.split(/\s+OR\s+/i).map(parseClause).filter((e): e is ExpressionSpecification => e !== null)
      if (orExprs.length === 1) conditions.push(orExprs[0])
      else if (orExprs.length > 1) conditions.push(['any', ...orExprs] as ExpressionSpecification)
    } else if (/\s+AND\s+/i.test(inner)) {
      const andExprs = inner.split(/\s+AND\s+/i).map(parseClause).filter((e): e is ExpressionSpecification => e !== null)
      conditions.push(...andExprs)
    } else {
      const expr = parseClause(inner)
      if (expr) conditions.push(expr)
    }
  }

  if (conditions.length === 0) return null
  if (conditions.length === 1) return conditions[0]
  return ['all', ...conditions] as FilterSpecification
}

export default function Map() {
  const { updateLayerSelection } = useLayerUrl()
  const { contextValue } = useMapContextState();
  const searchRef = useRef<SearchComboboxHandle>(null);

  // Get URL filters
  const searchParams = useSearch({ from: '/_map/carbonstorage/' })
  const filtersFromUrl = searchParams.filters ?? {}

  // Translate stored CQL filters (Wells Database + Power Plants) into MapLibre
  // filter expressions for their PMTiles layers.
  const vectorLayerFilters = useMemo(() => {
    const result: Record<string, FilterSpecification> = {}
    const wellsCql = filtersFromUrl[wellWithTopsWMSTitle]
    if (wellsCql) {
      const wellsExpr = wellsCqlToMaplibreFilter(wellsCql)
      if (wellsExpr) result[wellWithTopsWMSTitle] = wellsExpr
    }
    const powerplantsCql = filtersFromUrl[powerplantsFilterSchema.recordKey]
    if (powerplantsCql) {
      const expr: ExpressionSpecification | null = toMaplibreFilter(powerplantsFilterSchema, fromCql(powerplantsFilterSchema, powerplantsCql))
      if (expr) result[powerplantsTitle] = expr
    }
    return result
  }, [filtersFromUrl])

  // A filtered layer must be on screen (selection reveals its groups too).
  useEffect(() => {
    for (const [filterKey, layerTitle] of Object.entries(CCS_FILTER_MAPPING)) {
      if (filtersFromUrl[filterKey]) updateLayerSelection(layerTitle, true)
    }
    if (filtersFromUrl[powerplantsFilterSchema.recordKey]) updateLayerSelection(powerplantsTitle, true)
  }, [filtersFromUrl, updateLayerSelection])

  const onFeatureSelect = handleSearchSelect
  const onCollectionSelect = handleCollectionSelect

  return (
    <MapContext.Provider value={contextValue}>
      <TourAutoStart route="ccs" />
      <MapShell
        search={
          <SearchCombobox
            ref={searchRef}
            config={searchConfig}
            onFeatureSelect={onFeatureSelect}
            onCollectionSelect={onCollectionSelect}
            className="w-full"
          />
        }
      >
        <GenericMapContainer
          vectorLayerFilters={vectorLayerFilters}
          onClearSearch={() => searchRef.current?.clear()}
        />
      </MapShell>
    </MapContext.Provider>
  )
}
