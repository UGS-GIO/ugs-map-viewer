import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/theme-provider'
import { Button } from './ui/button'

export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  // `theme` defaults to 'system', which is neither 'light' nor 'dark' - comparing it directly shows
  // the wrong icon and a label for a switch that changes nothing. Resolve it first.
  const isDark =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : theme === 'dark'

  return (
    <Button
      size='icon'
      variant='ghost'
      className='rounded-full'
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      data-tour="theme-switch"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
  )
}
