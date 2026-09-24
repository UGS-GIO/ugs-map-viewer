import { describe, it, expect } from 'vitest';
import { toSqlPredicates, toMaplibreFilter, toCql } from '../generators';
import { fromCql } from '../parse';
import { wetlandPlantsFilterSchema } from '@/routes/_map/wetlandplants/-data/layers/wetlandplants-schema';
import type { FilterState } from '../types';

describe('wetlandPlantsFilterSchema', () => {
    it('defines the 6 expected filter fields', () => {
        const fields = wetlandPlantsFilterSchema.fields.map(f => f.field);
        expect(fields).toEqual([
            'ecoregionalgroup',
            'wetlandtype',
            'watershed',
            'vegetationcondition',
            'scientificname',
            'privacystatus',
        ]);
    });

    it('configures wetlandtype with alternateField wetlandtype2', () => {
        const wtField = wetlandPlantsFilterSchema.fields.find(f => f.field === 'wetlandtype');
        expect(wtField).toBeDefined();
        if (wtField && wtField.kind === 'multiSelect') {
            expect(wtField.alternateField).toBe('wetlandtype2');
        }
    });

    it('configures scientificname as a relatedAsset filter', () => {
        const spField = wetlandPlantsFilterSchema.fields.find(f => f.field === 'scientificname');
        expect(spField).toBeDefined();
        if (spField && spField.kind === 'multiSelect') {
            expect(spField.relatedAsset).toBe('wetlands_plants_species');
            expect(spField.foreignKey).toBe('surveyeventid');
        }
    });

    it('configures privacystatus with valueLabels and swatches for symbology legend', () => {
        const privacyField = wetlandPlantsFilterSchema.fields.find(f => f.field === 'privacystatus');
        expect(privacyField).toBeDefined();
        if (privacyField && privacyField.kind === 'multiSelect') {
            expect(privacyField.valueLabels).toEqual({
                Shared: 'Exact Location',
                Confidential: 'Confidential (Approximate)',
            });
            expect(privacyField.optionSwatches).toEqual({
                Shared: '#FFD700',
                Confidential: '#D7191C',
            });
        }
    });
});

describe('wetland filter generators & parsers', () => {
    it('generates MapLibre expression matching primary and secondary wetland types', () => {
        const state: FilterState = {
            wetlandtype: { kind: 'multiSelect', values: ['Fresh Meadow', 'Marsh'] },
        };
        const filter = toMaplibreFilter(wetlandPlantsFilterSchema, state);
        expect(filter).toEqual([
            'any',
            ['in', ['get', 'wetlandtype'], ['literal', ['Fresh Meadow', 'Marsh']]],
            ['in', ['get', 'wetlandtype2'], ['literal', ['Fresh Meadow', 'Marsh']]],
        ]);
    });

    it('excludes relatedAsset fields like scientificname from toMaplibreFilter', () => {
        const state: FilterState = {
            scientificname: { kind: 'multiSelect', values: ['Typha latifolia'] },
        };
        const filter = toMaplibreFilter(wetlandPlantsFilterSchema, state);
        expect(filter).toBeNull();
    });

    it('generates SQL predicate for wetlandtype covering alternateField', () => {
        const state: FilterState = {
            wetlandtype: { kind: 'multiSelect', values: ['Fresh Meadow'] },
        };
        const predicates = toSqlPredicates(wetlandPlantsFilterSchema, state);
        expect(predicates).toEqual([
            `(CAST("wetlandtype" AS VARCHAR) IN ('Fresh Meadow') OR CAST("wetlandtype2" AS VARCHAR) IN ('Fresh Meadow'))`,
        ]);
    });

    it('excludes relatedAsset fields from toSqlPredicates', () => {
        const state: FilterState = {
            scientificname: { kind: 'multiSelect', values: ['Typha latifolia'] },
        };
        const predicates = toSqlPredicates(wetlandPlantsFilterSchema, state);
        expect(predicates).toEqual([]);
    });

    it('generates MapLibre expression matching privacystatus', () => {
        const state: FilterState = {
            privacystatus: { kind: 'multiSelect', values: ['Shared'] },
        };
        const filter = toMaplibreFilter(wetlandPlantsFilterSchema, state);
        expect(filter).toEqual(['in', ['get', 'privacystatus'], ['literal', ['Shared']]]);
    });

    it('round-trips attribute and species filter state through CQL', () => {
        const originalState: FilterState = {
            ecoregionalgroup: { kind: 'multiSelect', values: ['Basin and Range'] },
            wetlandtype: { kind: 'multiSelect', values: ['Fresh Meadow'] },
            watershed: { kind: 'multiSelect', values: ['Jordan'] },
            vegetationcondition: { kind: 'multiSelect', values: ['High Quality Reference'] },
            scientificname: { kind: 'multiSelect', values: ['Typha latifolia'] },
            privacystatus: { kind: 'multiSelect', values: ['Shared'] },
        };
        const cql = toCql(wetlandPlantsFilterSchema, originalState);
        expect(cql).toContain("ecoregionalgroup = 'Basin and Range'");
        expect(cql).toContain("wetlandtype = 'Fresh Meadow'");
        expect(cql).toContain("watershed = 'Jordan'");
        expect(cql).toContain("vegetationcondition = 'High Quality Reference'");
        expect(cql).toContain("scientificname = 'Typha latifolia'");
        expect(cql).toContain("privacystatus = 'Shared'");

        const parsed = fromCql(wetlandPlantsFilterSchema, cql);
        expect(parsed.ecoregionalgroup).toEqual({ kind: 'multiSelect', values: ['Basin and Range'] });
        expect(parsed.wetlandtype).toEqual({ kind: 'multiSelect', values: ['Fresh Meadow'] });
        expect(parsed.watershed).toEqual({ kind: 'multiSelect', values: ['Jordan'] });
        expect(parsed.vegetationcondition).toEqual({ kind: 'multiSelect', values: ['High Quality Reference'] });
        expect(parsed.scientificname).toEqual({ kind: 'multiSelect', values: ['Typha latifolia'] });
        expect(parsed.privacystatus).toEqual({ kind: 'multiSelect', values: ['Shared'] });
    });
});
