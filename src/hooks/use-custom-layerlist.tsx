import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, AccordionHeader } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronRight, SlidersHorizontal, Trash2 } from 'lucide-react';
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
import { useUserLayers } from '@/context/user-layers-provider';
import LayerControls from '@/components/maps/layer-controls';
import { WfsVectorLegend } from '@/components/maps/wfs-vector-legend';
import { StacRenderLegend } from '@/components/maps/stac-render-legend';
import { ZoomHintPill } from '@/components/maps/zoom-hint-pill';
import { useIsMobile } from './use-mobile';
import { PROD_GEOSERVER_URL, HAZARDS_WORKSPACE } from '@/lib/constants';
import { useLayerUrl } from '@/context/layer-url-provider';

interface LayerAccordionItemProps {
    layerConfig: LayerProps;
    isTopLevel: boolean;
    disableExport?: boolean;
    /** Optional render-prop for content shown inside a group's accordion */
    groupExtrasRender?: (groupTitle: string) => React.ReactNode;
    /** Optional render-prop for content shown inside a single layer's accordion */
    layerExtrasRender?: (layerTitle: string) => React.ReactNode;
    /** Optional render-prop for whole-layer stats / charts rendered via the Stats toggle */
    layerStatsRender?: (layerTitle: string) => React.ReactNode;
    /** Optional render-prop overriding a layer's legend content (e.g. an interactive symbology legend). */
    layerLegendRender?: (layer: LayerProps) => React.ReactNode;
}

/**
 * Collapsible "Filters" subsection rendered above a layer or group's normal
 * content. Hides itself entirely when the consumer's render-prop returns null,
 * so the slot is invisible by default and quiet for layers that have nothing
 * to expose.
 */
