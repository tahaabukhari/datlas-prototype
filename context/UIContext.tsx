import React, { createContext, useState, useContext, ReactNode } from 'react';

type MobileNavState = 'none' | 'left' | 'right';

interface UIContextType {
    mobileNavState: MobileNavState;
    openLeftSidebar: () => void;
    openRightSidebar: () => void;
    closeSidebars: () => void;
    isDashboardOpen: boolean;
    openDashboard: () => void;
    closeDashboard: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [mobileNavState, setMobileNavState] = useState<MobileNavState>('none');
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);

    const openLeftSidebar = () => setMobileNavState('left');
    const openRightSidebar = () => setMobileNavState('right');
    const closeSidebars = () => setMobileNavState('none');
    const openDashboard = () => setIsDashboardOpen(true);
    const closeDashboard = () => setIsDashboardOpen(false);

    return (
        <UIContext.Provider value={{ 
            mobileNavState, openLeftSidebar, openRightSidebar, closeSidebars,
            isDashboardOpen, openDashboard, closeDashboard
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (context === undefined) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};