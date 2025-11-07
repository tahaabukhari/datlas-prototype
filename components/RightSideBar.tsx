import React from 'react';
import { useUI } from '../context/UIContext';
import { useDashboard } from '../context/DashboardContext';
import { ChevronRightIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import PlotlyDash from './PlotlyDash';
import DashboardTray from './DashboardTray';

const RightSideBar: React.FC = () => {
    const { mobileNavState, closeSidebars, isDashboardOpen, closeDashboard } = useUI();
    const { plots, dashboards } = useDashboard();

    const isMobileOpen = mobileNavState === 'right';
    const latestPlot = plots.length > 0 ? plots[0] : null;
    const latestDashboard = dashboards.length > 0 ? dashboards[0] : null;

    const handleClose = () => {
        closeDashboard();
        closeSidebars();
    };

    const hasContent = latestDashboard || latestPlot;

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
                 <div className="w-10 h-10" />
            </div>
            <div className="flex-1 flex flex-col overflow-y-auto min-w-full">
                {latestDashboard ? (
                     <DashboardTray dashboard={latestDashboard.descriptor} />
                ) : latestPlot ? (
                    <div className="animate-fade-in space-y-4 p-4">
                        <div
                            className="prose prose-invert prose-sm text-gray-300"
                            dangerouslySetInnerHTML={{ __html: latestPlot.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                        />
                        <div className="bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 w-full">
                           <PlotlyDash fig={latestPlot.figure} />
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