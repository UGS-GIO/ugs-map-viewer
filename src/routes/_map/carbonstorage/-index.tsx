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
 * formation presence with nested/grouped AND/OR) into a MapLibre filter expression
 * for the Wells Database PMTiles layer. Logs and aborts on malformed expressions
 * rather than silently dropping clauses.
 */
function wellsCqlToMaplibreFilter(cql: string): FilterSpecification | null {
  type Token = { type: 'lparen' | 'rparen' | 'and' | 'or' | 'clause'; value: string }
  const tokens: Token[] = []
  let i = 0
  while (i < cql.length) {
    if (/\s/.test(cql[i])) { i++; continue }
    if (cql[i] === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue }
    if (cql[i] === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue }

    const rest = cql.slice(i)
    const opMatch = rest.match(/^(AND|OR)(?=[\s(]|$)/i)
    if (opMatch) {
      tokens.push({ type: opMatch[1].toUpperCase() === 'AND' ? 'and' : 'or', value: opMatch[1] })
      i += opMatch[1].length
      continue
    }

    const isNullMatch = rest.match(/^([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL(?=[\s)]|$)/i)
    if (isNullMatch) {
      tokens.push({ type: 'clause', value: isNullMatch[0] })
      i += isNullMatch[0].length
      continue
    }

    const eqMatch = rest.match(/^([a-zA-Z0-9_]+)\s*=\s*'([^']*)'/)
    if (eqMatch) {
      tokens.push({ type: 'clause', value: eqMatch[0] })
      i += eqMatch[0].length
      continue
    }

    console.error(`[wellsCqlToMaplibreFilter] Unparseable CQL near: ${rest.slice(0, 40)}`)
    return null
  }

  let pos = 0
  const parseClause = (raw: string): ExpressionSpecification | null => {
    const isNotNull = raw.match(/^([a-zA-Z0-9_]+)\s+IS\s+NOT\s+NULL$/i)
    if (isNotNull) {
      const col = isNotNull[1]
      return ['all', ['has', col], ['!=', ['get', col], null]]
    }
    const eqMatch = raw.match(/^([a-zA-Z0-9_]+)\s*=\s*'([^']*)'$/)
    if (eqMatch) {
      const [, field, value] = eqMatch
      if (field === 'has_las') return ['==', ['get', field], value === 'True']
      return ['==', ['get', field], value]
    }
    console.error(`[wellsCqlToMaplibreFilter] Invalid clause: ${raw}`)
    return null
  }

  const parseOr = (): ExpressionSpecification | null => {
    const left = parseAnd()
    if (!left) return null
    const items: ExpressionSpecification[] = [left]
    while (pos < tokens.length && tokens[pos].type === 'or') {
      pos++
      const right = parseAnd()
      if (!right) return null
      items.push(right)
    }
    return items.length === 1 ? items[0] : (['any', ...items] as ExpressionSpecification)
  }

  const parseAnd = (): ExpressionSpecification | null => {
    const left = parsePrimary()
    if (!left) return null
    const items: ExpressionSpecification[] = [left]
    while (pos < tokens.length && tokens[pos].type === 'and') {
      pos++
      const right = parsePrimary()
      if (!right) return null
      items.push(right)
    }
    return items.length === 1 ? items[0] : (['all', ...items] as ExpressionSpecification)
  }

  const parsePrimary = (): ExpressionSpecification | null => {
    const tok = tokens[pos]
    if (!tok) {
      console.error('[wellsCqlToMaplibreFilter] Unexpected end of CQL expression')
      return null
    }
    if (tok.type === 'lparen') {
      pos++
      const expr = parseOr()
      if (!expr || tokens[pos]?.type !== 'rparen') {
        console.error('[wellsCqlToMaplibreFilter] Unmatched parenthesis in CQL')
        return null
      }
      pos++
      return expr
    }
    if (tok.type === 'clause') {
      pos++
      return parseClause(tok.value)
    }
    console.error(`[wellsCqlToMaplibreFilter] Unexpected token '${tok.value}'`)
    return null
  }

  if (tokens.length === 0) return null
  const result = parseOr()
  if (!result || pos < tokens.length) {
    if (pos < tokens.length) {
      console.error(`[wellsCqlToMaplibreFilter] Unexpected trailing token '${tokens[pos].value}'`)
    }
    return null
  }
  return result as FilterSpecification
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
