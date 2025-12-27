import { SYMBOL_CONSTANTS } from "@/lib/constants";
import { Symbolizer } from "@/lib/types/geoserver-types";
import { createEmptySVG } from "@/lib/legend/symbol-generator";

/**
 * Creates an SVG symbol for point features based on the provided symbolizers.
 * @param symbolizers - Array of Symbolizer objects defining the styles.
 * @returns An SVGSVGElement representing the point symbol.
 */
export function createPointSymbol(symbolizers: Symbolizer[]): SVGSVGElement {
    const pointSymbolizer = symbolizers.find(symbolizer => 'Point' in symbolizer)?.Point;

    if (!pointSymbolizer) {
        throw new Error("No valid Point symbolizer found in the provided symbolizers.");
    }

    const { size, opacity, rotation, graphics } = pointSymbolizer;
    const graphic = graphics && graphics.length > 0 ? graphics[0] : null;

    if (!graphic) {
        throw new Error("No valid graphic found in the Point symbolizer.");
    }

    const rawParsedSize = parseSize(size);
    const parsedOpacity = parseFloat(opacity) || 1.0;
    const parsedRotation = parseFloat(rotation) || 0.0;

    // Smart sizing for legend display
    const parsedSize = calculateLegendPointSize(rawParsedSize);

    const svg = createEmptySVG();
    const centerX = SYMBOL_CONSTANTS.SVG_WIDTH / 2;
    const centerY = SYMBOL_CONSTANTS.SVG_HEIGHT / 2;
    const pixelSize = rawParsedSize * SYMBOL_CONSTANTS.POINT_TO_PIXEL_RATIO;
    const radius = pixelSize / 2;

    // Check for external graphic first
    if (graphic["external-graphic-url"] && graphic["external-graphic-type"]) {
        const imageUrl = graphic["external-graphic-url"];
        const imageSize = rawParsedSize * SYMBOL_CONSTANTS.IMAGE_SCALING_RATIO;

        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("href", imageUrl);
        image.setAttribute("x", (centerX - imageSize / 2).toString());
        image.setAttribute("y", (centerY - imageSize / 2).toString());
        image.setAttribute("width", imageSize.toString());
        image.setAttribute("height", imageSize.toString());

        if (parsedOpacity !== 1.0) {
            image.setAttribute("opacity", parsedOpacity.toString());
        }

        if (parsedRotation !== 0) {
            image.setAttribute("transform", `rotate(${parsedRotation} ${centerX} ${centerY})`);
        }

        svg.appendChild(image);
        return svg;
    }

    const { fill, stroke, mark } = graphic;
    const fillOpacity = graphic["fill-opacity"];
    const strokeWidth = graphic["stroke-width"];

    const element = createMarkElement(mark, centerX, centerY, radius, parsedSize, stroke, strokeWidth);

    // Apply common styling (for shapes that support fill/stroke)
    if (mark?.toLowerCase() !== "cross" && mark?.toLowerCase() !== "x") {
        const finalFill = fill || "#000000";
        const finalFillOpacity = (parsedOpacity * parseFloat(fillOpacity || "1"));
        const finalStroke = stroke || "#000000";
        const finalStrokeWidth = strokeWidth || "1";

        element.setAttribute("fill", finalFill);
        element.setAttribute("fill-opacity", finalFillOpacity.toString());
        element.setAttribute("stroke", finalStroke);
        element.setAttribute("stroke-width", finalStrokeWidth);
    }

    if (parsedRotation !== 0) {
        element.setAttribute("transform", `rotate(${parsedRotation} ${centerX} ${centerY})`);
    }

    svg.appendChild(element);
    return svg;
}

