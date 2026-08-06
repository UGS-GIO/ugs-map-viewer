/** Scale bar calculation result */
export interface ScaleBarInfo {
    text: string;
    pixelWidth: number;
}

/**
 * Pick a round distance for the report map preview's scale bar, along with the pixel
 * width to draw it at. The bar must span exactly the distance it is labelled with, so
 * the chosen distance is the largest round number that fits the target width - nothing
 * downstream may clamp or stretch `pixelWidth` without relabelling.
 */
export function calculateScaleBar(bboxWidthMeters: number, canvasWidth: number, centerLat: number): ScaleBarInfo {
    const correctedWidth = bboxWidthMeters * Math.cos(centerLat * Math.PI / 180);
    const metersPerPixel = correctedWidth / canvasWidth;
    const targetPixels = Math.min(canvasWidth / 5, 150);
    let distance = targetPixels * metersPerPixel;

    let unit = 'm';
    if (distance >= 1000) {
        distance /= 1000;
        unit = 'km';
    }

    const niceNumbers = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    let bestDistance = niceNumbers[0];
    for (const n of niceNumbers) {
        if (distance >= n) bestDistance = n;
        else break;
    }

    const actualMeters = unit === 'km' ? bestDistance * 1000 : bestDistance;
    return { text: `${bestDistance} ${unit}`, pixelWidth: Math.round(actualMeters / metersPerPixel) };
}
