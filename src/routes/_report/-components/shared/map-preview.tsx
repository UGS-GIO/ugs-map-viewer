import { useRef, useMemo, useEffect, useState, useCallback, useId } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hazardLayerNameMap as importedHazardLayerNameMap } from '@/routes/_report/-data/hazard-unit-map';
import { PROD_GEOSERVER_URL } from '@/lib/constants';
import { convertCoordinate, calculateBounds, convertPolygonToWGS84 } from '@/lib/map/conversion-utils';
import { useScreenshotLoading } from '@/routes/_report/-context/screenshot-loading-context';

const hazardLayerNameMap: Record<string, string> = importedHazardLayerNameMap as Record<string, string>;

// Static tile URL - using standard 256px tiles (not @2x)
const TILE_URL = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

// Padding around polygon in pixels (matching MapLibre fitBounds behavior)
const MAP_PADDING_PX = 50;

interface MapPreviewProps {
    title?: string;
    polygon?: string;
    hazardCodes?: string[];
    height?: number;
    geoserverUrl?: string;
    tooltip?: React.ReactNode;
}

/** Convert lng/lat to Web Mercator using proj4 */
function toWebMercator(lng: number, lat: number): [number, number] {
    const result = convertCoordinate([lng, lat], 'EPSG:4326', 'EPSG:3857');
    return [result[0], result[1]];
}

/** Convert Web Mercator to lng/lat using proj4 */
function fromWebMercator(x: number, y: number): [number, number] {
    const result = convertCoordinate([x, y], 'EPSG:3857', 'EPSG:4326');
    return [result[0], result[1]];
}

/** Parse polygon string into WGS84 coordinates */
function parsePolygonCoordinates(polygon: string | undefined): number[][] | null {
    if (!polygon) return null;

    // Try using existing utility first
    const fromUtil = convertPolygonToWGS84(polygon);
    if (fromUtil) return fromUtil;

    // Fallback for other formats
    try {
        const parsed = JSON.parse(polygon);
        if (Array.isArray(parsed) && Array.isArray(parsed[0]) && typeof parsed[0][0] === 'number') return parsed;
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) return parsed.coordinates[0];
        if (Array.isArray(parsed[0]?.[0]) && typeof parsed[0][0][0] === 'number') return parsed[0];
        if (parsed.geometry?.type === 'Polygon' && Array.isArray(parsed.geometry.coordinates?.[0])) return parsed.geometry.coordinates[0];
        return null;
    } catch {
        return null;
    }
}

// Earth's circumference at equator in Web Mercator meters
const EARTH_CIRCUMFERENCE_M = 40075016.686;
const TILE_SIZE_PX = 256;
const MIN_ZOOM = 0;
const MAX_ZOOM = 18;

/** Calculate zoom level that would show this bbox width at given canvas width */
function calculateZoomForBbox(bboxWidthMeters: number, canvasWidth: number): number {
    // At zoom 0, world is TILE_SIZE_PX wide = EARTH_CIRCUMFERENCE_M meters
    // At zoom z, 1 pixel = EARTH_CIRCUMFERENCE_M / (TILE_SIZE_PX * 2^z) meters
    const zoom = Math.log2(canvasWidth * EARTH_CIRCUMFERENCE_M / (bboxWidthMeters * TILE_SIZE_PX));
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Get tile x/y coordinates for a lng/lat point at a zoom level */
function getTileCoords(lng: number, lat: number, zoom: number): { x: number; y: number } {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
}

/** Get geographic bounds of a tile in lng/lat */
function getTileBoundsLngLat(tileX: number, tileY: number, zoom: number): { west: number; east: number; north: number; south: number } {
    const n = Math.pow(2, zoom);
    return {
        west: tileX / n * 360 - 180,
        east: (tileX + 1) / n * 360 - 180,
        north: Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI,
        south: Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileY + 1) / n))) * 180 / Math.PI
    };
}

/** Scale bar calculation result */
interface ScaleBarInfo {
    text: string;
    pixelWidth: number;
}

