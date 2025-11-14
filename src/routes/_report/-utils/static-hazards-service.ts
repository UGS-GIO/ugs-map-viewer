import groupingsData from '../-data/hazard-groupings.json';
import referencesData from '../-data/hazard-references.json';
import groupTextData from '../-data/hazard-group-text.json';
import introTextData from '../-data/hazard-intro-text.json';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import type { PostgRESTRowOf } from '@/lib/types/postgrest-types';

export interface HazardUnit {
    HazardUnit: string;
    HazardName: string;
    UnitName: string;
    Description: string;
    HowToUse: string | null;
}

export interface HazardGrouping {
    HazardCode: string;
    HazardGroup: string;
}

export interface HazardReference {
    Hazard: string;
    Text: string;
}

export interface GroupText {
    HazardGroup: string;
    Text: string;
    Order_: number;
}

export interface IntroText {
    Hazard: string;
    Text: string;
}

export interface HazardTextSections {
    intro: string | null;
    howToUse: string | null;
    moreInfo: string | null;
}

/**
 * Type for PostgREST unit_descriptions_test table response rows
 */
type HazardUnitRow = PostgRESTRowOf<{
    relate_id: string;
    hazardname: string;
    description: string;
    notes: string | null;
}>;

// Helper to extract properties from GeoJSON features
function extractFeatures<T>(geojson: { features: Array<{ properties: T }> }): T[] {
    return geojson.features.map((f) => f.properties);
}

/**
 * Query groupings - replaces queryGroupingAsync
 * @param units - Array of unit codes to filter by hazard code
 * @returns Array of groupings matching the hazard codes
 */
export function queryGroupingStatic(units: string[]): HazardGrouping[] {
    const features = extractFeatures<HazardGrouping>(groupingsData);

    // Extract hazard codes from unit codes (first 3 chars typically)
    const hazardCodes = Array.from(new Set(
        units.map(unit => getHazardCodeFromUnit(unit))
    ));

    return features.filter(g => hazardCodes.includes(g.HazardCode));
}

/**
 * Query ALL hazard units for specific hazard codes (not filtered by polygon)
 * This is used for legend display to show all possible units for a layer
 * @param hazardCodes - Array of hazard codes like ['EXS', 'LSS', 'CSS']
 * @returns Array of all unit details for those hazard codes
 */
