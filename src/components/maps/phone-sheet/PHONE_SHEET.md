# Phone sheet

How the map routes work on phones (viewport narrower than 768px): one draggable sheet over a
full-bleed map, with a tab bar under it. Desktop and tablets 768px and wider keep the sidebar,
the side results panel, and the Map/Split/Table modes, and nothing here changes them.

The pattern matches the ugs-warehouse viewer (`viewer/src/map/map-shell.tsx`,
`use-sheet-drag.ts`, `map-model.ts`), which adapted it from ugs-soil-water-model. Keeping the UGS
viewers alike is part of the point, so port from there instead of inventing a variant.

## Why one sheet

Before this, a phone user had six surfaces that did not share state:

- a full-screen sidebar drawer behind a hamburger
- a fixed 70% results sheet that could not be dragged
- Map/Split/Table modes in a bottom bar, whose split handle only responded to a mouse
- a second Map/Split/Table toggle on the map
- Info's own side drawers
- the results table

Buttons opened one surface on top of another, and people could not predict which. One sheet over
a map that never unmounts gives every action the same place to land.

## What the user sees

The screen, top to bottom:

- **App bar.** Logo, title, basemap picker, and the route's own `actions` (for example the
  hazards-review account menu). No hamburger.
- **Map.** Full-bleed, mounted once. The sheet slides over it, so switching tabs never
  re-initializes WebGL.
