import { useState, useRef } from "react";
import { useMap } from '@/hooks/use-map';
import { useMapLibreScreenshot } from '@/hooks/use-maplibre-screenshot';
import { Button } from '@/components/custom/button';
import { BackToMenuButton } from "@/components/custom/back-to-menu-button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/components/custom/link";
import proj4 from 'proj4';
import { serializePolygonForUrl, PolygonGeometry } from '@/lib/map/conversion-utils';
import type { Polygon } from 'geojson';

type ActiveButtonOptions = 'currentMapExtent' | 'customArea' | 'reset';
type DialogType = 'areaTooLarge' | 'confirmation' | null;

function ReportGenerator() {
    const { map, setIsSketching, setIgnoreNextClick, startDraw, cancelDraw } = useMap();
    const [activeButton, setActiveButton] = useState<ActiveButtonOptions>();
    const { setNavOpened } = useSidebar();
    const isMobile = useIsMobile();
    const [activeDialog, setActiveDialog] = useState<DialogType>(null);
    const [pendingAoi, setPendingAoi] = useState<PolygonGeometry | null>(null);
    const [aoiForScreenshot, setAoiForScreenshot] = useState<string | null>(null);
    const { toast } = useToast();

    // Use ref to track sketching state synchronously to prevent race conditions
    // The ref is checked immediately in click handlers before React re-renders
    const isSketchingRef = useRef(false);

    // Use the MapLibre screenshot hook
    const { screenshot, isLoading: isCapturing } = useMapLibreScreenshot({
        polygon: aoiForScreenshot,
        width: '50vw',
        height: '50vh'
    });

    // Handle draw completion from the shared TerraDraw instance
    const handleDrawComplete = (polygon: Polygon) => {
        // Convert from WGS84 (GeoJSON) to Web Mercator for area check
        const rings = polygon.coordinates;
        const mercatorRings: number[][][] = [];

        for (const ring of rings) {
            const mercatorRing: number[][] = [];
            for (const coord of ring) {
                const [x, y] = proj4('EPSG:4326', 'EPSG:3857', [coord[0], coord[1]]);
                mercatorRing.push([x, y]);
            }
            mercatorRings.push(mercatorRing);
        }

        // Calculate extent from Web Mercator coordinates
        const allX: number[] = [];
        const allY: number[] = [];
        for (const ring of mercatorRings) {
            for (const coord of ring) {
                allX.push(coord[0]);
                allY.push(coord[1]);
            }
        }

        const minX = Math.min(...allX);
        const maxX = Math.max(...allX);
        const minY = Math.min(...allY);
        const maxY = Math.max(...allY);

        const areaWidth = maxX - minX;
        const areaHeight = maxY - minY;

        // Check if area is within limits (12000m x 18000m)
        if (areaHeight < 12000 && areaWidth < 18000) {
            const aoi: PolygonGeometry = {
                rings: mercatorRings,
                crs: 'EPSG:3857' // Web Mercator
            };
            setPendingAoi(aoi);
            setAoiForScreenshot(JSON.stringify(aoi));
            setActiveDialog('confirmation');
            setActiveButton(undefined);
        } else {
            setActiveDialog('areaTooLarge');
            setActiveButton(undefined);
        }

        // Set flag to ignore the next click (the finishing double-click)
        // This will be checked and cleared by the click handler
        setIgnoreNextClick(true);

        // Now safe to clear sketching state
        isSketchingRef.current = false;
        setIsSketching(false);
    };

    const handleNavigate = (aoi: PolygonGeometry) => {
        setPendingAoi(aoi);
        setAoiForScreenshot(JSON.stringify(aoi));
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

        // Convert to Web Mercator for area calculation
        const [swX, swY] = proj4('EPSG:4326', 'EPSG:3857', [sw.lng, sw.lat]);
        const [neX, neY] = proj4('EPSG:4326', 'EPSG:3857', [ne.lng, ne.lat]);

        const areaWidth = Math.abs(neX - swX);
        const areaHeight = Math.abs(neY - swY);

        if (areaHeight < 12000 && areaWidth < 18000) {
            // Create polygon from bounds (in Web Mercator)
            const rings = [[
                [neX, neY],
                [neX, swY],
                [swX, swY],
                [swX, neY],
                [neX, neY]
            ]];

            const aoi: PolygonGeometry = {
                rings: [rings[0]],
                crs: 'EPSG:3857' // Web Mercator
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

        // Start drawing via context - pass callback for when drawing completes
        startDraw('polygon', handleDrawComplete);
    };

    const handleReset = () => {
        cancelDraw();
        setActiveButton(undefined);
        setActiveDialog(null);
        isSketchingRef.current = false;
        setIsSketching(false);
        setIgnoreNextClick(false);
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
        setIsSketching(true);
        handleCustomAreaButton();
    }

    return (
        <div>
            <BackToMenuButton />
            <div className="p-4 space-y-4">
                <div>
                    <h3 className="text-lg font-medium mb-2">Report Generator</h3>
                    <p className="text-sm">
                        The Report Generator is designed to provide a summary of geologic hazard information for small areas. Use the current map extent or create a custom area and double-click to finish the drawing. If your area of interest is too large, you will be prompted to select a smaller area.
                    </p>
                </div>
                <div className="space-y-2">
                    <div className="flex flex-wrap justify-start items-center md:space-x-4">
                        <Button onClick={handleCurrentMapExtentButton} variant="default" className="w-full md:w-auto flex-grow mb-2 md:mb-0">
                            {buttonText('currentMapExtent', 'Current Map Extent')}
                        </Button>
                        <Button onClick={handleCustomAreaButton} variant="default" className="w-full md:w-auto flex-grow mb-2 md:mb-0">
                            {buttonText('customArea', 'Draw Custom Area')}
                        </Button>
                    </div>
                    <div className="flex w-full">
                        <Button onClick={handleReset} variant="secondary" className="w-full flex-grow mb-2 md:mb-0">
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
                <DialogContent className="w-full sm:w-4/5">
                    <DialogHeader>
                        <DialogTitle>Area too large</DialogTitle>
                    </DialogHeader>
                    <DialogDescription asChild>
                        <div>
                            <p>The map area is too large. Please draw a smaller custom area or zoom in.</p>
                            <div className="flex flex-row space-x-2 mt-4 justify-end">
                                <Button onClick={handleResetDrawing} variant="default">
                                    Create a new area
                                </Button>
                                <Button onClick={handleReset} variant="secondary">
                                    Close
                                </Button>
                            </div>
                        </div>
                    </DialogDescription>
                    <DialogClose />
                </DialogContent>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={activeDialog === 'confirmation'} onOpenChange={handleCloseDialog}>
                <DialogContent className="w-full sm:w-3/5">
                    <DialogHeader>
                        <DialogTitle>Generate report for the selected area?</DialogTitle>
                    </DialogHeader>
                    <div>
                        <div className="flex justify-center">
                            {isCapturing ? (
                                <div className="flex items-center justify-center w-full h-80 bg-muted rounded-md">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                                        <p className="text-sm text-muted-foreground">Generating map preview...</p>
                                    </div>
                                </div>
                            ) : screenshot ? (
                                <img
                                    src={screenshot}
                                    alt="map preview"
                                    className="rounded-md w-full max-w-full h-auto"
                                />
                            ) : (
                                <div className="flex items-center justify-center w-full h-80 bg-destructive/10 rounded-md">
                                    <p className="text-sm text-destructive">Failed to generate map preview</p>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-row space-x-2 mt-4 justify-end">
                            <Button onClick={handleConfirmNavigation} variant="default" disabled={isCapturing || !screenshot}>
                                Generate Report
                            </Button>
                            <Button onClick={handleCopyLink} variant="secondary" disabled={isCapturing}>
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
