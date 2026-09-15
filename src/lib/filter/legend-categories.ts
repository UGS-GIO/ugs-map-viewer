/**
 * Legend categories, ordered by current match count. Drawn from `allValues` (unfiltered) so
 * filtering one field can't remove another's categories; counts stay filtered, so one can sit
 * at zero.
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
