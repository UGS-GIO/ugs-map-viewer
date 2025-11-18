import { createContext, useContext, ReactNode } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';

type PopupViewMode = 'card' | 'table';

interface PopupViewContextType {
    defaultViewMode: PopupViewMode;
    setDefaultViewMode: (mode: PopupViewMode) => void;
}

const PopupViewContext = createContext<PopupViewContextType | undefined>(undefined);

export function PopupViewProvider({ children }: { children: ReactNode }) {
    const search = useSearch({ strict: false }) as { popup_view?: PopupViewMode };
    const navigate = useNavigate();
    const defaultViewMode = search.popup_view || 'card';

    const setDefaultViewMode = (mode: PopupViewMode) => {
        navigate({
            to: '.',
            search: (prev) => ({
                ...prev,
                popup_view: mode,
            }),
            replace: true,
        });
    };

    return (
        <PopupViewContext.Provider value={{ defaultViewMode, setDefaultViewMode }}>
            {children}
        </PopupViewContext.Provider>
    );
}

export function usePopupView() {
    const context = useContext(PopupViewContext);
    if (context === undefined) {
        throw new Error('usePopupView must be used within a PopupViewProvider');
    }
    return context;
}
