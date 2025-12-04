import { useMemo, useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, AccordionHeader } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useLayerItemState } from '@/hooks/use-layer-item-state';
import { LayerProps, WMSLayerProps, PMTilesLayerProps, WFSLayerProps } from '@/lib/types/mapping-types';
import { useMap } from '@/hooks/use-map';
import { findLayerByTitle, isWMSLayer } from '@/lib/map/utils';
import { useLayerExtent, UseLayerExtentOptions } from '@/hooks/use-layer-extent';
import { useFetchLayerDescriptions } from '@/hooks/use-fetch-layer-descriptions';
import { useSidebar } from '@/hooks/use-sidebar';
import LayerControls from '@/components/custom/layer-controls';
import { useIsMobile } from './use-mobile';
import { clearGraphics } from '@/lib/map/highlight-utils';
import { PROD_GEOSERVER_URL, HAZARDS_WORKSPACE } from '@/lib/constants';

const isPMTilesLayer = (layer: LayerProps): layer is PMTilesLayerProps => {
    return layer.type === 'pmtiles';
};

const isWFSLayerConfig = (layer: LayerProps): layer is WFSLayerProps => {
    return layer.type === 'wfs';
};

const LayerAccordionItem = ({ layerConfig, isTopLevel }: { layerConfig: LayerProps; isTopLevel: boolean }) => {
    const {
        isSelected,
        handleToggleSelection,
        isGroupVisible,
        handleToggleGroupVisibility,
        groupCheckboxState,
        handleSelectAllToggle,
    } = useLayerItemState(layerConfig);

    const { map } = useMap();
    const { setIsCollapsed, setNavOpened } = useSidebar();
    const { data: layerDescriptions } = useFetchLayerDescriptions();
    const isMobile = useIsMobile();
    const [isUserExpanded, setIsUserExpanded] = useState(() => {
        if (layerConfig.type === 'group') {
            // If it is, expand it ONLY if any of its children are selected.
            return groupCheckboxState === 'all' || groupCheckboxState === 'some';
        }

        // If it's not a group, it's a single layer. ALWAYS start collapsed.
        return false;
    });

    const liveLayer = useMemo(() => {
        if (!map || !layerConfig.title) return null;
        return findLayerByTitle(map, layerConfig.title);
    }, [map, layerConfig.title]);

    // Extract extent query options based on layer type
    const extentOptions: UseLayerExtentOptions = useMemo(() => {
        if (isPMTilesLayer(layerConfig)) {
            // PMTiles bounds in file headers can be inaccurate (tippecanoe calculates global bounds)
            // Fall back to WMS GetCapabilities for layer-specific extent
            if (layerConfig.pmtilesUrl.includes('hazards.pmtiles') && layerConfig.sourceLayer) {
                return {
                    type: 'wms',
                    wmsUrl: `${PROD_GEOSERVER_URL}wms`,
                    layerName: `${HAZARDS_WORKSPACE}:${layerConfig.sourceLayer}`,
                };
            }
            return {
                type: 'pmtiles',
                pmtilesUrl: layerConfig.pmtilesUrl,
            };
        }
        if (isWFSLayerConfig(layerConfig)) {
            // WFS layers can use WFS GetCapabilities for extent via WMS URL
            // Extract WMS URL from WFS URL (typically replace /wfs with /wms)
            const wmsUrl = layerConfig.wfsUrl.replace('/wfs', '/wms');
            return {
                type: 'wms',
                wmsUrl,
                layerName: layerConfig.typeName,
            };
        }
        if (isWMSLayer(layerConfig)) {
            const wmsLayer = layerConfig as WMSLayerProps;
            const sublayers = wmsLayer.sublayers;
            const layerName = Array.isArray(sublayers) && sublayers.length > 0 && sublayers[0].name
                ? sublayers[0].name
                : null;
            return {
                type: 'wms',
                wmsUrl: wmsLayer.url ?? null,
                layerName,
            };
        }
        return { type: 'wms', wmsUrl: null, layerName: null };
    }, [layerConfig]);

    const { refetch: fetchExtent, data: cachedExtent } = useLayerExtent(extentOptions);

    const handleOpacityChange = (value: number) => {
        if (liveLayer) {
            liveLayer.opacity = value / 100;
        }
    };

    // This handler now explicitly sets the accordion state.
    const handleLocalToggle = (checked: boolean) => {
        // Only clear graphics if using MapLibre (has map)
        if (map) {
            clearGraphics(map, layerConfig.title || '');
        }

        handleToggleSelection(checked);
        setIsUserExpanded(checked);
    };

    const handleZoomToLayer = async () => {
        if (!liveLayer || !map) return;
        try {
            let extent = cachedExtent;
            if (!extent) {
                const result = await fetchExtent();
                extent = result.data;
            }
            if (extent && extent.length === 4) {
                handleToggleSelection(true);
                setIsUserExpanded(true);
                // extent is [minLng, minLat, maxLng, maxLat]
                map.fitBounds(
                    [[extent[0], extent[1]], [extent[2], extent[3]]],
                    { padding: 50, animate: true }
                );
                if (isMobile) {
                    setIsCollapsed(true);
                    setNavOpened(false);
                }
            }
        } catch (error) {
            console.error("Error in handleZoomToLayer:", error);
        }
    };

    const accordionValue = isUserExpanded ? "item-1" : "";


    // --- Group Layer Rendering ---
    if (layerConfig.type === 'group' && 'layers' in layerConfig) {
        const childLayers = [...(layerConfig.layers || [])];

        return (
            <div className="mr-2 border border-secondary rounded my-1">
                <Accordion
                    type="single"
                    collapsible
                    value={accordionValue}
                    onValueChange={(val) => setIsUserExpanded(val === "item-1")}
                >
                    <AccordionItem value="item-1">
                        <AccordionHeader>
                            <Switch
                                checked={isGroupVisible}
                                onCheckedChange={handleToggleGroupVisibility}
                                className="mx-2"
                            />
                            <AccordionTrigger>
                                <h3 className="font-medium text-left text-md">
                                    {layerConfig.title}
                                </h3>
                            </AccordionTrigger>
                        </AccordionHeader>
                        <AccordionContent>
                            <div className="flex items-center space-x-2 ml-2">
                                <Checkbox
                                    checked={groupCheckboxState === 'all'}
                                    onCheckedChange={handleSelectAllToggle}
                                />
                                <label className="text-sm font-medium italic">Select All</label>
                            </div>
                            {childLayers.map((child) => (
                                <div className="ml-4" key={child.title}>
                                    <LayerAccordionItem
                                        layerConfig={child}
                                        isTopLevel={false}
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        );
    }

    // --- Single Layer Rendering ---
    return (
        <div className={`mr-2 my-1 ${isTopLevel ? 'border border-secondary rounded' : ''}`}>
            <Accordion
                type="single"
                collapsible
                value={accordionValue}
                onValueChange={(val) => setIsUserExpanded(val === 'item-1')}
            >
                <AccordionItem value="item-1">
                    <AccordionHeader>
                        {isTopLevel ? (
                            <Switch
                                checked={isSelected}
                                onCheckedChange={handleLocalToggle}
                                className="mx-2"
                            />
                        ) : (
                            <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                    if (typeof checked === 'boolean') {
                                        handleLocalToggle(checked);
                                    }
                                }}
                                className="mx-2"
                            />
                        )}
                        <AccordionTrigger>
                            <h3 className="text-md font-medium text-left">
                                {layerConfig.title}
                            </h3>
                        </AccordionTrigger>
                    </AccordionHeader>
                    <AccordionContent>
                        <LayerControls
                            layerOpacity={liveLayer?.opacity ?? 1}
                            handleOpacityChange={handleOpacityChange}
                            title={layerConfig.title || ''}
                            description={layerDescriptions ? layerDescriptions[layerConfig.title || ''] : ''}
                            handleZoomToLayer={handleZoomToLayer}
                            layerId={liveLayer?.id || ''}
                            url={extentOptions.type === 'wms' ? extentOptions.wmsUrl || '' : ''}
                            openLegend={isUserExpanded}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};


export const useCustomLayerList = ({ config }: { config: LayerProps[] | null }) => {

    const layerList = useMemo(() => {
        if (!config) return [];
        return [...config].map(layer => {
            return (
                <LayerAccordionItem
                    key={layer.title}
                    layerConfig={layer}
                    isTopLevel={true}
                />
            )
        });
    }, [config]);

    return layerList;
};