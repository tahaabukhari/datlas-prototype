import React, { createContext, useState, useContext, ReactNode } from 'react';
import { DashboardContent } from '../types';

interface DashboardContextType {
  plots: DashboardContent[];
  addPlot: (plot: DashboardContent) => void;
  clearPlots: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [plots, setPlots] = useState<DashboardContent[]>([]);

  const addPlot = (plot: DashboardContent) => {
    // For now, only show the latest plot
    setPlots([plot]);
  };
  
  const clearPlots = () => {
    setPlots([]);
  };

  return (
    <DashboardContext.Provider value={{ plots, addPlot, clearPlots }}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};