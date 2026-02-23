import { describe, it, expect } from 'vitest';
import groupings from '../hazard-groupings.json';

const VALID_GROUPS = ['Flooding', 'Earthquake', 'Landslide', 'Problem Soil/Rock', 'Volcanic'];

describe('hazard-groupings.json', () => {
  it('every feature has a valid HazardGroup', () => {
    for (const feature of groupings.features) {
      const { HazardCode, HazardGroup } = feature.properties;
      expect(VALID_GROUPS, `${HazardCode} has invalid group "${HazardGroup}"`).toContain(HazardGroup);
    }
  });

  it('has no duplicate HazardCodes', () => {
    const codes = groupings.features.map(f => f.properties.HazardCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
