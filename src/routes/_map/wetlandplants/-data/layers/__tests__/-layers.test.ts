import { describe, it, expect } from 'vitest';
import layersConfig, { wetlandSurveySitesTitle } from '../layers';
import type { PMTilesLayerProps, RelatedTable } from '@/lib/types/mapping-types';
import { relatedRowToGalleryImage } from '@/lib/gallery-utils';

describe('wetlandplants layer configuration', () => {
    const surveySitesLayer = layersConfig.find(
        (l): l is PMTilesLayerProps => l.type === 'pmtiles' && l.title === wetlandSurveySitesTitle
    );

    it('contains the wetland survey sites layer with PMTiles type', () => {
        expect(surveySitesLayer).toBeDefined();
        expect(surveySitesLayer?.stacItemId).toBe('wetlands_plants_site');
    });

    it('configures wetlands_plants_photos as a gallery related table', () => {
        const sublayer = surveySitesLayer?.sublayers?.[0];
        expect(sublayer).toBeDefined();

        const photosTable = sublayer?.relatedTables?.find(
            rt => rt.stacAsset === 'wetlands_plants_photos'
        );
        expect(photosTable).toBeDefined();
        expect(photosTable?.displayAs).toBe('gallery');
        expect(photosTable?.galleryUrlField).toBe('att_name');
        expect(photosTable?.galleryLabelField).toBe('att_name');
        expect(photosTable?.galleryBaseUrl).toBe(
            'https://maps-assets.geology.utah.gov/wetlands/plantphotos'
        );
        expect(photosTable?.fieldLabel).toBe('Site Photos');
    });

    it('transforms wetlands_plants_photos row into a GalleryImage with proper URL and caption', () => {
        const sublayer = surveySitesLayer?.sublayers?.[0];
        const photosTable = sublayer?.relatedTables?.find(
            rt => rt.stacAsset === 'wetlands_plants_photos'
        ) as RelatedTable;

        const row = {
            att_name: 'UWC-30E.jpg',
            surveyeventid: 268,
            bucket_url: 'https://storage.googleapis.com/ut-dnr-ugs-maps-prod.firebasestorage.app/wetlandplants',
            photo_id: 1,
        };

        const galleryImage = relatedRowToGalleryImage(row, photosTable);
        expect(galleryImage).toBeDefined();
        expect(galleryImage?.url).toBe(
            'https://maps-assets.geology.utah.gov/wetlands/plantphotos/UWC-30E.jpg'
        );
        expect(galleryImage?.label).toBe('UWC-30E.jpg');
        expect(galleryImage?.thumbnailUrl).toBeUndefined();
    });

    it('falls back to row.bucket_url if galleryBaseUrl is omitted', () => {
        const photosTable: RelatedTable = {
            fieldLabel: 'Site Photos',
            stacAsset: 'wetlands_plants_photos',
            displayAs: 'gallery',
            galleryUrlField: 'att_name',
            galleryLabelField: 'att_name',
        };

        const row = {
            att_name: 'BR-010_1.jpg',
            surveyeventid: 751,
            bucket_url: 'https://storage.googleapis.com/ut-dnr-ugs-maps-prod.firebasestorage.app/wetlandplants',
        };

        const galleryImage = relatedRowToGalleryImage(row, photosTable);
        expect(galleryImage?.url).toBe(
            'https://maps-assets.geology.utah.gov/wetlands/plantphotos/BR-010_1.jpg'
        );
        expect(galleryImage?.label).toBe('BR-010_1.jpg');
    });
});
