// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as maplibregl from 'maplibre-gl';
import { PreviousExtentControl } from '../previous-extent-control';

type View = { center: [number, number]; zoom: number; pitch: number; bearing: number };

/** Fires movestart/moveend like MapLibre, merging easeTo's eventData into the events. */
function fakeMap(start: View) {
  let view = start;
  const listeners: Record<string, ((e: object) => void)[]> = {};
  const fire = (type: string, data = {}) => listeners[type]?.forEach((fn) => fn({ target: map, ...data }));
  const map = {
    on: (type: string, fn: (e: object) => void) => { (listeners[type] ??= []).push(fn); },
    off: () => {},
    getCenter: () => ({ lng: view.center[0], lat: view.center[1] }),
    getZoom: () => view.zoom,
    getPitch: () => view.pitch,
    getBearing: () => view.bearing,
    easeTo: vi.fn((to: View, data: object) => {
      fire('movestart', data);
      view = to;
      fire('moveend', data);
    }),
  };
  const move = (to: Partial<View>) => {
    fire('movestart');
    view = { ...view, ...to };
    fire('moveend');
  };
  return { map, move, view: () => view };
}

const HOME: View = { center: [-111.5, 39], zoom: 6, pitch: 0, bearing: 0 };

function setup() {
  const fake = fakeMap(HOME);
  const control = new PreviousExtentControl();
  const container = control.onAdd(fake.map as unknown as maplibregl.Map);
  const button = container.querySelector('button')!;
  return { ...fake, button };
}

describe('PreviousExtentControl', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts disabled and enables once the map moves', () => {
    const { move, button } = setup();
    expect(button.disabled).toBe(true);
    move({ zoom: 8 });
    expect(button.disabled).toBe(false);
    vi.runAllTimers();
    expect(button.disabled).toBe(false);
  });

  it('steps back through views in order without recording its own moves', () => {
    const { move, button, view } = setup();
    move({ zoom: 8 });
    vi.runAllTimers();
    move({ center: [-112, 40] });
    vi.runAllTimers();

    button.click();
    expect(view()).toEqual({ ...HOME, zoom: 8 });
    button.click();
    expect(view()).toEqual(HOME);
    expect(button.disabled).toBe(true);
  });

  it('records a burst of wheel moveends as one entry', () => {
    const { move, button, view } = setup();
    move({ zoom: 6.5 });
    move({ zoom: 7 });
    move({ zoom: 7.5 });
    vi.runAllTimers();

    button.click();
    expect(view()).toEqual(HOME);
    expect(button.disabled).toBe(true);
  });

  it('undoes a move that is still settling', () => {
    const { move, button, view } = setup();
    move({ zoom: 9 });
    button.click();
    expect(view()).toEqual(HOME);
  });

  it('ignores moves that end where they started', () => {
    const { move, button } = setup();
    move({});
    vi.runAllTimers();
    expect(button.disabled).toBe(true);
  });
});
