import type { FilterSchema } from '@/lib/filter/types';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { ucrcWellsWMSTitle } from './layers';

export const ucrcFilterSchema: FilterSchema = {
    recordKey: ucrcWellsWMSTitle,
    tableUrl: `${PROD_POSTGREST_URL}/enmin_ucrc_wells_current`,
    tableHeaders: { 'Accept-Profile': 'emp' },
    stacItemId: 'enmin_ucrc_wells',
    fields: [
        {
            kind: 'multiSelect',
            field: 'purpose',
            label: 'Purpose',
            // Symbology colours (purpose + box type) live in the legend, derived from the STAC
            // render legend — not here. This field is surfaced in the legend, hidden in Filters.
            optionLabelFilter: (label) => label !== 'Other / Unknown' && label !== 'Other',
        },
        { kind: 'multiSelect', field: 'county', label: 'County', placeholder: 'Select counties...' },
        { kind: 'multiSelect', field: 'current_operator', label: 'Operator', placeholder: 'Select operators...' },
        { kind: 'multiSelect', field: 'field_name', label: 'Oil/Gas Field', placeholder: 'Select oil/gas fields...' },
        { kind: 'multiSelect', field: 'cored_formations', label: 'Cored Formation', placeholder: 'Select formations...' },
        { kind: 'range', field: 'td_ft', label: 'Total Depth', units: 'ft', step: 100, snapStep: 100 },
        {
            kind: 'boolean',
            field: 'has_photos',
            label: 'Has Core Photos',
            trueValue: 'True',
            falseValue: 'False',
        },
        {
            kind: 'boolean',
            field: 'has_core_docs',
            label: 'Has Core Docs',
            trueValue: 'True',
            falseValue: 'False',
        },
        { kind: 'containsAny', field: 'box_type_codes', label: 'Sample Type', placeholder: 'Select sample types...' },
    ],
};
