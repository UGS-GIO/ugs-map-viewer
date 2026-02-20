import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { BackToMenuButton } from '@/components/ui/back-to-menu-button';
import { useCallback } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import React from 'react';

function MapConfigurations() {
    const navigate = useNavigate({ from: '/hazards-review' });
    const search = useSearch({ from: '/_map/hazards-review/' });

    const handleCoordFormatChange = useCallback((value: 'dd' | 'dms') => {
        navigate({
            search: (prev) => ({ ...prev, coordinate_format: value }),
            replace: true
        });
    }, [navigate]);


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
                            value={search.coordinate_format ?? 'dd'}
                            onValueChange={handleCoordFormatChange}
                            className="grid grid-cols-2 gap-2"
                        >
                            <div>
                                <RadioGroupItem
                                    value="dd"
                                    id="dd-radio"
                                    className="peer sr-only"
                                />
                                <Label
                                    htmlFor="dd-radio"
                                    className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-3 text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
                                >
                                    Decimal Degrees
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem
                                    value="dms"
                                    id="dms-radio"
                                    className="peer sr-only"
                                />
                                <Label
                                    htmlFor="dms-radio"
                                    className="flex flex-1 items-center justify-center rounded-md border-2 border-transparent bg-popover p-3 text-center cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground"
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

export default React.memo(MapConfigurations);