import { useEffect, useCallback, useState } from 'react';
import { ChevronsLeft, ChevronLeft } from 'lucide-react';
import Nav from './nav';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/hooks/use-sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGetSidebarLinks } from '@/hooks/use-get-sidebar-links';
import { NavSkeleton } from './sidebar/sidebar-skeleton';
import { SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX, SIDEBAR_WIDTH_MD, SIDEBAR_WIDTH_XL, SIDEBAR_WIDTH_COLLAPSED } from '@/context/sidebar-provider';

const SIDEBAR_RESIZE_STEP = 24;

interface SidebarProps extends React.HTMLAttributes<HTMLElement> { }

export default function Sidebar({ className }: SidebarProps) {
  const { navOpened, setNavOpened, isCollapsed, setIsCollapsed, sidebarWidthPx, setSidebarWidthPx } = useSidebar();
  const { data: sidebarLinks, isLoading: areLinksLoading } = useGetSidebarLinks();
  const [isDragging, setIsDragging] = useState(false);
  const isMobile = useIsMobile();

  // Hidden, not unmounted: the panel would otherwise take the flex-1 remainder of the rail — a ~5px
  // column that paints a scrollbar beside the icons — but unmounting drops the layer groups' local
  // expansion state on every collapse. Keyed off navOpened, not a breakpoint hook: the mobile
  // drawer IS the panel, and useIsMobile lags a live resize, which would blank it.
  const showPanel = navOpened || !isCollapsed;

  // Collapsed shares one constant with MapShell so the sidebar and the map's margin can't drift.
  const sidebarStyle = isMobile ? undefined : { width: `${isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : sidebarWidthPx}px` };

  // Get default width based on screen size
  const getDefaultWidth = useCallback(() => {
    return window.innerWidth >= 1280 ? SIDEBAR_WIDTH_XL : SIDEBAR_WIDTH_MD;
  }, []);

  const clampWidth = (px: number) => Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, px));

  const toggleCollapsed = useCallback(() => {
    if (isCollapsed) {
      setSidebarWidthPx(getDefaultWidth());
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [isCollapsed, setIsCollapsed, setSidebarWidthPx, getDefaultWidth]);

  // Drag to resize, click to toggle. The element carries `touch-none` so a touch drag resizes
  // rather than scrolling the page.
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const collapseThreshold = SIDEBAR_WIDTH_MIN - 50;
    const dragThreshold = 5; // px of travel before a press counts as a drag rather than a click
    let hasDragged = false;
    let expandedFromCollapsed = false;

    const startWidth = isCollapsed ? SIDEBAR_WIDTH_MIN : sidebarWidthPx;

    const stop = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', stop);
    };

    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (!hasDragged && Math.abs(deltaX) < dragThreshold) return;
      if (!hasDragged) {
        setIsDragging(true);
        hasDragged = true;
      }

      if (isCollapsed && !expandedFromCollapsed) {
        setIsCollapsed(false);
        setSidebarWidthPx(SIDEBAR_WIDTH_MIN);
        expandedFromCollapsed = true;
      }

      const rawWidth = startWidth + deltaX;

      if (rawWidth < collapseThreshold) {
        setIsCollapsed(true);
        stop();
        return;
      }

      setSidebarWidthPx(clampWidth(rawWidth));
    };

    // Only a completed press toggles. A cancelled pointer (OS edge gesture, second touch, long
    // press) unwinds through `stop` alone, or an aborted gesture would silently collapse the panel.
    const onEnd = () => {
      stop();
      if (!hasDragged) toggleCollapsed();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', stop);
  }, [isCollapsed, setIsCollapsed, sidebarWidthPx, setSidebarWidthPx, toggleCollapsed]);

  // The splitter is the only way to collapse or resize on desktop, so it has to work from the keyboard.
  const handleResizeKeyDown = useCallback((e: React.KeyboardEvent) => {
    const { key } = e;

    if (key === 'Enter' || key === ' ') {
      e.preventDefault();
      toggleCollapsed();
      return;
    }

    if (key === 'Home') {
      e.preventDefault();
      setIsCollapsed(true);
      return;
    }

    if (key === 'End') {
      e.preventDefault();
      setIsCollapsed(false);
      setSidebarWidthPx(SIDEBAR_WIDTH_MAX);
      return;
    }

    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    e.preventDefault();

    const step = key === 'ArrowLeft' ? -SIDEBAR_RESIZE_STEP : SIDEBAR_RESIZE_STEP;

    // Both branches mirror the drag: out of collapsed lands on the minimum, under it snaps shut.
    if (isCollapsed) {
      if (step > 0) {
        setIsCollapsed(false);
        setSidebarWidthPx(SIDEBAR_WIDTH_MIN);
      }
      return;
    }

    if (sidebarWidthPx + step < SIDEBAR_WIDTH_MIN) {
      setIsCollapsed(true);
      return;
    }

    setSidebarWidthPx(clampWidth(sidebarWidthPx + step));
  }, [isCollapsed, setIsCollapsed, sidebarWidthPx, setSidebarWidthPx, toggleCollapsed]);

  /* Make body not scrollable when navBar is opened */
  useEffect(() => {
    if (navOpened) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [navOpened]);

  return (
    <aside
      aria-label="Map tools"
      className={cn(
        "absolute left-0 right-0 top-0 z-50 w-full md:bottom-0 md:right-auto md:h-full md:border-r-2 md:border-r-muted",
        navOpened ? "border-b" : "hidden md:block",
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

      <div className={cn('flex h-full flex-col', navOpened && 'h-full')}>
        {/* Navigation links */}
        {areLinksLoading ?
          <NavSkeleton id='sidebar-menu' className='hidden h-full flex-1 md:flex' />
          : <Nav
            id='sidebar-menu'
            className={cn(
              'h-full flex-1 overflow-hidden z-40',
              navOpened ? 'max-h-screen' : 'max-h-0 py-0 md:max-h-screen md:py-2'
            )}
            closeNav={() => setNavOpened(!navOpened)}
            isCollapsed={isCollapsed}
            showPanel={showPanel}
            setIsCollapsed={setIsCollapsed}
            links={sidebarLinks || []}
          />}

        {/* Combined toggle button + drag handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize map tools"
          aria-controls="sidebar-menu"
          aria-valuenow={isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : Math.round(sidebarWidthPx)}
          aria-valuemin={SIDEBAR_WIDTH_COLLAPSED}
          aria-valuemax={SIDEBAR_WIDTH_MAX}
          tabIndex={0}
          onPointerDown={handleResizePointerDown}
          onKeyDown={handleResizeKeyDown}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 z-[60] hidden md:flex",
            "w-6 h-12 items-center justify-center",
            "bg-background border border-border rounded-sm",
            "cursor-col-resize hover:bg-accent active:bg-accent",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "transition-colors duration-150 select-none touch-none"
          )}
          title={isCollapsed ? 'Click to expand, drag to resize' : 'Click to collapse, drag to resize'}
        >
          {isCollapsed ? (
            <ChevronLeft strokeWidth={1.5} className="h-5 w-5 rotate-180 pointer-events-none" />
          ) : (
            <ChevronsLeft strokeWidth={1.5} className="h-5 w-5 pointer-events-none" />
          )}
        </div>
      </div>
    </aside>
  );
}