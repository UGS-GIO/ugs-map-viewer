import { Button, buttonVariants } from './custom/button'
import { Link } from '@tanstack/react-router'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible'

// todo add tooltip functionality back
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './ui/tooltip'
import { cn } from '@/lib/utils'
import useCheckActiveNav from '@/hooks/use-check-active-nav'
import { Suspense } from 'react'
import { ChevronLeft } from 'lucide-react'
import { LoadingSpinner } from './custom/loading-spinner'
import { useSidebar } from '@/hooks/use-sidebar'
import { SideLink } from '@/lib/types/sidelink-types'

interface NavProps extends React.HTMLAttributes<HTMLDivElement> {
  isCollapsed: boolean
  links: SideLink[]
  closeNav: () => void
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  className?: string
}

export default function Nav({
  links,
  isCollapsed,
  setIsCollapsed,
  closeNav,
  className,
}: NavProps) {
  const { currentContent, setCurrentContent } = useSidebar()

  const renderLink = (link: SideLink) => {
    const key = `${link.title}`

    // if (isCollapsed && link.sub)
    //   return (
    //     <NavLinkIconDropdown
    //       {...link}
    //       sub={link.sub}
    //       key={key}
    //       closeNav={closeNav}
    //       setCurrentContent={setCurrentContent}
    //     />
    //   )

    if (isCollapsed) return;

    if (link.sub)
      return (
        <NavLinkDropdown
          {...link}
          key={key}
          closeNav={closeNav}
          setCurrentContent={setCurrentContent}
        />
      )

    return (
      <NavLink
        {...link}
        key={key}
        closeNav={closeNav}
        setCurrentContent={setCurrentContent}
        currentContent={currentContent}
        isCollapsed={isCollapsed}
      />
    )
  }


  const DynamicComponent = currentContent?.component
    ? currentContent?.component
    : null

  return (
    <div className="flex flex-1 overflow-hidden" >
      <div className="hidden md:flex flex-col items-center gap-4 pt-2 border-r px-1" >
        {links.map((link, index) => (
          <NavLinkIcon
            key={index}
            link={link}
            isCollapsed={isCollapsed}
            currentContent={currentContent}
            setIsCollapsed={setIsCollapsed}
            setCurrentContent={setCurrentContent}
            closeNav={closeNav}
          />
        ))}
      </div>
      <div
        data-collapsed={isCollapsed}
        className={cn(
          'group border-b bg-background py-2 transition-[max-height,padding] duration-500 data-[collapsed=true]:py-2 md:border-none',
          className
        )}
      >
        <TooltipProvider delayDuration={0}>
          {currentContent ? (
            <div className="px-4 pb-4 h-full">
              <Suspense fallback={<div><LoadingSpinner /></div>}>
                {DynamicComponent ? (
                  <div className='overflow-y-auto h-full'>
                    <DynamicComponent />
                  </div>
                ) : (
                  <div className='w-full flex justify-center'>
                    <LoadingSpinner />
                  </div>
                )}
              </Suspense>
            </div>
          ) : (
            <nav className='grid gap-4 group-[[data-collapsed=true]]:justify-center group-[[data-collapsed=true]]:px-2'>
              {links.map(renderLink)}
            </nav>
          )}
        </TooltipProvider>
      </div>
    </div >
  )
}

interface NavLinkProps extends SideLink {
  subLink?: boolean
  closeNav: () => void
  isCollapsed?: boolean
  href?: string
  setIsCollapsed?: React.Dispatch<React.SetStateAction<boolean>>
  currentContent?: SideLink | null
  setCurrentContent: (content: SideLink) => void
}

function NavLink({
  title,
  icon,
  label,
  component,
  componentPath,
  href,
  // closeNav,
  subLink = false,
  setCurrentContent,
  isCollapsed,
  currentContent
}: NavLinkProps) {
  const { checkActiveNav } = useCheckActiveNav()

  const handleClick = () => {
    if (title === 'Home') {
      return
    }
    if (!href) {
      setCurrentContent({ title, icon, label, componentPath, component })
    }
  }

  const linkContent = (
    <>
      <div className='block md:hidden mr-2'>{icon}</div>
      {title}
      {label && (
        <div className='ml-2 rounded-lg bg-primary px-1 text-[0.75rem] text-primary-foreground'>
          {label}
        </div>
      )}
    </>
  )

  return href ? (
    <Link
      target='_blank'
      to={href}
      className={cn(
        buttonVariants({
          variant: 'ghost',
          size: 'sm',
        }),
        'h-12 justify-start text-wrap rounded-none px-6',
        subLink && 'h-10 w-full border-l border-l-slate-500 px-2',
        title === 'Home' ? 'hidden md:flex' : '' // hide Home on mobile,
      )}
      aria-current={checkActiveNav(componentPath ?? '') ? 'page' : undefined}
    >
      {linkContent}
    </Link>
  ) : (
    <button
      onClick={handleClick}
      className={cn(
        buttonVariants({
          variant: 'ghost',
          size: 'sm',
        }),
        'h-12 justify-start text-wrap rounded-none px-6',
        subLink && 'h-10 w-full border-l border-l-slate-500 px-2',
        title === 'Home' ? 'hidden md:flex' : '', // hide Home on mobile
        title === 'Home' && !currentContent && !isCollapsed ? 'underline' : ''

      )}
      aria-current={checkActiveNav(componentPath ?? '') ? 'page' : undefined}
    >
      {linkContent}
    </button>
  )
}

