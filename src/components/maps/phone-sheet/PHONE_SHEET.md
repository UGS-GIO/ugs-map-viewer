# Phone sheet

How the map routes work on phones: one draggable sheet over a full-bleed map, with a tab bar
under it. Desktop and tablets keep the sidebar, the side results panel, and the Map/Split/Table
modes, and nothing here changes them.

**A phone** is a viewport matching `(max-width: 767px), (pointer: coarse) and (max-height: 500px)`.
The second half catches large phones in landscape (about 814-863px wide, under 430px tall), which
would otherwise get the desktop sidebar on a screen too short for it. Everything else is desktop.

The pattern matches the ugs-warehouse viewer (`viewer/src/map/map-shell.tsx`, `map-model.ts`),
which adapted it from ugs-soil-water-model. The sheet itself is Base UI's `Drawer`
(`@base-ui/react`), the library those viewers already use. The sheet's header, tab bar and touch guards follow ugs-fleet-fuel-finder
(`src/components/bottom-drawer.tsx`, `close-button.tsx`, `tab-bar.tsx`, `index.css`). Keeping the
UGS apps alike is part of the point, so port from those instead of inventing a variant. Where
they differ, or say nothing, follow iOS sheet behavior (Apple Maps, `UISheetPresentationController`).

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
  hazards-review account menu). No hamburger and no route search, in portrait or landscape. No
  footer bar on phones.
- **Map.** Full-bleed, mounted once. The sheet slides over it, so switching tabs never
  re-initializes WebGL.
- **Sheet.** A Base UI `Drawer` that is always open, non-modal, with three snap points: peek
  `4.5rem` (the header), half `0.55` and full `0.92` of the map area. No backdrop, so the map stays usable
  around the sheet.
- **Sheet header.** A grabber, then a title row naming what is open ("Layers", "Results", "Map
  Configurations"). At the peek the title row also carries a short summary ("2 results",
  "4 layers on"). A view opened from inside another shows a back control at the left of the title
  row: "‹ More" for a More panel, "‹ Info" for an Info detail. Nothing has a ✕: the user taps the
  open tab or drags down, as in Apple Maps, and clears a selection from the map toolbar.
- **Tab bar.** Layers · Results · Info · More, 48px tall, lucide icons at 22px. The tab whose
  content is showing above the peek is in the primary color with a heavier stroke and carries
  `aria-current="page"`. At the peek no tab is highlighted, as in the warehouse and soil-water
  viewers. Padded by `env(safe-area-inset-bottom)`.

Tabs:

| Tab | Shows | Notes |
|---|---|---|
| Layers | The route's Layers panel, the same component the desktop sidebar renders | "Zoom to layer" drops the sheet to the peek so the zoom is visible |
| Results | What the user tapped or selected | Cards (the popup content) or Table (`QueryResultsTable`), switched by a segmented control |
| Info | The route's Info panel | References, Acknowledgments and the Data Disclaimer open in the sheet as details, with "‹ Info" |
| More | A list built from the route's sidelinks, plus Take the tour and the light/dark theme | Map Configurations and Report Generator open in the sheet with "‹ More". Links with an `href` (Feedback, Learn More) open in a new tab |

Rules:

- Tapping a tab whose content is not showing opens it at half, or keeps the current height if the
  sheet is already higher. Tapping the tab that is showing toggles the sheet between the peek and
  half. There is no Map tab: the open tab, or a drag down, gives the map back.
- A map tap that finds something raises Results to half. Box select, a draw filter, and the
  wetlandplants "Open table" raise Results to full with Table selected. An empty tap leaves the
  sheet where it is, as desktop leaves its panel closed; the map's loading indicator shows while
  a tap is being queried.
- When Results is already open, a new selection keeps the view the user chose (Cards or Table).
- Closing Results clears the selection, drops the sheet to the peek, and moves focus to the
  grabber. With nothing selected, Results says "Tap the map to see what's there."
- A popup's Report button opens More › Report Generator. On a route without that panel the sheet
  shows More and logs a warning.
- On first load the sheet is at the peek on whatever `tab` names. `tab` defaults to `info` for
  desktop, so a bare URL peeks at Info.

