import { Layout } from '@/components/layout/layout';
import { TopNav } from '@/components/top-nav';
import { MapFooter } from '@/components/maps/map-footer';
import { cn } from '@/lib/utils';
import GenericMapContainer from '@/components/maps/generic-map-container';
import Sidebar from '@/components/sidebar';
import { useSidebar } from '@/hooks/use-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRef } from 'react';
import { SearchCombobox, SearchSourceConfig, defaultMasqueradeConfig, handleCollectionSelect, handleSearchSelect, type SearchComboboxHandle } from '@/components/sidebar/filter/search-combobox';
import { parquetUrl } from '@/lib/constants';
import { qFaultsWMSTitle } from './-data/layers/layers';
import { useMapContextState } from '@/hooks/use-map-context-state';
import { MapContext } from '@/context/map-context';
import { TourAutoStart } from '@/components/tour-auto-start';

export default function Map() {
  const { isCollapsed, sidebarWidthPx } = useSidebar();
  const isMobile = useIsMobile();
  const { contextValue } = useMapContextState();
  const searchRef = useRef<SearchComboboxHandle>(null);
  // Use 56px (3.5rem) when collapsed, dynamic pixel width when expanded
  // On mobile, no margin needed (sidebar is top, not left)
  const sidebarMargin = isMobile ? 0 : (isCollapsed ? 56 : sidebarWidthPx);

  const searchConfig: SearchSourceConfig[] = [
    defaultMasqueradeConfig,
    {
      type: 'parquet',
      parquetUrl: parquetUrl('hazards_qfaults'),
      layerName: qFaultsWMSTitle,
      sourceName: 'Faults',
      // `concatnames` was assembled by the search_fault_data RPC; the warehouse stores the
      // three parts separately. Same join, same skip-the-empties, same output.
      derivedFields: {
        concatnames: `array_to_string(list_filter([faultzone, sectionname, strandname], x -> x IS NOT NULL AND x <> ''), ' - ')`,
      },
      displayField: 'concatnames',
      // Keyed on the assembled name, not `faultnum`: one fault number covers every section
      // and strand of a zone (229 numbers over 19,743 rows), so picking "Wasatch fault zone -
      // Brigham City section" would otherwise highlight the entire zone.
      idField: 'concatnames',
      params: { targetFields: ['concatnames'] },
    },
  ];

  return (
    <MapContext.Provider value={contextValue}>
      <TourAutoStart route="hazards" />
      <div className="relative h-svh overflow-hidden bg-background">
        <Sidebar />
        <main
          id="content"
          className="overflow-x-hidden pt-[var(--header-height)] transition-[margin] duration-200 ease-linear md:overflow-y-hidden md:pt-0 h-full"
          style={{ marginLeft: `${sidebarMargin}px` }}
        >
          <Layout>
            <Layout.Header className='hidden md:flex items-center justify-between px-4 md:px-6'>
              <TopNav />
              <div className='flex items-center flex-1 min-w-0 md:flex-initial md:w-1/3 md:ml-auto space-x-2'>
                <div className="flex-1 min-w-0">
                  <SearchCombobox
                    ref={searchRef}
                    config={searchConfig}
                    onFeatureSelect={handleSearchSelect}
                    onCollectionSelect={handleCollectionSelect}
                    className="w-full"
                  />
                </div>
              </div>
            </Layout.Header>

            {/* ===== Map ===== */}
            <Layout.Body>
              <GenericMapContainer
                onClearSearch={() => searchRef.current?.clear()}
                disableExport
              />
            </Layout.Body>

            {/* ===== Footer ===== */}
            {/* no footer on mobile */}
            <Layout.Footer className={cn('hidden md:flex z-20')} dynamicContent={<MapFooter />} />
          </Layout>
        </main>
      </div>
    </MapContext.Provider>
  )
}