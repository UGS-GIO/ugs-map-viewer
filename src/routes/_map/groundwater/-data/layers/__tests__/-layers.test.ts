import { describe, it, expect } from 'vitest';
import layersConfig, {
    monitoringLocationsWMSTitle,
    monitoringLocationsLayerName,
    siteAreasTitle,
    siteAreasLayerName,
} from '../layers';
import type { WMSLayerProps } from '@/lib/types/mapping-types';

describe('groundwater layer configuration', () => {
    it('contains both monitoring locations and site areas layers', () => {
        expect(layersConfig).toHaveLength(2);
        const titles = layersConfig.map(l => l.title);
        expect(titles).toContain(monitoringLocationsWMSTitle);
        expect(titles).toContain(siteAreasTitle);
    });

    describe('Well & Spring Locations layer', () => {
        const locationsLayer = layersConfig.find(
            (l): l is WMSLayerProps => l.type === 'wms' && l.title === monitoringLocationsWMSTitle
        );

        it('is configured as WMS with GeoServer groundwater workspace', () => {
            expect(locationsLayer).toBeDefined();
            const sublayer = locationsLayer?.sublayers?.[0];
            expect(sublayer?.name).toBe(`groundwater:${monitoringLocationsLayerName}`);
            expect(locationsLayer?.customLayerParameters?.cql_filter).toBe("display = '1'");
        });

        it('has popups and related tables configured', () => {
            const sublayer = locationsLayer?.sublayers?.[0];
            expect(sublayer?.popupEnabled).toBe(true);
            expect(sublayer?.queryable).toBe(true);
            expect(sublayer?.popupFields?.['Location Name']?.field).toBe('locationname');
            expect(sublayer?.popupFields?.['Location ID']?.field).toBe('locationid');

            const related = sublayer?.relatedTables;
            expect(related).toBeDefined();
            expect(related?.length).toBe(3);

            const lithology = related?.find(r => r.fieldLabel === 'Lithology');
            expect(lithology).toBeDefined();
            expect(lithology?.displayAs).toBe('table');
            expect(lithology?.targetField).toBe('locationid');
            expect(lithology?.matchingField).toBe('siteno');

            const notes = related?.find(r => r.fieldLabel === 'Field Notes');
            expect(notes).toBeDefined();
            expect(notes?.displayAs).toBe('outline');
            expect(notes?.targetField).toBe('altlocationid');
            expect(notes?.matchingField).toBe('typeid');

            const waterLevels = related?.find(r => r.fieldLabel === 'Water Level Measurements');
            expect(waterLevels).toBeDefined();
            expect(waterLevels?.displayAs).toBe('table');
            expect(waterLevels?.targetField).toBe('altlocationid');
            expect(waterLevels?.matchingField).toBe('locationid');
        });
    });

    describe('Site Areas layer', () => {
        const siteAreasLayer = layersConfig.find(
            (l): l is WMSLayerProps => l.type === 'wms' && l.title === siteAreasTitle
        );

        it('is configured as WMS with GeoServer groundwater workspace', () => {
            expect(siteAreasLayer).toBeDefined();
            const sublayer = siteAreasLayer?.sublayers?.[0];
            expect(sublayer?.name).toBe(`groundwater:${siteAreasLayerName}`);
        });

        it('has popup fields and site notes configured', () => {
            const sublayer = siteAreasLayer?.sublayers?.[0];
            expect(sublayer?.popupEnabled).toBe(true);
            expect(sublayer?.popupFields?.['Site Name']?.field).toBe('name');

            const notes = sublayer?.relatedTables?.find(r => r.fieldLabel === 'Site Notes');
            expect(notes).toBeDefined();
            expect(notes?.targetField).toBe('siteid');
            expect(notes?.matchingField).toBe('typeid');
        });
    });
});
