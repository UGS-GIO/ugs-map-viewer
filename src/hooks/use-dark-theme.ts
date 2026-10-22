import { useTheme } from '@/context/theme-provider'

/** Whether the page is dark, and a setter. */
export function useDarkTheme() {
  const { theme, setTheme } = useTheme()
  // `theme` defaults to 'system', which is neither 'light' nor 'dark' - comparing it directly shows
  // the wrong icon and a label for a switch that changes nothing. Resolve it first.
  const isDark =
    theme === 'system'
      ? !!globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches
      : theme === 'dark'
  return { isDark, setDark: (dark: boolean) => setTheme(dark ? 'dark' : 'light') }
}
