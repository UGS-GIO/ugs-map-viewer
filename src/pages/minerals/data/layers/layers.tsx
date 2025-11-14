import { GeoJsonProperties } from "geojson";
import { PROD_GEOSERVER_URL, ENERGY_MINERALS_WORKSPACE } from "@/lib/constants";
import { LayerProps, WMSLayerProps } from "@/lib/types/mapping-types";
import { addThousandsSeparator } from "@/lib/utils";

// --- Industrial Minerals WMS Layer Configurations ---
const aluniteLayerName = 'metalmineralapp_im_alunite';
const aluniteWMSTitle = 'Alunite';
const aluniteWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: aluniteWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${aluniteLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Deposit Type': { field: 'deposit_type', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Alunite Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: unknown) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Alunite.pdf'
                            }
                        ];
                    }
                }
            },
        }
    ]
};

const bentoniteLayerName = 'metalmineralapp_im_bentonite';
const bentoniteWMSTitle = 'Bentonite';
const bentoniteWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: bentoniteWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${bentoniteLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Age': { field: 'age', type: 'string' },
                'Unit Name': { field: 'unitname', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Bentonite Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: unknown) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Bentonite.pdf'
                            }
                        ]
                    }
                }
            }
        }
    ]
};

const dolomiteLayerName = 'metalmineralapp_im_dolomite';
const dolomiteWMSTitle = 'Dolomite';
const dolomiteWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: dolomiteWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${dolomiteLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Age': { field: 'age', type: 'string' },
                'Unit Name': { field: 'unitname', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Dolomite Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: unknown) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Dolomite.pdf'
                            }
                        ];
                    }
                }
            }
        }
    ]
};

const gypsumLayerName = 'metalmineralapp_im_gypsum';
const gypsumWMSTitle = 'Gypsum';
const gypsumWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: gypsumWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${gypsumLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Age': { field: 'age', type: 'string' },
                'Unit Name': { field: 'unitname', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Gypsum Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: unknown) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Gypsum.pdf'
                            }
                        ];
                    }
                }
            }
        }
    ]
};

const limestoneLayerName = 'metalmineralapp_im_limestone';
const limestoneWMSTitle = 'Limestone';
const limestoneWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: limestoneWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${limestoneLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Age': { field: 'age', type: 'string' },
                'Unit Name': { field: 'unitname', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Limestone Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: unknown) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Limestone.pdf'
                            }
                        ];
                    }
                }
            }
        }
    ]
};

const phosphateLayerName = 'metalmineralapp_im_phosphate';
const phosphateWMSTitle = 'Phosphate';
const phosphateWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: phosphateWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${phosphateLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Age': { field: 'age', type: 'string' },
                'Unit Name': { field: 'unitname', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Phosphate Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: unknown) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Phosphate.pdf'
                            }
                        ];
                    }
                }
            }
        }
    ]
};

const potashLayerName = 'metalmineralapp_im_potash';
const potashWMSTitle = 'Potash';
const potashWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: potashWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${potashLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Name': { field: 'name', type: 'string' },
                'Deposit Type': { field: 'deposit_type', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: (() => 'Potash Information') as (value: unknown) => string
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: GeoJsonProperties | null | undefined) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Potash.pdf'
                            }
                        ];
                    }
                },
            }
        }
    ]
};

const silicaLayerName = 'metalmineralapp_im_silica';
const silicaWMSTitle = 'Silica';
const silicaWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: silicaWMSTitle,
    opacity: .5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${silicaLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Age': { field: 'age', type: 'string' },
                'Unit Name': { field: 'unitname', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: () => 'Silica Information'
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: GeoJsonProperties | null | undefined) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://ugspub.nr.utah.gov/publications/blm_mineral_resources/Silica.pdf'
                            }
                        ];
                    }
                }
            }
        }
    ]
};

// --- Industrial Minerals Group Layer ---
const industrialMineralsGroupConfig: LayerProps = {
    type: 'group',
    title: 'Industrial Mineral Resource Potential',
    visible: true,
    layers: [
        aluniteWMSConfig,
        bentoniteWMSConfig,
        dolomiteWMSConfig,
        gypsumWMSConfig,
        limestoneWMSConfig,
        phosphateWMSConfig,
        potashWMSConfig,
        silicaWMSConfig
    ]
};

// --- Critical Minerals WMS Layer Configurations ---
const criticalMineralOccurrencesWMSLayerName = 'metalmineralapp_criticalmineralpoints';
const criticalMineralOccurrencesWMSTitle = 'Critical Mineral Occurrences';
const criticalMineralOccurrencesWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: criticalMineralOccurrencesWMSTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${criticalMineralOccurrencesWMSLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Site Name': { field: 'site_name', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Label': { field: 'label', type: 'string' }
            }

        }
    ]
};

