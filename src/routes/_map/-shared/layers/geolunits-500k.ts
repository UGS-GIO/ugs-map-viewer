import { PMTilesLayerProps } from "@/lib/types/mapping-types";

export const geolunits500kTitle = 'Geologic Units (500k)';

// STAC-driven (item `geolmap_geolunits_500k`), shared by the subsurface and carbonstorage routes.
// The tiles drop `notes`, so the WMS popup's unit description has no field to read here.
export const geolunits500kConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: 'geolmap_geolunits_500k',
    pmtilesUrl: '',
    sourceLayer: 'geolmap_geolunits_500k',
    title: geolunits500kTitle,
    opacity: 0.5,
    blend: true,
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://geology.utah.gov/publication-details/?pub=M-179dm',
    sublayers: [
        {
            name: 'geolmap_geolunits_500k',
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Unit': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props) => `${props?.['unitname']} (${props?.['unitsymbol']})`,
                },
                'Age': { field: 'age', type: 'string' },
                'Source': { field: 'metadata_publication_id', type: 'string' },
            },
            linkFields: {
                'metadata_publication_id': {
                    baseUrl: '',
                    transform: (value: string) => [{ href: `https://doi.org/10.34191/${value}`, label: value }],
                },
            },
        },
    ],
};
