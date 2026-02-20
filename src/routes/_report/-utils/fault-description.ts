import { GeoJsonProperties } from "geojson";

function toSentenceCase(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Generates a cleaned and formatted description string for a Quaternary Fault feature.
 * This logic mimics the ArcPy script's steps 8, 9, and 10 for CSV export.
 * @param properties The GeoJSON properties object for the fault feature.
 * @returns The final, cleaned description string.
 */
export function generateFaultDescription(propertiesOrArray: GeoJsonProperties | GeoJsonProperties[]): string {
  // Handle both single feature and array of features
  const featureArray = Array.isArray(propertiesOrArray) ? propertiesOrArray : [propertiesOrArray];

  if (!featureArray || featureArray.length === 0) {
    return 'No description available.';
  }

  // If multiple features, show all fault zones involved
  if (featureArray.length > 1) {
    // Use faultzone if available, otherwise fall back to faultname
    const faultZones = featureArray
      .map(f => f.faultzone ? String(f.faultzone) : (f.faultname ? String(f.faultname) : ''))
      .filter(fz => fz !== '')

    const uniqueFaultZones = [...new Set(faultZones)]
    const descriptionFromFirst = generateFaultDescription(featureArray[0])

    return `${descriptionFromFirst} (Also includes: ${uniqueFaultZones.slice(1).join(', ')})`
  }

  // Single feature - use original logic
  const properties = featureArray[0]
  if (!properties) {
    return 'No description available.';
  }

  // Extract and ensure all required properties are strings
  // Use faultzone if available, otherwise fall back to faultname
  const faultZone = properties.faultzone ? String(properties.faultzone) : (properties.faultname ? String(properties.faultname) : '');
  const faultName = properties.faultname ? String(properties.faultname) : '';
  let sectionName = properties.sectionname ? String(properties.sectionname) : '';
  const strandName = properties.strandname ? String(properties.strandname) : '';
  const mappedScale = properties.mappedscale ? String(properties.mappedscale) : '';
  const slipSense = properties.slipsense ? String(properties.slipsense) : '';
  const faultAge = properties.faultage ? String(properties.faultage) : '';
  const slipRate = properties.sliprate ? String(properties.sliprate) : '';

  // --- Step 8: Clean up SectionName ---

  // 1. If not null/empty, append ' section'
  if (sectionName.trim() !== '') {
    sectionName = `${sectionName} section`;
  }

  // 2. Cleanup replacements (handle case-insensitively)
  sectionName = sectionName.toLowerCase().replace('section section', 'section');

  // 3. Handle cases where SectionName was just a space or null/empty
  if (sectionName.trim() === 'section') {
    sectionName = ''; // Equivalent to lstrip() and final replacement
  } else {
    // Apply casing for presentation if it wasn't stripped completely
    sectionName = toSentenceCase(sectionName.trim());
  }

  // --- Step 9: Calculate Description based on conditions ---
  let description = '';
  const lowerSlipSense = slipSense.toLowerCase();
  const isFoldStructure = ['anticline', 'monocline', 'syncline'].includes(lowerSlipSense);

  if (isFoldStructure) {
    // For Anticline, Monocline, Syncline
    description = `${faultZone} ${faultName} ${sectionName} ${strandName} is a ${slipSense} that was mapped at ${mappedScale} scale. Geologic studies have determined that the structure has had movement in the last ${faultAge} years and has a slip rate of ${slipRate}.`;

  } else if (faultAge.toLowerCase() === 'undetermined') {
    // For Undetermined age
    description = `${faultZone} ${faultName} ${sectionName} ${strandName} is a ${slipSense} fault that was mapped at ${mappedScale} scale. Geologic studies have not determined the age or slip rate of the fault.`;

  } else {
    // For Known age (NOT Undetermined)
    description = `${faultZone} ${faultName} ${sectionName} ${strandName} is a ${slipSense} fault that was mapped at ${mappedScale} scale. Geologic studies have determined that the fault has had movement in the last ${faultAge} years and has a slip rate of ${slipRate}.`;
  }


  // --- Step 10: Clean up Description field ---
  // Perform the string replacements and cleaning
  description = description.replace(/Undetermined/g, 'undetermined'); // Global replace
  description = description.replace(/unnamed Quaternary/g, 'Unnamed Quaternary'); // Global replace
  description = description.replace(/None/g, ''); // Remove 'None' (case-sensitive as per script)
  description = description.replace(/ {2,}/g, ' '); // Replace 2 or more spaces with a single space
  description = description.replace(/anormal/g, 'a normal'); // Fix typo

  // Final trim to handle leading/trailing spaces created by joining and replacements
  return description.trim();
}
