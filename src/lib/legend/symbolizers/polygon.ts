import { FillSymbolizer, GraphicFillData, LineCap, LineJoin, StrokeSymbolizer, Symbolizer } from "@/lib/types/geoserver-types";
import { createEmptySVG } from "@/lib/legend/symbol-generator";
import { SYMBOL_CONSTANTS } from "@/lib/constants";

type SymbolizerWithPolygon = Symbolizer & { Polygon: FillSymbolizer | StrokeSymbolizer };

/**
 * Type guard to check if a symbolizer has a Polygon property.
 * @param symbolizer - The symbolizer to check.
 * @returns True if the symbolizer has a Polygon property, false otherwise.
 */
function isSymbolizerWithPolygon(symbolizer: Symbolizer): symbolizer is SymbolizerWithPolygon {
    return 'Polygon' in symbolizer;
}

/**
 * Handles the fill properties of a FillSymbolizer and returns the fill color with opacity applied.
 * @param fillSymbolizer - The FillSymbolizer object containing fill properties.
 * @returns The fill color with opacity applied in hex format.
 */
function handleFillSymbolizer(fillSymbolizer: FillSymbolizer) {
    const fillOpacity = parseFloat(fillSymbolizer["fill-opacity"] || "");
    return addOpacityToHex(fillSymbolizer.fill || "", fillOpacity);
}

/**
 * Handles the stroke properties of a StrokeSymbolizer and returns an object containing stroke details.
 * @param strokeSymbolizer - The StrokeSymbolizer object containing stroke properties.
 * @returns An object with stroke color (with opacity), width, line join, and line cap.
 */
function handleStrokeSymbolizer(strokeSymbolizer: StrokeSymbolizer) {
    const stroke = strokeSymbolizer.stroke || "";

    const strokeOpacity = parseFloat(strokeSymbolizer["stroke-opacity"] || "1");
    const strokeWidth = parseFloat(strokeSymbolizer["stroke-width"] || "1");
    const strokeJoin = strokeSymbolizer["stroke-linejoin"] || "round";
    const strokeCap = strokeSymbolizer["stroke-linecap"] || "round";
    const strokeColorWithOpacity = addOpacityToHex(stroke, strokeOpacity);

    return { strokeColorWithOpacity, strokeWidth, strokeJoin, strokeCap };
}

/**
 * Creates an SVG symbol for polygon features based on the provided symbolizers.
 * It supports both fill and stroke properties, including graphic fills.
 * @param symbolizers - Array of Symbolizer objects defining the styles.
 * @returns An SVGSVGElement representing the polygon symbol.
 */
export function createPolygonSymbol(symbolizers: Symbolizer[]): SVGSVGElement {
    let fillColorWithOpacity = "transparent";
    let strokeColorWithOpacity = "#000000";
    let strokeWidth = 1;
    let strokeJoin: LineJoin = "round";
    let strokeCap: LineCap = "round";
    let strokeDasharray = "";
    let hasGraphicFill = false;
    let graphicFillPattern: SVGElement | null = null;

    const PolygonSymbolizer = symbolizers.find(symbolizer => 'Polygon' in symbolizer)?.Polygon as StrokeSymbolizer;

    if (!PolygonSymbolizer) {
        throw new Error("No valid Polygon symbolizer found in the provided symbolizers.");
    }

    symbolizers.forEach(symbolizer => {
        if (isSymbolizerWithPolygon(symbolizer)) {
            // Check for GraphicFill
            const polygonData = symbolizer.Polygon;

            const graphicFill = polygonData.GraphicFill || polygonData['graphic-fill'];
            if (graphicFill) {
                hasGraphicFill = true;
                graphicFillPattern = createGraphicFillPatternElement(graphicFill);
            } else if ('fill' in symbolizer.Polygon) {
                fillColorWithOpacity = handleFillSymbolizer(symbolizer.Polygon);
            }

            if ('stroke' in symbolizer.Polygon) {
                const strokeSymbolizer = handleStrokeSymbolizer(symbolizer.Polygon);
                strokeColorWithOpacity = strokeSymbolizer.strokeColorWithOpacity;
                strokeWidth = strokeSymbolizer.strokeWidth;
                strokeJoin = strokeSymbolizer.strokeJoin;
                strokeCap = strokeSymbolizer.strokeCap;

                // Handle dash array
                const strokeData = symbolizer.Polygon as StrokeSymbolizer;
                if (strokeData["stroke-dasharray"]) {
                    strokeDasharray = strokeData["stroke-dasharray"].join(" ");
                }
            }
        }
    });

    const svg = createEmptySVG();

    // Create pattern definition if we have GraphicFill
    if (hasGraphicFill && graphicFillPattern) {
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");

        const patternId = generateUniquePatternId();
        pattern.setAttribute("id", patternId);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", SYMBOL_CONSTANTS.PATTERN_TILE_SIZE.toString());
        pattern.setAttribute("height", SYMBOL_CONSTANTS.PATTERN_TILE_SIZE.toString());
        pattern.appendChild(graphicFillPattern);
        defs.appendChild(pattern);
        svg.appendChild(defs);
        fillColorWithOpacity = `url(#${patternId})`;
    }

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", SYMBOL_CONSTANTS.LINE_START_X.toString());
    rect.setAttribute("y", "3");
    rect.setAttribute("width", "28");
    rect.setAttribute("height", "14");
    rect.setAttribute("fill", fillColorWithOpacity);
    rect.setAttribute("stroke", strokeColorWithOpacity);
    rect.setAttribute("stroke-width", strokeWidth.toString());
    rect.setAttribute("stroke-linecap", strokeCap);
    rect.setAttribute("stroke-linejoin", strokeJoin);

    if (strokeDasharray) {
        rect.setAttribute("stroke-dasharray", strokeDasharray);
    }

    svg.appendChild(rect);
    return svg;
}

