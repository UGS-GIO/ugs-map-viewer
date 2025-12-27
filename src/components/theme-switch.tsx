import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/theme-provider'
import { Button } from './ui/button'

export default function ThemeSwitch() {
  const { theme, setTheme } = useTheme()

  return (
    <Button
      size='icon'
      variant='ghost'
      className='rounded-full'
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </Button>
  )
}
