import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PortalControl } from '@/lib/map/controls/portal-control';
import type { MapLibreMap } from '@/lib/types/map-types';

interface MultiSelectControlProps {
  map: MapLibreMap | null;
  isActive: boolean;
  onToggle: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function MultiSelectControl({
  map,
  isActive,
  onToggle,
  position = 'top-left',
}: MultiSelectControlProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const controlRef = useRef<PortalControl | null>(null);

  useEffect(() => {
    if (!map) return;

    const control = new PortalControl();
    map.addControl(control, position);
    controlRef.current = control;
    setContainer(control.getContainer());

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map, position]);

  if (!container) return null;

  return createPortal(
    <button
      onClick={onToggle}
      className={`maplibregl-ctrl-icon !flex items-center gap-2 !px-2 !py-1.5 !w-auto !h-auto ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'text-gray-600'
      }`}
      title={isActive ? 'Click to disable multi-select' : 'Click to enable multi-select (or hold Shift)'}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <span className="text-sm font-medium">
        {isActive ? 'Multi-select ON' : 'Multi-select'}
      </span>
    </button>,
    container
  );
}
