import type { FilterSchema } from '@/lib/filter/types';
import { PROD_POSTGREST_URL } from '@/lib/constants';
import { ucrcWellsWMSTitle } from './ucrc-wells';

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
            placeholder: 'Select purposes...',
            optionLabelFilter: (label) => label !== 'Other / Unknown' && label !== 'Other',
        },
        { kind: 'containsAny', field: 'box_type_codes', label: 'Sample Type', placeholder: 'Select sample types...' },
        { kind: 'multiSelect', field: 'county', label: 'County', placeholder: 'Select counties...' },
        { kind: 'multiSelect', field: 'current_operator', label: 'Operator', placeholder: 'Select operators...' },
        { kind: 'multiSelect', field: 'field_name', label: 'Oil/Gas Field', placeholder: 'Select oil/gas fields...' },
        { kind: 'multiSelect', field: 'cored_formations', label: 'Cored Formation', placeholder: 'Select formations...' },
        { kind: 'range', field: 'td_ft', label: 'Total Depth', units: 'ft', step: 100, snapStep: 100, nullExcludedNote: 'Wells with no recorded total depth are not shown while this filter is active.' },
        {
            kind: 'boolean',
            field: 'has_photos',
            label: 'Has Core Photos',
            trueValue: 'True',
            falseValue: 'False',
        },
        {
            kind: 'boolean',
            field: 'has_attachments',
            label: 'Has Documents',
            trueValue: 'True',
            falseValue: 'False',
        },
    ],
};
