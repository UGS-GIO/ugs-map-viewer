import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useMapCoordinates } from '@/hooks/use-map-coordinates';
import { useSidebar } from '@/hooks/use-sidebar';

function MapConfigurations() {
    const { setIsDecimalDegrees, locationCoordinateFormat } = useMapCoordinates();
    const { sidebarWidth } = useSidebar();
    const handleCoordFormatChange = (value: string) => {
        if (value && setIsDecimalDegrees) {
            setIsDecimalDegrees(value === "Decimal Degrees");
        }
    };

    return (
        <>
            <BackToMenuButton />
            <div className='space-y-2'>
                <div className="mb-4">
                    <h3 className="text-lg font-medium mb-2">Map Configurations</h3>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Location Coordinate Format
                        </CardTitle>
                        {/* <CardDescription>Choose a coordinate format to toggle between decimal degrees and degrees, minutes, seconds.</CardDescription> */}
                    </CardHeader>
                    <CardContent>
                        <RadioGroup
                            value={locationCoordinateFormat}
                            onValueChange={handleCoordFormatChange}
                            className={`grid gap-2 ${sidebarWidth === 'wide' ? 'grid-cols-2' : 'grid-cols-1'}`}
                        >
                            <div className="flex min-w-0">
                                <RadioGroupItem value="Decimal Degrees" id="decimal-degrees" className="peer sr-only" />
                                <Label
                                    htmlFor="decimal-degrees"
                                    className="flex flex-1 items-center justify-center rounded-sm bg-popover p-3 text-center text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary [&:has([data-state=checked])]:text-primary-foreground"
                                >
                                    Decimal Degrees
                                </Label>
                            </div>
                            <div className="flex min-w-0">
                                <RadioGroupItem value="Degrees, Minutes, Seconds" id="dms" className="peer sr-only" />
                                <Label
                                    htmlFor="dms"
                                    className="flex flex-1 items-center justify-center rounded-sm bg-popover p-3 text-center text-sm hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary [&:has([data-state=checked])]:text-primary-foreground"
                                >
                                    Degrees, Minutes, Seconds
                                </Label>
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default MapConfigurations;