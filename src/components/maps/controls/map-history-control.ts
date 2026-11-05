import type * as maplibregl from 'maplibre-gl';
import type { MapHistory } from '@/lib/map/map-history';
import { createIconControlGroup } from './icon-control-group';

// Lucide's ArrowLeft and ArrowRight, inlined like HomeControl's
const svg = (paths: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const BACK_ICON = svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>');
const FORWARD_ICON = svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');

/** The camera in a URL's search, or undefined when it has none (before the map first writes it). */
function cameraOf(search: string): maplibregl.CameraOptions | undefined {
  const params = new URLSearchParams(search);
  const [lat, lon, zoom] = ['lat', 'lon', 'zoom'].map((key) => Number(params.get(key) ?? NaN));
  if ([lat, lon, zoom].some(Number.isNaN)) return undefined;
  return { center: [lon, lat], zoom, pitch: Number(params.get('pitch') ?? 0), bearing: Number(params.get('bearing') ?? 0) };
}

/**
 * Back and forward through browser history, which holds each map state (see createMapHistory). The map
 * only reads the URL's camera when it mounts, so this also moves it to the camera of whichever entry
 * Back or Forward lands on, from these buttons, the browser's, or the mouse's.
 */
export class MapHistoryControl implements maplibregl.IControl {
  // Built up front so React can portal the steps list into the same button group
  readonly container: HTMLElement;
  private readonly back: HTMLButtonElement;
  private readonly forward: HTMLButtonElement;
  private unsubscribe?: () => void;
  private stopTrackingMoves?: () => void;
  private stopFollowingResize?: () => void;

  constructor(private readonly nav: MapHistory) {
    const { container, buttons: [back, forward] } = createIconControlGroup([
      { title: 'Back to previous map view', icon: BACK_ICON, onClick: () => nav.history.back() },
      { title: 'Forward to next map view', icon: FORWARD_ICON, onClick: () => nav.history.forward() },
    ]);
    this.container = container;
    this.back = back;
    this.forward = forward;
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    const { history, canGoForward } = this.nav;
    const updateButtons = () => {
      this.back.disabled = !history.canGoBack();
      this.forward.disabled = !canGoForward();
    };

    this.unsubscribe = history.subscribe(({ action, location }) => {
      if (action.type !== 'PUSH' && action.type !== 'REPLACE') {
        const camera = cameraOf(location.search);
        if (camera) this.easeTo(map, camera);
      }
      // After the router's microtask writes the entry, so the Navigation API sees it
      queueMicrotask(updateButtons);
    });
    updateButtons();

    let moveEnded = () => {};
    const onMoveStart = () => { moveEnded = this.nav.moveStarted() };
    const onMoveEnd = () => moveEnded();
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);
    this.stopTrackingMoves = () => {
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
    };
    return this.container;
  }

  // easeTo keeps the pixel anchor it started with, and the results panel opening or closing with the step
  // resizes the map mid-ease, which would land it half the width change off. Restart from each new size.
  private easeTo(map: maplibregl.Map, camera: maplibregl.CameraOptions) {
    this.stopFollowingResize?.();
    const restart = () => map.easeTo(camera);
    const stop = () => {
      map.off('resize', restart);
      map.off('idle', stop);
    };
    map.on('resize', restart);
    map.on('idle', stop);
    this.stopFollowingResize = stop;
    map.easeTo(camera);
  }

  onRemove(): void {
    this.stopFollowingResize?.();
    this.stopTrackingMoves?.();
    this.unsubscribe?.();
    this.container.remove();
  }
}
