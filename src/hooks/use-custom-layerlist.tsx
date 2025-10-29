import { useMemo, useState } from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent, AccordionHeader } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useLayerItemState } from '@/hooks/use-layer-item-state';
import { LayerProps } from '@/lib/types/mapping-types';
import { useMap } from '@/hooks/use-map';
import { findLayerByTitle } from '@/lib/map/utils';
import { useLayerExtent } from '@/hooks/use-layer-extent';
import { useFetchLayerDescriptions } from '@/hooks/use-fetch-layer-descriptions';
import { useSidebar } from '@/hooks/use-sidebar';
import LayerControls from '@/components/custom/layer-controls';
import Extent from '@arcgis/core/geometry/Extent';
import { useIsMobile } from './use-mobile';
import Layer from '@arcgis/core/layers/Layer';
import { clearGraphics } from '@/lib/map/highlight-utils';

const LayerAccordionItem = ({ layerConfig, isTopLevel }: { layerConfig: LayerProps; isTopLevel: boolean }) => {
    const {
        isSelected,
        handleToggleSelection,
        isGroupVisible,
        handleToggleGroupVisibility,
        groupCheckboxState,
        handleSelectAllToggle,
    } = useLayerItemState(layerConfig);

    const { map, view } = useMap();
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
    }, [map, map?.allLayers, layerConfig.title]);

    const { refetch: fetchExtent, data: cachedExtent, isLoading: isExtentLoading } = useLayerExtent(liveLayer || new Layer());

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
        if (!liveLayer || isExtentLoading) return;
        try {
            const extent = cachedExtent || await fetchExtent().then(result => result.data);
            if (extent) {
                handleToggleSelection(true);
                setIsUserExpanded(true);
                view?.goTo(new Extent({ ...extent, spatialReference: { wkid: 4326 } }));
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
    let typedLayer: __esri.FeatureLayer | __esri.MapImageLayer | __esri.WMSLayer | null = null;
    if (liveLayer) {
        switch (liveLayer.type) {
            case 'feature': typedLayer = liveLayer as __esri.FeatureLayer; break;
            case 'map-image': typedLayer = liveLayer as __esri.MapImageLayer; break;
            case 'wms': typedLayer = liveLayer as __esri.WMSLayer; break;
            default: break;
        }
    }

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
                            url={typedLayer && 'url' in typedLayer ? typedLayer.url || '' : ''}
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