export async function queryAllUnitsForHazardCodes(hazardCodes: string[]): Promise<HazardUnit[]> {
    if (hazardCodes.length === 0) return [];

    try {
        // Query using hazardcode field with exact match
        // This will get ALL units for each hazard code, not just ones in the polygon
        const filter = hazardCodes.map(code => `hazardcode.eq.${code}`).join(',');
        const url = `${PROD_POSTGREST_URL}/unit_descriptions_test?or=(${filter})`;

        const response = await fetch(url, {
            headers: {
                'Accept-Profile': 'hazards'
            }
        });

        if (!response.ok) {
            console.error('queryAllUnitsForHazardCodes: PostgREST request failed:', response.statusText);
            throw new Error(`PostgREST request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as HazardUnitRow[];
        // Map PostgREST results to the expected HazardUnit structure
        const postgrestResults = data.map((row): HazardUnit => ({
            HazardUnit: row.relate_id,
            HazardName: row.hazardname,
            UnitName: row.hazardname,
            Description: row.description,
            HowToUse: row.notes || null,
        }));

        return postgrestResults;

    } catch (error) {
        console.error('queryAllUnitsForHazardCodes: Fatal error during PostgREST fetch.', error);
        throw error;
    }
}

/**
 * Query hazard unit details from PostgREST.
 * @param units - Array of unit codes to query (full codes like "SVSegs", "TDSlsf", "EFlsf")
 * @returns Array of unit details
 * @throws {Error} if the PostgREST request fails.
 */
export async function queryHazardUnitsStatic(units: string[]): Promise<HazardUnit[]> {
    if (units.length === 0) return [];

    try {
        const filter = `relate_id=in.(${units.join(',')})`;
        const url = `${PROD_POSTGREST_URL}/unit_descriptions_test?${filter}`;

        const response = await fetch(url, {
            headers: {
                'Accept-Profile': 'hazards'
            }
        });

        if (!response.ok) {
            // Throw error immediately if response status is not okay (e.g., 404, 500)
            console.error('queryHazardUnitsStatic: PostgREST request failed:', response.statusText);
            throw new Error(`PostgREST request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as HazardUnitRow[];

        // Map PostgREST results to the expected HazardUnit structure
        const postgrestResults = data.map((row): HazardUnit => ({
            HazardUnit: row.relate_id,
            HazardName: row.hazardname,
            UnitName: row.hazardname,
            Description: row.description,
            HowToUse: row.notes || null,
        }));

        return postgrestResults;

    } catch (error) {
        // Re-throw the error to let the calling function (like react-query) handle the failure
        console.error('queryHazardUnitsStatic: Fatal error during PostgREST fetch.', error);
        throw error;
    }
}

/**
 * Query references - replaces queryReferenceTableAsync
 * @param units - Array of unit codes (hazard codes extracted from them)
 * @returns Array of references
 */
export function queryReferencesStatic(units: string[]): HazardReference[] {
    const features = extractFeatures<HazardReference>(referencesData);

    const hazardCodes = Array.from(new Set(
        units.map(unit => getHazardCodeFromUnit(unit))
    ));

    return features.filter(r => hazardCodes.includes(r.Hazard));
}

/**
 * Query group text - replaces queryGroupTextAsync
 * @param groups - Array of group names
 * @returns Array of group text, sorted by Order_
 */
export function queryGroupTextStatic(groups: string[]): GroupText[] {
    const features = extractFeatures<GroupText>(groupTextData);

    return features
        .filter(g => groups.includes(g.HazardGroup))
        .sort((a, b) => a.Order_ - b.Order_);
}

/**
 * Query intro text for hazards - replaces queryIntroTextAsync
 * @param units - Array of unit codes (hazard codes extracted from them)
 * @returns Array of intro text
 */
export function queryIntroTextStatic(units: string[]): IntroText[] {
    const features = extractFeatures<IntroText>(introTextData);

    const hazardCodes = Array.from(new Set(
        units.map(unit => getHazardCodeFromUnit(unit))
    ));

    return features.filter(i => hazardCodes.includes(i.Hazard));
}

/**
 * Extract hazard code from unit code
 * Examples: 
 * - "SSZsfr" -> "SFR"
 * - "Hlss" -> "LSS"
 * - "M2egs" -> "EGS"
 */
function getHazardCodeFromUnit(unitCode: string): string {
    // Uses same logic as original util.ts
    return unitCode.slice(-3).toUpperCase();
}

/**
 * Get all available hazard groups
 */
export function getAllHazardGroups(): string[] {
    const features = extractFeatures<HazardGrouping>(groupingsData);
    return Array.from(new Set(features.map(f => f.HazardGroup)));
}

/**
 * Get all hazard codes for a specific group
 */
export function getHazardCodesForGroup(groupName: string): string[] {
    const features = extractFeatures<HazardGrouping>(groupingsData);
    return features
        .filter(f => f.HazardGroup === groupName)
        .map(f => f.HazardCode);
}

/**
 * Get group intro text by group name
 * @param groupName - Name of the hazard group
 * @returns HTML intro text or null if not found
 */
export function getGroupIntroText(groupName: string): string | null {
    const features = extractFeatures<GroupText>(groupTextData);
    const group = features.find(g => g.HazardGroup === groupName);
    return group?.Text || null;
}

/**
 * Get hazard intro text by hazard code
 * The Text field in hazard-intro-text.json contains ALL sections:
 * - Intro paragraph(s)
 * - "How to Use This Map" section
 * - "More Information" section
 * 
 * @param hazardCode - Hazard code (e.g., 'SFR', 'LSS')
 * @returns Full HTML text with all sections or null if not found
 */
export function getHazardIntroText(hazardCode: string): string | null {
    const features = extractFeatures<IntroText>(introTextData);
    const hazard = features.find(h => h.Hazard === hazardCode);
    return hazard?.Text || null;
}

/**
 * Parse hazard intro text into sections
 * Extracts intro, howToUse, and moreInfo from the combined Text field
 * 
 * @param hazardCode - Hazard code
 * @returns Object with intro, howToUse, moreInfo sections
 */
export function getHazardTextSections(hazardCode: string): HazardTextSections {
    const fullText = getHazardIntroText(hazardCode);

    if (!fullText) {
        return { intro: null, howToUse: null, moreInfo: null };
    }

    // Split by section headers
    const howToUseMatch = fullText.match(/<strong>How to Use This Map<\/strong>(.*?)(?=<strong>More Information|$)/s);
    const moreInfoMatch = fullText.match(/<strong>More Information<\/strong>(.*?)$/s);

    // Everything before "How to Use This Map" is the intro
    const introMatch = fullText.split(/<strong>How to Use This Map/)[0];

    return {
        intro: introMatch?.trim() || null,
        howToUse: howToUseMatch?.[1]?.trim() || null,
        moreInfo: moreInfoMatch?.[1]?.trim() || null,
    };
}