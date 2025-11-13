import { useState, useRef } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionHeader, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ExternalLink, Layers as LayersIcon } from 'lucide-react';
import { Button } from '../custom/button';
import { LoadingSpinner } from '../custom/loading-spinner';
import Layers from '@/components/sidebar/layers';
import { BackToMenuButton } from '../custom/back-to-menu-button';
import { useSidebar } from '@/hooks/use-sidebar';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerTrigger } from '@/components/ui/drawer';
import { useGetPageInfo } from '@/hooks/use-get-page-info';

function Info() {
  type ModalType = 'references' | 'disclaimer' | 'acknowledgments' | '';
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType | ''>('');
  const { setCurrentContent } = useSidebar();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isMapDetailsExpanded, setIsMapDetailsExpanded] = useState(true);
  const [isDataSourcesExpanded, setIsDataSourcesExpanded] = useState(false);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const { data: pageInfo, isLoading: isInfoLoading } = useGetPageInfo();

  const toggleMapDetails = () => {
    setIsMapDetailsExpanded(!isMapDetailsExpanded);
  };

  const toggleDataSources = () => {
    setIsDataSourcesExpanded(!isDataSourcesExpanded);
  };

  const handleOpenModal = (type: ModalType) => {
    setModalType(type);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalType('');
  };

  const handleOpenDrawer = (type: ModalType) => {
    setModalType(type);
    if (drawerTriggerRef.current) {
      drawerTriggerRef.current.click();
    }
  };

  // Show loading spinner while page info is loading
  if (isInfoLoading) {
    return (
      <div className="flex flex-col h-full">
        <BackToMenuButton />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <BackToMenuButton />
      <div className="ml-2 overflow-y-auto flex-grow" ref={contentRef}>
        {/* Map Details Accordion */}
        <div className="mr-2" key="map-details-accordion">
          <Accordion type="multiple" defaultValue={['map-details-accordion-item-1']}>
            <AccordionItem value="map-details-accordion-item-1">
              <AccordionHeader onClick={toggleMapDetails}>
                <AccordionTrigger>
                  <div className="flex flex-col mx-2 items-start">
                    <h3 className="font-large text-left text-lg">Map Details</h3>
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
          <Accordion type="multiple">
            <AccordionItem value="data-sources-accordion-item-1">
              <AccordionHeader onClick={toggleDataSources}>
                <AccordionTrigger>
                  <div className="flex flex-col mx-2 items-start">
                    <h3 className="font-large text-left text-lg">Data Sources</h3>
                  </div>
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent>
                {pageInfo?.dataSources || (
                  <div className="flex justify-center py-4">
                    <LoadingSpinner />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {!isDataSourcesExpanded && (
            <div>
              {pageInfo?.dataSourcesShortened || (
                <div className="animate-pulse h-4 bg-gray-200 rounded w-2/3"></div>
              )}
            </div>
          )}
        </div>

        {/* Desktop Modal Buttons */}
        <div className="flex flex-wrap justify-center mx-2 hidden md:flex">
          <Button variant={'link'} onClick={() => handleOpenModal('references')}>
            References
          </Button>
          <Button variant={'link'} onClick={() => handleOpenModal('acknowledgments')}>
            Acknowledgments
          </Button>
          <Button variant={'link'} onClick={() => window.open('https://geology.utah.gov/about-us/contact-webmaster/', '_blank')}>
            Contact Webmaster&nbsp;<ExternalLink size={16} />
          </Button>
        </div>

        {/* Mobile Modal Buttons */}
        <div className="flex flex-wrap justify-center mx-2 md:hidden">
          <Button variant={'link'} onClick={() => handleOpenDrawer('references')}>
            References
          </Button>
          <Button variant={'link'} onClick={() => handleOpenDrawer('acknowledgments')}>
            Acknowledgments
          </Button>
          <Button variant={'link'} onClick={() => window.open('https://geology.utah.gov/about-us/contact-webmaster/', '_blank')}>
            Contact Webmaster&nbsp;<ExternalLink size={16} />
          </Button>
        </div>

        {/* Drawer for mobile */}
        <Drawer>
          <DrawerTrigger asChild>
            <button ref={drawerTriggerRef} className="hidden">
              Open Dialog
            </button>
          </DrawerTrigger>
          <DrawerContent>
            <div className="py-2">
              {modalType === 'disclaimer' && <DrawerHeader><DrawerTitle>Data Disclaimer</DrawerTitle></DrawerHeader>}
              {modalType === 'references' && <DrawerHeader><DrawerTitle>References</DrawerTitle></DrawerHeader>}
              {modalType === 'acknowledgments' && <DrawerHeader><DrawerTitle>Acknowledgments</DrawerTitle></DrawerHeader>}
            </div>
            <div data-vaul-no-drag className="overflow-y-auto p-4">
              {modalType === 'disclaimer' && (
                <DrawerDescription asChild>
                  <div>
                    {pageInfo?.dataDisclaimer}
                  </div>
                </DrawerDescription>
              )}
              {modalType === 'references' && (
                <DrawerDescription asChild>
                  <div>
                    {pageInfo?.references}
                  </div>
                </DrawerDescription>
              )}
              {modalType === 'acknowledgments' && (
                <DrawerDescription asChild>
                  <div>
                    {pageInfo?.acknowledgments}
                  </div>
                </DrawerDescription>
              )}
            </div>
          </DrawerContent>
        </Drawer>

        {/* Dialog for desktop */}
        <Dialog open={modalOpen} onOpenChange={handleCloseModal}>
          <DialogTrigger asChild>
            <div className="hidden"></div>
          </DialogTrigger>
          <DialogContent>
            {modalType === 'disclaimer' && (
              <>
                <DialogHeader>
                  <DialogTitle>Data Disclaimer</DialogTitle>
                </DialogHeader>
                <DialogDescription asChild>
                  <div>
                    {pageInfo?.dataDisclaimer}
                  </div>
                </DialogDescription>
              </>
            )}
            {modalType === 'references' && (
              <>
                <DialogHeader>
                  <DialogTitle>References</DialogTitle>
                </DialogHeader>
                <DialogDescription asChild>
                  <div>
                    {pageInfo?.references}
                  </div>
                </DialogDescription>
              </>
            )}
            {modalType === 'acknowledgments' && (
              <>
                <DialogHeader>
                  <DialogTitle>Acknowledgments</DialogTitle>
                </DialogHeader>
                <DialogDescription asChild>
                  <div>
                    {pageInfo?.acknowledgments}
                  </div>
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
            className='text-foreground hidden md:inline-flex'
            variant='link'
            onClick={() => handleOpenModal('disclaimer')}
          >
            Open Data Disclaimer
          </Button>
          <Button
            className='text-foreground md:hidden'
            variant='link'
            onClick={() => handleOpenDrawer('disclaimer')}
          >
            Open Data Disclaimer
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Info;