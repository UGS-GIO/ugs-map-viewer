import { cn } from '@/lib/utils'
import lockupBlue from '@/assets/ugs-logo-blue.png'
import lockupWhite from '@/assets/ugs-logo-white.png'
import mark from '@/assets/ugs-mark.png'
import markWhite from '@/assets/ugs-mark-white.png'

interface UgsLogoProps {
  /**
   * `lockup` is the hexagon mark plus the "Utah Geological Survey" wordmark. `mark`
   * is the hexagon alone — use it wherever the agency name is already spelled out
   * next to the logo, so the wordmark isn't said twice. Both ship in navy and white
   * and swap with the theme.
   */
  variant?: 'lockup' | 'mark'
  className?: string
  alt?: string
}

export function UgsLogo({ variant = 'lockup', className, alt = 'Utah Geological Survey' }: UgsLogoProps) {
  const [navy, white] = variant === 'mark' ? [mark, markWhite] : [lockupBlue, lockupWhite]

  // Both variants render as a pair and let CSS pick, so the right one is up on the
  // first paint — a JS-driven swap would flash the wrong logo on load.
  return (
    <>
      <img src={navy} alt={alt} className={cn('ugs-logo-navy dark:hidden', className)} />
      <img src={white} alt='' aria-hidden='true' className={cn('ugs-logo-white hidden dark:block', className)} />
    </>
  )
}
