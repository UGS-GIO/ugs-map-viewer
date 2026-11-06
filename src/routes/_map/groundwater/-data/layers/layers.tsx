import { GROUNDWATER_WORKSPACE, PROD_GEOSERVER_URL } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";

// --- Well & Spring Locations WMS Layer Configuration ---
const monitoringLocationsLayerName = 'ugs_ngwmn_monitoring_locations';
const monitoringLocationsWMSTitle = 'Well & Spring Locations';

const monitoringLocationsWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: monitoringLocationsWMSTitle,
    opacity: 1,
    visible: true,
    crs: 'EPSG:3857',
    sourceAgency: 'Utah Geological Survey',
    sourceUrl: 'https://gwportal.geology.utah.gov/',
    customLayerParameters: { cql_filter: "display = '1'" },
    sublayers: [
        {
            name: `${GROUNDWATER_WORKSPACE}:${monitoringLocationsLayerName}`,
            popupEnabled: true,
            queryable: true,
            popupFields: {
                'Location Name': { field: 'locationname', type: 'string' },
                'Location ID': { field: 'locationid', type: 'string' },
                'Location Type': { field: 'locationtype', type: 'string' },
                'Well Type': { field: 'welltype', type: 'string' },
                'Aquifer Name': { field: 'aquifername', type: 'string' },
                'Well Depth': { field: 'welldepth', type: 'number', unit: ' ft' },
                'Network Name': { field: 'wlnetworkname', type: 'string' },
                'National Aquifer': { field: 'nationalaquifer', type: 'string' },
                'Description': { field: 'locationdesc', type: 'string' },
                'County': { field: 'county', type: 'string' },
                'State': { field: 'state', type: 'string' },
            },
        },
    ],
};

const layersConfig: LayerProps[] = [
    monitoringLocationsWMSConfig,
];

export default layersConfig;