Moving the sheet:

- Base UI's `Drawer` does the dragging: from the header or the content, never from the tab bar
  (an upward drag there fights the iPhone home-bar gesture). `snapToSequentialPoints` makes a
  flick go one height further. A scrolled list scrolls first and moves the sheet once it is at
  its top; sideways scrollers keep their swipes. Mark anything else that owns a vertical gesture
  with `data-base-ui-swipe-ignore`.
- The sheet never closes. A swipe past the peek, or Escape, is cancelled in `onSnapPointChange`
  and `onOpenChange` and lands on the peek.
- The handle is a `<button>`. A tap steps peek → half → full → peek, and the up and down arrow
  keys step one height. This is the non-drag path WCAG 2.5.7 requires.
- At the peek the content is `inert`.

Keyboard and fields:

- On phones text fields are 16px everywhere, including popovers rendered outside the sheet,
  because iOS zooms the page on focus for anything smaller. Tablets are untouched.
- `Drawer.VirtualKeyboardProvider` keeps a focused field visible above the software keyboard.

Page:

- On phones `html` and `body` have `overscroll-behavior: none`, so a swipe on the app bar or tab
  bar never triggers pull-to-refresh or rubber-banding.
- The tab bar and the sheet header use `touch-action: manipulation` (no double-tap zoom) and
  suppress the tap highlight and the long-press callout.
- Toasts (`sonner`) are top-center, clear of the sheet and tab bar.
- The TanStack Router devtools toggle, which preview builds render bottom-left, is hidden on
  phones so it never covers the Layers tab.

Over the map:

- Zoom stays top-left and map tools stay top-right.
- The map's loading spinner sits in the upper part of the map, which the sheet leaves visible.
- The map's own Map/Split/Table control is hidden on phones; Results replaces it.
- MapLibre's bottom controls (attribution) sit `4.5rem` up, clear of the peek.
- Dialogs stay centered dialogs: the hazards-review welcome, report confirmations, the InSAR
  analysis view, and the photo lightbox.

Tour:

- Phones get their own steps: the tab bar, the sheet's header, tapping the map for Results,
  Layers, and More. The desktop steps are unchanged.
- It auto-starts once per route on a first visit, after any open dialog closes, and More › Take
  the tour restarts it.

## State and links

The sheet keeps its state in the URL, so reloads, shared links and Back all work.

- **`tab`** (existing, shared with desktop) names the panel: `layers`, `info`,
  `map configurations`, `report generator`, or `home` for the More list. A desktop link with
  `tab=layers` opens the phone on Layers.
- **`sheet`** (new, phone only) is what the sheet shows and how high it is. A panel (named by
  `tab`) is absent (peek), `half` or `full`. Results is `cards-peek`, `cards-half`,
  `cards-full`, `table-peek`, `table-half` or `table-full`, where `cards` and `table` are the
  Results control. Desktop ignores it.
- **`detail`** (new, phone only) is the Info detail being shown: `references`,
  `acknowledgments` or `disclaimer`. Any write that changes `tab` clears it. Desktop ignores it
  and keeps its dialogs.
- **`view`** (existing, desktop only). When `sheet` is absent and `view` is `split` or `table`,
  the phone opens Results (table) at half or full, so a selection shared from desktop opens
  sensibly. Phones treat the map as always in map view for selection, so map taps work even
  while such a link's `view` is still in the URL. Every phone write clears `view`.
- **History.** The sheet never adds a browser history entry: every write replaces the URL, as
  the rest of the app already does. Map position, layers and settings live in the URL too, so a
  pushed entry would let Back restore an older URL and silently undo a layer toggle, a map move or
  a setting changed since. The in-app "‹ More" and "‹ Info" controls go to the parent view; Android
  Back and the iOS back swipe leave the page, as they do today. (iOS has no system Back, and in-app
  back controls are its convention.)

`sheet` and `detail` are external input, validated in `_map.tsx`'s search schema as enums
(`SHEET_PARAMS`, `INFO_DETAILS`) with `.catch(undefined)`. An unknown value drops, so a bad link
opens the panel at its peek.

## Components

New, in this folder:

