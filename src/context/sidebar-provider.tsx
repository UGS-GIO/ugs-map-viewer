import Info from '@/components/sidebar/info';
import { SideLink } from '@/lib/types/sidelink-types';
import { useGetSidebarLinks } from '@/hooks/use-get-sidebar-links';
import { InfoIcon } from 'lucide-react';
import React, { createContext, useState, ReactNode, Dispatch, SetStateAction, useCallback, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';

export type SidebarWidth = 'icon' | 'wide' | 'narrow';

// Pixel width constraints for drag-to-resize
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 600;
// Original widths: md:w-96 (384px), xl:w-[32rem] (512px)
export const SIDEBAR_WIDTH_MD = 384;
export const SIDEBAR_WIDTH_XL = 512;

// Get initial width based on screen size (runs at module load)
const getInitialSidebarWidth = () => {
    if (typeof window === 'undefined') return SIDEBAR_WIDTH_XL;
    return window.innerWidth >= 1280 ? SIDEBAR_WIDTH_XL : SIDEBAR_WIDTH_MD;
};

interface SidebarContextProps {
    currentContent: SideLink | null;
    setCurrentContent: (content: SideLink | null) => void;
    isCollapsed: boolean;
    setIsCollapsed: Dispatch<SetStateAction<boolean>>;
    sidebarWidth: SidebarWidth;
    setSidebarWidth: (width: SidebarWidth) => void;
    sidebarWidthPx: number;
    setSidebarWidthPx: (width: number) => void;
    navOpened: boolean;
    setNavOpened: Dispatch<SetStateAction<boolean>>;
}

export const SidebarContext = createContext<SidebarContextProps>({
    currentContent: null,
    setCurrentContent: () => null,
    isCollapsed: false,
    setIsCollapsed: () => false,
    sidebarWidth: 'wide',
    setSidebarWidth: () => {},
    sidebarWidthPx: SIDEBAR_WIDTH_XL,
    setSidebarWidthPx: () => {},
    navOpened: false,
    setNavOpened: () => false,
});

const defaultInfoLink: SideLink = {
    title: 'Info',
    label: '',
    icon: <InfoIcon className='stroke-foreground' />,
    component: Info,
    componentPath: 'src/components/sidebar/info.tsx',
};

export const SidebarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const navigate = useNavigate();
    const search = useSearch({ from: '/_map' });

    const { data: dynamicLinks } = useGetSidebarLinks();
    const [navOpened, setNavOpened] = useState<boolean>(false);
    const [sidebarWidthPx, setSidebarWidthPx] = useState<number>(getInitialSidebarWidth);

    const allAvailableLinks = useMemo(() => {
        return dynamicLinks ? [defaultInfoLink, ...dynamicLinks] : [defaultInfoLink];
    }, [dynamicLinks]);

    // --- Derive State From URL ---
    const currentTab = search.tab;
    const isCollapsed = search.sidebar_collapsed;
    const sidebarWidth = search.sidebar_width || 'wide';

    const currentContent =
        currentTab === 'home'
            ? null
            : allAvailableLinks.find(
                (link) => link.title.toLowerCase() === currentTab?.toLowerCase()
            ) || null;

    // --- URL-Updating Setters ---
    const handleSetCurrentContent = useCallback((content: SideLink | null) => {
        const newTab = content ? content.title.toLowerCase() : 'home';
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                tab: newTab,
            }),
            replace: true,
        });
    }, [navigate]);

    const handleSetIsCollapsed = useCallback((value: boolean | ((prevState: boolean) => boolean)) => {
        const newCollapsedValue = typeof value === 'function' ? value(isCollapsed) : value;
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                sidebar_collapsed: newCollapsedValue ? true : undefined,
            }),
            replace: true,
        });
    }, [navigate, isCollapsed]);

    const handleSetSidebarWidth = useCallback((width: SidebarWidth) => {
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                sidebar_width: width,
            }),
            replace: true,
        });
    }, [navigate]);

    return (
        <SidebarContext.Provider
            value={{
                currentContent,
                setCurrentContent: handleSetCurrentContent,
                isCollapsed,
                setIsCollapsed: handleSetIsCollapsed,
                sidebarWidth,
                setSidebarWidth: handleSetSidebarWidth,
                sidebarWidthPx,
                setSidebarWidthPx,
                navOpened,
                setNavOpened,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
};