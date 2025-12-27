import { useMemo, useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import Layers from "@/components/sidebar/layers";
import { useCustomLayerList } from "@/hooks/use-custom-layerlist";
import { useFetchReviewableLayers } from "@/hooks/use-fetch-reviewable-layers";
import { ExtendedSublayerProperties, LayerProps } from "@/lib/types/mapping-types";
import { isGroupLayer, isWMSLayer } from "@/lib/map/utils";
import { useGetLayerConfigsData } from "@/hooks/use-get-layer-configs";

const getFilteredLayers = (
    layers: LayerProps[],
    reviewableNames: Set<string>
): LayerProps[] => {
    return layers
        .map((layer): LayerProps | null => {
            if (isWMSLayer(layer)) {
                const sublayers = layer.sublayers?.filter((sub: ExtendedSublayerProperties) => sub.name !== undefined && reviewableNames.has(sub.name));
                return sublayers?.length ? { ...layer, sublayers } : null;
            }

            if (isGroupLayer(layer)) {
                const nestedLayers = layer.layers ? getFilteredLayers(layer.layers, reviewableNames) : [];
                return nestedLayers.length ? { ...layer, layers: nestedLayers } : null;
            }

            return null;
        })
        .filter(Boolean) as LayerProps[];
};

const LayersWithReview = () => {
    const [view, setView] = useState<'review' | 'default'>('review');
    const layerConfig = useGetLayerConfigsData('review-layers');
    const { data: reviewableLayers } = useFetchReviewableLayers();

    const filteredLayerConfig = useMemo(() => {
        if (!layerConfig || !reviewableLayers) return [];

        const reviewableNames = new Set(reviewableLayers.map(layer => layer.value));
        return getFilteredLayers(layerConfig, reviewableNames);
    }, [layerConfig, reviewableLayers]);

    const reviewLayerList = useCustomLayerList({ config: filteredLayerConfig });

    return (
        <Card className="border-none shadow-none">
            <CardHeader>
                <CardTitle>Layer Controls</CardTitle>
                <div className="pt-2">
                    <ToggleGroup
                        type="single"
                        value={view}
                        onValueChange={(value) => {
                            if (value) setView(value as 'review' | 'default');
                        }}
                        className="justify-start"
                    >
                        <ToggleGroupItem value="review">For Review</ToggleGroupItem>
                        <ToggleGroupItem value="default">Published</ToggleGroupItem>
                    </ToggleGroup>
                </div>
                <CardDescription className="pt-2">
                    {view === 'review'
                        ? "Showing only layers that are currently under review."
                        : "Showing all publicly available hazard layers."}
                </CardDescription>
            </CardHeader>

            <Collapsible open={view === 'review'}>
                <CollapsibleContent>
                    <div className="overflow-y-visible">
                        {reviewLayerList}
                    </div>
                </CollapsibleContent>
            </Collapsible>

            <Collapsible open={view === 'default'}>
                <CollapsibleContent>
                    <Layers />
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
};

export { LayersWithReview };