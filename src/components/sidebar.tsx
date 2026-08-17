import { useEffect, useCallback, useState } from 'react';
import { ChevronsLeft, ChevronLeft, Menu, X } from 'lucide-react';
import { Layout } from './layout/layout';
import { Button } from './ui/button';
import Nav from './nav';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from '@/components/ui/link';
import { UgsLogo } from '@/components/ugs-logo';
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
  const isMobile = useIsMobile();

  // Use pixel width when expanded, icon width when collapsed (desktop only)
  // On mobile, let CSS handle the width (w-full)
  const sidebarStyle = isMobile ? undefined : (isCollapsed ? { width: '3.5rem' } : { width: `${sidebarWidthPx}px` });

  // Get default width based on screen size
  const getDefaultWidth = useCallback(() => {
    return window.innerWidth >= 1280 ? SIDEBAR_WIDTH_XL : SIDEBAR_WIDTH_MD;
  }, []);

  // Combined drag-to-resize and click-to-toggle handler
  const handleResizeMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const isTouch = 'touches' in e;
    const startX = isTouch ? e.touches[0].clientX : e.clientX;
    const collapseThreshold = SIDEBAR_WIDTH_MIN - 50;
    const dragThreshold = 5; // pixels before considering it a drag
    let hasDragged = false;
    let expandedFromCollapsed = false;

    // If collapsed, we'll expand on first drag movement
    const startWidth = isCollapsed ? SIDEBAR_WIDTH_MIN : sidebarWidthPx;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = clientX - startX;

      // Only start dragging after threshold
      if (!hasDragged && Math.abs(deltaX) < dragThreshold) return;

      if (!hasDragged) {
        setIsDragging(true);
        hasDragged = true;
      }

      // First movement while collapsed - expand to min width
      if (isCollapsed && !expandedFromCollapsed) {
        setIsCollapsed(false);
        setSidebarWidthPx(SIDEBAR_WIDTH_MIN);
        expandedFromCollapsed = true;
      }

      const rawWidth = startWidth + deltaX;

      // If dragged below collapse threshold, collapse to icons
      if (rawWidth < collapseThreshold) {
        setIsCollapsed(true);
        setIsDragging(false);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        return;
      }

      const newWidth = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, rawWidth));
      setSidebarWidthPx(newWidth);
    };

    const onEnd = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);

      // If didn't drag, treat as click - toggle collapse
      if (!hasDragged) {
        if (isCollapsed) {
          setSidebarWidthPx(getDefaultWidth());
          setIsCollapsed(false);
        } else {
          setIsCollapsed(true);
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [isCollapsed, setIsCollapsed, sidebarWidthPx, setSidebarWidthPx, getDefaultWidth]);

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
      // Absolute, not fixed: the app shell now sits under the official Utah header,
      // so the sidebar spans the map area (the positioned route container) rather
      // than the whole viewport, which would slide it up under the header.
      className={cn(
        "absolute left-0 right-0 top-0 z-50 w-full border-b md:border-b-0 md:border-r-2 md:border-r-muted md:bottom-0 md:right-auto md:h-full",
        !isDragging && "transition-[width] duration-200 ease-linear",
        className
      )}
      style={sidebarStyle}
    >
      <div
        onClick={() => setNavOpened(false)}
        className={`absolute inset-0 transition-opacity duration-700 ${navOpened ? 'h-full opacity-50' : 'h-0 opacity-0'
          } w-full bg-black md:hidden`}
      />

      <Layout fixed className={cn('md:h-full', navOpened && 'h-full')}>
        {/* Header */}
        <Layout.Header
          sticky
          className={`z-50 flex justify-between shadow-sm px-4 md:px-1`}
        >
          <div className={`flex items-center min-w-0 ${!isCollapsed ? 'gap-3' : 'w-full justify-center'}`}>
            <Link
              to="https://geology.utah.gov/"
              className={cn('cursor-pointer flex items-center justify-center', isCollapsed && 'w-10')}
            >
              {/* Collapsed there is only room for the hexagon; expanded, the full
                  lockup carries the agency name — which matters on mobile, where the
                  official Utah header is hidden. */}
              {isCollapsed
                ? <UgsLogo variant='mark' className='h-8 w-auto' />
                : <UgsLogo className='h-9 w-auto shrink-0' />}
            </Link>
            {!isCollapsed && (
              <>
                <div className='h-8 w-px shrink-0 bg-border' aria-hidden='true' />
                <span className='font-display font-medium truncate'>{appTitle}</span>
              </>
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

        {/* Combined toggle button + drag handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          onTouchStart={handleResizeMouseDown}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-[60] hidden md:flex",
            "w-6 h-12 items-center justify-center",
            "bg-background border border-border rounded-sm",
            "cursor-col-resize hover:bg-accent active:bg-accent",
            "transition-colors duration-150 select-none"
          )}
          title={isCollapsed ? 'Click to expand, drag to resize' : 'Click to collapse, drag to resize'}
        >
          {isCollapsed ? (
            <ChevronLeft strokeWidth={1.5} className="h-5 w-5 rotate-180 pointer-events-none" />
          ) : (
            <ChevronsLeft strokeWidth={1.5} className="h-5 w-5 pointer-events-none" />
          )}
        </div>
      </Layout>
    </aside>
  );
}