import { useState, useEffect, useRef, useCallback } from "react";
import { useMap } from '@/hooks/use-map';
import { useTerraDrawPolygon } from '@/hooks/use-terra-draw';
import SketchViewModel from "@arcgis/core/widgets/Sketch/SketchViewModel";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Layer from "@arcgis/core/layers/Layer";
import { Button } from '@/components/custom/button';
import { BackToMenuButton } from "@/components/custom/back-to-menu-button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Polygon from "@arcgis/core/geometry/Polygon";
import { useToast } from "@/hooks/use-toast";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import { Link } from "@/components/custom/link";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";


type ActiveButtonOptions = 'currentMapExtent' | 'customArea' | 'reset';
type DialogType = 'areaTooLarge' | 'confirmation' | null;

function ReportGenerator() {
    const { view, map, setIsSketching } = useMap();
    const [activeButton, setActiveButton] = useState<ActiveButtonOptions>();
    const tempGraphicsLayer = useRef<__esri.GraphicsLayer | undefined>(undefined);
    const sketchVM = useRef<__esri.SketchViewModel | undefined>(undefined);
    const { setNavOpened } = useSidebar();
    const isMobile = useIsMobile();
    const [activeDialog, setActiveDialog] = useState<DialogType>(null);
    const [screenshot, setScreenshot] = useState<string>("");
    const [pendingAoi, setPendingAoi] = useState<__esri.Geometry | null>(null);
    const { toast } = useToast();

    // Wrap draw complete handler in useCallback to ensure stable reference
    const handleMapLibreDrawCompleteCallback = useCallback((geometry: any) => {
        console.log('[ReportGenerator] MapLibre draw complete callback triggered');
        try {
            // Convert MapLibre geometry to Polygon-like format
            if (geometry.rings && geometry.rings.length > 0) {
                const rings = geometry.rings;

                // Check area constraints
                // For simplicity, estimate area using a simple bounding box
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                for (const ring of rings) {
                    for (const [lng, lat] of ring) {
                        minX = Math.min(minX, lng);
                        maxX = Math.max(maxX, lng);
                        minY = Math.min(minY, lat);
                        maxY = Math.max(maxY, lat);
                    }
                }

                // Rough conversion to meters for comparison
                const degreesToMeters = 111320;
                const areaWidth = (maxX - minX) * degreesToMeters * Math.cos((minY + maxY) / 2 * Math.PI / 180);
                const areaHeight = (maxY - minY) * degreesToMeters;

                console.log('[ReportGenerator] MapLibre draw dimensions:', { areaWidth, areaHeight });

                if (areaHeight < 12000 && areaWidth < 18000) {
                    // Create a geometry object compatible with the rest of the code
                    const aoiGeometry = {
                        spatialReference: { wkid: 4326 },
                        rings: rings
                    };
                    handleNavigate(aoiGeometry as any);
                } else {
                    setActiveDialog('areaTooLarge');
                }
            }
        } catch (error) {
            console.error('Error handling MapLibre draw complete:', error);
            setActiveDialog('areaTooLarge');
        }
    }, []);

    // Terra Draw hook for MapLibre
    const terraDraw = useTerraDrawPolygon({
        map: map,
        onDrawComplete: handleMapLibreDrawCompleteCallback
    });

    const createMap = async (aoi: string): Promise<{ view: __esri.MapView, cleanup: () => void }> => {
        // Remove any existing map containers
        const existingDiv = document.getElementById('screenshotMapDiv');
        if (existingDiv) {
            existingDiv.remove();
        }

        // Create new map container
        const mapDiv = document.createElement('div');
        mapDiv.id = 'screenshotMapDiv';
        mapDiv.style.width = '50vw';
        mapDiv.style.height = '50vh';
        document.body.appendChild(mapDiv);

        const polygonSymbol = new SimpleFillSymbol({
            color: "#8a2be2cc",
            style: "solid",
            outline: {
                color: "white",
                width: 1
            }
        });

        const parsedAoi = JSON.parse(aoi);
        const polygon = new Polygon(parsedAoi);

        const polylineGraphic = new Graphic({
            geometry: polygon,
            symbol: polygonSymbol
        });

        const map = new Map({
            basemap: "topo"
        });

        const extentClone = polygon.extent?.clone();

        const screenshotView = new MapView({
            map: map,
            container: mapDiv,
            ui: {
                components: ['attribution']
            },
            extent: extentClone?.expand(2),
            constraints: {
                snapToZoom: false
            }
        });

        // Add graphic after view initialization
        screenshotView.graphics.add(polylineGraphic);

        // Wait for the view to be ready
        await screenshotView.when();

        // Wait for the basemap to load
        await map.basemap?.load();

        // Important: Wait for ALL basemap layers to load
        const basemapLayerPromises = map.basemap?.baseLayers.map(layer => layer.load());
        await Promise.all(basemapLayerPromises || []);

        // Go to extent after layers are loaded
        await screenshotView.goTo(extentClone?.expand(2), {
            animate: false,
            duration: 0
        });

        // Wait for rendering to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        const cleanup = () => {
            screenshotView.destroy();
            mapDiv.remove();
        };

        return { view: screenshotView, cleanup };
    };

    const getScreenshot = async (geometry: __esri.Geometry) => {
        try {
            const aoi = JSON.stringify(geometry);
            const { view: screenshotView, cleanup } = await createMap(aoi);

            // Dynamically get the width and height of the map container
            const mapDiv = document.getElementById('screenshotMapDiv');
            const width = mapDiv?.offsetWidth || 0;
            const height = mapDiv?.offsetHeight || 0;

            // Capture the screenshot with dynamic width and height
            const screenshot = await screenshotView.takeScreenshot({
                width: width,
                height: height,
                format: "png"
            });

            // Clean up
            cleanup();

            return screenshot?.dataUrl;
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            return null;
        }
    };

    const handleNavigate = async (aoi: __esri.Geometry) => {
        setPendingAoi(aoi);
        const screenshotDataUrl = await getScreenshot(aoi);

        if (screenshotDataUrl) {
            setScreenshot(screenshotDataUrl);
        }

        setActiveDialog('confirmation');
    };

    const handleConfirmNavigation = () => {
        if (!pendingAoi) return;

        const aoiString = JSON.stringify(pendingAoi);
        const reportUrl = '/hazards/report/' + aoiString;

        // Open in new tab
        window.open(reportUrl, '_blank');
        handleReset();
    };

    const handleCopyLink = () => {
        if (!pendingAoi) return;

        const aoiString = JSON.stringify(pendingAoi);
        const reportUrl = window.location.origin + '/hazards/report/' + aoiString;

        navigator.clipboard.writeText(reportUrl)
            .catch(err => {
                toast({
                    variant: "destructive",
                    title: "Uh oh! Something went wrong.",
                    description: "There was a copying the link. Please try again.",
                })
                console.error('Failed to copy URL:', err)
            });

        toast({
            variant: "default",
            description: "Link copied!",
        })
    };

    function addGraphic(
        event: __esri.SketchViewModelCreateEvent,
        tempGraphicsLayer: __esri.GraphicsLayer | undefined,
        setActiveButton: React.Dispatch<React.SetStateAction<ActiveButtonOptions | undefined>>
    ) {
        if (event.state === "complete" && event.graphic && event.graphic.geometry && event.graphic.geometry.extent) {
            tempGraphicsLayer?.remove(event.graphic);
            const drawAOIHeight = event.graphic.geometry.extent.height;
            const drawAOIWidth = event.graphic.geometry.extent.width;
            const aoi = event.graphic.geometry;

            if (drawAOIHeight < 12000 && drawAOIWidth < 18000) {
                handleNavigate(aoi);
                setActiveButton(undefined);
            } else {
                setActiveDialog('areaTooLarge');
                setActiveButton(undefined);
            }
        }
    }

    const handleActiveButton = (buttonName: ActiveButtonOptions) => {
        setActiveButton(buttonName);
        view?.focus();
    };

    useEffect(() => {
        // Only run if the view is available
        if (!view) return;

        tempGraphicsLayer.current = new GraphicsLayer();
        // Correcty chain the check for '.map'
        view.map?.add(tempGraphicsLayer.current as Layer);

        return () => {
            if (tempGraphicsLayer.current) {
                view.map?.remove(tempGraphicsLayer.current as Layer);
            }
        };
    }, [view]);

    useEffect(() => {
        if (sketchVM.current) {
            sketchVM.current.destroy();
        }
    }, []);

    const handleCurrentMapExtentButton = () => {
        handleReset()
        handleActiveButton('currentMapExtent');

        const extent = view?.extent;
        const areaHeight = extent?.height;
        const areaWidth = extent?.width;

        if (areaHeight && areaWidth && areaHeight < 12000 && areaWidth < 18000) {
            const xMini = extent.xmin;
            const xMaxi = extent.xmax;
            const yMini = extent.ymin;
            const yMaxi = extent.ymax;

            const newRings = [
                [xMaxi, yMaxi],
                [xMaxi, yMini],
                [xMini, yMini],
                [xMini, yMaxi],
                [xMaxi, yMaxi]
            ];

            const aoi = new Polygon({
                spatialReference: {
                    wkid: 102100
                },
                rings: [newRings]
            });
            handleNavigate(aoi);
        } else {
            setActiveDialog('areaTooLarge');
        }
    };

    const handleCustomAreaButton = () => {
        handleReset()
        handleActiveButton('customArea');
        if (isMobile) setNavOpened(false); // Close the sidebar on mobile so user can see the map

        // Use Terra Draw (MapLibre) if map is available, otherwise use ArcGIS SketchViewModel
        if (map && terraDraw) {
            console.log('[ReportGenerator] Starting Terra Draw polygon mode');
            terraDraw.startPolygonDraw();
        } else if (view) {
            console.log('[ReportGenerator] Starting ArcGIS sketch');
            sketchVM.current = new SketchViewModel({
                view: view,
                layer: tempGraphicsLayer.current,
                updateOnGraphicClick: false,
                polygonSymbol: {
                    type: "simple-fill",
                    color: "rgba(138,43,226, 0.8)",
                    style: "solid",
                    outline: {
                        color: "white",
                        width: 1
                    }
                }
            });

            sketchVM.current.on('create', (event) => {
                if (event.state === "start") {
                    if (isMobile) {
                        const completeButton = document.createElement("button");
                        // onclick to complete the sketch
                        completeButton.onclick = () => {
                            sketchVM.current?.complete();
                        };
                        completeButton.innerHTML = "Complete";
                        completeButton.id = "complete-button";
                        completeButton.classList.add("esri-widget-button", "esri-widget", "esri-interactive", "p-2", "bg-background");

                        view?.ui.add(completeButton, "top-right");
                    }
                    setIsSketching?.(true);
                }

                if (event.state === "active") {
                    addGraphic(event, tempGraphicsLayer.current, setActiveButton);
                }

                if (event.state === "complete") {
                    setIsSketching?.(true); // Ensure it remains true immediately after completion
                    const completeButton = view?.ui.find("complete-button")
                    if (completeButton) view?.ui.remove(completeButton);

                    const extent = event.graphic.geometry?.extent;
                    const areaHeight = extent?.height;
                    const areaWidth = extent?.width;
                    const geometry = event.graphic.geometry as __esri.Polygon;

                    if (areaHeight && areaWidth && areaHeight < 12000 && areaWidth < 18000) {

                        const aoi = new Polygon({
                            spatialReference: {
                                wkid: 102100
                            },
                            rings: geometry.rings
                        });
                        handleNavigate(aoi);
                    } else {
                        setActiveDialog('areaTooLarge');
                    }

                }

                return;
            });

            sketchVM.current.create("polygon", {
                mode: "click"
            });
        }
    };

    const handleReset = () => {
        sketchVM.current?.cancel();
        if (tempGraphicsLayer.current) {
            tempGraphicsLayer.current?.removeAll();
        }
        // Also reset Terra Draw if active
        if (map && terraDraw) {
            terraDraw.clearDrawings();
        }
        setActiveButton(undefined);
        requestAnimationFrame(() => {
            setIsSketching?.(false);
        })
        setActiveDialog(null);
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
        setIsSketching?.(true);
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
                    <DialogDescription>
                        The map area is too large. Please draw a smaller custom area or zoom in.
                        <div className="flex flex-row space-x-2 mt-4 justify-end">
                            <Button onClick={handleResetDrawing} variant="default">
                                Create a new area
                            </Button>
                            <Button onClick={handleReset} variant="secondary">
                                Close
                            </Button>
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
                            <img
                                src={screenshot}
                                alt="map"
                                className="rounded-md w-full max-w-full h-auto"
                            />
                        </div>
                        <div className="flex flex-row space-x-2 mt-4 justify-end">
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
