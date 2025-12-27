import { SYMBOL_CONSTANTS } from "@/lib/constants";
import { GraphicStrokeData, StrokeSymbolizer, Symbolizer } from "@/lib/types/geoserver-types";

export interface CompositeSymbolResult {
    symbol?: SVGSVGElement;
    html?: HTMLElement | SVGSVGElement;
    isComposite: boolean;
    symbolizers: Symbolizer[];
}

/**
 * Creates a composite line symbol from an array of symbolizers.
 * 
 * @param symbolizers - Array of Symbolizer objects defining the styles.
 * @returns - An object containing the composite SVG symbol and metadata.
 */
export function createCompositeLineSymbol(symbolizers: Symbolizer[]): CompositeSymbolResult {
    const lineSymbolizers = symbolizers.filter(symbolizer => 'Line' in symbolizer);

    if (lineSymbolizers.length === 0) {
        throw new Error("No valid Line symbolizer found in the provided symbolizers.");
    }

    const compositeHtml = createCompositeLineHTML(lineSymbolizers);

    return {
        html: compositeHtml,
        symbol: compositeHtml,
        isComposite: lineSymbolizers.length > 1,
        symbolizers: lineSymbolizers
    };
}

/** Create composite SVG for multiple line symbolizers
* @param lineSymbolizers - Array of line symbolizers
* @returns SVGSVGElement representing the composite line symbol
*/
function createCompositeLineHTML(lineSymbolizers: Symbolizer[]): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", SYMBOL_CONSTANTS.SVG_WIDTH.toString());
    svg.setAttribute("height", SYMBOL_CONSTANTS.SVG_HEIGHT.toString());
    svg.setAttribute("viewBox", `0 0 ${SYMBOL_CONSTANTS.SVG_WIDTH} ${SYMBOL_CONSTANTS.SVG_HEIGHT}`);
    svg.style.display = "block";
    svg.style.width = `${SYMBOL_CONSTANTS.SVG_WIDTH}px`;
    svg.style.height = `${SYMBOL_CONSTANTS.SVG_HEIGHT}px`;
    svg.style.maxWidth = `${SYMBOL_CONSTANTS.SVG_WIDTH}px`;
    svg.style.maxHeight = `${SYMBOL_CONSTANTS.SVG_HEIGHT}px`;
    svg.style.minWidth = `${SYMBOL_CONSTANTS.SVG_WIDTH}px`;
    svg.style.minHeight = `${SYMBOL_CONSTANTS.SVG_HEIGHT}px`;

    // Process symbolizers in order (first = bottom layer, last = top layer)
    lineSymbolizers.forEach((symbolizer, index) => {
        try {
            const lineData = symbolizer.Line as StrokeSymbolizer;
            // Check if this symbolizer has GraphicStroke
            const graphicStroke = lineData.GraphicStroke || lineData['graphic-stroke'];

            if (graphicStroke) {
                // For GraphicStroke symbolizers, ONLY add the graphic symbols, not another line
                const strokeElements = createGraphicStrokeElements(graphicStroke);
                strokeElements.forEach(element => svg.appendChild(element));
            } else {
                // For regular line symbolizers, create the base line (which may have dash patterns)
                const line = createSVGLineElement(lineData);
                svg.appendChild(line);
            }
        } catch (error) {
            console.error(`Error processing line symbolizer at index ${index}:`, error);
        }
    });

    return svg;
}

/** Create an SVG line element based on the StrokeSymbolizer properties
 * @param lineSymbolizer - StrokeSymbolizer defining the line style
 * @returns SVGLineElement styled according to the symbolizer
 */
export function createSVGLineElement(lineSymbolizer: StrokeSymbolizer): SVGLineElement {
    const {
        stroke = "#000000",
        "stroke-width": strokeWidth = "1",
        "stroke-linecap": strokeLinecap = "round",
        "stroke-linejoin": strokeLinejoin = "round",
        "stroke-dasharray": strokeDasharray,
        "stroke-opacity": strokeOpacity = "1",
    } = lineSymbolizer;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

    // Position line in center of SVG
    line.setAttribute("x1", SYMBOL_CONSTANTS.LINE_START_X.toString());
    line.setAttribute("y1", SYMBOL_CONSTANTS.LINE_Y_CENTER.toString());
    line.setAttribute("x2", SYMBOL_CONSTANTS.LINE_END_X.toString());
    line.setAttribute("y2", SYMBOL_CONSTANTS.LINE_Y_CENTER.toString());

    // Make lines a bit thicker for better visibility
    const originalWidth = parseFloat(strokeWidth);
    const enhancedWidth = Math.max(SYMBOL_CONSTANTS.MIN_LINE_WIDTH, originalWidth + SYMBOL_CONSTANTS.LINE_WIDTH_ENHANCEMENT);

    // Apply styling
    line.setAttribute("stroke", stroke);
    line.setAttribute("stroke-width", enhancedWidth.toString());
    line.setAttribute("stroke-linecap", strokeLinecap);
    line.setAttribute("stroke-linejoin", strokeLinejoin);
    line.setAttribute("stroke-opacity", strokeOpacity);

    // Handle dash patterns
    if (strokeDasharray && strokeDasharray.length > 0) {
        line.setAttribute("stroke-dasharray", strokeDasharray.join(" "));
    }

    return line;
}

