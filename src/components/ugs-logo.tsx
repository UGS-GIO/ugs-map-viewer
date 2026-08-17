import { cn } from '@/lib/utils'
import lockupBlue from '@/assets/ugs-logo-blue.png'
import lockupWhite from '@/assets/ugs-logo-white.png'
import mark from '@/assets/ugs-mark.png'

interface UgsLogoProps {
  /**
   * `lockup` is the hexagon mark plus the "Utah Geological Survey" wordmark, and
   * swaps navy/white with the theme. `mark` is the hexagon alone — use it wherever
   * the agency name is already spelled out next to the logo, so the wordmark isn't
   * said twice.
   *
   * The mark only ships in navy today, so it stays navy in both themes; its beehive
   * is white and still reads on a dark bar, but the hexagon edge fades out. When the
   * inverted mark arrives, import it as `markWhite` and give `mark` the same
   * dark:hidden / hidden dark:block pair the lockup uses.
   */
  variant?: 'lockup' | 'mark'
  className?: string
  alt?: string
}

export function UgsLogo({ variant = 'lockup', className, alt = 'Utah Geological Survey' }: UgsLogoProps) {
  if (variant === 'mark') {
    return <img src={mark} alt={alt} className={className} />
  }

  return (
    <>
      <img src={lockupBlue} alt={alt} className={cn('dark:hidden', className)} />
      <img src={lockupWhite} alt='' aria-hidden='true' className={cn('hidden dark:block', className)} />
    </>
  )
}
