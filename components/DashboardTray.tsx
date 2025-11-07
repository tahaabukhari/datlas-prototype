import React from 'react';
import { ProcessedDashboard } from '../lib/plotlyPipeline';
import PlotlyDash from './PlotlyDash';

const DashboardTray: React.FC<{ dashboard: ProcessedDashboard }> = ({ dashboard }) => {
  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto animate-fade-in">
      <div className="flex-shrink-0">
        <h2 className="text-xl font-semibold tracking-wide text-gray-100">{dashboard.title}</h2>
        <p className="text-sm text-gray-400 mt-1">{dashboard.desc}</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
        {dashboard.charts.map((chart, i) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex flex-col">
            <h3 className="text-sm text-gray-300 mb-2 font-medium flex-shrink-0">{chart.instructions.layout.title}</h3>
            <div className="flex-grow min-h-64">
              <PlotlyDash fig={chart.figure} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DashboardTray;
