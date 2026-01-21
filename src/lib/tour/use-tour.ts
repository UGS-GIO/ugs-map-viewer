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

  // Start the tour
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
