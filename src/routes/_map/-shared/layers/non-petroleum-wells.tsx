import { isHttpUrl, Link } from '@/components/ui/link';
import { MAPS_ASSETS_CDN_URL } from '@/lib/constants';
import type { PMTilesLayerProps } from '@/lib/types/mapping-types';
import type { GeoJsonProperties } from 'geojson';

const nonpetrolWellsLayerName = 'enmin_non_petroleum_wells';
export const nonpetrolWellsTitle = 'Exploration Boreholes - Downhole Data';

const nwpdFileLinkTransform = (value: string | null, row?: Record<string, unknown>) => {
    const path = row?.['full_path'];
    if (!path) return value || 'No link available';
    const href = `${MAPS_ASSETS_CDN_URL}/${String(path).replace(/^\/+/, '')}`;
    return isHttpUrl(href) ? <Link to={href}>{value || 'View File'}</Link> : (value || 'No link available');
};

/**
 * Shared STAC-backed Exploration Boreholes (NWPD) layer used by both
 * `/carbonstorage` and `/subsurface`.
 */
export const nonpetrolWellsConfig: PMTilesLayerProps = {
    type: 'pmtiles',
    stacItemId: nonpetrolWellsLayerName,
    pmtilesUrl: '',
    sourceLayer: nonpetrolWellsLayerName,
    title: nonpetrolWellsTitle,
    visible: false,
    opacity: 1,
    sourceAgency: 'Utah Geological Survey',
    sublayers: [
        {
            name: nonpetrolWellsLayerName,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Name': { field: 'well_name', type: 'string' },
                'UWI': { field: 'uwi', type: 'string' },
                'Operator': { field: 'operator', type: 'string' },
                'Depth': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const depth = props?.['depth'];
                        return depth != null && depth !== '' ? `${depth} ft` : '';
                    },
                },
                'County': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) =>
                        [props?.['county'], props?.['state']].filter(Boolean).join(', '),
                },
                'Location': {
                    field: 'custom',
                    type: 'custom',
                    transform: (props: GeoJsonProperties | null | undefined) => {
                        const tnum = props?.['town_num'];
                        const tdir = props?.['town_dir'];
                        const rnum = props?.['range_num'];
                        const rdir = props?.['range_dir'];
                        const sect = props?.['sect'];
                        const parts: string[] = [];
                        if (tnum != null && tnum !== '') parts.push(`${tnum}${tdir ?? ''}`);
                        if (rnum != null && rnum !== '') parts.push(`${rnum}${rdir ?? ''}`);
                        if (sect != null && sect !== '') parts.push(`Section ${sect}`);
                        return parts.join(' ');
                    },
                },
                'Meridian': { field: 'meridian', type: 'string' },
                'Purpose': {
                    field: 'purpose',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'C') return 'Coal';
                        if (value === 'T') return 'Tar Sands';
                        if (value === 'SH') return 'Oil Shale';
                        if (value === 'W') return 'Water/Geothermal';
                        return 'Unknown';
                    },
                },
                'Reports': {
                    field: 'analyses',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'Y') return 'Available';
                        if (value === 'N') return 'None';
                        return 'Unknown';
                    },
                },
                'Well Logs': {
                    field: 'well_logs',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (value === 'Y') return 'Available';
                        if (value === 'N') return 'None';
                        return 'Unknown';
                    },
                },
            },
            relatedTables: [
                {
                    fieldLabel: 'Well Log Files',
                    stacAsset: 'enmin_nwpd_wellogs',
                    matchingField: 'well_id',
                    targetField: 'uwi',
                    displayFields: [
                        { field: 'filename', label: '', transform: nwpdFileLinkTransform },
                    ],
                    sortBy: 'filename',
                    sortDirection: 'asc',
                },
                {
                    fieldLabel: 'Well Analyses Files',
                    stacAsset: 'enmin_nwpd_analyses',
                    matchingField: 'well_id',
                    targetField: 'uwi',
                    displayFields: [
                        { field: 'filename', label: '', transform: nwpdFileLinkTransform },
                    ],
                },
            ],
        },
    ],
};
