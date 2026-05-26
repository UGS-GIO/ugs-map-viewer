import { useState, useRef } from "react";
import { useMap } from '@/hooks/use-map';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MapPreview } from '@/routes/_report/-components/shared/map-preview';
import { BackToMenuButton } from "@/components/ui/back-to-menu-button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/components/ui/link";
import turfArea from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import { serializePolygonForUrl, PolygonGeometry } from '@/lib/map/conversion-utils';
import { queryIntersectingQuadNames } from '@/routes/_report/-utils/geoserver-wfs-service';
import { queryKeys } from '@/lib/query-keys';
import type { Polygon } from 'geojson';

type ActiveButtonOptions = 'currentMapExtent' | 'customArea' | 'reset';
type DialogType = 'areaTooLarge' | 'confirmation' | null;

const SQ_METERS_PER_SQ_MILE = 2589988.11;
const SQ_METERS_PER_SQ_KM = 1_000_000;

// AOI extent limits in WGS84 degrees. Calibrated to preserve the pre-migration cap: the old check
// compared Web Mercator unit deltas against 12000/18000, which (with ~1.305× Mercator inflation at
// 40°N) capped the true ground extent at ≈9.2 km lat × 13.8 km lon. These degree values reproduce
// that same true extent at 40°N. Longitude degrees vary ~4% across Utah latitudes (approximate).
// 1° latitude ≈ 111,320 m everywhere; 1° longitude ≈ 85,300 m at 40°N.
const MAX_AOI_LAT_EXTENT_DEG = 0.0826;  // ≈9.2 km
const MAX_AOI_LON_EXTENT_DEG = 0.162;   // ≈13.8 km at 40°N

/** Geodesic area from a WGS84 polygon via @turf/area */
function formatAoiArea(aoi: PolygonGeometry): string {
    const sqM = turfArea(turfPolygon(aoi.rings));
    const sqMi = (sqM / SQ_METERS_PER_SQ_MILE).toFixed(1);
    const sqKm = (sqM / SQ_METERS_PER_SQ_KM).toFixed(1);

    return `~${sqMi} mi² (~${sqKm} km²)`;
}