function createMarkElement(
    mark: string | undefined,
    centerX: number,
    centerY: number,
    radius: number,
    parsedSize: number,
    stroke: string | undefined,
    strokeWidth: string | undefined
): SVGElement {
    switch (mark?.toLowerCase()) {
        case "circle":
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", centerX.toString());
            circle.setAttribute("cy", centerY.toString());
            circle.setAttribute("r", radius.toString());
            return circle;

        case "square":
            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", (centerX - radius).toString());
            rect.setAttribute("y", (centerY - radius).toString());
            rect.setAttribute("width", parsedSize.toString());
            rect.setAttribute("height", parsedSize.toString());
            return rect;

        case "triangle":
            const triangle = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const height = parsedSize * Math.sqrt(3) / 2;
            const trianglePoints = [
                [centerX, centerY - height / 2],
                [centerX - radius, centerY + height / 2],
                [centerX + radius, centerY + height / 2]
            ].map(point => point.join(',')).join(' ');
            triangle.setAttribute("points", trianglePoints);
            return triangle;

        case "diamond":
            const diamond = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const diamondPoints = [
                [centerX, centerY - radius],
                [centerX + radius, centerY],
                [centerX, centerY + radius],
                [centerX - radius, centerY]
            ].map(point => point.join(',')).join(' ');
            diamond.setAttribute("points", diamondPoints);
            return diamond;

        case "cross":
            return createCrossElement(centerX, centerY, radius, stroke, strokeWidth);

        case "x":
            return createXElement(centerX, centerY, radius, stroke, strokeWidth);

        default:
            // Default to circle for unknown marks
            const defaultCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            defaultCircle.setAttribute("cx", centerX.toString());
            defaultCircle.setAttribute("cy", centerY.toString());
            defaultCircle.setAttribute("r", radius.toString());
            return defaultCircle;
    }
}


function createXElement(
    centerX: number,
    centerY: number,
    radius: number,
    stroke: string | undefined,
    strokeWidth: string | undefined
): SVGElement {
    const element = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const xLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xLine1.setAttribute("x1", (centerX - radius).toString());
    xLine1.setAttribute("y1", (centerY - radius).toString());
    xLine1.setAttribute("x2", (centerX + radius).toString());
    xLine1.setAttribute("y2", (centerY + radius).toString());
    xLine1.setAttribute("stroke", stroke || "#000000");
    xLine1.setAttribute("stroke-width", strokeWidth || "1");

    const xLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    xLine2.setAttribute("x1", (centerX + radius).toString());
    xLine2.setAttribute("y1", (centerY - radius).toString());
    xLine2.setAttribute("x2", (centerX - radius).toString());
    xLine2.setAttribute("y2", (centerY + radius).toString());
    xLine2.setAttribute("stroke", stroke || "#000000");
    xLine2.setAttribute("stroke-width", strokeWidth || "1");

    element.appendChild(xLine1);
    element.appendChild(xLine2);
    return element;
}

function calculateLegendPointSize(rawSize: number): number {
    if (rawSize <= 5) {
        return Math.max(6, rawSize * 1.5);
    } else if (rawSize <= 20) {
        return Math.min(16, rawSize * 0.8);
    } else {
        return Math.min(18, 8 + (rawSize - 20) * 0.3);
    }
}

// Utility function to parse size from string or number
function parseSize(size: string | number): number {
    if (typeof size === 'number') {
        return size;
    }

    if (typeof size === 'string') {
        const simpleNumeric = parseFloat(size);
        if (!isNaN(simpleNumeric)) {
            return simpleNumeric > SYMBOL_CONSTANTS.MAX_POINT_SIZE ? SYMBOL_CONSTANTS.MAX_POINT_SIZE : simpleNumeric;
        }

        if (size.includes('Interpolate')) {
            return 12;
        }

        const numbers = size.match(/\d+\.?\d*/g);
        if (numbers && numbers.length > 0) {
            return parseFloat(numbers[numbers.length - 1]);
        }
    }

    return SYMBOL_CONSTANTS.DEFAULT_POINT_SIZE;
}

function createCrossElement(
    centerX: number,
    centerY: number,
    radius: number,
    stroke: string | undefined,
    strokeWidth: string | undefined
): SVGElement {
    const element = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const crossLine1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    crossLine1.setAttribute("x1", (centerX - radius).toString());
    crossLine1.setAttribute("y1", centerY.toString());
    crossLine1.setAttribute("x2", (centerX + radius).toString());
    crossLine1.setAttribute("y2", centerY.toString());
    crossLine1.setAttribute("stroke", stroke || "#000000");
    crossLine1.setAttribute("stroke-width", strokeWidth || "1");

    const crossLine2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    crossLine2.setAttribute("x1", centerX.toString());
    crossLine2.setAttribute("y1", (centerY - radius).toString());
    crossLine2.setAttribute("x2", centerX.toString());
    crossLine2.setAttribute("y2", (centerY + radius).toString());
    crossLine2.setAttribute("stroke", stroke || "#000000");
    crossLine2.setAttribute("stroke-width", strokeWidth || "1");

    element.appendChild(crossLine1);
    element.appendChild(crossLine2);
    return element;
}