function FiltersCollapsible({ content }: { content: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    if (content === null || content === undefined || content === false) return null;
    // Match LayerControls' mx-8 horizontal padding so the filter row aligns with
    // the opacity slider + button cluster beneath it.
    return (
        <div className="mx-8 mt-2">
            <Collapsible open={open} onOpenChange={setOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                    <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Filters</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                    {content}
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

const LayerAccordionItem = ({ layerConfig, isTopLevel, disableExport, groupExtrasRender, layerExtrasRender, layerStatsRender, layerLegendRender }: LayerAccordionItemProps) => {
    const {
        isSelected,
        handleToggleSelection,
        groupCheckboxState,
        handleSelectAllToggle,
    } = useLayerItemState(layerConfig);

    const { map } = useMap();
    const { groupVisibility, setGroupVisibility, layerOpacity: layerOpacityMap, setLayerOpacity, updateLayerSelection } = useLayerUrl();
    const { removeUserLayer } = useUserLayers();
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

    // A child can be selected from outside the list (search, a filter) while its group
    // sits collapsed. Expand on the none → some/all transition only, so a group the user
    // collapsed by hand stays collapsed. (Mount-time selection is handled by the initializer.)
    const prevCheckboxState = useRef(groupCheckboxState);
    useEffect(() => {
        if (layerConfig.type !== 'group') return;
        if (prevCheckboxState.current === 'none' && groupCheckboxState !== 'none') {
            setIsUserExpanded(true);
        }
        prevCheckboxState.current = groupCheckboxState;
    }, [groupCheckboxState, layerConfig.type]);

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

    // Related tables live on sublayer popup config (WMS/PMTiles). Flattened
    // across sublayers so the download menu can bundle them all in one zip.
    const relatedTables = useMemo(() => {
        if (isWMSLayer(layerConfig) || isPMTilesLayer(layerConfig)) {
            return layerConfig.sublayers?.flatMap(sub => sub.relatedTables ?? []) ?? [];
        }
        return [];
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

    const handleLocalToggle = (checked: boolean) => {
        // Notify parent to clear features from results when layer is turned off
        // (handleLayerTurnedOff in useFeatureSelection handles highlight clearing declaratively)
        if (!checked && layerConfig.title) {
            onLayerTurnedOff(layerConfig.title);
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

    // Remove a user-added layer: deselect it, drop highlights, then delete it
    // from the URL recipe / IndexedDB (via the user-layers provider).
    const isUserLayer = layerConfig.userAdded === true;
    const handleRemoveUserLayer = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!layerConfig.title) return;
        onLayerTurnedOff(layerConfig.title);
        updateLayerSelection(layerConfig.title, false);
        removeUserLayer(layerConfig.title);
    }, [layerConfig.title, onLayerTurnedOff, updateLayerSelection, removeUserLayer]);

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
                                <div className="text-left">
                                    <h3 className="font-medium text-md">
                                        {layerConfig.title}
                                    </h3>
                                    {(layerConfig.subtitle ?? layerConfig.sourceAgency) && (
                                        <p className="text-xs font-normal text-muted-foreground">
                                            {layerConfig.subtitle ?? layerConfig.sourceAgency}
                                        </p>
                                    )}
                                </div>
                            </AccordionTrigger>
                        </AccordionHeader>
                        <AccordionContent>
                            {layerConfig.title && (
                                <FiltersCollapsible
                                    content={groupExtrasRender?.(layerConfig.title)}
                                />
                            )}
                            <div className="flex items-center space-x-2">
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
                                        groupExtrasRender={groupExtrasRender}
                                        layerExtrasRender={layerExtrasRender}
                                        layerStatsRender={layerStatsRender}
                                        layerLegendRender={layerLegendRender}
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
        (layerConfig.title ? layerLegendRender?.(layerConfig) : undefined)
        ?? layerConfig.customLegend
        ?? (isCOGLayer(layerConfig) ? <CogLegend layer={layerConfig} /> : undefined)
        ?? (isWFSLayer(layerConfig) ? <WfsVectorLegend layer={layerConfig} /> : undefined)
        // PMTiles layers have no GetLegendGraphic; swatches come from the STAC render.
        ?? (isPMTilesLayer(layerConfig) ? <StacRenderLegend layer={layerConfig} /> : undefined);

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
                            <div className="text-left">
                                <h3
                                    className={`text-md font-medium ${zoomHint ? 'text-muted-foreground italic' : ''}`}
                                >
                                    {layerConfig.title}
                                </h3>
                                {(layerConfig.subtitle ?? layerConfig.sourceAgency) && (
                                    <p className="text-xs font-normal text-muted-foreground">
                                        {layerConfig.subtitle ?? layerConfig.sourceAgency}
                                    </p>
                                )}
                            </div>
                        </AccordionTrigger>
                        {isUserLayer && (
                            <button
                                type="button"
                                onClick={handleRemoveUserLayer}
                                title="Remove layer"
                                aria-label={`Remove ${layerConfig.title}`}
                                className="mr-2 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        )}
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
                            layerName={extentOptions.type === 'wms' ? extentOptions.layerName : null}
                            customLegend={resolvedCustomLegend}
                            bivariateLegend={layerConfig.bivariateLegend}
                            arcgisUrl={extentOptions.type === 'arcgis' ? extentOptions.mapServerUrl : undefined}
                            legendUnit={isWMSLayer(layerConfig) ? layerConfig.legendUnit : undefined}
                            downloadParquetUrl={layerConfig.downloadParquetUrl}
                            relatedTables={relatedTables}
                            disableExport={disableExport}
                            filtersContent={layerConfig.title ? layerExtrasRender?.(layerConfig.title) : undefined}
                            statsContent={layerConfig.title ? layerStatsRender?.(layerConfig.title) : undefined}
                        />
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
};


export const useCustomLayerList = ({ config, disableExport, groupExtrasRender, layerExtrasRender, layerStatsRender, layerLegendRender }: { config: LayerProps[] | null; disableExport?: boolean; groupExtrasRender?: (groupTitle: string) => React.ReactNode; layerExtrasRender?: (layerTitle: string) => React.ReactNode; layerStatsRender?: (layerTitle: string) => React.ReactNode; layerLegendRender?: (layer: LayerProps) => React.ReactNode }) => {

    const layerList = useMemo(() => {
        if (!config) return [];
        return [...config].map(layer => {
            return (
                <LayerAccordionItem
                    key={layer.title}
                    layerConfig={layer}
                    isTopLevel={true}
                    disableExport={disableExport}
                    groupExtrasRender={groupExtrasRender}
                    layerExtrasRender={layerExtrasRender}
                    layerStatsRender={layerStatsRender}
                    layerLegendRender={layerLegendRender}
                />
            )
        });
    }, [config, disableExport, groupExtrasRender, layerExtrasRender, layerStatsRender, layerLegendRender]);

    return layerList;
};