- **Sheet.** Three heights, as fractions of the map area: peek `0.06`, half `0.55`, full
  `0.92`. At the peek it shows its handle and a one-line summary ("2 results · Mapped Areas,
  Quaternary Faults", "Layers · 3 groups on").
- **Tab bar.** Layers · Results · Info · More, padded by `env(safe-area-inset-bottom)`.

Tabs:

| Tab | Shows | Notes |
|---|---|---|
| Layers | The route's Layers panel, the same component the desktop sidebar renders | "Zoom to layer" drops the sheet to the peek so the zoom is visible |
| Results | What the user tapped or selected | Cards (the popup content) or Table (`QueryResultsTable`), switched by a toggle in its header |
| Info | The route's Info panel | References, Acknowledgments and the Data Disclaimer open inside the sheet with a "‹ Info" back link |
| More | A list built from the route's sidelinks, plus Take the tour and the light/dark theme | Map Configurations and Report Generator open inside the sheet with "‹ More". Links with an `href` (Feedback, Learn More) open in a new tab |

Rules:

- Tapping a closed tab opens it at half, or keeps the current height if the sheet is already
  higher. Tapping the open tab drops the sheet to the peek. That is how the user gets the map
  back; there is no Map tab.
- A map tap raises Results to half. Box select, a draw filter, and the wetlandplants "open
  table" raise Results to full with Table selected.
- Closing Results clears the selection and drops the sheet to the peek. With nothing selected,
  Results says "Tap the map to see what's there."
- A popup's Report button opens More › Report Generator.
- On first load the sheet is at the peek on whatever `tab` names. `tab` defaults to `info` for
  desktop, so a bare URL peeks at Info.

Moving the sheet:

- Drag from the handle, the tab bar, or the content. The content only takes the drag when the
  swipe is mostly vertical, and, going down, only when every scroller under the finger is at its
  top. Going up, it takes the drag only while the sheet can still grow.
- A press moves 8px before it counts as a drag, so a tap on a tab stays a tap. The click that a
  drag ends with is ignored; a keyboard click (`detail === 0`) always counts.
- On release, a flick faster than 0.8 sheet-heights per second goes one height further in its
  direction. Otherwise the sheet settles on the nearest height, and ties go to the lower one.
- The handle is a `<button>`. A tap steps peek → half → full → peek, and the up and down arrow
  keys step one height. This is the non-drag path WCAG 2.5.7 requires.
- During a drag the hook writes the sheet's height straight to the DOM, so there is no React
  render per frame. On release it hands control back to the rendered height.
- Elements with `touch-action: none` inside the sheet (a reorder grip, a slider) keep their own
  gestures; the sheet does not take them.

Over the map:

- Zoom stays top-left and map tools stay top-right.
- The map's own Map/Split/Table control is hidden on phones; Results replaces it.
- A `--peek` CSS variable lifts MapLibre's bottom controls (attribution, scale) above the peek.
- Toasts sit above the tab bar.
- Dialogs stay centered dialogs: the hazards-review welcome, report confirmations, the InSAR
  analysis view, and the photo lightbox.

Tour:

- Phones get their own steps: the tab bar, dragging the sheet, tapping the map for Results,
  Layers, and More. The desktop steps are unchanged.
- It auto-starts once per route on a first visit, after any open dialog closes, and More › Take
  the tour restarts it.

## State and links

The sheet keeps its state in the URL, so reloads, shared links and Back all work.

- **`tab`** (existing, shared with desktop) names the panel: `layers`, `info`,
  `map configurations`, `report generator`, or `home` for the More list. A desktop link with
  `tab=layers` opens the phone on Layers.
- **`sheet`** (new, phone only) is the height, plus whether Results is showing: absent (peek),
  `half`, `full`, `results-half`, `results-full`. Desktop ignores it.
- **`view`** (existing, desktop only). The phone never writes it. When `sheet` is absent and
  `view` is `split` or `table`, the phone opens Results at half or full, so a selection shared
  from desktop opens sensibly.
- **History.** Tab taps, the handle, and back links push a history entry, so Back on Android
  steps the sheet back. Drags and automatic raises (a map tap, a filter) replace the entry, so
  Back does not replay every drag.

`sheet` is external input. It is validated in the `/_map` search schema. An unknown value falls
back to the peek and logs a `console.warn` naming the value, so a bad link still opens the map
and the problem is visible in the console.

## Components

New, in this folder:

- `sheet-model.ts`. The pure logic: the heights, `nearestDetent`, `releaseDetent`,
  `contentTakesDrag`, parsing and writing `sheet`, and reading a desktop `view`. Ported from
  ugs-warehouse `map-model.ts` along with its tests.
- `use-sheet-drag.ts`. The drag hook, ported from ugs-warehouse. It gives the handle and tab bar
  a pointer drag, and the content a non-passive touch drag (only a non-passive `touchmove` can
  stop the browser treating the swipe as a scroll).
- `use-phone-sheet.ts`. Reads and writes `sheet` and `tab`. Other code raises or lowers the sheet
  only through this hook: `showResults({ as })`, `openPanel(tab)`, `peek()`.
- `phone-sheet.tsx`. The sheet, the tab bar, the More list, and the back links.

Where it mounts:

- `GenericMapContainer` renders the phone sheet next to the map on phones. Results state
  (`popupContent`, the selection, the table props) already lives there, so Results reuses
  `PopupContentWithPagination` with the props `PopupSheet` passes it today, and
  `QueryResultsTable`, both unchanged.
- `MapShell` on phones renders the app bar and the map container only. No `Sidebar`, no footer.
- Panels come from the existing sidebar context (`currentContent.component`), so each route's
  sidelinks drive Layers, Info and More with no new per-route config.

Removed:

- The mobile drawer branch in `sidebar.tsx`, `nav.tsx` and `sidebar-provider.tsx`, including
  `navOpened`.
- `mobile-map-nav.tsx`, and the fixed mobile results sheet in `GenericMapContainer`.
- `ui/back-to-menu-button.tsx` and its call sites. It only ever rendered in the mobile drawer.
- The mobile side drawers in `sidebar/info.tsx`, replaced by in-sheet sub-views.

Callers that used to close the drawer go through `usePhoneSheet` instead:

- `use-custom-layerlist.tsx` (zoom to layer) calls `peek()`.
- hazards `report-generator.tsx` calls `peek()` when it starts drawing.
- wetlandplants `wetlandplants-layer-filters.tsx` calls `showResults({ as: 'table' })` instead of
  forcing `view=table` and `tab=home`.

## Accessibility

- The tab bar is a `<nav aria-label="Map views">`. Each tab is a button with
  `aria-expanded` set while its content is showing above the peek.
- The handle's `aria-label` says what it will do next: "Expand panel", "Expand panel to full
  height", "Collapse panel".
- When a tab opens, focus stays on the tab. The sheet's region is labelled with the tab name, so
  screen readers announce what opened.
- `prefers-reduced-motion` removes the height transition.
- Tap targets in the tab bar and handle are at least 44px tall.

## Testing

- Unit (vitest): `sheet-model` (nearest height with ties going lower, flicks both ways,
  `contentTakesDrag`, the `sheet` round-trip, `view` to Results, unknown `sheet` values).
- Component (vitest + Testing Library):
  - tapping a tab raises the sheet, and tapping the open tab drops it to the peek
  - a click that ends a drag is ignored
  - the handle steps on tap and with the arrow keys
  - More lists the route's links, and `href` links open in a new tab
- Emulated phone (Playwright, iPhone 13 portrait and landscape, every map route):
  - each tab opens its content
  - a map tap shows Results at half, and the Cards | Table toggle works
  - Report opens More › Report Generator
  - touch drag and flick work, and Back steps the sheet
  - the last layer is reachable at full height
  - the tour runs once and never over the welcome dialog
  - desktop at 1440px behaves as on develop
- Real devices: iOS Safari and Android Chrome on the PR preview build. The emulation is Chromium
  only.

## Out of scope

- Desktop and tablet layouts.
- The basemap picker and map tools, which stay where they are.
- Dialog designs.