/**
 * Adds opacity to a hex color string.
 * @param hex - The hex color string (e.g., "#RRGGBB" or "#RRGGBBAA").
 * @param opacity - The opacity value (0 to 1).
 * @returns The hex color string with opacity applied (e.g., "#RRGGBBAA").
 * */
function addOpacityToHex(hex: string, opacity: number): string {
    if (!hex) {
        return "#000000FF";
    }

    const validOpacity = Math.max(0, Math.min(1, opacity));
    const alpha = Math.round(validOpacity * 255).toString(16).padStart(2, '0').toUpperCase();

    if (hex.length === 9) {
        return `${hex.substring(0, 7)}${alpha}`;
    }

    return `${hex}${alpha}`;
}

/**
 * Generates a unique pattern ID for SVG patterns.
 * @returns A unique pattern ID string.
 */
function generateUniquePatternId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 5);
    return `graphicFillPattern_${timestamp}_${randomStr}`;
}

/**
 * Creates an SVG element for a GraphicFill pattern based on the provided GraphicFillData.
 * @param graphicFill - The GraphicFillData object containing graphic fill properties.
 * @returns An SVGElement representing the graphic fill pattern, or null if unsupported.
 * */
function createGraphicFillPatternElement(graphicFill: GraphicFillData): SVGElement | null {
    try {
        if (!graphicFill.graphics || graphicFill.graphics.length === 0) {
            console.warn("No graphics found in GraphicFill data");
            return null;
        }

        const graphic = graphicFill.graphics[0];
        if (!graphic.mark) {
            console.warn("No mark specified in graphic data");
            return null;
        }

        const strokeColor = graphic.stroke || graphic.fill || "#000000";
        const strokeWidth = graphic["stroke-width"] || "1";
        const fillColor = graphic.fill || "none";

        return createPatternMarkElement(graphic.mark, strokeColor, strokeWidth, fillColor);
    } catch (error) {
        console.error("Error creating graphic fill pattern:", error);
        return null;
    }
}

/**
 * Creates an SVG element for a given pattern mark type.
 * @param mark 
 * @param strokeColor 
 * @param strokeWidth 
 * @param fillColor 
 * @returns An SVGElement representing the mark, or null if unsupported.
 */
