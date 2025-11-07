import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFiles } from '../context/FileContext';
import { useUI } from '../context/UIContext';
import { 
    ChevronLeftIcon, PlusIcon, CircleStackIcon, ClockIcon, InformationCircleIcon, ArrowRightOnRectangleIcon, DocumentTextIcon, XMarkIcon, ArrowPathIcon
} from '@heroicons/react/24/outline';

const LeftSideBar: React.FC = () => {
    const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
    const { user, isAuthenticated, signIn } = useAuth();
    const { files, addFiles, removeFile } = useFiles();
    const { mobileNavState, closeSidebars, isDashboardOpen } = useUI();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddDatasetClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        addFiles(event.target.files);
        if(event.target) {
            event.target.value = '';
        }
    };
    
    const isMobileOpen = mobileNavState === 'left';
    const effectiveIsCollapsed = isDesktopCollapsed || isDashboardOpen;

    return (
        <aside
            className={`
                flex flex-col bg-zinc-975 border-r border-zinc-800 
                transform transition-transform duration-300 ease-in-out
                md:relative md:translate-x-0 md:transition-all md:duration-200
                ${effectiveIsCollapsed ? 'md:w-16' : 'md:w-64'}
                ${isMobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}
                fixed inset-y-0 left-0 z-50 w-full
            `}
        >
            <div className="flex-1 flex flex-col overflow-y-auto">
                {/* Top Section */}
                <div className={`p-4 flex items-center ${effectiveIsCollapsed ? 'md:justify-center' : 'justify-between'}`}>
                     <div className={effectiveIsCollapsed ? 'md:hidden' : 'block'}>
                         <h1 className="text-2xl font-bold tracking-wider">DATLAS</h1>
                     </div>
                     <h1 className={`text-2xl font-bold ${effectiveIsCollapsed ? 'hidden md:block' : 'hidden'}`}>D</h1>
                     <button onClick={closeSidebars} className="p-1 text-gray-400 hover:text-white md:hidden" aria-label="Close menu">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>
                
                <div className={`p-4 ${effectiveIsCollapsed ? 'md:flex md:justify-center' : ''}`}>
                    {isAuthenticated && user ? (
                        <div className="flex items-center space-x-3">
                            <img src={user.image} alt="User Avatar" className="w-8 h-8 rounded-full" />
                            <div className={`overflow-hidden ${effectiveIsCollapsed ? 'md:hidden' : 'block'}`}>
                                <p className="text-sm font-medium truncate">{user.name}</p>
                                <p className="text-xs text-gray-400 truncate">{user.email}</p>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={signIn}
                            className={`w-full flex justify-center items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-sm font-semibold py-2 px-4 rounded-md transition-colors duration-200 ${effectiveIsCollapsed ? 'md:p-2' : ''}`}
                        >
                           {effectiveIsCollapsed ? <ArrowRightOnRectangleIcon className="h-5 w-5" /> : 'Google Sign-In'}
                        </button>
                    )}
                </div>

                {/* Main Navigation */}
                <nav className="flex-1 px-4 py-4 space-y-8">
                    {/* Datasets Section */}
                    <div onClick={effectiveIsCollapsed ? () => setIsDesktopCollapsed(false) : undefined} className={effectiveIsCollapsed ? 'cursor-pointer' : ''}>
                        <div className={`flex items-center text-sm font-semibold text-gray-500 uppercase tracking-wider ${effectiveIsCollapsed ? 'md:justify-center' : 'pl-2'}`}>
                            <CircleStackIcon className={`h-4 w-4 ${effectiveIsCollapsed ? '' : 'mr-2'}`} />
                            <span className={effectiveIsCollapsed ? 'md:hidden' : 'inline'}>Datasets</span>
                        </div>
                        <div className="mt-3 space-y-2">
                           <button onClick={handleAddDatasetClick} className={`w-full flex items-center justify-center p-2 text-sm rounded-lg border border-zinc-700 text-gray-300 hover:bg-zinc-800 hover:border-zinc-600 transition-all duration-200 group ${effectiveIsCollapsed ? 'md:px-0' : 'space-x-2'}`}>
                                <PlusIcon className="h-5 w-5 text-gray-400 group-hover:text-gray-200" />
                                <span className={effectiveIsCollapsed ? 'md:hidden' : 'inline'}>Add dataset</span>
                           </button>
                           <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                className="hidden"
                                multiple
                            />
                            {effectiveIsCollapsed ? null : files.length > 0 ? (
                                <ul className="space-y-2 pt-2">
                                    {files.map(file => (
                                        <li key={file.url} className="flex items-center justify-between text-sm text-gray-300 bg-zinc-800/50 p-2 rounded-md group" title={file.errorMessage}>
                                            <div className="flex items-center min-w-0">
                                                <DocumentTextIcon className="h-4 w-4 mr-2 shrink-0" />
                                                <span className="truncate" title={file.name}>{file.name}</span>
                                            </div>
                                            <div className="ml-2">
                                                {file.status === 'uploading' && <ArrowPathIcon className="h-4 w-4 text-zinc-400 animate-spin" />}
                                                {file.status === 'ready' && (
                                                    <button onClick={() => removeFile(file.url)} className="text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <XMarkIcon className="h-4 w-4" />
                                                    </button>
                                                )}
                                                {file.status === 'error' && (
                                                    <div className="w-4 h-4 text-red-500" title={file.errorMessage}>!</div>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                               <div className="text-center text-gray-500 text-sm px-2 py-4">
                                   No datasets added
                               </div>
                            )}
                        </div>
                    </div>

                    {/* History Section */}
                    <div onClick={effectiveIsCollapsed ? () => setIsDesktopCollapsed(false) : undefined} className={effectiveIsCollapsed ? 'cursor-pointer' : ''}>
                        <div className={`flex items-center text-sm font-semibold text-gray-500 uppercase tracking-wider ${effectiveIsCollapsed ? 'md:justify-center' : 'pl-2'}`}>
                           <ClockIcon className={`h-4 w-4 ${effectiveIsCollapsed ? '' : 'mr-2'}`} />
                           <span className={effectiveIsCollapsed ? 'md:hidden' : 'inline'}>History</span>
                        </div>
                        <div className="mt-3 text-center text-gray-500 text-sm px-2 py-4">
                           {effectiveIsCollapsed ? '...' : 'No dashboards yet'}
                        </div>
                    </div>

                     {/* About Section */}
                     <div onClick={effectiveIsCollapsed ? () => setIsDesktopCollapsed(false) : undefined} className={effectiveIsCollapsed ? 'cursor-pointer' : ''}>
                        <div className={`flex items-center text-sm font-semibold text-gray-500 uppercase tracking-wider ${effectiveIsCollapsed ? 'md:justify-center' : 'pl-2'}`}>
                           <InformationCircleIcon className={`h-4 w-4 ${effectiveIsCollapsed ? '' : 'mr-2'}`} />
                           <span className={effectiveIsCollapsed ? 'md:hidden' : 'inline'}>About</span>
                        </div>
                        <div className={`mt-3 text-left text-gray-500 text-sm px-2 ${effectiveIsCollapsed ? 'md:hidden' : ''}`}>
                           DATLAS is a data-centric AI chat interface.
                        </div>
                    </div>
                </nav>
            </div>
            {/* Collapse Button */}
            <div className="p-2 border-t border-zinc-800 hidden md:block">
                <button
                    onClick={() => setIsDesktopCollapsed(!isDesktopCollapsed)}
                    className="w-full flex justify-center items-center p-2 text-gray-400 rounded-md hover:bg-zinc-800 hover:text-gray-200 transition-colors duration-200"
                    aria-label={effectiveIsCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    disabled={isDashboardOpen}
                >
                    <ChevronLeftIcon className={`w-6 h-6 transform transition-transform duration-200 ${ effectiveIsCollapsed ? 'rotate-180' : 'rotate-0'}`} />
                </button>
            </div>
        </aside>
    );
};

export default LeftSideBar;