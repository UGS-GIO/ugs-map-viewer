import { useState, useId } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface PopupFieldTableRow {
    label: string;
    value: string;
}

interface PopupFieldTableProps {
    rows: PopupFieldTableRow[];
    label?: string;
}

export function PopupFieldTable({ rows, label }: PopupFieldTableProps) {
    const [isOpen, setIsOpen] = useState(true);
    const contentId = useId();

    if (rows.length === 0) return null;

    const headers = rows.map(r => r.label);

    return (
        <div className="space-y-2">
            {label && (
                <button
                    onClick={() => setIsOpen(o => !o)}
                    aria-expanded={isOpen}
                    aria-controls={contentId}
                    className="flex items-center gap-1 font-bold text-foreground hover:text-foreground/80 hover:bg-muted/50 rounded px-1 -ml-1 transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {isOpen
                        ? <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        : <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
                    <span className="underline">{label}</span>
                </button>
            )}
            {(!label || isOpen) && (
                <Table>
                    <TableHeader>
                        <TableRow>
                            {headers.map((header, idx) => (
                                <TableHead key={idx} className="h-8 text-xs">{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            {rows.map((row, idx) => (
                                <TableCell key={idx} className="py-1.5 text-xs">
                                    {row.value}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableBody>
                </Table>
            )}
        </div>
    );
}