function createPatternMarkElement(
    mark: string,
    strokeColor: string,
    strokeWidth: string,
    fillColor: string
): SVGElement | null {
    const tileSize = SYMBOL_CONSTANTS.PATTERN_TILE_SIZE;

    switch (mark.toLowerCase()) {
        case 'shape://slash':
        case 'slash':
            const slashLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            slashLine.setAttribute("x1", "0");
            slashLine.setAttribute("y1", tileSize.toString());
            slashLine.setAttribute("x2", tileSize.toString());
            slashLine.setAttribute("y2", "0");
            slashLine.setAttribute("stroke", strokeColor);
            slashLine.setAttribute("stroke-width", strokeWidth);
            return slashLine;

        case 'shape://backslash':
        case 'backslash':
            const backslashLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            backslashLine.setAttribute("x1", "0");
            backslashLine.setAttribute("y1", "0");
            backslashLine.setAttribute("x2", tileSize.toString());
            backslashLine.setAttribute("y2", tileSize.toString());
            backslashLine.setAttribute("stroke", strokeColor);
            backslashLine.setAttribute("stroke-width", strokeWidth);
            return backslashLine;

        case 'shape://plus':
        case 'plus':
            const plusGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const centerX = tileSize / 2;
            const centerY = tileSize / 2;

            const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hLine.setAttribute("x1", "0");
            hLine.setAttribute("y1", centerY.toString());
            hLine.setAttribute("x2", tileSize.toString());
            hLine.setAttribute("y2", centerY.toString());
            hLine.setAttribute("stroke", strokeColor);
            hLine.setAttribute("stroke-width", strokeWidth);

            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", centerX.toString());
            vLine.setAttribute("y1", "0");
            vLine.setAttribute("x2", centerX.toString());
            vLine.setAttribute("y2", tileSize.toString());
            vLine.setAttribute("stroke", strokeColor);
            vLine.setAttribute("stroke-width", strokeWidth);

            plusGroup.appendChild(hLine);
            plusGroup.appendChild(vLine);
            return plusGroup;

        case 'shape://times':
        case 'times':
        case 'x':
            const timesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");

            const diag1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
            diag1.setAttribute("x1", "0");
            diag1.setAttribute("y1", "0");
            diag1.setAttribute("x2", tileSize.toString());
            diag1.setAttribute("y2", tileSize.toString());
            diag1.setAttribute("stroke", strokeColor);
            diag1.setAttribute("stroke-width", strokeWidth);

            const diag2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
            diag2.setAttribute("x1", "0");
            diag2.setAttribute("y1", tileSize.toString());
            diag2.setAttribute("x2", tileSize.toString());
            diag2.setAttribute("y2", "0");
            diag2.setAttribute("stroke", strokeColor);
            diag2.setAttribute("stroke-width", strokeWidth);

            timesGroup.appendChild(diag1);
            timesGroup.appendChild(diag2);
            return timesGroup;

        case 'shape://dot':
        case 'dot':
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", (tileSize / 2).toString());
            dot.setAttribute("cy", (tileSize / 2).toString());
            dot.setAttribute("r", "1");
            dot.setAttribute("fill", fillColor !== "none" ? fillColor : strokeColor);
            return dot;

        case 'shape://circle':
        case 'circle':
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", (tileSize / 2).toString());
            circle.setAttribute("cy", (tileSize / 2).toString());
            circle.setAttribute("r", "2");
            circle.setAttribute("fill", fillColor);
            circle.setAttribute("stroke", strokeColor);
            circle.setAttribute("stroke-width", strokeWidth);
            return circle;

        case 'shape://square':
        case 'square':
            const square = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const squareSize = 4;
            square.setAttribute("x", ((tileSize - squareSize) / 2).toString());
            square.setAttribute("y", ((tileSize - squareSize) / 2).toString());
            square.setAttribute("width", squareSize.toString());
            square.setAttribute("height", squareSize.toString());
            square.setAttribute("fill", fillColor);
            square.setAttribute("stroke", strokeColor);
            square.setAttribute("stroke-width", strokeWidth);
            return square;

        case 'shape://triangle':
        case 'triangle':
            const triangle = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const triCenterX = tileSize / 2;
            const triCenterY = tileSize / 2;
            const size = 3;
            const trianglePoints = [
                [triCenterX, triCenterY - size],
                [triCenterX - size, triCenterY + size],
                [triCenterX + size, triCenterY + size]
            ].map(point => point.join(',')).join(' ');
            triangle.setAttribute("points", trianglePoints);
            triangle.setAttribute("fill", fillColor);
            triangle.setAttribute("stroke", strokeColor);
            triangle.setAttribute("stroke-width", strokeWidth);
            return triangle;

        case 'shape://vertline':
        case 'vertline':
        case 'vertical':
            const vertLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vertLine.setAttribute("x1", (tileSize / 2).toString());
            vertLine.setAttribute("y1", "0");
            vertLine.setAttribute("x2", (tileSize / 2).toString());
            vertLine.setAttribute("y2", tileSize.toString());
            vertLine.setAttribute("stroke", strokeColor);
            vertLine.setAttribute("stroke-width", strokeWidth);
            return vertLine;

        case 'shape://horline':
        case 'horline':
        case 'horizontal':
            const horLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            horLine.setAttribute("x1", "0");
            horLine.setAttribute("y1", (tileSize / 2).toString());
            horLine.setAttribute("x2", tileSize.toString());
            horLine.setAttribute("y2", (tileSize / 2).toString());
            horLine.setAttribute("stroke", strokeColor);
            horLine.setAttribute("stroke-width", strokeWidth);
            return horLine;

        default:
            console.warn(`Unsupported graphic fill mark type: ${mark}`);
            return null;
    }
}