- `sheet-model.ts`. The pure logic: the tab rules, the `sheet` values and reading and writing
  them, and reading a desktop `view`. Ported from ugs-warehouse `map-model.ts`.
- `use-phone-sheet.ts`. `usePhoneSheet()` reads `sheet`, `tab` and `detail`;
  `usePhoneSheetActions()` only writes them, for callers that don't need to re-render. Other code
  raises or lowers the sheet only through these: `showResults`, `raiseResults`, `openPanel`,
  `openDetail`, `peek`, `closeResults`.
- `phone-sheet.tsx`. The sheet and the tab bar (presentational).
- `phone-sheet-host.tsx`. Picks the sheet's title, back control and body from the URL and the
  sidebar context.
- `more-list.tsx`, `results-view-toggle.tsx`.

Where it mounts:

- `GenericMapContainer` renders the host next to the map on phones. Results state
  (`popupContent`, the selection, the table props) already lives there, so Results reuses
  `PopupContentWithPagination` with the props `PopupSheet` passes it today, and
  `QueryResultsTable`, both unchanged.
- Selection already opens the desktop popup through `popupSheetRef.open()`. On phones that ref
  holds a handle that raises Results instead, so the selection code is unchanged. Box select and
  a drawn filter call `showResults('table')` when the area is set.
- `MapShell` on phones renders the app bar and the map container only. No `Sidebar`, no footer.
- Panels come from the existing sidebar context (`currentContent.component`), so each route's
  sidelinks drive Layers, Info and More with no new per-route config.

Removed:

- The mobile drawer branch in `sidebar.tsx`, `nav.tsx` and `sidebar-provider.tsx`, including
  `navOpened`, and the app bar's hamburger.
- `mobile-map-nav.tsx`, and the fixed mobile results sheet in `GenericMapContainer`.
- `ui/back-to-menu-button.tsx` and its call sites. It only ever rendered in the mobile drawer.
- The mobile side drawers in `sidebar/info.tsx`, replaced by the `detail` views.

Callers that used to close the drawer go through `usePhoneSheetActions`:

- `use-custom-layerlist.tsx` (zoom to layer) calls `peek()`.
- hazards `report-generator.tsx` calls `peek()` when it starts drawing.
- wetlandplants `wetlandplants-layer-filters.tsx` calls `showResults('table')` instead of forcing
  `view=table` and `tab=home`. Its "Close table" button is hidden on phones, where the filters
  (Layers) and the table (Results) are never on screen together.

## Accessibility

- The tab bar is a `<nav aria-label="Map views">`. Each tab is a button with `aria-expanded`
  set while its content shows above the peek.
- The handle's `aria-label` says what it will do next: "Expand panel", "Expand panel to full
  height", "Collapse panel".
- When the user opens a tab, a More panel or an Info detail, focus moves to the sheet's title
  (`tabIndex={-1}`) without scrolling, so screen readers announce it and no keyboard opens. Page
  load does not move focus. The title shows a focus ring only for keyboard focus
  (`focus-visible`).
- `prefers-reduced-motion` removes the height transition.
- Tap targets in the tab bar and header are at least 44px tall.

## Testing

- Unit (vitest): `sheet-model` (the `sheet` round-trip, `view` to Results, the tab rules).
- Components (vitest in jsdom with React's `createRoot` and `act`; the repo has no Testing
  Library): tabs, the handle and arrow keys, Escape to the peek, `inert` at the peek, focus on a
  new panel, More's links, and the phone tour steps. Dragging is Base UI's and is checked in the
  browser, not jsdom.
- Emulated phone (Playwright, iPhone 13 portrait and landscape and Pixel 7 landscape, every map
  route): the full checklist in the plan's Task 9.
- Real devices: iOS Safari and Android Chrome on the PR preview build. The emulation is Chromium
  only.

## Out of scope

- Desktop and tablet layouts.
- The basemap picker and map tools, which stay where they are.
- Dialog designs.
- Search, geolocate and the scale bar, which today render only on desktop (and stay off large
  phones in landscape). Phone users will look for search and "locate me" first, so they are the
  next follow-up.
- The hazards-review popup's Report button, which points at a panel that route does not have.
