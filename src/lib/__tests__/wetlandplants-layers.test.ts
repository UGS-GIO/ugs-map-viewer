import { describe, expect, it } from 'vitest';
import layersConfig from '@/routes/_map/wetlandplants/-data/layers/layers';
import type { PMTilesLayerProps } from '@/lib/types/mapping-types';

describe('wetlandplants layers configuration', () => {
    it('configures wetland survey sites layer with both plant species and project info related tables', () => {
        const siteLayer = layersConfig.find(
            (layer): layer is PMTilesLayerProps =>
                layer.type === 'pmtiles' && 'stacItemId' in layer && layer.stacItemId === 'wetlands_plants_site'
        );
        expect(siteLayer).toBeDefined();

        const sublayer = siteLayer?.sublayers?.[0];
        expect(sublayer).toBeDefined();
        expect(sublayer?.popupEnabled).toBe(true);
        expect(sublayer?.queryable).toBe(true);

        const relatedTables = sublayer?.relatedTables;
        expect(relatedTables).toHaveLength(2);

        // 1. Plant Species table
        const speciesTable = relatedTables?.[0];
        expect(speciesTable?.fieldLabel).toBe('Plant Species');
        expect(speciesTable?.stacAsset).toBe('wetlands_plants_species');
        expect(speciesTable?.displayAs).toBe('table');

        // 2. Project Information table
        const projectTable = relatedTables?.[1];
        expect(projectTable?.fieldLabel).toBe('Project Information');
        expect(projectTable?.fetchMode).toBe('parquet');
        expect(projectTable?.targetField).toBe('project');
        expect(projectTable?.matchingField).toBe('projectcode');
        expect(projectTable?.url).toContain('parquet/wetlands_plants_projects/wetlands_plants_projects.parquet');
        expect(projectTable?.displayAs).toBe('outline');
        expect(projectTable?.sortBy).toBe('projectcode');

        const fields = projectTable?.displayFields?.map(f => f.field);
        expect(fields).toEqual([
            'projectcode',
            'organization',
            'contactinfo',
            'projectgoal',
            'methodname',
            'assessmentareadescription',
            'vegetationmethod',
            'vegetationcalculation',
            'reportlink',
        ]);

        // Transform tests
        const reportlinkField = projectTable?.displayFields?.find(f => f.field === 'reportlink');
        expect(reportlinkField?.transform?.('')).toBe('—');
        expect(reportlinkField?.transform?.('javascript:alert(1)')).toBe('javascript:alert(1)');
        expect(reportlinkField?.transform?.('https://doi.org/10.34191/RI-291')).not.toBe('—');

        const contactinfoField = projectTable?.displayFields?.find(f => f.field === 'contactinfo');
        expect(contactinfoField?.transform?.('')).toBe('—');
        expect(contactinfoField?.transform?.('user@example.com')).toBe('user@example.com');
    });
});
