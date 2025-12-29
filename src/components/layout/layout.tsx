import * as React from 'react'
import { cn } from '@/lib/utils'

const LayoutContext = React.createContext<{
  offset: number
  fixed: boolean
} | null>(null)

interface LayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  fixed?: boolean
}

// Adjust the Layout component to ensure it fills the screen
const Layout = ({ className, fixed = false, ...props }: LayoutProps) => {
  const divRef = React.useRef<HTMLDivElement>(null);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    const div = divRef.current;

    if (!div) return;
    const onScroll = () => setOffset(div.scrollTop);

    div.removeEventListener('scroll', onScroll);
    div.addEventListener('scroll', onScroll, { passive: true });
    return () => div.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <LayoutContext.Provider value={{ offset, fixed }}>
      <div
        ref={divRef}
        data-layout="layout"
        className={cn(
          "h-full overflow-auto flex flex-col",
          className
        )}
        {...props}
      />
    </LayoutContext.Provider>
  );
};
Layout.displayName = 'Layout'

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  sticky?: boolean
}

const Header = React.forwardRef<HTMLDivElement, HeaderProps>(
  ({ className, sticky, ...props }, ref) => {
    // Check if Layout.Header is used within Layout
    const contextVal = React.useContext(LayoutContext)
    if (contextVal === null) {
      throw new Error(
        `Layout.Header must be used within ${Layout.displayName}.`
      )
    }

    return (
      <div
        ref={ref}
        data-layout='header'
        className={cn(
          `z-10 flex h-[var(--header-height)] items-center bg-background p-2 md:px-8`,
          contextVal.offset > 10 && sticky ? 'shadow' : 'shadow-none',
          contextVal.fixed && 'flex-none',
          sticky && 'sticky top-0',
          className
        )}
        {...props}
      />
    )
  }
)
Header.displayName = 'Header'

const Body = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const contextVal = React.useContext(LayoutContext);
  if (contextVal === null) {
    throw new Error(`Layout.Body must be used within ${Layout.displayName}.`);
  }

  return (
    <div
      ref={ref}
      data-layout="body"
      className={cn(
        'flex-1 min-h-0 overflow-hidden relative', // flex-1 fills remaining space, min-h-0 allows shrinking, relative for absolute children
        className
      )}
      {...props}
    />
  );
}
);
Body.displayName = 'Body';

interface FooterProps extends React.HTMLAttributes<HTMLDivElement> {
  dynamicContent?: React.ReactNode; // This allows you to pass in dynamic content
}

const Footer = React.forwardRef<HTMLDivElement, FooterProps>(
  ({ className, dynamicContent, ...props }, ref) => {
    const contextVal = React.useContext(LayoutContext);
    if (contextVal === null) {
      throw new Error(`Layout.Footer must be used within ${Layout.displayName}.`);
    }

    return (
      <div
        ref={ref}
        data-layout="footer"
        className={cn(
          "flex items-center justify-between px-2 py-1 md:py-2 border-t bg-background", // Footer style
          contextVal.fixed && 'flex-none',
          className
        )}
        {...props}
      >
        {dynamicContent && dynamicContent}
      </div>
    );
  }
);
Footer.displayName = 'Footer';

// Combine the components under Layout
Layout.Header = Header;
Layout.Body = Body;
Layout.Footer = Footer;

export { Layout };
