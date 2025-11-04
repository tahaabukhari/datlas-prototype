import React, { useState } from 'react';
import { useUI } from '../context/UIContext';
import { usePyodide } from '../context/PyodideContext';
import { useDashboard } from '../context/DashboardContext';
import { ChevronRightIcon, XMarkIcon, CodeBracketIcon, SpinnerIcon } from './icons';

const RightSideBar: React.FC = () => {
    const { mobileNavState, closeSidebars, isDashboardOpen, closeDashboard } = useUI();
    const { isPyodideReady, pyodideMessage } = usePyodide();
    const { plots } = useDashboard();
    const [showCode, setShowCode] = useState(false);
    
    const isMobileOpen = mobileNavState === 'right';
    const latestPlot = plots.length > 0 ? plots[0] : null;

    const handleClose = () => {
        closeDashboard();
    };

    return (
        <aside className={`
            flex flex-col bg-zinc-975/70 backdrop-blur-sm border-l border-zinc-800 
            transform transition-all duration-300 ease-in-out
            md:static md:translate-x-0 overflow-hidden
            ${isDashboardOpen ? 'md:w-1/2 xl:w-2/5' : 'md:w-0 border-l-0'}
            ${isMobileOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full'}
            fixed inset-y-0 right-0 z-50 w-full
        `}>
            <div className="flex items-center justify-between p-2 border-b border-zinc-800 flex-shrink-0">
                <button
                    onClick={handleClose}
                    className="p-2 text-gray-400 rounded-md hover:bg-zinc-800 hover:text-gray-200 transition-colors duration-200 hidden md:block"
                    aria-label={'Collapse dashboard'}
                >
                    <ChevronRightIcon className={`w-6 h-6 transform transition-transform duration-200 'rotate-0'`} />
                </button>
                <div className={`font-semibold text-gray-200 transition-opacity duration-200 ${isDashboardOpen ? 'opacity-100' : 'opacity-0'}`}>Dashboard</div>
                 <button onClick={closeSidebars} className="p-2 text-gray-400 rounded-md hover:bg-zinc-800 hover:text-gray-200 md:hidden" aria-label="Close dashboard">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="flex-1 flex flex-col p-4 overflow-y-auto min-w-full">
                {!isPyodideReady && isDashboardOpen ? (
                    <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
                        <SpinnerIcon className="w-8 h-8 text-gray-400 mb-4" />
                        <p className="text-gray-300 font-semibold">{pyodideMessage}</p>
                        <p className="text-gray-500 text-sm mt-1">This may take a minute on first load.</p>
                    </div>
                ) : latestPlot ? (
                    <div className="animate-fade-in space-y-4">
                        <h3 className="text-lg font-semibold text-gray-100">{latestPlot.description}</h3>
                        <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                             <img src={latestPlot.plotData} alt="Generated plot" className="w-full h-auto rounded" />
                        </div>
                        <div>
                            <button onClick={() => setShowCode(!showCode)} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
                                <CodeBracketIcon className="w-5 h-5" />
                                {showCode ? 'Hide' : 'Show'} Code
                            </button>
                            {showCode && (
                                <pre className="mt-2 bg-zinc-900 text-xs text-gray-300 p-3 rounded-lg border border-zinc-800 overflow-x-auto animate-fade-in">
                                    <code>{latestPlot.code}</code>
                                </pre>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className={`flex items-center justify-center h-full text-center text-gray-500 transition-opacity duration-200 ${isDashboardOpen ? 'opacity-100' : 'opacity-0'}`}>
                        Nothing to see here... yet.
                    </div>
                )}
            </div>
        </aside>
    );
};

export default RightSideBar;