function ReportGenerator() {
    const { map, setIsSketching, startDraw, cancelDraw } = useMap();
    const [activeButton, setActiveButton] = useState<ActiveButtonOptions>();
    const { setNavOpened } = useSidebar();
    const isMobile = useIsMobile();
    const [activeDialog, setActiveDialog] = useState<DialogType>(null);
    const [pendingAoi, setPendingAoi] = useState<PolygonGeometry | null>(null);
    const { toast } = useToast();

    // Use ref to track sketching state synchronously to prevent race conditions
    // The ref is checked immediately in click handlers before React re-renders
    const isSketchingRef = useRef(false);

    // Serialize pending AOI for queries (stable reference when AOI doesn't change)
    const serializedAoi = pendingAoi ? JSON.stringify(pendingAoi) : null;

    // Query quad names when confirmation dialog is open
    const { data: quadNames = [] } = useQuery({
        queryKey: queryKeys.hazards.quadNames(serializedAoi ?? ''),
        queryFn: () => queryIntersectingQuadNames(serializedAoi!),
        enabled: !!serializedAoi && activeDialog === 'confirmation',
    });


    // Handle draw completion from the shared TerraDraw instance
    const handleDrawComplete = (polygon: Polygon) => {
        // TerraDraw provides coordinates in WGS84 (GeoJSON spec)
        const rings = polygon.coordinates;

        // Calculate extent in WGS84 degrees directly
        const allLng: number[] = [];
        const allLat: number[] = [];
        for (const ring of rings) {
            for (const coord of ring) {
                allLng.push(coord[0]);
                allLat.push(coord[1]);
            }
        }

        const minLng = Math.min(...allLng);
        const maxLng = Math.max(...allLng);
        const minLat = Math.min(...allLat);
        const maxLat = Math.max(...allLat);

        const areaWidth = maxLng - minLng;   // degrees longitude
        const areaHeight = maxLat - minLat;  // degrees latitude

        if (areaHeight < MAX_AOI_LAT_EXTENT_DEG && areaWidth < MAX_AOI_LON_EXTENT_DEG) {
            const aoi: PolygonGeometry = {
                rings,
                crs: 'EPSG:4326'
            };
            setPendingAoi(aoi);
            setActiveDialog('confirmation');
            setActiveButton(undefined);
        } else {
            setActiveDialog('areaTooLarge');
            setActiveButton(undefined);
        }

        // Now safe to clear sketching state
        isSketchingRef.current = false;
        setIsSketching(false);
    };

    const handleNavigate = (aoi: PolygonGeometry) => {
        setPendingAoi(aoi);
        setActiveDialog('confirmation');
    };

    const handleConfirmNavigation = () => {
        if (!pendingAoi) return;

        const serialized = serializePolygonForUrl(pendingAoi);
        if (!serialized) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to serialize polygon for report",
            });
            return;
        }

        const reportUrl = `/hazards/report?aoi=${encodeURIComponent(serialized)}`;

        // Open in new tab
        window.open(reportUrl, '_blank');
        handleReset();
    };

    const handleCopyLink = () => {
        if (!pendingAoi) return;

        const serialized = serializePolygonForUrl(pendingAoi);
        if (!serialized) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to serialize polygon for report",
            });
            return;
        }

        const reportUrl = window.location.origin + `/hazards/report?aoi=${encodeURIComponent(serialized)}`;

        navigator.clipboard.writeText(reportUrl)
            .catch(err => {
                toast({
                    variant: "destructive",
                    title: "Uh oh! Something went wrong.",
                    description: "There was a problem copying the link. Please try again.",
                })
                console.error('Failed to copy URL:', err)
            });

        toast({
            variant: "default",
            description: "Link copied!",
        })
    };

    const handleActiveButton = (buttonName: ActiveButtonOptions) => {
        setActiveButton(buttonName);
    };

    const handleCurrentMapExtentButton = () => {
        handleReset();
        handleActiveButton('currentMapExtent');

        console.log('[ReportGenerator] Current Map Extent - map:', map)
        if (!map) {
            console.warn('[ReportGenerator] Map is null/undefined')
            return
        }

        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // Area calculation in WGS84 degrees
        const areaWidth = Math.abs(ne.lng - sw.lng);
        const areaHeight = Math.abs(ne.lat - sw.lat);

        if (areaHeight < MAX_AOI_LAT_EXTENT_DEG && areaWidth < MAX_AOI_LON_EXTENT_DEG) {
            // CCW winding per GeoJSON RFC 7946 (exterior ring)
            const rings = [[
                [sw.lng, sw.lat],
                [ne.lng, sw.lat],
                [ne.lng, ne.lat],
                [sw.lng, ne.lat],
                [sw.lng, sw.lat],
            ]];

            const aoi: PolygonGeometry = {
                rings,
                crs: 'EPSG:4326'
            };
            handleNavigate(aoi);
        } else {
            setActiveDialog('areaTooLarge');
        }
    };

    const handleCustomAreaButton = () => {
        // Cancel any existing drawing first
        cancelDraw();
        setActiveButton('customArea');
        if (isMobile) setNavOpened(false);

        // Set sketching state synchronously with ref
        isSketchingRef.current = true;
        setIsSketching(true);

        // Start drawing via context - pass callbacks for completion and external cancel
        startDraw('polygon', handleDrawComplete, () => {
            setActiveButton(undefined);
            isSketchingRef.current = false;
            setIsSketching(false);
        });
    };

    const handleReset = () => {
        cancelDraw();
        setActiveButton(undefined);
        setActiveDialog(null);
        isSketchingRef.current = false;
        setIsSketching(false);
    };

    const buttonText = (buttonName: ActiveButtonOptions, defaultText: string) => {
        return (
            activeButton === buttonName ? `✓ ${defaultText}` : defaultText
        );
    }

    const handleCloseDialog = () => {
        setActiveDialog(null);
        setPendingAoi(null);
        handleReset();
    }

    const handleResetDrawing = () => {
        setActiveDialog(null);
        setPendingAoi(null);
        handleCustomAreaButton();
    }

    const handleZoomToFit = () => {
        if (!map) return;

        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        // Area calculation in WGS84 degrees
        const areaWidth = Math.abs(ne.lng - sw.lng);
        const areaHeight = Math.abs(ne.lat - sw.lat);

        // Calculate scale factor needed to fit within MAX_AOI extent.
        // Add a small buffer (0.95) to ensure we're comfortably within limits.
        const scaleX = (MAX_AOI_LON_EXTENT_DEG * 0.95) / areaWidth;
        const scaleY = (MAX_AOI_LAT_EXTENT_DEG * 0.95) / areaHeight;
        const scaleFactor = Math.min(scaleX, scaleY);

        // Calculate zoom delta (each zoom level is 2x)
        const zoomDelta = Math.log2(1 / scaleFactor);
        const currentZoom = map.getZoom();
        const newZoom = currentZoom + zoomDelta;

        // Close dialog and zoom
        setActiveDialog(null);
        map.zoomTo(newZoom, { duration: 500 });

        // After zoom completes, trigger current map extent
        setTimeout(() => {
            handleCurrentMapExtentButton();
        }, 600);
    }

    return (
        <div>
            <BackToMenuButton />
            <div className="p-4 space-y-4" data-tour="report-generator">
                <div>
                    <h3 className="text-lg font-medium mb-2">Report Generator</h3>
                    <p className="text-sm">
                        The Report Generator is designed to provide a summary of geologic hazard information for small areas. Use the current map extent or create a custom area and double-click to finish the drawing. If your area of interest is too large, you will be prompted to select a smaller area.
                    </p>
                </div>
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 justify-start items-center">
                        <Button onClick={handleCurrentMapExtentButton} variant="default" className="w-full md:w-auto flex-grow">
                            {buttonText('currentMapExtent', 'Current Map Extent')}
                        </Button>
                        <Button onClick={handleCustomAreaButton} variant="default" className="w-full md:w-auto flex-grow">
                            {buttonText('customArea', 'Draw Custom Area')}
                        </Button>
                    </div>
                    <div className="flex w-full">
                        <Button onClick={handleReset} variant="secondary" className="w-full flex-grow">
                            {buttonText('reset', 'Reset')}
                        </Button>
                    </div>
                </div>
                <p className="text-sm italic">
                    These summary reports are not a substitute for a site-specific geologic hazards and geotechnical engineering investigation by a qualified, Utah-licensed consultant. See your local city or county building department for details on these investigations and <Link to="https://doi.org/10.34191/C-128">UGS Circular 128</Link> for more information.
                </p>
            </div>

            {/* Area Too Large Dialog */}
            <Dialog open={activeDialog === 'areaTooLarge'} onOpenChange={handleCloseDialog}>
                <DialogContent className="w-full sm:w-4/5" role="alertdialog">
                    <DialogHeader>
                        <DialogTitle>Area too large</DialogTitle>
                        <DialogDescription>
                            The map area is too large. Please draw a smaller custom area, zoom in, or let us zoom to fit.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-wrap gap-2 justify-end" role="group" aria-label="Area size options">
                        <Button onClick={handleZoomToFit} variant="default">
                            Zoom to fit
                        </Button>
                        <Button onClick={handleResetDrawing} variant="secondary">
                            Draw new area
                        </Button>
                        <Button onClick={handleReset} variant="secondary">
                            Close
                        </Button>
                    </div>
                    <DialogClose />
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={activeDialog === 'confirmation'} onOpenChange={handleCloseDialog}>
                <DialogContent className="w-full sm:w-3/5 max-h-[90vh] flex flex-col" aria-describedby="confirmation-description">
                    <DialogHeader>
                        <DialogTitle>Generate report for the selected area?</DialogTitle>
                        <DialogDescription id="confirmation-description">
                            {pendingAoi && formatAoiArea(pendingAoi)}
                            {pendingAoi && quadNames.length > 0 && ' · '}
                            {quadNames.length > 0 && `${quadNames.join(', ')} quad${quadNames.length > 1 ? 's' : ''}`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 flex flex-col gap-4">
                        {pendingAoi && (
                            <MapPreview
                                polygon={JSON.stringify(pendingAoi)}
                                height={isMobile ? 250 : 300}
                                title=""
                            />
                        )}
                        <div className="flex flex-wrap gap-2 justify-end shrink-0" role="group" aria-label="Report actions">
                            <Button onClick={handleConfirmNavigation} variant="default">
                                Generate Report
                            </Button>
                            <Button onClick={handleCopyLink} variant="secondary">
                                Copy Link
                            </Button>
                            <Button onClick={handleCloseDialog} variant="secondary">
                                Cancel
                            </Button>
                        </div>
                    </div>
                    <DialogClose />
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ReportGenerator;
