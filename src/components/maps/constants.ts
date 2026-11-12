/**
 * Highlight styles for selected features (yellow with shadow)
 */
export const HIGHLIGHT_STYLES = {
  line: {
    shadow: { 'line-color': 'rgba(0, 0, 0, 0.5)', 'line-width': 6 },
    main: { 'line-color': '#FFFF00', 'line-width': 4 },
  },
  fill: {
    shadow: { 'fill-color': 'rgba(0, 0, 0, 0)', 'fill-outline-color': 'rgba(0, 0, 0, 0.8)' },
    main: { 'fill-color': 'rgba(255, 255, 0, 0.2)', 'fill-outline-color': '#FFFF00' },
    stroke: { 'line-color': '#FFFF00', 'line-width': 3 },
  },
  circle: {
    shadow: { 'circle-radius': 12, 'circle-color': 'rgba(0, 0, 0, 0.5)', 'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(0, 0, 0, 0.5)' },
    main: { 'circle-radius': 10, 'circle-color': 'rgba(255, 255, 0, 0.5)', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFFF00' },
  },
}

// Cyan reads apart from the yellow selection on every basemap
export const HOVER_HIGHLIGHT_STYLES = {
  line: { 'line-color': '#00E5FF', 'line-width': 5 },
  fill: { 'fill-color': 'rgba(0, 229, 255, 0.25)' },
  stroke: { 'line-color': '#00E5FF', 'line-width': 3 },
  circle: { 'circle-radius': 11, 'circle-color': 'rgba(0, 229, 255, 0.5)', 'circle-stroke-width': 3, 'circle-stroke-color': '#00E5FF' },
}

/**
 * Box select configuration
 */
export const BOX_SELECT_SIZE = 200
export const BOX_SELECT_PAGE_SIZE = 1000
export const BOX_SELECT_MIN_ZOOM = 7

/**
 * Click tolerance in pixels for feature identification
 */
export const DEFAULT_CLICK_TOLERANCE = 5
