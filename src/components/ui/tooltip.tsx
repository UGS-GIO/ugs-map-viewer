import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const CustomTooltipProvider = TooltipPrimitive.Provider

const CustomTooltip = TooltipPrimitive.Root

const CustomTooltipTrigger = TooltipPrimitive.Trigger

const CustomTooltipArrow = TooltipPrimitive.Arrow

const CustomTooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-md bg-secondary px-3 py-1.5 text-base text-secondary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]",
        className
      )}
      {...props}
    >
      {props.children}
      <CustomTooltipArrow className="fill-secondary" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
CustomTooltipContent.displayName = TooltipPrimitive.Content.displayName

export {
  CustomTooltip as Tooltip,
  CustomTooltipTrigger as TooltipTrigger,
  CustomTooltipContent as TooltipContent,
  CustomTooltipProvider as TooltipProvider
}