/** Viewport calculation result for map rendering */
interface Viewport {
    bboxMinX: number;
    bboxMaxX: number;
    bboxMinY: number;
    bboxMaxY: number;
    bboxWidth: number;
    bboxHeight: number;
    width: number;
    height: number;
    zoom: number;
    scaleBar: ScaleBarInfo;
}

/** Calculate scale bar info */
function calculateScaleBar(bboxWidthMeters: number, canvasWidth: number, centerLat: number): ScaleBarInfo {
    const correctedWidth = bboxWidthMeters * Math.cos(centerLat * Math.PI / 180);
    const metersPerPixel = correctedWidth / canvasWidth;
    const targetPixels = Math.min(canvasWidth / 5, 150);
    let distance = targetPixels * metersPerPixel;

    let unit = 'm';
    if (distance >= 1000) {
        distance /= 1000;
        unit = 'km';
    }

    const niceNumbers = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
    let bestDistance = niceNumbers[0];
    for (const n of niceNumbers) {
        if (distance >= n * 0.7) bestDistance = n;
        else break;
    }

    const actualMeters = unit === 'km' ? bestDistance * 1000 : bestDistance;
    const pixelWidth = Math.round(actualMeters / metersPerPixel);
    return { text: `${bestDistance} ${unit}`, pixelWidth: Math.min(pixelWidth, 200) };
}

/** Calculate viewport bbox that fits polygon with padding */
function calculateViewport(
    bounds: [[number, number], [number, number]],
    width: number,
    height: number
): Viewport {
    const [[minLng, minLat], [maxLng, maxLat]] = bounds;

    // Convert polygon bounds to Web Mercator
    const [polyMinX, polyMinY] = toWebMercator(minLng, minLat);
    const [polyMaxX, polyMaxY] = toWebMercator(maxLng, maxLat);

    const polyWidth = polyMaxX - polyMinX;
    const polyHeight = polyMaxY - polyMinY;
    const polyCenterX = (polyMinX + polyMaxX) / 2;
    const polyCenterY = (polyMinY + polyMaxY) / 2;

    // Calculate bbox with padding (like MapLibre fitBounds)
    const availableWidth = width - 2 * MAP_PADDING_PX;
    const availableHeight = height - 2 * MAP_PADDING_PX;

    const scale = Math.min(availableWidth / polyWidth, availableHeight / polyHeight);
    const bboxWidth = width / scale;
    const bboxHeight = height / scale;

    const bboxMinX = polyCenterX - bboxWidth / 2;
    const bboxMaxX = polyCenterX + bboxWidth / 2;
    const bboxMinY = polyCenterY - bboxHeight / 2;
    const bboxMaxY = polyCenterY + bboxHeight / 2;

    const centerLat = (minLat + maxLat) / 2;
    const zoom = Math.floor(calculateZoomForBbox(bboxWidth, width));

    return {
        bboxMinX, bboxMaxX, bboxMinY, bboxMaxY,
        bboxWidth, bboxHeight, width, height, zoom,
        scaleBar: calculateScaleBar(bboxWidth, width, centerLat)
    };
}

/** Fetch a tile image with caching via QueryClient */
async function fetchTile(
    queryClient: ReturnType<typeof useQueryClient>,
    z: number,
    x: number,
    y: number
): Promise<HTMLImageElement | null> {
    const queryKey = ['tile', z, x, y];

    // Check cache first
    const cached = queryClient.getQueryData<HTMLImageElement>(queryKey);
    if (cached) return cached;

    // Fetch and cache
    return queryClient.fetchQuery({
        queryKey,
        queryFn: () => new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Tile load failed'));
            img.src = TILE_URL.replace('{z}', z.toString()).replace('{x}', x.toString()).replace('{y}', y.toString());
        }),
        staleTime: Infinity, // Tiles don't change
        gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    }).catch(() => null);
}

