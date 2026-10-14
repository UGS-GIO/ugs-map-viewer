import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, Layers as LayersIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Spinner } from '../ui/loading-spinner';
import Layers from '@/components/sidebar/layers';
import { useSidebar } from '@/hooks/use-sidebar';
import { useGetPageInfo } from '@/hooks/use-get-page-info';
import { DatasetDownloads } from '@/components/sidebar/dataset-downloads';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePhoneSheet } from '@/components/maps/phone-sheet/use-phone-sheet';
import { INFO_DETAIL_TITLE } from '@/components/maps/phone-sheet/sheet-model';

function Info() {
  const { setCurrentContent } = useSidebar();
  // Driven by the accordions: a handler on the heading also fired on its padding, leaving
  // the summary out of step with the section it summarises.
  const [openDetails, setOpenDetails] = useState<string[]>(['map-details-accordion-item-1']);
  const [openSources, setOpenSources] = useState<string[]>([]);
  const isMapDetailsExpanded = openDetails.includes('map-details-accordion-item-1');
  const isDataSourcesExpanded = openSources.includes('data-sources-accordion-item-1');
  const { data: pageInfo, isLoading: isInfoLoading } = useGetPageInfo();
  const isMobile = useIsMobile();

  // The detail lives in the URL: phones show it in the sheet, desktop in a dialog.
  const { detail, openDetail } = usePhoneSheet();
  const detailText = detail && {
    disclaimer: pageInfo?.dataDisclaimer,
    references: pageInfo?.references,
    acknowledgments: pageInfo?.acknowledgments,
  }[detail];

  // Show loading spinner while page info is loading
  if (isInfoLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  // On phones a detail opens in the sheet itself; the sheet's header shows its title and "‹ Info".
  if (isMobile && detail) {
    return <div className="text-sm text-muted-foreground">{detailText}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="ml-2 overflow-y-auto flex-grow">
        {/* Map Details Accordion */}
        <div className="mr-2" key="map-details-accordion">
          <Accordion type="multiple" value={openDetails} onValueChange={setOpenDetails}>
            <AccordionItem value="map-details-accordion-item-1">
              <AccordionHeader level={2}>
                <AccordionTrigger>
                  <div className="flex flex-col mx-2 items-start">
                    <span className="font-large text-left text-lg">Map Details</span>
                  </div>
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent>
                {pageInfo?.mapDetails}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {!isMapDetailsExpanded && (
            <div>
              {pageInfo?.mapDetailsShortened}
            </div>
          )}
        </div>

        {/* Data Sources Accordion */}
        <div className="mr-2" key="data-sources-accordion">
          <Accordion type="multiple" value={openSources} onValueChange={setOpenSources}>
            <AccordionItem value="data-sources-accordion-item-1">
              <AccordionHeader level={2}>
                <AccordionTrigger>
                  <div className="flex flex-col mx-2 items-start">
                    <span className="font-large text-left text-lg">Data Sources</span>
                  </div>
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent>
                <DatasetDownloads />
                {pageInfo?.dataSources || (
                  <div className="flex justify-center py-4">
                    <Spinner />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {!isDataSourcesExpanded && (
            <div>
              {pageInfo?.dataSourcesShortened || (
                <div className="animate-pulse h-4 bg-muted rounded-md w-2/3"></div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center mx-2">
          <Button variant={'link'} onClick={() => openDetail('references')}>
            References
          </Button>
          <Button variant={'link'} onClick={() => openDetail('acknowledgments')}>
            Acknowledgments
          </Button>
          <Button variant={'link'} onClick={() => window.open('https://geology.utah.gov/about-us/contact-webmaster/', '_blank')}>
            Contact Webmaster&nbsp;<ExternalLink size={16} />
          </Button>
        </div>

        <Dialog open={!isMobile && detail !== null} onOpenChange={(open) => { if (!open) openDetail(null) }}>
          <DialogContent>
            {detail && (
              <>
                <DialogHeader>
                  <DialogTitle>{INFO_DETAIL_TITLE[detail]}</DialogTitle>
                </DialogHeader>
                <DialogDescription asChild>
                  <div>{detailText}</div>
                </DialogDescription>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className='flex justify-center space-x-4 border-t border-secondary'>
        <div className='pt-6'>
          <Button
            onClick={() => setCurrentContent({
              title: 'Layers',
              label: '',
              icon: <LayersIcon />,
              componentPath: '/src/components/sidebar/layers',
              component: Layers
            })}
          >
            Start Exploring
          </Button>
          <Button
            className='text-foreground'
            variant='link'
            onClick={() => openDetail('disclaimer')}
          >
            Open Data Disclaimer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Info;