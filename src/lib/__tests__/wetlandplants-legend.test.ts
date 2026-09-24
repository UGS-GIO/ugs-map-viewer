import { describe, expect, it } from 'vitest';
import { renderWetlandPlantsLegend } from '@/routes/_map/wetlandplants/-components/sidebar/wetlandplants-symbology-legend';
import { WETLANDPLANTS_FILTER_SCHEMAS } from '@/routes/_map/wetlandplants/-components/sidebar/wetlandplants-layer-filters';
import { wetlandSurveySitesConfig, wetlandSurveySitesTitle } from '@/routes/_map/wetlandplants/-data/layers/layers';
import type { LayerProps } from '@/lib/types/mapping-types';

describe('wetlandplants symbology legend wiring', () => {
    it('renders SymbologyLegend for Wetland Survey Sites PMTiles layer', () => {
        const result = renderWetlandPlantsLegend(wetlandSurveySitesConfig);
        expect(result).not.toBeNull();
    });

    it('returns null for non-wetland survey sites layers', () => {
        const otherLayer: LayerProps = {
            type: 'pmtiles',
            title: 'Other Layer',
            pmtilesUrl: 'https://example.com/other.pmtiles',
            sourceLayer: 'other',
            visible: true,
        };
        const result = renderWetlandPlantsLegend(otherLayer);
        expect(result).toBeNull();
    });

    it('configures WETLANDPLANTS_FILTER_SCHEMAS with layer and schema', () => {
        const cfg = WETLANDPLANTS_FILTER_SCHEMAS[wetlandSurveySitesTitle];
        expect(cfg).toBeDefined();
        expect(cfg.schema.recordKey).toBe(wetlandSurveySitesTitle);
        expect(cfg.layer).toBe(wetlandSurveySitesConfig);
    });
});