const criticalMineralsAreasWMSLayerName = 'metalmineralapp_criticalmineralpolygons';
const criticalMineralsAreasWMSTitle = 'Critical Mineral Areas';
const criticalMineralsAreasWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: criticalMineralsAreasWMSTitle,
    opacity: 0.5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${criticalMineralsAreasWMSLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'District Name': { field: 'district', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Label': { field: 'label', type: 'string' }
            }

        }
    ]
};

// --- Critical Minerals group layer ---
const criticalMineralsGroupConfig: LayerProps = {
    type: 'group',
    title: 'Critical Minerals',
    visible: true,
    layers: [
        criticalMineralsAreasWMSConfig,
        criticalMineralOccurrencesWMSConfig
    ]
};

// --- Other Layers ---

const miningDistrictsLayerName = 'metalmineralapp_mining_districts';
const miningDistrictsTitle = 'Metalliferous Mining Districts';
const miningDistrictsConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: miningDistrictsTitle,
    opacity: 0.5,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${miningDistrictsLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Commodity': { field: 'commodity', type: 'string' },
                'Organized District': { field: 'organized', type: 'string' },
                'Productive': { field: 'productive', type: 'string' },
                'Short Tons': {
                    field: 'short_tons', type: 'string', transform: (value: string | null) => {
                        if (value === '0' || !value) return null;
                        return addThousandsSeparator(value);
                    },
                },
                'Total Dollar Value': {
                    field: 'total_dollar_value',
                    type: 'string',
                    transform: (value: string | null) => {
                        if (!value || value === '0') return null;
                        const numValue = parseFloat(value);
                        if (isNaN(numValue)) return value;
                        return numValue.toLocaleString('en-US', {
                            style: 'currency',
                            currency: 'USD',
                        });
                    }
                },
            },
        },
    ],
}

const umosLayerName = 'metalmineralapp_umos';
const umosWMSTitle = 'Utah Mineral Occurrence System';
const umosWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: umosWMSTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${umosLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'Site Name': { field: 'site_name', type: 'string' },
                'Commodity': { field: 'commodity', type: 'string' },
                'Ore Mineral': { field: 'ore_minerals', type: 'string' },
                'Commodity Type': { field: 'type', type: 'string' },
                'Production': { field: 'production', type: 'string' },
                'Deposit Size': { field: 'dep_size', type: 'string' },
                'Mining District': { field: 'district', type: 'string' },
                'County': { field: 'county', type: 'string' },
                '': {
                    field: 'info_link',
                    type: 'custom',
                    transform: () => 'UMOS Explanation'
                },
            },
            linkFields: {
                'info_link': {
                    transform: (value: GeoJsonProperties | null | undefined) => {
                        return [
                            {
                                label: `${value}`,
                                href: 'https://geology.utah.gov/apps/blm_mineral/appfiles/UMOS%20Explanation.pdf'
                            }
                        ];
                    }
                }
            },
        },
    ],
}

const landAssessmentLayerName = 'metalmineralapp_blm_wsa_mineral_land_asssessment';
const landAssessmentWMSTitle = 'WSA Mineral Land Assessment';
const landAssessmentWMSConfig: WMSLayerProps = {
    type: 'wms',
    url: `${PROD_GEOSERVER_URL}/wms`,
    title: landAssessmentWMSTitle,
    visible: true,
    sublayers: [
        {
            name: `${ENERGY_MINERALS_WORKSPACE}:${landAssessmentLayerName}`,
            popupEnabled: false,
            queryable: true,
            popupFields: {
                'WSA': { field: 'wsa', type: 'string' },
                'URL': { field: 'url', type: 'string' }, // Keep this field, but maybe hide if desired
            },
            linkFields: {
                'url': { // This links based on the 'url' field value
                    transform: (value: string | null) => {
                        if (value && value.startsWith('http')) {
                            return [
                                {
                                    label: 'Download Mineral Land Assessment for Wilderness Study Area',
                                    href: value
                                }
                            ];
                        }
                        return []; // Return empty array if no valid URL
                    }
                }
            }
        },
    ],
}

// --- SITLA Land Ownership Layer ---
const SITLAConfig: LayerProps = {
    type: 'feature',
    title: 'SITLA Land Ownership',
    url: 'https://gis.trustlands.utah.gov/mapping/rest/services/Land_Ownership_WM/MapServer/0',
    opacity: 0.45,
    options: {
        popupEnabled: false,
        title: 'SITLA Land Ownership',
        elevationInfo: [{ mode: 'on-the-ground' }],
        visible: false,
    },
};

// --- Final Export ---
const layersConfig: LayerProps[] = [
    umosWMSConfig,
    criticalMineralsGroupConfig,
    miningDistrictsConfig,
    industrialMineralsGroupConfig,
    landAssessmentWMSConfig,
    SITLAConfig
];

export default layersConfig;