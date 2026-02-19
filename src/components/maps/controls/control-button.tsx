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
        'flex size-[29px] cursor-pointer items-center justify-center border-none text-foreground',
        'hover:!bg-black/5 dark:hover:!bg-white/10',
        active && '!bg-amber-500 text-white hover:!bg-amber-600',
        disabled && 'cursor-not-allowed opacity-40',
        variant === 'danger' && !active && 'text-red-600',
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
