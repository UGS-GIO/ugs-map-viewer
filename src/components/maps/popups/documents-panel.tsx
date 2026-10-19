import { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { RelatedTable } from '@/lib/types/mapping-types';
import { Input } from '@/components/ui/input';
import {
    classifyDocument,
    formatBadge,
    listedDocumentRows,
    DOC_CATEGORY_ORDER,
    type DocCategory,
} from '@/lib/documents/classify';

type AttachmentRow = Record<string, unknown>;

interface DocItem {
    key: string;
    filename: string;
    href?: string;
    category: DocCategory;
    badge: string;
}

const PAGE_SIZE = 25;
/** At or below this total, groups open by default; above it they stay collapsed. */
const AUTO_EXPAND_MAX = 10;
/** Only show the search box once a well has more than this many documents. */
const SEARCH_MIN = 8;

function buildItems(table: RelatedTable, rows: AttachmentRow[]): DocItem[] {
    const base = table.itemBaseUrl;
    // Sidecar/junk files are dropped here too. Callers already filter for the count and empty-state
    // gate; this keeps the panel correct on its own even if it is ever handed raw rows.
    return listedDocumentRows(rows).map((row, i) => {
        const filename = String(row.filename ?? 'Document');
        const path = row.storage_path ? String(row.storage_path) : '';
        // encodeURI (not encodeURIComponent): keep the path separators, escape spaces —
        // matches the accordion link builder in popup-content-display.
        const href = base && path ? encodeURI(`${base}/${path}`) : undefined;
        return {
            key: String(row.pk ?? i),
            filename,
            href,
            category: classifyDocument(filename),
            badge: formatBadge(filename),
        };
    });
}

function DocItemRow({ item }: { item: DocItem }) {
    return (
        <li className="flex items-center gap-2 py-0.5 text-xs">
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
                {item.badge}
            </span>
            <span className="min-w-0 flex-1 truncate" title={item.filename}>{item.filename}</span>
            {item.href ? (
                <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-0.5 text-primary hover:underline"
                >
                    Open / download <ExternalLink size={11} />
                </a>
            ) : (
                <span className="shrink-0 italic text-muted-foreground">no link</span>
            )}
        </li>
    );
}

function PaginatedList({ items }: { items: DocItem[] }) {
    const [page, setPage] = useState(0);
    const pageCount = Math.ceil(items.length / PAGE_SIZE);
    const clamped = Math.min(page, Math.max(0, pageCount - 1));
    const shown = items.slice(clamped * PAGE_SIZE, clamped * PAGE_SIZE + PAGE_SIZE);
    return (
        <>
            <ul className="space-y-0.5">
                {shown.map(it => <DocItemRow key={it.key} item={it} />)}
            </ul>
            {pageCount > 1 && (
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <button
                        type="button"
                        disabled={clamped === 0}
                        onClick={() => setPage(Math.max(0, clamped - 1))}
                        className="rounded px-1 hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >Prev</button>
                    <span className="tabular-nums">Page {clamped + 1} of {pageCount}</span>
                    <button
                        type="button"
                        disabled={clamped >= pageCount - 1}
                        onClick={() => setPage(Math.min(pageCount - 1, clamped + 1))}
                        className="rounded px-1 hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >Next</button>
                </div>
            )}
        </>
    );
}

function DocGroup({ category, items, defaultOpen }: { category: DocCategory; items: DocItem[]; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    const contentId = useId();
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls={contentId}
                className="-ml-1 flex w-full items-center gap-1 rounded px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                <span>{category}</span>
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{items.length}</span>
            </button>
            {/* hidden rather than unmounted so the paginated position survives a collapse/expand;
                it also keeps the aria-controls target present in the DOM while collapsed */}
            <div id={contentId} hidden={!open} className="mt-1 pl-1"><PaginatedList items={items} /></div>
        </div>
    );
}

/**
 * Renders the well's documents/attachments grouped by a filename-derived type,
 * with a format badge, an open-or-download link per row, in-panel search, and
 * pagination so image-heavy wells stay usable. Opt-in via `displayAs: 'documents'`.
 */
export function DocumentsPanel({ table, rows }: { table: RelatedTable; rows: AttachmentRow[] }) {
    // Remount per well so a collapsed group, the current page, or a leftover search query from one
    // well's popup doesn't carry into the next — map popups reuse the same React tree across features.
    const mf = table.matchingField;
    const wellKey = String((mf ? rows[0]?.[mf] : undefined) ?? rows.length);
    return <DocumentsPanelInner key={wellKey} table={table} rows={rows} />;
}

function DocumentsPanelInner({ table, rows }: { table: RelatedTable; rows: AttachmentRow[] }) {
    const [query, setQuery] = useState('');
    const items = useMemo(() => buildItems(table, rows), [table, rows]);

    const q = query.trim().toLowerCase();
    const filtered = useMemo(
        () => (q ? items.filter(it => it.filename.toLowerCase().includes(q)) : items),
        [items, q],
    );
    const groups = useMemo(() => {
        const map = new Map<DocCategory, DocItem[]>();
        for (const it of items) {
            const list = map.get(it.category) ?? [];
            list.push(it);
            map.set(it.category, list);
        }
        return DOC_CATEGORY_ORDER.filter(c => map.has(c)).map(c => [c, map.get(c)!] as const);
    }, [items]);

    if (items.length === 0) return null;

    const autoExpand = items.length <= AUTO_EXPAND_MAX;

    return (
        <div className="space-y-2">
            {items.length > SEARCH_MIN && (
                <Input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search documents..."
                    className="h-7 text-xs"
                    aria-label="Search documents"
                />
            )}
            {q ? (
                filtered.length === 0
                    ? <p className="text-xs italic text-muted-foreground">No documents match &ldquo;{query}&rdquo;.</p>
                    : <PaginatedList key={q} items={filtered} />
            ) : (
                groups.map(([category, groupItems]) => (
                    <DocGroup
                        key={category}
                        category={category}
                        items={groupItems}
                        defaultOpen={autoExpand || groups.length === 1}
                    />
                ))
            )}
        </div>
    );
}