/** Load and draw basemap tiles */
async function drawBasemapTiles(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    queryClient: ReturnType<typeof useQueryClient>,
    checkCancelled: () => void
): Promise<void> {
    const { bboxMinX, bboxMaxX, bboxMinY, bboxMaxY, bboxWidth, bboxHeight, width, height, zoom } = viewport;

    const [bboxMinLng, bboxMinLat] = fromWebMercator(bboxMinX, bboxMinY);
    const [bboxMaxLng, bboxMaxLat] = fromWebMercator(bboxMaxX, bboxMaxY);

    const minTile = getTileCoords(bboxMinLng, bboxMaxLat, zoom);
    const maxTile = getTileCoords(bboxMaxLng, bboxMinLat, zoom);

    // Fetch all tiles (uses cache if available)
    const tileRequests: { x: number; y: number; promise: Promise<HTMLImageElement | null> }[] = [];
    for (let tx = minTile.x; tx <= maxTile.x; tx++) {
        for (let ty = minTile.y; ty <= maxTile.y; ty++) {
            tileRequests.push({
                x: tx,
                y: ty,
                promise: fetchTile(queryClient, zoom, tx, ty)
            });
        }
    }

    const tiles = await Promise.all(
        tileRequests.map(async ({ x, y, promise }) => {
            const img = await promise;
            return img ? { img, x, y } : null;
        })
    );
    checkCancelled();

    for (const tile of tiles) {
        if (!tile) continue;
        const tileBounds = getTileBoundsLngLat(tile.x, tile.y, zoom);
        const [tileMinX, tileMinY] = toWebMercator(tileBounds.west, tileBounds.south);
        const [tileMaxX, tileMaxY] = toWebMercator(tileBounds.east, tileBounds.north);

        const px1 = ((tileMinX - bboxMinX) / bboxWidth) * width;
        const px2 = ((tileMaxX - bboxMinX) / bboxWidth) * width;
        const py1 = ((bboxMaxY - tileMaxY) / bboxHeight) * height;
        const py2 = ((bboxMaxY - tileMinY) / bboxHeight) * height;

        ctx.drawImage(tile.img, px1, py1, px2 - px1, py2 - py1);
    }
}

/** Load and draw WMS hazard layers */
async function drawHazardLayers(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    layers: { code: string; layerName: string }[],
    geoserverUrl: string,
    checkCancelled: () => void
): Promise<void> {
    const { bboxMinX, bboxMaxX, bboxMinY, bboxMaxY, width, height } = viewport;
    const wmsBbox = `${bboxMinX},${bboxMinY},${bboxMaxX},${bboxMaxY}`;

    for (const { layerName } of layers) {
        checkCancelled();
        const wmsUrl = `${geoserverUrl}/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=${layerName}&SRS=EPSG:3857&WIDTH=${width}&HEIGHT=${height}&BBOX=${wmsBbox}`;

        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.crossOrigin = 'anonymous';
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = wmsUrl;
            });
            checkCancelled();
            ctx.globalAlpha = 0.7;
            ctx.drawImage(img, 0, 0, width, height);
            ctx.globalAlpha = 1.0;
        } catch {
            // Layer failed or cancelled
        }
    }
}

