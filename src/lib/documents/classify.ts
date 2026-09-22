/**
 * Heuristic classification of a UCRC document by its filename, used to group the
 * subsurface Documents panel.
 *
 * There is no authoritative document-type field on the attachments record today,
 * so type is derived from the filename (with the extension as a fallback). It is
 * only as good as the filenames and will shift a little as staff rename files; a
 * curated type field would supersede this if one is ever added.
 */

export type DocCategory =
    | 'Geophysical logs'
    | 'Reports & completion'
    | 'Geochemistry & analyses'
    | 'Data & spreadsheets'
    | 'Core photos'
    | 'Images & scans'
    | 'Archives'
    | 'Other';

/** Fixed display order for the groups. */
export const DOC_CATEGORY_ORDER: DocCategory[] = [
    'Geophysical logs',
    'Reports & completion',
    'Geochemistry & analyses',
    'Data & spreadsheets',
    'Core photos',
    'Images & scans',
    'Archives',
    'Other',
];

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tif', 'tiff']);
const DATA_EXTS = new Set(['xls', 'xlsx', 'xlsb', 'xlsm', 'xlxs', 'csv', 'tsv', 'txt', 'xyz']);
const ARCHIVE_EXTS = new Set(['zip', 'gz', '7z', 'tar', 'rar']);
const REPORT_EXTS = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'rtf']);

/** Lowercased extension without the dot, or '' when there is none. */
export function fileExtension(filename: string): string {
    const m = /\.([a-z0-9]+)$/i.exec(filename);
    return m ? m[1].toLowerCase() : '';
}

// Distinctive curve/tool/log stems. Safe as plain substrings — they don't collide with
// non-log words in the real filenames. `gamm?a` catches the "GAMA" misspelling in the data;
// `combo` catches "Triple Print Combo" etc.; `mud[\s_]?log` catches MUD_LOG / mudlog.
const LOG_STEM_RE = /induction|resistiv|poro|caliper|neutron|density|sonic|gamm?a|spectralog|combo|cement[\s_]?bond|mud[\s_]?log|well[\s_]?log/i;
// Short/ambiguous log tokens that need a separator boundary so they don't fire inside words
// like "geological" or "catalog". Underscore counts as a separator here; \b does not, and
// these filenames are underscore-heavy (MUD_LOG, ..._CBL_Page_1).
const LOG_TOKEN_RE = /(?:^|[^a-z0-9])(?:logs?|cbl)(?![a-z])/i;
const GEOCHEM_RE = /\bicp\b|\btoc\b|xrd|xrf|assay|geochem|analys/i;
const REPORT_RE = /completion|coregraph|report|summary/i;
// `photos?` as a separator-led trailing word catches "... Sidewall Photos.pdf" / "Box 3 Photo.jpg";
// the other alternatives catch "core photo" and mid-name "_photo_" forms.
const PHOTO_RE = /core[\s_]?photo|_photo|photo[\s_]|(?:^|[\s_-])photos?\b/i;

// Windows/GIS sidecar files that are not documents anyone opens. Matched narrowly: `.aux.xml` by
// suffix (its extension is only "xml", and real metadata XML must stay visible), Thumbs.db by name,
// and a short list of pure-sidecar extensions. Deliberately NOT whole families like `xml`.
const JUNK_EXTS = new Set(['prj', 'ovr', 'meta']);

/** True for sidecar/junk files that should not be listed as documents. */
export function isJunkFile(filename: string): boolean {
    const lower = filename.toLowerCase();
    if (lower.endsWith('thumbs.db') || lower.endsWith('.aux.xml')) return true;
    return JUNK_EXTS.has(fileExtension(filename));
}

/**
 * The attachment rows the panel actually lists, with sidecar/junk dropped. Call this once at each
 * render site so the section count, the empty-state check, and the panel all agree on the same set.
 */
export function listedDocumentRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
    return rows.filter(row => !isJunkFile(String(row.filename ?? '')));
}

/**
 * Best-effort document type from a filename. Order matters: meaning beats format, so a
 * curve-named `.tif` or a keyword-bearing `.pdf` is classified before its extension bucket.
 * The image-extension fallback is "Images & scans" (honest) rather than "Core photos" —
 * only a filename that actually reads like a photo lands in Core photos.
 */
export function classifyDocument(filename: string): DocCategory {
    const ext = fileExtension(filename);
    // A .las file is always a log. Otherwise geochem keywords win before the log patterns, because
    // the log stems include unanchored `poro`/`density` that would otherwise pull core-analysis
    // spreadsheets ("Bulk Density analyses.xlsx", "... porosity permeability.xlsx") out of Geochem.
    if (ext === 'las') return 'Geophysical logs';
    if (GEOCHEM_RE.test(filename)) return 'Geochemistry & analyses';
    if (LOG_STEM_RE.test(filename) || LOG_TOKEN_RE.test(filename)) return 'Geophysical logs';
    if (PHOTO_RE.test(filename)) return 'Core photos';
    if (REPORT_RE.test(filename) || REPORT_EXTS.has(ext)) return 'Reports & completion';
    if (IMAGE_EXTS.has(ext)) return 'Images & scans';
    if (DATA_EXTS.has(ext)) return 'Data & spreadsheets';
    if (ARCHIVE_EXTS.has(ext)) return 'Archives';
    return 'Other';
}

/** Short uppercase format badge, e.g. "PDF", "LAS", "XLSX", "JPG", "TIF". */
export function formatBadge(filename: string): string {
    const ext = fileExtension(filename);
    if (!ext) return 'FILE';
    if (ext === 'jpeg') return 'JPG';
    if (ext === 'tiff') return 'TIF';
    return ext.toUpperCase();
}
