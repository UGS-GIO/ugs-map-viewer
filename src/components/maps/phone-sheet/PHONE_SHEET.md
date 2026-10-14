# Phone sheet

On phones (`PHONE_QUERY` in `hooks/use-mobile.tsx`: narrow screens plus large phones in
landscape) the map routes show one sheet over a full-bleed map, with a Layers · Results · Info ·
More tab bar under it. Desktop keeps the sidebar, side results panel and Map/Split/Table modes.
The pattern matches the ugs-warehouse and ugs-soil-water-model viewers; port from them rather
than inventing a variant.

- **Sheet.** Base UI `Drawer`, always open and non-modal, portaled into the map area. Snap
  points: peek `4.5rem` (the header), half `0.55`, full `0.92`. A swipe past the peek or Escape
  lands on the peek; it never closes. No ✕: tap the open tab or drag down. Its content
  scrolls only at full height; below that a drag anywhere moves the whole sheet, as in Apple Maps.
- **Map.** `GenericMapContainer` renders the same tree down to `<DataMap>` on both layouts, so
  crossing the phone query never remounts the map.
- **Results.** Selection calls `popupSheetRef.open()` as on desktop; on phones that raises Results
  as cards and keeps the user's Cards/Table choice. Box select and a drawn filter open the table.

## URL

All sheet state is in the URL and validated in `_map.tsx`; unknown values drop. Every write
replaces the URL, so Back never undoes a layer toggle or map move.

- `tab` (shared with desktop): the panel. `home` is the More list.
- `sheet`: `half` or `full`; absent is the peek.
- `results`: `cards` or `table` while Results shows; absent while a panel shows.
- `detail`: the open Info detail (`references`, `acknowledgments`, `disclaimer`). Phones show it
  in the sheet, desktop in a dialog. Changing `tab` clears it.
- `view` (desktop): with no `sheet` or `results`, `split`/`table` opens the phone on the results
  table. Phone writes clear it.

Change the sheet only through `usePhoneSheetActions()` in `use-phone-sheet.ts`.

## Not covered

Real iOS Safari and Android Chrome need a device pass on the preview; the Playwright checks are
Chromium only. Search and the scale bar are still desktop-only.
