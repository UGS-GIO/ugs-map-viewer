import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/custom/button';
import { useMap } from '@/hooks/use-map';
import { BasemapIcon } from '@/assets/basemap-icons';
import { BASEMAP_STYLES, DEFAULT_BASEMAP, BasemapStyle } from '@/lib/basemaps';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { MapSearchParams } from '@/routes/_map';

interface TopNavProps extends React.HTMLAttributes<HTMLElement> { }

interface BasemapProps {
  links: BasemapStyle[];
  trigger: React.ReactNode | string;
  onBasemapChange: (basemapId: string) => void;
  activeBasemap: string;
}

const BasemapDropdown = ({ links, trigger, onBasemapChange, activeBasemap }: BasemapProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start">
        {links.map(({ id, title }) => {
          const isActive = activeBasemap === id;

          return (
            <DropdownMenuItem key={id} asChild>
              <Button
                variant="ghost"
                className={cn('w-full justify-start', !isActive ? 'text-muted-foreground' : 'underline')}
                onClick={() => onBasemapChange(id)}
              >
                {title}
              </Button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function TopNav({ className, ...props }: TopNavProps) {
  const { map } = useMap();
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as MapSearchParams;

  const activeBasemap = searchParams.basemap || DEFAULT_BASEMAP.id;

  // Track if this is the initial mount to only load basemap if it differs from default
  const isInitialMount = useRef(true);

  // Load basemap from URL on mount or when URL changes
  useEffect(() => {
    if (!map) return;

    const basemap = BASEMAP_STYLES.find(b => b.id === activeBasemap);
    if (!basemap) return;

    // On initial mount, only load if basemap from URL differs from default
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (activeBasemap === DEFAULT_BASEMAP.id) {
        return; // Skip - map already loaded with correct default basemap
      }
    }

    // Preserve camera state to prevent zoom flash during basemap switch
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const currentBearing = map.getBearing();
    const currentPitch = map.getPitch();

    // Preserve WMS layers before changing basemap
    const style = map.getStyle();
    const wmsLayers: unknown[] = [];
    const wmsSources: Record<string, unknown> = {};

    if (style) {
      // Save WMS, PMTiles, and WFS sources
      for (const [sourceId, source] of Object.entries(style.sources || {})) {
        if (sourceId.startsWith('wms-') || sourceId.startsWith('mapimage-') || sourceId.startsWith('pmtiles-') || sourceId.startsWith('wfs-')) {
          wmsSources[sourceId] = source;
        }
      }

      // Save WMS, PMTiles, and WFS layers
      for (const layer of style.layers || []) {
        if (layer.id.startsWith('wms-') || layer.id.startsWith('mapimage-') || layer.id.startsWith('pmtiles-') || layer.id.startsWith('wfs-')) {
          wmsLayers.push(layer);
        }
      }
    }

    // Helper to restore camera state after style change
    const restoreCamera = () => {
      map.jumpTo({
        center: currentCenter,
        zoom: currentZoom,
        bearing: currentBearing,
        pitch: currentPitch,
      });
    };

    // Helper to restore WMS/PMTiles layers after style change
    const restoreLayers = () => {
      // Re-add sources
      for (const [sourceId, source] of Object.entries(wmsSources)) {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, source as Parameters<typeof map.addSource>[1]);
        }
      }

      // Re-add layers
      for (const layer of wmsLayers) {
        const layerObj = layer as { id: string };
        if (!map.getLayer(layerObj.id)) {
          map.addLayer(layer as Parameters<typeof map.addLayer>[0]);
        }
      }
    };

    // Handle "none" basemap (empty style)
    if (!basemap.url) {
      const emptyStyle = {
        version: 8 as const,
        sources: {
          ...wmsSources
        },
        layers: [
          // Light gray background
          {
            id: 'background',
            type: 'background' as const,
            paint: {
              'background-color': '#f0f0f0'
            }
          },
          ...wmsLayers
        ]
      };
      map.setStyle(emptyStyle, { diff: false });
      map.once('style.load', restoreCamera);
      return;
    }

    // Check if the URL is a raster tile URL (satellite imagery)
    if (basemap.url.includes('{x}') && basemap.url.includes('{y}') && basemap.url.includes('{z}')) {
      // It's a raster tile source, need to create a custom style
      const rasterStyle = {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [basemap.url],
            tileSize: 256,
            attribution: '© Sentinel-2 cloudless by EOX IT Services GmbH'
          },
          ...wmsSources
        },
        layers: [
          {
            id: 'raster-layer',
            type: 'raster',
            source: 'raster-tiles'
          },
          ...wmsLayers
        ]
      };
      // Force complete style replacement
      map.setStyle(rasterStyle, { diff: false });
      map.once('style.load', restoreCamera);
    } else {
      // It's a style JSON URL - use style.load for reliable timing
      // style.load fires when the style is completely loaded (vs styledata which fires early)
      const onStyleLoad = () => {
        restoreLayers();
        restoreCamera();
      };

      map.once('style.load', onStyleLoad);
      // Force complete style replacement to avoid old basemap showing through
      map.setStyle(basemap.url, { diff: false });
    }
  }, [map, activeBasemap]);

  const handleBasemapChange = (basemapId: string) => {
    if (!map) {
      console.warn('[TopNav] No map instance available');
      return;
    }

    const basemap = BASEMAP_STYLES.find(b => b.id === basemapId);
    if (!basemap) {
      console.warn(`[TopNav] Basemap not found: ${basemapId}`);
      return;
    }

    // Update URL with new basemap
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, basemap: basemapId }),
    });
  };

  // Check if any long-type basemap is active
  const isLongActive = BASEMAP_STYLES
    .filter(({ type }) => type === 'long')
    .some(({ id }) => activeBasemap === id);

  const mobileTrigger = (
    <Button size="icon" variant="outline">
      <BasemapIcon />
    </Button>
  );

  const desktopTrigger = (
    <Button
      className={cn(
        'text-muted-foreground',
        isLongActive && 'text-secondary-foreground underline',
        'focus-visible:outline-none'
      )}
      variant="ghost"
    >
      More
    </Button>
  );

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden">
        <BasemapDropdown
          links={BASEMAP_STYLES.filter(({ type }) => type === 'short')}
          trigger={mobileTrigger}
          onBasemapChange={handleBasemapChange}
          activeBasemap={activeBasemap}
        />
      </div>

      {/* Desktop */}
      <nav
        className={cn(
          'hidden items-center space-x-4 md:flex lg:space-x-6',
          className
        )}
        {...props}
      >
        {BASEMAP_STYLES
          .filter(({ type }) => type === 'short')
          .map(({ id, title }) => {
            const isActive = activeBasemap === id;

            return (
              <Button
                variant="ghost"
                key={id}
                onClick={() => handleBasemapChange(id)}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-secondary-foreground',
                  isActive ? 'underline' : 'text-muted-foreground'
                )}
              >
                {title}
              </Button>
            );
          })}
        <BasemapDropdown
          links={BASEMAP_STYLES.filter(({ type}) => type === 'long')}
          trigger={desktopTrigger}
          onBasemapChange={handleBasemapChange}
          activeBasemap={activeBasemap}
        />
      </nav>
    </>
  );
}

export { TopNav };
