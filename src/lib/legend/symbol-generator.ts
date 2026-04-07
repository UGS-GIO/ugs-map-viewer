import { Symbolizer } from "@/lib/types/geoserver-types";
import { SYMBOL_CONSTANTS } from "@/lib/constants";
import { createPolygonSymbol } from "@/lib/legend/symbolizers/polygon";
import { createPointSymbol } from "@/lib/legend/symbolizers/point";
import { CompositeSymbolResult, createCompositeLineSymbol } from "@/lib/legend/symbolizers/line";

/**
 * Main function to create an SVG symbol based on the provided symbolizers.
 * It determines the type of symbol (Line, Polygon, Point) and delegates
 * the creation to the appropriate specialized function.
 * 
 * @param symbolizers - Array of Symbolizer objects defining the styles.
 * @returns An SVGSVGElement representing the symbol or a CompositeSymbolResult for complex line symbols.
 */
export function createSVGSymbol(symbolizers: Symbolizer[]): SVGSVGElement | CompositeSymbolResult {
    try {
        const polygonSymbolizers = symbolizers.filter(s => s.Polygon);
        const lineSymbolizers = symbolizers.filter(s => s.Line);
        const pointSymbolizers = symbolizers.filter(s => s.Point);

        if (lineSymbolizers.length > 0) {
            return createCompositeLineSymbol(lineSymbolizers);
        } else if (polygonSymbolizers.length > 0) {
            return createPolygonSymbol(polygonSymbolizers);
        } else if (pointSymbolizers.length > 0) {
            return createPointSymbol(pointSymbolizers);
        } else {
            console.error("Unsupported symbol type:", symbolizers);
            return createEmptySVG();
        }
    } catch (error) {
        console.error("Error creating SVG symbol:", error);
        return createEmptySVG();
    }
}

/**
* Helper function to create an empty SVG element with predefined width, height, and viewBox.
* @returns An empty SVGSVGElement.
*/
export function createEmptySVG(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", SYMBOL_CONSTANTS.SVG_WIDTH.toString());
    svg.setAttribute("height", SYMBOL_CONSTANTS.SVG_HEIGHT.toString());
    svg.setAttribute("viewBox", `0 0 ${SYMBOL_CONSTANTS.SVG_WIDTH} ${SYMBOL_CONSTANTS.SVG_HEIGHT}`);
    return svg;
}

