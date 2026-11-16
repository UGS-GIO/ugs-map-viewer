/**
 * Highlight styles for selected features (yellow with shadow)
 */
const HIGHLIGHT_COLOR = '#FFFF00'

export const HIGHLIGHT_STYLES = {
  line: {
    shadow: { 'line-color': 'rgba(0, 0, 0, 0.5)', 'line-width': 6 },
    main: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 4 },
  },
  fill: {
    shadow: { 'fill-color': 'rgba(0, 0, 0, 0)', 'fill-outline-color': 'rgba(0, 0, 0, 0.8)' },
    main: { 'fill-color': 'rgba(255, 255, 0, 0.2)', 'fill-outline-color': HIGHLIGHT_COLOR },
    stroke: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 3 },
  },
  circle: {
    shadow: { 'circle-radius': 12, 'circle-color': 'rgba(0, 0, 0, 0.5)', 'circle-stroke-width': 2, 'circle-stroke-color': 'rgba(0, 0, 0, 0.5)' },
    main: { 'circle-radius': 10, 'circle-color': 'rgba(255, 255, 0, 0.5)', 'circle-stroke-width': 2, 'circle-stroke-color': HIGHLIGHT_COLOR },
  },
}

// Every result of a multi-select: thin outlines, no fill, so big polygons don't tint the map
export const RESULT_HIGHLIGHT_STYLES = {
  line: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 1.25, 'line-opacity': 0.55 },
  stroke: { 'line-color': HIGHLIGHT_COLOR, 'line-width': 1.25, 'line-opacity': 0.55 },
  circle: { 'circle-radius': 6, 'circle-color': 'rgba(255, 255, 0, 0.15)', 'circle-stroke-width': 1.5, 'circle-stroke-color': 'rgba(255, 255, 0, 0.8)' },
}

// Blue reads apart from the yellow selection on every basemap
const HOVER_HIGHLIGHT_COLOR = '#1E6BFF'
export const HOVER_HIGHLIGHT_STYLES = {
  line: { 'line-color': HOVER_HIGHLIGHT_COLOR, 'line-width': 5 },
  fill: { 'fill-color': 'rgba(30, 107, 255, 0.25)' },
  stroke: { 'line-color': HOVER_HIGHLIGHT_COLOR, 'line-width': 3 },
  circle: { 'circle-radius': 11, 'circle-color': 'rgba(30, 107, 255, 0.5)', 'circle-stroke-width': 3, 'circle-stroke-color': HOVER_HIGHLIGHT_COLOR },
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
