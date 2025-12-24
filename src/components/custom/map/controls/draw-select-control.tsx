import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PortalControl } from '@/lib/map/controls/portal-control';
import type { MapLibreMap } from '@/lib/types/map-types';

export type DrawMode = 'off' | 'rectangle' | 'polygon';

interface DrawSelectControlProps {
  map: MapLibreMap | null;
  drawMode: DrawMode;
  hasResults: boolean;
  onModeChange: (mode: DrawMode) => void;
  onClear: () => void;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export function DrawSelectControl({
  map,
  drawMode,
  hasResults,
  onModeChange,
  onClear,
  position = 'top-left',
}: DrawSelectControlProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const controlRef = useRef<PortalControl | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Add control to map
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

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  if (!container) return null;

  const isDrawing = drawMode !== 'off';

  return createPortal(
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Main button */}
      <button
        onClick={() => setShowMenu(prev => !prev)}
        className={`maplibregl-ctrl-icon !flex items-center gap-2 !px-2 !py-1.5 !w-auto !h-auto ${
          isDrawing
            ? 'bg-primary text-primary-foreground'
            : hasResults
              ? 'bg-amber-500 text-white'
              : 'text-gray-600'
        }`}
        title={isDrawing ? 'Drawing...' : hasResults ? 'Has selection' : 'Draw to select features'}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {drawMode === 'polygon' ? (
            <polygon points="12,2 22,8.5 18,21 6,21 2,8.5" strokeWidth={2} fill="none" />
          ) : (
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} fill="none" />
          )}
        </svg>
        <span className="text-sm font-medium">
          {isDrawing ? (drawMode === 'rectangle' ? 'Box' : 'Polygon') : hasResults ? 'Selected' : 'Draw'}
        </span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            backgroundColor: 'white',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            border: '1px solid #e5e7eb',
            padding: '4px 0',
            zIndex: 50,
            minWidth: '160px',
          }}
        >
          <button
            onClick={() => { onModeChange('rectangle'); setShowMenu(false); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              background: drawMode === 'rectangle' ? '#eff6ff' : 'transparent',
              color: drawMode === 'rectangle' ? '#1d4ed8' : '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = drawMode === 'rectangle' ? '#eff6ff' : 'transparent'}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
            </svg>
            Draw Rectangle
          </button>
          <button
            onClick={() => { onModeChange('polygon'); setShowMenu(false); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              textAlign: 'left',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              background: drawMode === 'polygon' ? '#eff6ff' : 'transparent',
              color: drawMode === 'polygon' ? '#1d4ed8' : '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.background = drawMode === 'polygon' ? '#eff6ff' : 'transparent'}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <polygon points="12,2 22,8.5 18,21 6,21 2,8.5" strokeWidth={2} fill="none" />
            </svg>
            Draw Polygon
          </button>
          {(isDrawing || hasResults) && (
            <>
              <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }} />
              {isDrawing && (
                <button
                  onClick={() => { onModeChange('off'); setShowMenu(false); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel Drawing
                </button>
              )}
              {hasResults && !isDrawing && (
                <button
                  onClick={() => { onClear(); setShowMenu(false); }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    textAlign: 'left',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Selection
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>,
    container
  );
}
