import { Moon, Sun } from 'lucide-react'
import { useDarkTheme } from '@/hooks/use-dark-theme'
import { Button } from './ui/button'

export default function ThemeSwitch() {
  const { isDark, setDark } = useDarkTheme()

  return (
    <Button
      size='icon'
      variant='ghost'
      className='rounded-full'
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setDark(!isDark)}
      data-tour="theme-switch"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </Button>
  )
}
