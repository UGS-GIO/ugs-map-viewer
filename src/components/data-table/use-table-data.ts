import { useMemo } from 'react';
import { hasRasterData, type LayerContentProps, type ExtendedFeature } from '@/components/maps/popups/types';
import type { ColumnConfig, RowData } from './types';

export function useTableData(selectedLayer: LayerContentProps | null) {
    const rowData = useMemo((): RowData[] => {
        if (!selectedLayer) return [];

        // Raster-only layers have no vector features — synthesize a single row from the raster value
        if (selectedLayer.features.length === 0 && hasRasterData(selectedLayer)) {
            const rasterSource = selectedLayer.rasterSource!;
            const rasterValue = rasterSource.data?.features?.[0]?.properties?.[rasterSource.valueField];
            const displayValue = rasterSource.transform
                ? rasterSource.transform(rasterValue)
                : String(rasterValue ?? 'N/A');

            const syntheticFeature: ExtendedFeature = {
                type: 'Feature',
                id: 'raster-0',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: { [rasterSource.valueLabel]: displayValue },
                namespace: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
            };

            return [{
                id: `${selectedLayer.layerTitle}-raster-0`,
                layerTitle: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
                sourceCRS: selectedLayer.sourceCRS,
                feature: syntheticFeature,
                properties: syntheticFeature.properties || {},
                maxZoomLevel: selectedLayer.maxZoomLevel,
            }];
        }

        return selectedLayer.features.map((feature, i) => ({
            id: `${selectedLayer.layerTitle}-${feature.id || i}`,
            layerTitle: selectedLayer.layerTitle || selectedLayer.groupLayerTitle,
            sourceCRS: selectedLayer.sourceCRS,
            feature,
            properties: feature.properties || {},
            maxZoomLevel: selectedLayer.maxZoomLevel,
        }));
    }, [selectedLayer]);

    const columnConfigs = useMemo((): ColumnConfig[] => {
        if (selectedLayer?.features.length === 0 && hasRasterData(selectedLayer)) {
            const rasterSource = selectedLayer.rasterSource!;
            return [{
                id: rasterSource.valueLabel,
                label: rasterSource.valueLabel,
                field: rasterSource.valueLabel,
            }];
        }

        if (selectedLayer?.popupFields && Object.keys(selectedLayer.popupFields).length > 0) {
            const seen = new Set<string>();
            return Object.entries(selectedLayer.popupFields)
                .map(([label, fieldConfig], index) => {
                    // Custom fields use label slug as id so multiple custom columns
                    // (e.g. Location, Observed Measurement) each get their own column
                    const id = fieldConfig.type === 'custom'
                        ? (label || '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_()-]/g, '') || `custom_${index}`
                        : fieldConfig.field;
                    return { label, fieldConfig, id };
                })
                .filter(({ id }) => {
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                })
                .map(({ label, fieldConfig, id }) => ({
                    id,
                    label: label || fieldConfig.field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    field: fieldConfig.field,
                    fieldConfig,
                }));
        }

        // No popupFields configured — auto-generate columns from feature properties
        const firstFeature = selectedLayer?.features?.[0];
        if (!firstFeature?.properties) return [];

        return Object.keys(firstFeature.properties)
            .filter(key => key !== 'geometry' && key !== 'bbox')
            .map(key => ({
                id: key,
                label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                field: key,
            }));
    }, [selectedLayer]);

    return { rowData, columnConfigs };
}
