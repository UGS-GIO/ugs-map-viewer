import type { ReactNode } from 'react'

/** Pill to the left of a map control group naming the mode it has on. */
export function ActiveModeLabel({ children }: { children: ReactNode }) {
  return (
    <div className="absolute top-1/2 right-full mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm">
      {children}
    </div>
  )
}
