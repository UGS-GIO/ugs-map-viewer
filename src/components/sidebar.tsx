import { useEffect, useCallback, useState } from 'react';
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
import { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MD, SIDEBAR_WIDTH_XL } from '@/context/sidebar-provider';

interface SidebarProps extends React.HTMLAttributes<HTMLElement> { }

export default function Sidebar({ className }: SidebarProps) {
  const { navOpened, setNavOpened, isCollapsed, setIsCollapsed, sidebarWidthPx, setSidebarWidthPx } = useSidebar();
  const { data: sidebarLinks, isLoading: areLinksLoading } = useGetSidebarLinks();
  const currentPage = useGetCurrentPage();
  const appTitle = getAppTitle(currentPage);
  const [isDragging, setIsDragging] = useState(false);

  // Use pixel width when expanded, icon width when collapsed
  const sidebarStyle = isCollapsed ? { width: '3.5rem' } : { width: `${sidebarWidthPx}px` };

  // Get default width based on screen size
  const getDefaultWidth = useCallback(() => {
    return window.innerWidth >= 1280 ? SIDEBAR_WIDTH_XL : SIDEBAR_WIDTH_MD;
  }, []);

  // Drag to resize handler
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const collapseThreshold = SIDEBAR_WIDTH_MIN - 50;
    let hasDragged = false;
    let expandedFromCollapsed = false;

    // If collapsed, we'll expand on first drag movement
    const startWidth = isCollapsed ? SIDEBAR_WIDTH_MIN : sidebarWidthPx;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;

      // First movement while collapsed - expand to min width
      if (isCollapsed && !expandedFromCollapsed) {
        setIsCollapsed(false);
        setSidebarWidthPx(SIDEBAR_WIDTH_MIN);
        expandedFromCollapsed = true;
      }

      hasDragged = true;
      const rawWidth = startWidth + deltaX;

      // If dragged below collapse threshold, collapse to icons
      if (rawWidth < collapseThreshold) {
        setIsCollapsed(true);
        setIsDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        return;
      }

      const newWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, rawWidth));
      setSidebarWidthPx(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      // If collapsed and didn't drag, treat as click - expand to default
      if (isCollapsed && !hasDragged) {
        setSidebarWidthPx(getDefaultWidth());
        setIsCollapsed(false);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [isCollapsed, setIsCollapsed, sidebarWidthPx, setSidebarWidthPx, getDefaultWidth]);

  const handleSidebarToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // When expanding, reset to default width
    if (isCollapsed) {
      setSidebarWidthPx(getDefaultWidth());
    }
    setIsCollapsed(!isCollapsed);
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
        "fixed left-0 right-0 top-0 z-50 w-full border-r-2 border-r-muted md:bottom-0 md:right-auto md:h-svh",
        !isDragging && "transition-[width] duration-200 ease-linear",
        className
      )}
      style={sidebarStyle}
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
          className={`z-50 flex justify-between shadow-sm px-4 md:px-1`}
        >
          <div className={`flex items-center ${!isCollapsed ? 'gap-4' : 'w-full'}`}>
            <Link to="https://geology.utah.gov/" className="cursor-pointer flex items-center justify-center w-10">
              <img
                src='/logo_main.png'
                alt='Utah Geological Survey Logo'
                className={`transition-all duration-300 ${isCollapsed ? 'h-8 w-7' : 'h-8 w-[1.75rem]'}`}
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

        {/* Toggle button */}
        <Button
          onClick={handleSidebarToggle}
          size='icon'
          variant='outline'
          className='absolute -right-5 top-1/2 z-[60] hidden rounded-none md:inline-flex w-6 h-12 -translate-y-1/2'
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronLeft strokeWidth={1.5} className="h-5 w-5 rotate-180" />
          ) : (
            <ChevronsLeft strokeWidth={1.5} className="h-5 w-5" />
          )}
        </Button>

        {/* Drag handle for resizing */}
        <div
          onMouseDown={handleResizeMouseDown}
          className={cn(
            "absolute top-0 bottom-0 -right-1 w-2 z-[70] hidden md:block",
            "cursor-col-resize hover:bg-accent/50 active:bg-accent",
            "transition-colors duration-150"
          )}
          title={isCollapsed ? "Click to expand" : "Drag to resize"}
        >
          <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        </div>
      </Layout>
    </aside>
  );
}