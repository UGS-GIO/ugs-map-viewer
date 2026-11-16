/// <reference types="vite/client" />

interface Window {
    dataLayer?: Record<string, unknown>[];
    // Navigation API (Chromium, Safari 26+), not yet in TypeScript's DOM lib
    navigation?: { canGoForward: boolean };
}
