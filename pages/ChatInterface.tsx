import React from 'react';
import MainCenter from '../components/MainCenter';
import RightSideBar from '../components/RightSideBar';
import { useUI } from '../context/UIContext';

const ChatInterface: React.FC = () => {
    const { mobileNavState, closeSidebars } = useUI();
    return (
        <div className="flex flex-1 h-full overflow-hidden relative">
            {mobileNavState !== 'none' && (
                <div 
                    onClick={closeSidebars}
                    className="fixed inset-0 bg-black/60 z-40 md:hidden"
                    aria-hidden="true"
                />
            )}
            <MainCenter />
            <RightSideBar />
        </div>
    );
};

export default ChatInterface;