/** Draw polygon outline on canvas */
function drawPolygon(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    coords: number[][]
): void {
    const { bboxMinX, bboxMaxY, bboxWidth, bboxHeight, width, height } = viewport;

    ctx.beginPath();
    for (let i = 0; i < coords.length; i++) {
        const [lng, lat] = coords[i];
        const [mx, my] = toWebMercator(lng, lat);
        const px = ((mx - bboxMinX) / bboxWidth) * width;
        const py = ((bboxMaxY - my) / bboxHeight) * height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
}

export function MapPreview({
    title = 'Map',
    polygon,
    hazardCodes = [],
    height = 400,
    geoserverUrl,
    tooltip
}: MapPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasWidth, setCanvasWidth] = useState(800);
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [scaleInfo, setScaleInfo] = useState<{ text: string; pixelWidth: number } | null>(null);

    const id = useId();
    const queryClient = useQueryClient();
    const { registerLoading, unregisterLoading } = useScreenshotLoading();

    // Measure container width
    useEffect(() => {
        if (!containerRef.current) return;
        const width = containerRef.current.offsetWidth;
        if (width > 0) setCanvasWidth(width);
    }, []);

    useEffect(() => {
        if (isLoading) {
            registerLoading(id);
        } else {
            unregisterLoading(id);
        }
        return () => unregisterLoading(id);
    }, [isLoading, id, registerLoading, unregisterLoading]);

    const polygonCoords = useMemo(() => parsePolygonCoordinates(polygon), [polygon]);
    const bounds = useMemo(() => polygonCoords ? calculateBounds(polygonCoords) : null, [polygonCoords]);

    const validHazardLayers = useMemo(() => {
        return hazardCodes
            .filter(code => hazardLayerNameMap[code])
            .map(code => ({ code, layerName: hazardLayerNameMap[code] }));
    }, [hazardCodes]);

    const renderMap = useCallback(async (canvas: HTMLCanvasElement, width: number, signal: AbortSignal): Promise<ScaleBarInfo | null> => {
        if (!bounds || !polygonCoords) return null;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const checkCancelled = () => {
            if (signal.aborted) throw new Error('Render cancelled');
        };

        // Calculate viewport
        const viewport = calculateViewport(bounds, width, height);

        // Clear canvas
        ctx.fillStyle = '#e8e8e8';
        ctx.fillRect(0, 0, width, height);

        // Draw layers (basemap tiles use queryClient for caching)
        await drawBasemapTiles(ctx, viewport, queryClient, checkCancelled);
        await drawHazardLayers(ctx, viewport, [{ code: 'QUADS', layerName: 'gen_gis:24kquads' }, ...validHazardLayers], geoserverUrl || PROD_GEOSERVER_URL, checkCancelled);

        checkCancelled();
        drawPolygon(ctx, viewport, polygonCoords);

        // Return scale bar info and image data
        setImageDataUrl(canvas.toDataURL('image/png'));
        setIsLoading(false);
        return viewport.scaleBar;
    }, [bounds, polygonCoords, validHazardLayers, geoserverUrl, height, queryClient]);

    useEffect(() => {
        if (!canvasRef.current || !bounds || canvasWidth === 0) return;

        const abortController = new AbortController();

        renderMap(canvasRef.current, canvasWidth, abortController.signal)
            .then(scaleBar => {
                if (scaleBar && !abortController.signal.aborted) {
                    setScaleInfo(scaleBar);
                }
            })
            .catch(err => {
                if (err?.message !== 'Render cancelled') {
                    console.error('Map render failed:', err);
                }
            });

        return () => abortController.abort();
    }, [bounds, renderMap, canvasWidth]);

    // Build descriptive alt text for accessibility
    const altText = title
        || (hazardCodes.length > 0
            ? `Map preview showing ${hazardCodes.join(', ')} hazard layers`
            : 'Map preview of selected area');

    if (imageDataUrl) {
        return (
            <div className="relative overflow-hidden shadow-sm print-map-container rounded-lg border">
                {title && (
                    <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                        <span className="font-semibold text-sm">{title}</span>
                        {tooltip && <div>{tooltip}</div>}
                    </div>
                )}
                <div className="relative bg-secondary">
                    <img src={imageDataUrl} alt={altText} className="print-map-image w-full h-auto block" />
                    {scaleInfo && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs flex items-center gap-2 print:bg-background print:border">
                            <span className="text-foreground whitespace-nowrap">Scale:</span>
                            <div style={{ width: `${scaleInfo.pixelWidth}px`, minWidth: '30px' }} className="h-1 bg-muted-foreground" />
                            <span className="text-foreground whitespace-nowrap">{scaleInfo.text}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative border rounded-lg overflow-hidden shadow-sm">
            <div className="relative overflow-hidden" style={{ height: `${height}px` }}>
                {isLoading && (
                    <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Loading map...</p>
                        </div>
                    </div>
                )}
                <canvas ref={canvasRef} width={canvasWidth} height={height} className="w-full h-full absolute inset-0" />
            </div>
        </div>
    );
}
