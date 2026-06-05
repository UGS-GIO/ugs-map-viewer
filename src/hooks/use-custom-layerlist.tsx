import { useCallback, useMemo, useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, AccordionHeader } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useLayerItemState } from '@/hooks/use-layer-item-state';
import { LayerProps } from '@/lib/types/mapping-types';
import { useMap } from '@/hooks/use-map';
import { findLayerByTitle } from '@/lib/map/utils';
import { isWMSLayer, isWFSLayer, isPMTilesLayer, isArcGISMapServerLayer, isCOGLayer } from '@/lib/map/layer-utils';
import { CogLegend } from '@/components/maps/cog-legend';
import { useLayerExtent, UseLayerExtentOptions } from '@/hooks/use-layer-extent';
import { useMapZoom, getZoomHint } from '@/hooks/use-map-zoom';
import { useFetchLayerDescriptions } from '@/hooks/use-fetch-layer-descriptions';
import { useSidebar } from '@/hooks/use-sidebar';
import LayerControls from '@/components/maps/layer-controls';
import { WfsVectorLegend } from '@/components/maps/wfs-vector-legend';
import { ZoomHintPill } from '@/components/maps/zoom-hint-pill';
import { useIsMobile } from './use-mobile';
import { PROD_GEOSERVER_URL, HAZARDS_WORKSPACE } from '@/lib/constants';
import { useLayerUrl } from '@/context/layer-url-provider';

// Helper to get all child layer titles from a group
const getChildLayerTitles = (layer: LayerProps): string[] => {
    if ('layers' in layer && layer.type === 'group') {
        return (layer.layers || []).flatMap(child => getChildLayerTitles(child));
    }
    return layer.title ? [layer.title] : [];
};

interface LayerAccordionItemProps {
    layerConfig: LayerProps;
    isTopLevel: boolean;
    parentGroupTitle?: string;
    disableExport?: boolean;
}

