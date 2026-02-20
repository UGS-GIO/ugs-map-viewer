import type { RelatedTable } from '@/lib/types/mapping-types';
import type { PostgRESTRow } from '@/lib/types/postgrest-types';
import { formatNumeric } from '@/lib/utils';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface ExpandedRelatedTableProps {
    relatedTable: RelatedTable;
    rows: PostgRESTRow[];
    colSpan: number;
}

export function ExpandedRelatedTable({ relatedTable, rows, colSpan }: ExpandedRelatedTableProps) {
    if (rows.length === 0) return null;

    const headers = relatedTable.displayFields?.map(df => df.label || df.field) || [];

    return (
        <TableRow className="bg-muted/30">
            <TableCell colSpan={colSpan} className="p-4">
                <div>
                    <h4 className="text-sm font-medium mb-2">{relatedTable.fieldLabel}</h4>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {headers.map((h, i) => (
                                    <TableHead key={i} className="h-8 text-xs">
                                        {h}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r, i) => (
                                <TableRow key={i}>
                                    {relatedTable.displayFields?.map((df, j) => {
                                        const raw = r[df.field];
                                        const formatted = formatNumeric(raw, df.format);
                                        const value = df.transform ? df.transform(formatted) : formatted;
                                        return (
                                            <TableCell key={j} className="py-1.5 text-xs">
                                                {value}
                                            </TableCell>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </TableCell>
        </TableRow>
    );
}
