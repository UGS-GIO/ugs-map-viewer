// Sidebar width classes with responsive breakpoints
// - 'wide' shows as narrow (w-96) on md screens, full width (w-[32rem]) on xl screens
// - This ensures smaller screens don't have an oversized sidebar
export const SIDEBAR_WIDTHS = {
  icon: 'md:w-12',
  wide: 'md:w-96 xl:w-[32rem]',    // 384px on md-lg, 512px on xl+
  narrow: 'md:w-96'                 // 384px - always narrow
} as const;

export const SIDEBAR_MARGINS = {
  icon: 'md:ml-12',
  wide: 'md:ml-96 xl:ml-[32rem]',  // matches sidebar width
  narrow: 'md:ml-96'                // 384px
} as const;