function NavLinkDropdown({
  title,
  icon,
  label,
  sub,
  closeNav,
  setCurrentContent,
}: NavLinkProps) {
  const { checkActiveNav } = useCheckActiveNav()

  const isChildActive = !!sub?.find((s) => checkActiveNav(s.componentPath ?? ''))

  return (
    <Collapsible defaultOpen={isChildActive}>
      <CollapsibleTrigger
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'group h-12 w-full justify-start rounded-none px-6'
        )}
      >
        <div className='mr-2'>{icon}</div>
        {title}
        {label && (
          <div className='ml-2 rounded-lg bg-primary px-1 text-[0.625rem] text-primary-foreground'>
            {label}
          </div>
        )}
        <span
          className={cn(
            'ml-auto transition-all group-data-[state="open"]:-rotate-180'
          )}
        >
          <ChevronLeft />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {sub?.map((item) => (
          <NavLink
            key={item.componentPath}
            {...item}
            subLink
            closeNav={closeNav}
            setCurrentContent={setCurrentContent}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

interface NavLinkIconProps {
  link: SideLink
  isCollapsed: boolean
  currentContent: SideLink | null
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  setCurrentContent: (content: SideLink | null) => void
  closeNav: () => void
}

export function NavLinkIcon({
  link,
  isCollapsed,
  currentContent,
  setIsCollapsed,
  setCurrentContent,
  closeNav,
}: NavLinkIconProps) {
  const { checkActiveNav } = useCheckActiveNav()
  const handleClick = () => {

    // special case for Home
    if (link.title === 'Home') {
      if (isCollapsed) { // if the nav is collapsed, open it
        // meets condition if click home and the nav is closed
        setIsCollapsed(false)
        // check if there is a title attribute, Home doesn't have a title attribute, if we click Home again, we want to close the nav
      } else if (!isCollapsed && currentContent?.title !== undefined) {
        // meets condition if on a menu item component and clicking Home
        setCurrentContent(null)
      } else { // if the nav is open, close it
        // meets condition if on Home and clicking Home
        setCurrentContent(null)
        setIsCollapsed(true)
      }
      setCurrentContent(null)
      return
    }

    if (link.href) {
      closeNav()
      return
    }

    if (isCollapsed) {
      setIsCollapsed(false)
    }

    if (!isCollapsed && currentContent?.title === link.title) {
      setCurrentContent(null)
      setIsCollapsed(true)
    } else {
      setCurrentContent(link)
    }
  }

  return link.href ? (
    <Link
      target='_blank'
      to={link.href}
      className={cn(
        buttonVariants({
          variant: 'ghost',
          size: 'icon',
        }),
        'h-12 w-10 justify-center rounded-none transition-transform duration-200 ease-in-out',
        // checkActiveNav(link.title ?? '') ? 'bg-accent text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground'

      )}
      aria-current={checkActiveNav(link.componentPath ?? '') ? 'page' : undefined}
    >
      {/* {link.icon} */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {link.icon}
          </TooltipTrigger>
          <TooltipContent side='right' className="z-50 bg-secondary text-base text-secondary-foreground">
            <p>{link.title}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Link>
  ) : (
    <Button
      variant="ghost"
      size="icon"
      aria-label={link.title}
      className={cn('h-12 w-10 justify-center rounded-none transition-transform duration-200 ease-in-out z-50',
        isCollapsed ? '' : 'rotate-0',
        checkActiveNav(link.title ?? '') ? 'bg-accent text-primary-foreground text-white dark:text-black' : 'hover:bg-accent hover:text-accent-foreground',        // home can be active when currentContent is null
        link.title === 'Home' && !currentContent && !isCollapsed ? 'bg-accent text-accent-foreground' : ''
      )}
      onClick={handleClick}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {link.icon}
          </TooltipTrigger>
          <TooltipContent side='right' className="z-50 bg-secondary text-base text-secondary-foreground">
            <p>{link.title}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </Button>
  )
}


// function NavLinkIconDropdown({ title, icon, label, sub }: NavLinkProps) {
//   const { checkActiveNav } = useCheckActiveNav()

//   /* Open collapsible by default
//    * if one of child element is active */
//   const isChildActive = !!sub?.find((s) => checkActiveNav(s.href))

//   return (
//     <DropdownMenu>
//       <Tooltip delayDuration={0}>
//         <TooltipTrigger asChild>
//           <DropdownMenuTrigger asChild>
//             <Button
//               variant={isChildActive ? 'secondary' : 'ghost'}
//               size='icon'
//               className='h-12 w-12'
//             >
//               {icon}
//             </Button>
//           </DropdownMenuTrigger>
//         </TooltipTrigger>
//         <TooltipContent side='right' className='flex items-center gap-4'>
//           {title}{' '}
//           {label && (
//             <span className='ml-auto text-muted-foreground'>{label}</span>
//           )}
//           <IconChevronDown
//             size={18}
//             className='-rotate-90 text-muted-foreground'
//           />
//         </TooltipContent>
//       </Tooltip>
//       <DropdownMenuContent side='right' align='start' sideOffset={4}>
//         <DropdownMenuLabel>
//           {title} {label ? `(${label})` : ''}
//         </DropdownMenuLabel>
//         <DropdownMenuSeparator />
//         {sub!.map(({ title, icon, label, href }) => (
//           <DropdownMenuItem key={`${title}-${href}`} asChild>
//             <Link
//               to={href}
//               className={`${checkActiveNav(href) ? 'bg-secondary' : ''}`}
//             >
//               {icon} <span className='ml-2 max-w-52 text-wrap'>{title}</span>
//               {label && <span className='ml-auto text-xs'>{label}</span>}
//             </Link>
//           </DropdownMenuItem>
//         ))}
//       </DropdownMenuContent>
//     </DropdownMenu>
//   )
// }
