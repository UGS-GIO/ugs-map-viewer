/// <reference types="vite/client" />

// The Utah header ships a plain CSS side-effect entry with no types.
declare module '@utahdts/utah-design-system-header/css';

interface Window {
    dataLayer?: Record<string, unknown>[];
}
