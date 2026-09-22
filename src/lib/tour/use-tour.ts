import { useCallback, useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css'; // Base styles
import './tour.css'; // Custom theme overrides
import { getTourSteps, type TourRoute } from './tour-steps';

const TOUR_STORAGE_KEY = 'ugs-tour-completed';

interface UseTourOptions {
  route?: TourRoute;
  autoStart?: boolean;
  onComplete?: () => void;
}

// driver.js stamps `aria-haspopup`/`aria-expanded` on whatever it highlights, where neither is
// allowed without a matching role — and rewrites it per step, sometimes after the hook returns.
const HOLDS_POPUP = ['button', 'a', 'input'];
const POPUP_ROLES = ['button', 'combobox', 'menuitem', 'link'];

const stripHighlightAria = () => {
  const strip = () => {
    for (const el of document.querySelectorAll('.driver-active-element')) {
      const role = el.getAttribute('role') ?? '';
      if (HOLDS_POPUP.includes(el.tagName.toLowerCase()) || POPUP_ROLES.includes(role)) continue;
      el.removeAttribute('aria-haspopup');
      el.removeAttribute('aria-expanded');
    }
  };
  strip();
  setTimeout(strip, 0);
  // driver.js re-applies the attributes when its 300-400ms move transition lands.
  setTimeout(strip, 450);
};

export function useTour(options: UseTourOptions = {}) {
  const { route, autoStart = false, onComplete } = options;
  const driverRef = useRef<Driver | null>(null);

  // Check if tour was already completed for this route
  const isTourCompleted = useCallback((tourRoute?: TourRoute) => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) return false;
    
    try {
      const parsed = JSON.parse(completed) as string[];
      return parsed.includes(tourRoute ?? 'base');
    } catch {
      return false;
    }
  }, []);

  // Mark tour as completed
  const markTourCompleted = useCallback((tourRoute?: TourRoute) => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    let parsed: string[] = [];
    
    try {
      parsed = completed ? JSON.parse(completed) : [];
    } catch {
      parsed = [];
    }
    
    const key = tourRoute ?? 'base';
    if (!parsed.includes(key)) {
      parsed.push(key);
      localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(parsed));
    }
  }, []);

  // Reset tour completion status
  const resetTour = useCallback((tourRoute?: TourRoute) => {
    if (tourRoute) {
      const completed = localStorage.getItem(TOUR_STORAGE_KEY);
      try {
        const parsed = completed ? JSON.parse(completed) : [];
        const filtered = parsed.filter((r: string) => r !== tourRoute);
        localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(filtered));
      } catch {
        localStorage.removeItem(TOUR_STORAGE_KEY);
      }
    } else {
      localStorage.removeItem(TOUR_STORAGE_KEY);
    }
  }, []);

  const startTour = useCallback(() => {
    const steps = getTourSteps(route);
    
    if (steps.length === 0) {
      console.warn('No tour steps found for current page');
      return;
    }

    driverRef.current = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      stagePadding: 4,
      stageRadius: 8,
      popoverClass: 'ugs-tour-popover',
      steps,
      // driver.js builds the popover from <header>/<footer>: landmarks the dialog shouldn't have.
      onPopoverRender: (popover) => {
        if (!popover?.wrapper) return;
        popover.wrapper.setAttribute('role', 'dialog');
        // A step may define no title, and then there is no title node.
        if (popover.title) {
          // <header> may not carry role=heading, so it goes presentational and the text
          // moves into a span that can.
          popover.title.setAttribute('role', 'presentation');
          const heading = document.createElement('span');
          heading.setAttribute('role', 'heading');
          heading.setAttribute('aria-level', '2');
          heading.textContent = popover.title.textContent;
          popover.title.replaceChildren(heading);
          if (!popover.title.id) popover.title.id = 'driver-popover-title';
          popover.wrapper.setAttribute('aria-labelledby', popover.title.id);
        } else {
          popover.wrapper.setAttribute('aria-label', 'Tour step');
        }
        popover.footer?.setAttribute('role', 'presentation');
        stripHighlightAria();
      },
      onHighlighted: () => stripHighlightAria(),
      onDestroyStarted: () => {
        // Called when user tries to close (X, Escape, or overlay click)
        // This allows the tour to be exited at any time
        driverRef.current?.destroy();
      },
      onDestroyed: () => {
        markTourCompleted(route);
        onComplete?.();
      },
    });

    driverRef.current.drive();
    stripHighlightAria();
  }, [route, markTourCompleted, onComplete]);

  // Stop the tour
  const stopTour = useCallback(() => {
    driverRef.current?.destroy();
  }, []);

  // Auto-start on first visit
  useEffect(() => {
    if (autoStart && !isTourCompleted(route)) {
      // Delay to ensure DOM is ready
      const timeout = setTimeout(startTour, 500);
      return () => clearTimeout(timeout);
    }
  }, [autoStart, route, isTourCompleted, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
    };
  }, []);

  return {
    startTour,
    stopTour,
    resetTour,
    isTourCompleted: isTourCompleted(route),
  };
}
