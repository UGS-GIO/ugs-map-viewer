/**
 * Categories a symbology legend offers, ordered by current match count. Drawn from
 * `allValues` (unfiltered) so filtering one field can't remove another field's categories
 * when the symbology switches; counts stay filtered, so a category can sit at zero.
 * `filtered` covers the loading gap.
 */
export function orderedCategories(
    allValues: readonly string[] | undefined,
    filtered: readonly string[] | undefined,
    counts: Record<string, number> | undefined,
): string[] {
    const c = counts ?? {}
    return [...(allValues ?? filtered ?? [])]
        .sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0) || a.localeCompare(b))
}
