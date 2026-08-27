import type { GeoJsonProperties } from 'geojson';
import type { SearchSourceConfig, PostgRESTConfig, QueryResultWrapper } from './search-types';

export function formatAddressCase(address: string | undefined | null): string {
    if (!address) return '';
    return address.toLowerCase().split(' ')
        .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : '')
        .join(' ');
}

function formatName(name: string): string {
    return name
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
        .join(' ')
        .replace(/^Rpc\s/, '')
        .trim();
}

export function getDisplayValue(properties: GeoJsonProperties, source: SearchSourceConfig): string {
    const primary = String(properties?.[source.displayField] ?? '');
    if (source.type === 'postgREST' && source.secondaryDisplayField) {
        const secondary = String(properties?.[source.secondaryDisplayField] ?? '');
        if (secondary) return `${primary} — ${secondary}`;
    }
    return primary;
}

export function appendFunctionParams(params: URLSearchParams, source: PostgRESTConfig): void {
    if (source.functionParams) {
        for (const [key, val] of Object.entries(source.functionParams)) {
            params.set(key, val);
        }
    }
}

export function resultHasData(result: QueryResultWrapper): boolean {
    if (!result.data) return false;
    if (result.type === 'masquerade') return Array.isArray(result.data) && result.data.length > 0;
    if (result.type === 'postgREST') return 'features' in result.data && result.data.features.length > 0;
    return false;
}

/**
 * Resolve the index of the source to pre-select on load, matched by its authored
 * `sourceName`. Matching by name (not a hardcoded index) keeps the default stable if
 * the source list is reordered; matching the authored field rather than the derived
 * display name avoids depending on getSourceDisplayName's formatting fallback. Returns
 * null when no name is given or none matches, which the combobox treats as "no source
 * pre-selected" (search all).
 */
export function resolveDefaultSourceIndex(
    config: SearchSourceConfig[],
    defaultSourceName?: string,
): number | null {
    if (!defaultSourceName) return null;
    const index = config.findIndex(source => source.sourceName === defaultSourceName);
    return index >= 0 ? index : null;
}

export function getSourceDisplayName(sourceConfig: SearchSourceConfig): string {
    if (sourceConfig.sourceName) return sourceConfig.sourceName;
    let name = '';
    if (sourceConfig.type === 'postgREST') {
        if (sourceConfig.functionName) name = sourceConfig.functionName;
        else if (sourceConfig.params && 'targetField' in sourceConfig.params && sourceConfig.params.targetField) {
            name = sourceConfig.params.targetField;
        } else {
            name = sourceConfig.url.split('/').pop() || '';
        }
    } else if (sourceConfig.type === 'masquerade') {
        name = "Address Search: e.g. 123 Main St";
    }
    return formatName(name || sourceConfig.url.split('/').pop() || 'Unknown Source');
}
