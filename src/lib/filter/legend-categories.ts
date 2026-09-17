/**
 * Legend categories, ordered by current match count. Drawn from `totals` (every value in the
 * layer) so filtering one field can't remove another's categories; `counts` stay filtered, so a
 * category can sit at zero rather than disappear.
 */
export function orderedCategories(
    totals: Record<string, number> | undefined,
    counts: Record<string, number> | undefined,
): string[] {
    const c = counts ?? {}
    return Object.keys(totals ?? {}).sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0) || a.localeCompare(b))
}
