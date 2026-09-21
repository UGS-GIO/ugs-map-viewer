import type { FilterSchema } from '@/lib/filter/types';
import { wetlandSurveySitesTitle } from './layers';

/**
 * Filter schema for the Wetland Survey Sites layer.
 * Backed by the STAC warehouse item `wetlands_plants_site`.
 *
 * Distinct options for the site attributes (ecoregionalgroup, wetlandtype,
 * watershed, vegetationcondition) and related species (scientificname) are
 * queried client-side via DuckDB-WASM directly from their geoparquet archives.
 */
export const wetlandPlantsFilterSchema: FilterSchema = {
    recordKey: wetlandSurveySitesTitle,
    stacItemId: 'wetlands_plants_site',
    fields: [
        {
            kind: 'multiSelect',
            field: 'ecoregionalgroup',
            label: 'Ecoregional Group',
            placeholder: 'Select ecoregions...',
        },
        {
            kind: 'multiSelect',
            field: 'wetlandtype',
            alternateField: 'wetlandtype2',
            label: 'Wetland Type',
            placeholder: 'Select wetland types...',
        },
        {
            kind: 'multiSelect',
            field: 'watershed',
            label: 'Watershed (HUC8)',
            placeholder: 'Select watersheds...',
        },
        {
            kind: 'multiSelect',
            field: 'vegetationcondition',
            label: 'Wetland Condition',
            placeholder: 'Select conditions...',
        },
        {
            kind: 'multiSelect',
            field: 'scientificname',
            label: 'Species Scientific Name',
            placeholder: 'Search species scientific names...',
            relatedAsset: 'wetlands_plants_species',
            foreignKey: 'surveyeventid',
        },
    ],
};

export default wetlandPlantsFilterSchema;
