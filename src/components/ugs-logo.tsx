import { cn } from '@/lib/utils'
import lockupBlue from '@/assets/ugs-logo-blue.png'
import lockupWhite from '@/assets/ugs-logo-white.png'
import mark from '@/assets/ugs-mark.png'
import markWhite from '@/assets/ugs-mark-white.png'

interface UgsLogoProps {
  variant?: 'lockup' | 'mark'
  className?: string
  alt?: string
}

export function UgsLogo({ variant = 'lockup', className, alt = 'Utah Geological Survey' }: UgsLogoProps) {
  const [navy, white] = variant === 'mark' ? [mark, markWhite] : [lockupBlue, lockupWhite]

  // Both inks are decorative — the hidden one would take the alt text with it.
  // Navy stays eager: print pins to it, and a never-shown lazy image can print blank.
  return (
    <>
      <img src={navy} alt='' aria-hidden='true' decoding='async' className={cn('ugs-logo-navy dark:hidden', className)} />
      <img src={white} alt='' aria-hidden='true' loading='lazy' decoding='async' className={cn('ugs-logo-white hidden dark:block', className)} />
      <span className='sr-only'>{alt}</span>
    </>
  )
}