/** Create SVG elements for GraphicStroke symbolizer
 * @param graphicStroke - GraphicStrokeData defining the graphic stroke style
 * @returns Array of SVGElement representing the graphic stroke symbols
 */
function createGraphicStrokeElements(graphicStroke: GraphicStrokeData): SVGElement[] {
    const elements: SVGElement[] = [];

    try {
        if (!graphicStroke.graphics || graphicStroke.graphics.length === 0) {
            console.warn("No graphics found in GraphicStroke data");
            return elements;
        }

        const graphic = graphicStroke.graphics[0];
        const originalSize = parseFloat(graphicStroke.size || "6");

        if (!graphic.mark) {
            console.warn("No mark specified in graphic data");
            return elements;
        }

        // For legend display, we want multiple symbols spanning the full line width
        const symbolCount = SYMBOL_CONSTANTS.TRIANGLE_COUNT;
        const lineStart = SYMBOL_CONSTANTS.LINE_START_X;
        const lineEnd = SYMBOL_CONSTANTS.LINE_END_X;
        const lineWidth = lineEnd - lineStart;

        // Each symbol gets equal width across the full line
        const symbolSpacing = lineWidth / symbolCount;
        const symbolSize = Math.min(SYMBOL_CONSTANTS.TRIANGLE_HEIGHT, originalSize);

        for (let i = 0; i < symbolCount; i++) {
            // Calculate the center X position for this symbol
            const symbolLeft = lineStart + (i * symbolSpacing);
            const symbolRight = lineStart + ((i + 1) * symbolSpacing);
            const symbolCenter = (symbolLeft + symbolRight) / 2;

            const element = createStrokeSymbolElement(
                graphic.mark,
                symbolCenter,
                SYMBOL_CONSTANTS.LINE_Y_CENTER,
                symbolSize,
                symbolSpacing,
                graphic.fill || "#000000",
                graphic.stroke || "#000000",
                graphic["stroke-width"] || "0.5"
            );

            if (element) {
                elements.push(element);
            }
        }
    } catch (error) {
        console.error("Error creating graphic stroke elements:", error);
    }

    return elements;
}

/** Create an SVG element for a specific graphic mark type
 * @param mark - The type of graphic mark (e.g., triangle, circle)
 * @param centerX - X coordinate for the center of the symbol
 * @param centerY - Y coordinate for the center of the symbol
 * @param size - Size of the symbol
 * @param spacing - Spacing allocated for the symbol (used for positioning)
 * @param fill - Fill color for the symbol
 * @param stroke - Stroke color for the symbol
 * @param strokeWidth - Stroke width for the symbol
 * @returns SVGElement representing the graphic mark or null if unsupported
 */
