import React, { useEffect, useRef } from 'react';
import { useUI } from '../context/UIContext';
import { useDashboard } from '../context/DashboardContext';
import { ChevronRightIcon, ChartBarIcon } from '@heroicons/react/24/outline';

// vegaEmbed is available globally from the script tag in index.html
declare global {
    interface Window {
        vegaEmbed: (el: HTMLElement | string, spec: object, opts?: object) => Promise<any>;
    }
}

const RightSideBar: React.FC = () => {
    const { mobileNavState, closeSidebars, isDashboardOpen, closeDashboard } = useUI();
    const { plots } = useDashboard();
    const chartContainer = useRef<HTMLDivElement>(null);

    const isMobileOpen = mobileNavState === 'right';
    const latestPlot = plots.length > 0 ? plots[0] : null;

    useEffect(() => {
        if (latestPlot && latestPlot.spec && chartContainer.current) {
            // Clear previous chart before embedding a new one
            chartContainer.current.innerHTML = '';
            window.vegaEmbed(chartContainer.current, latestPlot.spec, { actions: false })
                .catch(error => console.error("Vega-Embed Error:", error));
        }
    }, [latestPlot]);

    const handleClose = () => {
        closeDashboard();
        closeSidebars();
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
                    className="p-2 text-gray-400 rounded-md hover:bg-zinc-800 hover:text-gray-200 transition-colors duration-200"
                    aria-label={'Collapse dashboard'}
                >
                    <ChevronRightIcon className="h-6 w-6" />
                </button>
                <div className={`font-semibold text-gray-200 transition-opacity duration-200 ${isDashboardOpen ? 'opacity-100' : 'opacity-0'}`}>Dashboard</div>
                {/* The top-right button is now unified */}
                 <div className="w-10 h-10" />
            </div>
            <div className="flex-1 flex flex-col p-4 overflow-y-auto min-w-full">
                {latestPlot ? (
                    <div className="animate-fade-in space-y-4">
                        <div
                            className="prose prose-invert prose-sm text-gray-300"
                            dangerouslySetInnerHTML={{ __html: latestPlot.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                        />
                        <div ref={chartContainer} className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 w-full min-h-[300px]">
                             {/* Vega-Embed will render the chart here */}
                        </div>
                    </div>
                ) : (
                    <div className={`flex flex-col items-center justify-center h-full text-center text-gray-500 transition-opacity duration-200 ${isDashboardOpen ? 'opacity-100' : 'opacity-0'}`}>
                        <ChartBarIcon className="h-12 w-12 mb-4 text-zinc-600" />
                        <h3 className="font-semibold text-lg text-zinc-400">Dashboard is Ready</h3>
                        <p>Ask for a chart to see it visualized here.</p>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default RightSideBar;