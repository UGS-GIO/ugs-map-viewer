import { useEffect } from 'react';
import { ChevronsLeft, ChevronLeft, Menu, X } from 'lucide-react';
import { Layout } from './custom/layout';
import { Button } from './custom/button';
import Nav from './nav';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { Link } from '@/components/custom/link';
import { useGetSidebarLinks } from '@/hooks/use-get-sidebar-links';
import { useGetCurrentPage } from '@/hooks/use-get-current-page';
import { getAppTitle } from '@/lib/app-titles';
import { NavSkeleton } from './sidebar/sidebar-skeleton';
import { SIDEBAR_WIDTHS } from '@/lib/sidebar-constants';

interface SidebarProps extends React.HTMLAttributes<HTMLElement> { }

export default function Sidebar({ className }: SidebarProps) {
  const { navOpened, setNavOpened, isCollapsed, setIsCollapsed, sidebarWidth, setSidebarWidth } = useSidebar();
  const { data: sidebarLinks, isLoading: areLinksLoading } = useGetSidebarLinks();
  const currentPage = useGetCurrentPage();
  const appTitle = getAppTitle(currentPage);

  const widthClass = isCollapsed ? SIDEBAR_WIDTHS.icon : SIDEBAR_WIDTHS[sidebarWidth];

  const handleSidebarCycle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Shift+click: simple toggle between collapsed and current width
    if (e.shiftKey) {
      setIsCollapsed((prev) => !prev);
      return;
    }

    // Normal click: cycle through all three states
    if (isCollapsed) {
      // From collapsed, go to medium
      setIsCollapsed(false);
      setSidebarWidth('medium');
    } else if (sidebarWidth === 'medium') {
      // From medium, go to wide
      setSidebarWidth('wide');
    } else {
      // From wide, go to collapsed
      setIsCollapsed(true);
    }
  };

  /* Make body not scrollable when navBar is opened */
  useEffect(() => {
    if (navOpened) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [navOpened]);

  // Mobile menu click handler is simplified (no setTimeout needed unless for specific animation)
  const handleMenuClick = () => {
    setNavOpened((prev) => !prev);
    // You can decide if you still want the collapse logic tied to the mobile menu
    if (!isCollapsed) {
      setIsCollapsed(true);
    }
  };

  return (
    <aside
      className={cn(
        `fixed left-0 right-0 top-0 z-50 w-full border-r-2 border-r-muted transition-[width] md:bottom-0 md:right-auto md:h-svh ${widthClass}`,
        className
      )}
    >
      <div
        onClick={() => setNavOpened(false)}
        className={`absolute inset-0 transition-opacity duration-700 ${navOpened ? 'h-svh opacity-50' : 'h-0 opacity-0'
          } w-full bg-black md:hidden`}
      />

      <Layout fixed className={navOpened ? 'h-svh' : ''}>
        {/* Header */}
        <Layout.Header
          sticky
          className={`z-50 flex justify-between py-2 shadow-sm px-4 md:px-1 ${isCollapsed ? 'md:mt-3' : ''}`}
        >
          <div className={`flex items-center ${!isCollapsed ? 'gap-4' : 'w-full'}`}>
            <Link to="https://geology.utah.gov/" className="cursor-pointer flex items-center justify-center w-10">
              <img
                src='/logo_main.png'
                alt='Utah Geological Survey Logo'
                className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-8' : 'h-8 w-[1.75rem]'}`}
              />
            </Link>
            {!isCollapsed && (
              <div className="flex flex-col justify-end truncate transition-all duration-300">
                <span className='font-medium text-wrap'>{appTitle}</span>
                <span className='text-sm'>Utah Geological Survey</span>
              </div>
            )}
          </div>

          {/* Toggle Button in mobile */}
          <Button
            variant='ghost'
            size='icon'
            className='md:hidden'
            aria-label='Toggle Navigation'
            aria-controls='sidebar-menu'
            aria-expanded={navOpened}
            onClick={handleMenuClick}
          >
            {navOpened ? <X /> : <Menu />}
          </Button>
        </Layout.Header>

        {/* Navigation links */}
        {areLinksLoading ?
          <NavSkeleton className='hidden h-full flex-1 md:flex' />
          : <Nav
            id='sidebar-menu'
            className={cn(
              'h-full flex-1 overflow-hidden z-40',
              navOpened ? 'max-h-screen' : 'max-h-0 py-0 md:max-h-screen md:py-2'
            )}
            closeNav={() => setNavOpened(!navOpened)}
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
            links={sidebarLinks || []}
          />}

        {/* Scrollbar width toggle button */}
        <Button
          onClick={handleSidebarCycle}
          size='icon'
          variant='outline'
          className='absolute -right-5 top-1/2 z-[60] hidden rounded-none md:inline-flex w-6 h-12 -translate-y-1/2'
          title={isCollapsed ? 'Expand to medium (Shift+click to toggle)' : sidebarWidth === 'medium' ? 'Expand to wide (Shift+click to collapse)' : 'Collapse sidebar (Shift+click to toggle)'}
        >
          {isCollapsed ? (
            <ChevronLeft strokeWidth={1.5} className="h-5 w-5 rotate-180" />
          ) : sidebarWidth === 'medium' ? (
            <ChevronLeft strokeWidth={1.5} className="h-5 w-5 rotate-180" />
          ) : (
            <ChevronsLeft strokeWidth={1.5} className="h-5 w-5" />
          )}
        </Button>
      </Layout>
    </aside>
  );
}