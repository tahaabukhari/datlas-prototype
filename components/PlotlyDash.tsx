import React, { useEffect, useRef } from 'react';
import { PlotlyFigure } from '../types';

// Plotly is available globally from the script tag in index.html
declare var Plotly: any;

const PlotlyDash: React.FC<{ fig: PlotlyFigure }> = ({ fig }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !fig || !fig.data?.length) return;
    
    Plotly.newPlot(ref.current, fig.data, fig.layout, { responsive: true, displayModeBar: false });
    
    return () => {
      if (ref.current) {
        Plotly.purge(ref.current);
      }
    };
  }, [fig]);

  return <div ref={ref} className="w-full h-full min-h-[300px]" />;
}

export default PlotlyDash;