function createStrokeSymbolElement(
    mark: string,
    centerX: number,
    centerY: number,
    size: number,
    spacing: number,
    fill: string,
    stroke: string,
    strokeWidth: string
): SVGElement | null {
    switch (mark.toLowerCase()) {
        case 'triangle':
        case 'shape://triangle':
            const triangle = document.createElementNS("http://www.w3.org/2000/svg", "polygon");

            // Position triangles so their base touches the top edge of the line
            const lineTopEdge = centerY - 1; // Assuming 2px line width
            const halfSpacing = spacing / 2;

            const points = [
                [centerX, lineTopEdge - size],                    // Top point (above the line)
                [centerX - halfSpacing, lineTopEdge],             // Bottom left
                [centerX + halfSpacing, lineTopEdge]              // Bottom right
            ].map(point => point.join(',')).join(' ');

            triangle.setAttribute("points", points);
            triangle.setAttribute("fill", fill);
            triangle.setAttribute("stroke", stroke);
            triangle.setAttribute("stroke-width", strokeWidth);
            return triangle;

        case 'circle':
        case 'shape://circle':
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            circle.setAttribute("cx", centerX.toString());
            circle.setAttribute("cy", (centerY - size / 2).toString());
            circle.setAttribute("r", (size / 3).toString());
            circle.setAttribute("fill", fill);
            circle.setAttribute("stroke", stroke);
            circle.setAttribute("stroke-width", strokeWidth);
            return circle;

        case 'square':
        case 'shape://square':
            const square = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const squareSize = size / 2;
            square.setAttribute("x", (centerX - squareSize / 2).toString());
            square.setAttribute("y", (centerY - size).toString());
            square.setAttribute("width", squareSize.toString());
            square.setAttribute("height", squareSize.toString());
            square.setAttribute("fill", fill);
            square.setAttribute("stroke", stroke);
            square.setAttribute("stroke-width", strokeWidth);
            return square;

        case 'diamond':
        case 'shape://diamond':
            const diamond = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const halfSize = size / 2;
            const diamondPoints = [
                [centerX, centerY - size],              // Top
                [centerX + halfSize, centerY - halfSize], // Right
                [centerX, centerY],                      // Bottom
                [centerX - halfSize, centerY - halfSize]  // Left
            ].map(point => point.join(',')).join(' ');
            diamond.setAttribute("points", diamondPoints);
            diamond.setAttribute("fill", fill);
            diamond.setAttribute("stroke", stroke);
            diamond.setAttribute("stroke-width", strokeWidth);
            return diamond;

        case 'cross':
        case 'shape://cross':
        case 'plus':
        case 'shape://plus':
            const crossGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const crossSize = size / 2;

            const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hLine.setAttribute("x1", (centerX - crossSize).toString());
            hLine.setAttribute("y1", (centerY - crossSize).toString());
            hLine.setAttribute("x2", (centerX + crossSize).toString());
            hLine.setAttribute("y2", (centerY - crossSize).toString());
            hLine.setAttribute("stroke", stroke);
            hLine.setAttribute("stroke-width", strokeWidth);

            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute("x1", centerX.toString());
            vLine.setAttribute("y1", (centerY - size).toString());
            vLine.setAttribute("x2", centerX.toString());
            vLine.setAttribute("y2", centerY.toString());
            vLine.setAttribute("stroke", stroke);
            vLine.setAttribute("stroke-width", strokeWidth);

            crossGroup.appendChild(hLine);
            crossGroup.appendChild(vLine);
            return crossGroup;

        case 'x':
        case 'shape://times':
        case 'times':
            const xGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const xSize = size / 2;

            const diag1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
            diag1.setAttribute("x1", (centerX - xSize).toString());
            diag1.setAttribute("y1", (centerY - size).toString());
            diag1.setAttribute("x2", (centerX + xSize).toString());
            diag1.setAttribute("y2", centerY.toString());
            diag1.setAttribute("stroke", stroke);
            diag1.setAttribute("stroke-width", strokeWidth);

            const diag2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
            diag2.setAttribute("x1", (centerX + xSize).toString());
            diag2.setAttribute("y1", (centerY - size).toString());
            diag2.setAttribute("x2", (centerX - xSize).toString());
            diag2.setAttribute("y2", centerY.toString());
            diag2.setAttribute("stroke", stroke);
            diag2.setAttribute("stroke-width", strokeWidth);

            xGroup.appendChild(diag1);
            xGroup.appendChild(diag2);
            return xGroup;

        case 'arrow':
        case 'shape://arrow':
            const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const arrowSize = size / 2;
            const arrowPoints = [
                [centerX, centerY - size],               // Tip
                [centerX - arrowSize, centerY - arrowSize], // Left wing
                [centerX - arrowSize / 2, centerY - arrowSize], // Left notch
                [centerX - arrowSize / 2, centerY],      // Left bottom
                [centerX + arrowSize / 2, centerY],      // Right bottom
                [centerX + arrowSize / 2, centerY - arrowSize], // Right notch
                [centerX + arrowSize, centerY - arrowSize]  // Right wing
            ].map(point => point.join(',')).join(' ');
            arrow.setAttribute("points", arrowPoints);
            arrow.setAttribute("fill", fill);
            arrow.setAttribute("stroke", stroke);
            arrow.setAttribute("stroke-width", strokeWidth);
            return arrow;

        default:
            console.warn(`Unsupported graphic stroke mark type: ${mark}`);
            return null;
    }
}