const LayerAccordionItem = ({ layerConfig, isTopLevel, parentGroupTitle, disableExport }: LayerAccordionItemProps) => {
    const {
        isSelected,
        handleToggleSelection,
        groupCheckboxState,
        handleSelectAllToggle,
    } = useLayerItemState(layerConfig);

    const { map } = useMap();
    const { groupVisibility, setGroupVisibility, layerOpacity: layerOpacityMap, setLayerOpacity } = useLayerUrl();
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

    // Get group visibility from shared context (default: true)
    const isGroupLayerVisible = groupVisibility.get(layerConfig.title || '') ?? true;

    // Toggle visibility for group layers via shared context
    // This affects both map visibility AND queryability
    const handleGroupVisibilityToggle = useCallback((visible: boolean) => {
        if (layerConfig.type !== 'group' || !layerConfig.title) return;
        setGroupVisibility(layerConfig.title, visible);
    }, [layerConfig, setGroupVisibility]);

    // Extract extent query options based on layer type
    const extentOptions: UseLayerExtentOptions = useMemo(() => {
        if (isPMTilesLayer(layerConfig)) {
            // PMTiles bounds in file headers can be inaccurate (tippecanoe calculates global bounds)
            // Fall back to WMS GetCapabilities for layer-specific extent
            if (layerConfig.pmtilesUrl.includes('hazards.pmtiles') && layerConfig.sourceLayer) {
                return {
                    type: 'wms',
                    wmsUrl: `${PROD_GEOSERVER_URL}/wms`,
                    layerName: `${HAZARDS_WORKSPACE}:${layerConfig.sourceLayer}`,
                };
            }
            return {
                type: 'pmtiles',
                pmtilesUrl: layerConfig.pmtilesUrl,
            };
        }
        if (isWFSLayer(layerConfig)) {
            // WFS layers can use WFS GetCapabilities for extent via WMS URL
            // Extract WMS URL from WFS URL (typically replace /wfs with /wms)
            const wmsUrl = layerConfig.wfsUrl.replace('/wfs', '/wms');
            return {
                type: 'wms',
                wmsUrl,
                layerName: layerConfig.typeName,
            };
        }
        if (isArcGISMapServerLayer(layerConfig)) {
            return {
                type: 'arcgis',
                mapServerUrl: layerConfig.url,
            };
        }
        if (isWMSLayer(layerConfig)) {
            const sublayers = layerConfig.sublayers;
            const layerName = Array.isArray(sublayers) && sublayers.length > 0 && sublayers[0].name
                ? sublayers[0].name
                : null;
            return {
                type: 'wms',
                wmsUrl: layerConfig.url ?? null,
                layerName,
            };
        }
        return { type: 'wms', wmsUrl: null, layerName: null };
    }, [layerConfig]);

    const { refetch: fetchExtent, data: cachedExtent } = useLayerExtent(extentOptions);

    // Legend uses ALL sublayer names (comma-separated) so a multi-sublayer layer shows every
    // sublayer's swatches. Kept separate from extentOptions.layerName, which must stay a single
    // name — fetchLayerExtent looks it up verbatim in GetCapabilities and a joined name won't match.
    const legendLayerName = useMemo(() => {
        if (isWMSLayer(layerConfig)) {
            const names = (layerConfig.sublayers?.map(s => s.name).filter(Boolean) ?? []) as string[];
            if (names.length > 0) return names.join(',');
        }
        return extentOptions.type === 'wms' ? extentOptions.layerName : null;
    }, [layerConfig, extentOptions]);

    // Friendly heading per sublayer (its popupTitle), so a composite legend can label each group.
    const legendLayerLabels = useMemo(() => {
        if (!isWMSLayer(layerConfig)) return undefined;
        const labels: Record<string, string> = {};
        for (const sub of layerConfig.sublayers ?? []) {
            if (sub.name && sub.popupTitle) labels[sub.name] = sub.popupTitle;
        }
        return Object.keys(labels).length > 0 ? labels : undefined;
    }, [layerConfig]);

    const currentZoom = useMapZoom();
    const visibleZoomRange = layerConfig.visibleZoomRange ?? null;
    const zoomHint = isSelected ? getZoomHint(currentZoom, visibleZoomRange) : null;

    const handleZoomToVisibleRange = () => {
        if (!map || !visibleZoomRange) return;
        const [minZ, maxZ] = visibleZoomRange;
        const target = currentZoom !== null && currentZoom > maxZ ? maxZ : minZ;
        map.flyTo({ zoom: target });
    };

    const handleOpacityChange = useCallback((value: number) => {
        // Continuously updates, so don't update url with this
        if (!map || !layerConfig.title) return;
        const layer = findLayerByTitle(map, layerConfig.title);
        if (layer) {
            layer.opacity = value / 100;
        }
    }, [map, layerConfig.title]);

    const handleOpacityCommit = useCallback((value: number) => {
        // Persist to URL only on mouse up / drag end
        if (!layerConfig.title) return;
        setLayerOpacity(layerConfig.title, value / 100);
    }, [layerConfig.title, setLayerOpacity]);

    const { onLayerTurnedOff } = useMap();

    // This handler now explicitly sets the accordion state.
    // Also enables parent group visibility when selecting a child layer
    const handleLocalToggle = (checked: boolean) => {
        // Notify parent to clear features from results when layer is turned off
        // (handleLayerTurnedOff in useFeatureSelection handles highlight clearing declaratively)
        if (!checked && layerConfig.title) {
            onLayerTurnedOff(layerConfig.title);
        }

        // When selecting a child layer, ensure parent group is visible
        if (checked && parentGroupTitle) {
            const parentVisible = groupVisibility.get(parentGroupTitle) ?? true;
            if (!parentVisible) {
                setGroupVisibility(parentGroupTitle, true);
            }
        }

        handleToggleSelection(checked);
        setIsUserExpanded(checked);
    };

    const handleZoomToLayer = async () => {
        if (!map) return;
        try {
            let extent = cachedExtent;
            if (!extent) {
                const result = await fetchExtent();
                extent = result.data;
            }
            if (extent && extent.length === 4) {
                handleToggleSelection(true);
                setIsUserExpanded(true);
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
                                checked={isGroupLayerVisible}
                                onCheckedChange={handleGroupVisibilityToggle}
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
                                        disableExport={disableExport}
                                        layerConfig={child}
                                        isTopLevel={false}
                                        parentGroupTitle={layerConfig.title}
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        );
    }

    // WFS layers get a client-rendered legend by default (swatches driven by layer.style +
    // current symbology mode). COG layers render a colorbar from raster stats. Explicit
    // `customLegend` on the config always wins.
    const resolvedCustomLegend =
        layerConfig.customLegend
        ?? (isCOGLayer(layerConfig) ? <CogLegend layer={layerConfig} /> : undefined)
        ?? (isWFSLayer(layerConfig) ? <WfsVectorLegend layer={layerConfig} /> : undefined);

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
                            <h3
                                className={`text-md font-medium text-left ${zoomHint ? 'text-muted-foreground italic' : ''}`}
                            >
                                {layerConfig.title}
                            </h3>
                        </AccordionTrigger>
                    </AccordionHeader>
                    {zoomHint && visibleZoomRange && (
                        <div className="px-2 pb-2 -mt-1">
                            <ZoomHintPill
                                direction={zoomHint}
                                range={visibleZoomRange}
                                onClick={handleZoomToVisibleRange}
                            />
                        </div>
                    )}
                    <AccordionContent>
                        <LayerControls
                            layerOpacity={isSelected ? (layerOpacityMap.get(layerConfig.title || '') ?? layerConfig.opacity ?? 0.8) : null}
                            handleOpacityChange={handleOpacityChange}
                            handleOpacityCommit={handleOpacityCommit}
                            title={layerConfig.title || ''}
                            description={layerDescriptions ? layerDescriptions[layerConfig.title || ''] : ''}
                            handleZoomToLayer={handleZoomToLayer}
                            url={extentOptions.type === 'wms' ? extentOptions.wmsUrl || '' : ''}
                            openLegend={isUserExpanded}
                            layerName={extentOptions.type === 'wms' ? legendLayerName : null}
                            layerLabels={legendLayerLabels}
                            customLegend={resolvedCustomLegend}
                            bivariateLegend={layerConfig.bivariateLegend}
                            arcgisUrl={extentOptions.type === 'arcgis' ? extentOptions.mapServerUrl : undefined}
                            legendUnit={isWMSLayer(layerConfig) ? layerConfig.legendUnit : undefined}
                            downloadParquetUrl={layerConfig.downloadParquetUrl}
                            disableExport={disableExport}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};


export const useCustomLayerList = ({ config, disableExport }: { config: LayerProps[] | null; disableExport?: boolean }) => {

    const layerList = useMemo(() => {
        if (!config) return [];
        return [...config].map(layer => {
            return (
                <LayerAccordionItem
                    key={layer.title}
                    layerConfig={layer}
                    isTopLevel={true}
                    disableExport={disableExport}
                />
            )
        });
    }, [config, disableExport]);

    return layerList;
};