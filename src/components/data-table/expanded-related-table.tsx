import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
import { PopupImageGallery, type GalleryImage } from '@/components/maps/popups/popup-image-gallery';
import { relatedRowToGalleryImage } from '@/lib/gallery-utils';

interface ExpandedRelatedTableProps {
    relatedTable: RelatedTable;
    rows: PostgRESTRow[];
    colSpan: number;
}

/** Converts "0510370000S000_3_CORE" → "Box 3 · Core" */
function formatBoxId(boxId: string): string {
    if (boxId === 'Unassigned') return boxId
    const parts = boxId.split('_')
    if (parts.length < 3) return boxId
    const num = parts[parts.length - 2]
    const type = parts[parts.length - 1]
    return `Box ${num} · ${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()}`
}

export function ExpandedRelatedTable({ relatedTable, rows, colSpan }: ExpandedRelatedTableProps) {
    const [isOpen, setIsOpen] = useState(true);

    if (rows.length === 0) return null;

    const sectionHeader = (
        <button
            onClick={() => setIsOpen(o => !o)}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground hover:bg-muted/50 rounded px-1 -ml-1 transition-colors mb-2 w-full"
        >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {relatedTable.fieldLabel}
        </button>
    );

    // Gallery display — group by box_id, sorted by box_pk
    if (relatedTable.displayAs === 'gallery' && relatedTable.galleryUrlField) {
        const grouped = new Map<string, { boxPk: number; rows: PostgRESTRow[] }>();
        for (const row of rows) {
            const boxId = String(row.box_id || 'Unassigned')
            const boxPk = Number(row.box_pk ?? 0)
            if (!grouped.has(boxId)) grouped.set(boxId, { boxPk, rows: [] })
            grouped.get(boxId)!.rows.push(row)
        }
        const sorted = Array.from(grouped.entries()).sort((a, b) => a[1].boxPk - b[1].boxPk)

        return (
            <TableRow className="bg-muted/30">
                <TableCell colSpan={colSpan} className="px-3 py-2">
                    {sectionHeader}
                    {isOpen && (
                        <div className="space-y-2">
                            {sorted.map(([boxId, { rows: boxRows }]) => {
                                const images = boxRows
                                    .map(r => relatedRowToGalleryImage(r, relatedTable))
                                    .filter((img): img is GalleryImage => img !== null)
                                if (images.length === 0) return null
                                const label = formatBoxId(boxId)
                                return (
                                    <div key={boxId}>
                                        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                                        <PopupImageGallery images={images} compact />
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TableCell>
            </TableRow>
        )
    }

    // Table display
    const headers = relatedTable.displayFields?.map(df => df.label || df.field) || [];

    return (
        <TableRow className="bg-muted/30">
            <TableCell colSpan={colSpan} className="px-3 py-2">
                {sectionHeader}
                {isOpen && (
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
                                        const value = df.transform ? df.transform(formatted, r, rows) : formatted;
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
                )}
            </TableCell>
        </TableRow>
    );
}
