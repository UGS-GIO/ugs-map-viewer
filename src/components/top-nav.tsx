import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/custom/button';
import { BasemapIcon } from '@/assets/basemap-icons';
import { BASEMAP_STYLES, DEFAULT_BASEMAP, BasemapStyle } from '@/lib/basemaps';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { MapSearchParams } from '@/routes/_map';

interface TopNavProps extends React.HTMLAttributes<HTMLElement> { }

interface BasemapProps {
  links: BasemapStyle[];
  trigger: React.ReactNode | string;
  onBasemapChange: (basemapId: string) => void;
  activeBasemap: string;
}

const BasemapDropdown = ({ links, trigger, onBasemapChange, activeBasemap }: BasemapProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start">
        {links.map(({ id, title }) => {
          const isActive = activeBasemap === id;

          return (
            <DropdownMenuItem key={id} asChild>
              <Button
                variant="ghost"
                className={cn('w-full justify-start', !isActive ? 'text-muted-foreground' : 'underline')}
                onClick={() => onBasemapChange(id)}
              >
                {title}
              </Button>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

function TopNav({ className, ...props }: TopNavProps) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false }) as MapSearchParams;

  const activeBasemap = searchParams.basemap || DEFAULT_BASEMAP.id;

  // Just update URL - DataMap handles the actual basemap change
  const handleBasemapChange = (basemapId: string) => {
    navigate({
      to: ".",
      search: (prev) => ({ ...prev, basemap: basemapId }),
      replace: true,
    });
  };

  // Check if any long-type basemap is active
  const isLongActive = BASEMAP_STYLES
    .filter(({ type }) => type === 'long')
    .some(({ id }) => activeBasemap === id);

  // Get current basemap title for collapsed view
  const currentBasemapTitle = BASEMAP_STYLES.find(b => b.id === activeBasemap)?.title || 'Basemap';

  // Collapsed trigger (icon only)
  const collapsedIconTrigger = (
    <Button size="icon" variant="outline">
      <BasemapIcon />
    </Button>
  );

  // Collapsed trigger with label (shows current basemap)
  const collapsedLabelTrigger = (
    <Button variant="outline" className="gap-2">
      <BasemapIcon className="h-4 w-4" />
      <span>{currentBasemapTitle}</span>
    </Button>
  );

  const moreTrigger = (
    <Button
      className={cn(
        'text-muted-foreground',
        isLongActive && 'text-secondary-foreground underline',
        'focus-visible:outline-none'
      )}
      variant="ghost"
    >
      More
    </Button>
  );

  return (
    <>
      {/* Collapsed view - icon only (small screens) */}
      <div className="sm:hidden">
        <BasemapDropdown
          links={BASEMAP_STYLES}
          trigger={collapsedIconTrigger}
          onBasemapChange={handleBasemapChange}
          activeBasemap={activeBasemap}
        />
      </div>

      {/* Collapsed view - with label (medium screens) */}
      <div className="hidden sm:block lg:hidden">
        <BasemapDropdown
          links={BASEMAP_STYLES}
          trigger={collapsedLabelTrigger}
          onBasemapChange={handleBasemapChange}
          activeBasemap={activeBasemap}
        />
      </div>

      {/* Expanded view - individual buttons (large screens) */}
      <nav
        className={cn(
          'hidden items-center space-x-4 lg:flex xl:space-x-6',
          className
        )}
        {...props}
      >
        {BASEMAP_STYLES
          .filter(({ type }) => type === 'short')
          .map(({ id, title }) => {
            const isActive = activeBasemap === id;

            return (
              <Button
                variant="ghost"
                key={id}
                onClick={() => handleBasemapChange(id)}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-secondary-foreground',
                  isActive ? 'underline' : 'text-muted-foreground'
                )}
              >
                {title}
              </Button>
            );
          })}
        <BasemapDropdown
          links={BASEMAP_STYLES.filter(({ type}) => type === 'long')}
          trigger={moreTrigger}
          onBasemapChange={handleBasemapChange}
          activeBasemap={activeBasemap}
        />
      </nav>
    </>
  );
}

export { TopNav };
