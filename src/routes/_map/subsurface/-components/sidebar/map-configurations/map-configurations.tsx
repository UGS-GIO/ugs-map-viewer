import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useMapCoordinates } from '@/hooks/use-map-coordinates';

// ─── Coord format toggle ─────────────────────────────────────────────────

const COORD_RADIO_LABEL_CLASS = "flex flex-1 items-center justify-center rounded-sm bg-popover p-3 text-center hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary [&:has([data-state=checked])]:text-primary-foreground";

const COORD_OPTIONS = [
    { value: 'Decimal Degrees', id: 'decimal-degrees' },
    { value: 'Degrees, Minutes, Seconds', id: 'dms' },
] as const;

const CoordFormatToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <RadioGroup value={value} onValueChange={onChange} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {COORD_OPTIONS.map(opt => (
            <div key={opt.id} className="flex">
                <RadioGroupItem value={opt.value} id={opt.id} className="peer sr-only" />
                <Label htmlFor={opt.id} className={COORD_RADIO_LABEL_CLASS}>{opt.value}</Label>
            </div>
        ))}
    </RadioGroup>
);

// ─── Main ────────────────────────────────────────────────────────────────

function MapConfigurations() {
    const { setIsDecimalDegrees, locationCoordinateFormat } = useMapCoordinates();

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
                    <h2 className="text-lg font-medium mb-2">Map Configurations</h2>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Location Coordinate Format</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CoordFormatToggle value={locationCoordinateFormat} onChange={handleCoordFormatChange} />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default MapConfigurations;
