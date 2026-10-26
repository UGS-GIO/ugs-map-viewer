import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ControlButtonProps {
  icon: LucideIcon
  title: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  variant?: 'default' | 'danger'
  className?: string
}

export function ControlButton({
  icon: Icon,
  title,
  onClick,
  active = false,
  disabled = false,
  variant = 'default',
  className,
}: ControlButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex size-[29px] cursor-pointer items-center justify-center border-none text-foreground transition-colors',
        // Theme tokens, not hardcoded washes: white/10 over the dark chip barely registered.
        'hover:!bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        active && '!bg-primary text-primary-foreground hover:!bg-primary/90 hover:text-primary-foreground',
        disabled && 'cursor-not-allowed text-muted-foreground hover:!bg-transparent hover:text-muted-foreground',
        variant === 'danger' && !active && 'text-destructive',
        className,
      )}
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      <Icon size={18} strokeWidth={1.5} />
    </button>
  )
}
