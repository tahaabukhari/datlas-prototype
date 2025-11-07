import React, { createContext, useState, useContext, ReactNode } from 'react';
import { DashboardContent } from '../types';
import { ProcessedDashboard } from '../lib/plotlyPipeline';

export type DashboardItem = { id: string; descriptor: ProcessedDashboard };

interface DashboardContextType {
  plots: DashboardContent[];
  addPlot: (plot: DashboardContent) => void;
  clearPlots: () => void;
  dashboards: DashboardItem[];
  addDashboard: (dashboard: DashboardItem) => void;
  clearDashboards: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [plots, setPlots] = useState<DashboardContent[]>([]);
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);

  const addPlot = (plot: DashboardContent) => {
    setDashboards([]); // Clear dashboards when a single plot is added
    setPlots([plot]);
  };
  
  const clearPlots = () => {
    setPlots([]);
  };
  
  const addDashboard = (dashboard: DashboardItem) => {
    setPlots([]); // Clear single plots when a dashboard is added
    setDashboards([dashboard]);
  };

  const clearDashboards = () => {
    setDashboards([]);
  };

  return (
    <DashboardContext.Provider value={{ plots, addPlot, clearPlots, dashboards, addDashboard, clearDashboards }}>
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