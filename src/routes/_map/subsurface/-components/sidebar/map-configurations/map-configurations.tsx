import { useMemo, useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useMapCoordinates } from '@/hooks/use-map-coordinates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ucrcWellsWMSTitle, UCRC_BOX_TYPE_CODES, UCRC_BOX_TYPE_COLORS } from '../../../-data/layers/layers';
import { ucrcFilterSchema } from '../../../-data/layers/ucrc-schema';
import { LayerFilterPanel, useLayerFilter } from '@/components/sidebar/filter/layer-filter-panel';

const SYMBOLOGY_PURPOSE = '';
const SYMBOLOGY_BOX_TYPE = 'box-type';

// ─── Vector symbology (URL-driven) ──────────────────────────────────────

const useVectorSymbology = (layerTitle: string) => {
    const navigate = useNavigate({ from: '/subsurface/' });
    const search = useSearch({ from: '/_map/subsurface/' });

    const value = useMemo(
        () => (search.vector_symbology as Record<string, string> | undefined)?.[layerTitle] ?? SYMBOLOGY_PURPOSE,
        [search.vector_symbology, layerTitle],
    );

    const setValue = useCallback((next: string) => {
        navigate({
            search: (prev) => {
                const current = (prev.vector_symbology as Record<string, string> | undefined) || {};
                if (next && next !== SYMBOLOGY_PURPOSE) {
                    return { ...prev, vector_symbology: { ...current, [layerTitle]: next } };
                }
                const { [layerTitle]: _removed, ...rest } = current;
                return { ...prev, vector_symbology: Object.keys(rest).length > 0 ? rest : undefined };
            },
            replace: true,
        });
    }, [navigate, layerTitle]);

    return { value, setValue };
};

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
    const filter = useLayerFilter(ucrcFilterSchema);
    const { value: symbology, setValue: setSymbology } = useVectorSymbology(ucrcWellsWMSTitle);
    const isBoxTypeMode = symbology === SYMBOLOGY_BOX_TYPE;

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
                        <CardTitle>Location Coordinate Format</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CoordFormatToggle value={locationCoordinateFormat} onChange={handleCoordFormatChange} />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Symbolize UCRC Wells By</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Select value={symbology || 'purpose'} onValueChange={(v) => setSymbology(v === 'purpose' ? '' : v)}>
                            <SelectTrigger className="h-9 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="purpose" className="text-xs">Purpose</SelectItem>
                                <SelectItem value={SYMBOLOGY_BOX_TYPE} className="text-xs">Box Type</SelectItem>
                            </SelectContent>
                        </Select>
                        {isBoxTypeMode && (
                            <div className="text-xs text-muted-foreground space-y-1">
                                <div className="font-medium">Wedge key</div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                    {UCRC_BOX_TYPE_CODES.map(code => (
                                        <div key={code} className="flex items-center gap-2">
                                            <span
                                                className="inline-block w-3 h-3 rounded-sm border border-foreground/30 shrink-0"
                                                style={{ backgroundColor: UCRC_BOX_TYPE_COLORS[code] }}
                                            />
                                            <span>{code}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] pt-1">
                                    Each well is a pie split into equal wedges — one per box type present, drawn clockwise starting top-left.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>UCRC Wells Filters</span>
                            {filter.hasAnyFilter && (
                                <button
                                    onClick={filter.clearAll}
                                    className="text-xs text-muted-foreground hover:text-foreground underline"
                                >
                                    Clear all
                                </button>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LayerFilterPanel schema={ucrcFilterSchema} />
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

export default MapConfigurations;
