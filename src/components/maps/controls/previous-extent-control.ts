import type * as maplibregl from 'maplibre-gl';
import { createIconControlButton } from './icon-control-button';

// Lucide's Undo2 icon, inlined like HomeControl's
const BACK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>';

const MAX_HISTORY = 50;
// A wheel zoom fires a moveend per wheel tick; wait for the map to settle so one gesture is one entry
const SETTLE_MS = 400;

interface View {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

const sameView = (a: View, b: View) =>
  Math.abs(a.center[0] - b.center[0]) < 1e-6 &&
  Math.abs(a.center[1] - b.center[1]) < 1e-6 &&
  Math.abs(a.zoom - b.zoom) < 0.01 &&
  Math.abs(a.pitch - b.pitch) < 0.1 &&
  Math.abs(a.bearing - b.bearing) < 0.1;

function viewOf(map: maplibregl.Map): View {
  const { lng, lat } = map.getCenter();
  return { center: [lng, lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
}

/** Steps the map back through the views it settled on. MapLibre keeps no view history of its own. */
export class PreviousExtentControl implements maplibregl.IControl {
  private map?: maplibregl.Map;
  private container?: HTMLElement;
  private button?: HTMLButtonElement;
  private history: View[] = [];
  private current?: View;
  private settleTimer?: ReturnType<typeof setTimeout>;

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map;
    this.current = viewOf(map);

    const { container, button } = createIconControlButton('Go to previous view', BACK_ICON, this.goBack);
    this.container = container;
    this.button = button;
    this.updateButton();

    map.on('movestart', this.onMoveStart);
    map.on('moveend', this.onMoveEnd);
    return container;
  }

  onRemove(): void {
    clearTimeout(this.settleTimer);
    this.map?.off('movestart', this.onMoveStart);
    this.map?.off('moveend', this.onMoveEnd);
    this.container?.remove();
    this.map = undefined;
  }

  private onMoveStart = () => clearTimeout(this.settleTimer);

  private onMoveEnd = (e: maplibregl.MapLibreEvent & { previousExtent?: boolean }) => {
    clearTimeout(this.settleTimer);
    // Our own step back lands on the restored view without recording the one we left
    if (e.previousExtent) {
      this.current = viewOf(e.target);
      return;
    }
    this.settleTimer = setTimeout(this.commit, SETTLE_MS);
    this.updateButton();
  };

  private commit = () => {
    this.settleTimer = undefined;
    if (!this.map) return;
    const next = viewOf(this.map);
    if (this.current && !sameView(this.current, next)) {
      this.history.push(this.current);
      if (this.history.length > MAX_HISTORY) this.history.shift();
    }
    this.current = next;
    this.updateButton();
  };

  private goBack = () => {
    // A move still settling counts, so back undoes it rather than the one before
    if (this.settleTimer !== undefined) {
      clearTimeout(this.settleTimer);
      this.commit();
    }
    const previous = this.history.pop();
    if (!previous || !this.map) return;
    this.updateButton();
    this.map.easeTo(previous, { previousExtent: true });
  };

  private updateButton() {
    // A move still settling is about to become an entry
    if (this.button) this.button.disabled = this.history.length === 0 && this.settleTimer === undefined;
  }
}
