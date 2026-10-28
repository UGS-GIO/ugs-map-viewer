import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { useCoordinateFormat, useMapCoordinates } from "@/hooks/use-map-coordinates";
import { COORDINATE_FORMATS, formatCoordinatePair, type CoordinateFormat } from "@/lib/map/conversion-utils";
import { addThousandsSeparator } from "@/lib/utils";

const FORMAT_LABELS: Record<CoordinateFormat, { short: string; full: string }> = {
    dd: { short: 'DD', full: 'Decimal degrees' },
    dms: { short: 'DMS', full: 'Degrees, minutes, seconds' },
    utm: { short: 'UTM', full: 'NAD83 / UTM zone 12N' },
};

const MapCoordinates = () => {
    const { lngLat, scale } = useMapCoordinates();
    const { coordinateFormat, setCoordinateFormat } = useCoordinateFormat();
    const pair = lngLat ? formatCoordinatePair(lngLat.lng, lngLat.lat, coordinateFormat, 3) : null;

    return (
        <div className="flex shrink-0 items-center space-x-1.5 whitespace-nowrap">
            <div className="flex items-center space-x-1.5">
                {pair?.map(({ label, value }) => (
                    <span key={label} className="text-xs md:text-sm text-muted-foreground">{label}:{' '}{value}</span>
                ))}
                <ToggleGroup
                    aria-label="Coordinate format"
                    value={[coordinateFormat]}
                    // A click on the pressed option would empty the group; keep the current format instead.
                    onValueChange={([next]) => next && setCoordinateFormat(next)}
                    className="inline-flex rounded-md bg-muted p-0.5"
                >
                    {COORDINATE_FORMATS.map((format) => (
                        <Toggle
                            key={format}
                            value={format}
                            title={FORMAT_LABELS[format].full}
                            className="rounded-sm px-1.5 text-xs text-muted-foreground data-[pressed]:bg-background data-[pressed]:text-foreground data-[pressed]:shadow-sm"
                        >
                            {FORMAT_LABELS[format].short}
                        </Toggle>
                    ))}
                </ToggleGroup>
                <div className="h-3 md:h-4 w-px bg-border" aria-hidden="true" />
                <span className="text-xs md:text-sm text-muted-foreground">
                    Scale: {scale > 0 ? `1:${addThousandsSeparator(scale.toFixed(0))}` : '—'}
                </span>
            </div>
        </div>
    );
};

export { MapCoordinates };
