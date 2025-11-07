import { GoogleGenAI } from '@google/genai';
import { parse } from 'csv-parse/sync';
import { PlotlyFigure } from '../types';

export type PlotlyInstructions = {
  type: 'line' | 'bar' | 'scatter' | 'heatmap' | 'box' | 'violin' | 'histogram' | 'sunburst' | 'treemap';
  traces: {
    x: string;
    y: string;
    z?: string;
    name?: string;
    mode?: 'lines' | 'markers' | 'lines+markers';
    marker?: { color: string; size?: number };
    line?: { shape?: 'linear' | 'spline'; width?: number };
    groups?: string; // For aggregation grouping
    transforms?: {
      type: 'aggregate' | 'filter' | 'groupby';
      aggregations?: { target: string; func: 'sum' | 'avg' | 'min' | 'max'; enabled?: boolean }[];
      filters?: { target: string; operation: '>' | '<' | '>=' | '<=' | '==' | '!='; value: string | number }[];
    }[];
  }[];
  layout: {
    title: string;
    xaxis: { title: string };
    yaxis: { title: string };
    paper_bgcolor: 'transparent';
    plot_bgcolor: 'transparent';
    font: { color: '#fff' };
    margin: { l: number; r: number; t: number; b: number };
    barmode?: 'group' | 'stack' | 'overlay';
    bargap?: number;
    grid?: { rows: number; columns: number; pattern: 'independent' };
  };
  desc: string;
};

// From Gemini
export type DashboardDescriptor = {
  title: string;
  charts: PlotlyInstructions[];
  globalFilters?: { field: string; op: '>' | '<' | '==' | '!='; value: string | number }[];
  desc: string;
};

// Processed for rendering
export type ProcessedDashboard = {
    title: string;
    desc: string;
    charts: {
        figure: PlotlyFigure;
        instructions: PlotlyInstructions;
    }[];
};

export type PipelineResult =
  | { kind: 'single'; data: { fig: PlotlyFigure, desc: string } }
  | { kind: 'dashboard'; data: ProcessedDashboard };
  
type RawAnalysisResult = {
    mode: 'single' | 'dashboard';
    single: PlotlyInstructions;
    dashboard: DashboardDescriptor;
};


const MAX_ROWS = 1000;

async function analyseRequest(prompt: string, headers: string[]): Promise<RawAnalysisResult> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const headersString = headers.join(', ');

    const system = `You are Plotly-Dashboard-Builder 4.0.
You receive:
- User request
- CSV column headers

Reply **only** JSON of shape:
{
  "mode": "single" | "dashboard",
  "single": { ...PlotlyInstructions },
  "dashboard": {
    "title": "string",
    "charts": [ {...PlotlyInstructions}, ... ],
    "globalFilters": [{field, op, value}, ...],
    "desc": "string"
  }
}

Rules:
- Use **only column names that exist** in the header.
- If user asks for **multiple views**, **comparisons**, **by region**, **over time**, **summary + detail**, etc. -> set mode:"dashboard".
- If user asks for **one chart** -> set mode:"single".
- Colours: midnight palette (#fff #22d3ee #a78bfa #f472b6 #fbbf24 #34d499).
- Reply **only JSON**, no markdown.`;
    
    const fullPrompt = `${system}\n\nUser request: "${prompt}"\n\nCSV Headers:\n${headersString}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: fullPrompt,
            config: { responseMimeType: "application/json" },
        });
        
        const jsonText = response.text.trim();
        const instructions = JSON.parse(jsonText);
        
        const sanitizeInstructions = (instr: PlotlyInstructions) => {
            if (!instr) return null;
            instr.layout.paper_bgcolor = 'transparent';
            instr.layout.plot_bgcolor = 'transparent';
            instr.layout.font = { color: '#fff' };
            instr.layout.margin = { l: 60, r: 20, t: 40, b: 60, ...(instr.layout.margin || {}) };
            return instr;
        };

        if (instructions.mode === 'dashboard' && instructions.dashboard?.charts) {
            instructions.dashboard.charts = instructions.dashboard.charts.map(sanitizeInstructions);
        } else if (instructions.mode === 'single' && instructions.single) {
            instructions.single = sanitizeInstructions(instructions.single);
        }
        
        return instructions as RawAnalysisResult;

    } catch (e) {
        console.error("Error calling Gemini API or parsing response:", e);
        if (e instanceof Error) {
           throw new Error(`AI analysis failed: ${e.message}`);
        }
        throw new Error("AI failed to generate valid plot instructions. The response might be malformed or the API call failed.");
    }
}

function evalExpr(cell: any, op: string, val: any) {
  const n = Number(cell);
  const v = Number(val);
  switch (op) {
    case '>':  return n > v;
    case '<':  return n < v;
    case '>=': return n >= v;
    case '<=': return n <= v;
    case '==': return cell == val;
    case '!=': return cell != val;
    default:   return true;
  }
}

function applyTransforms(rows: any[], t: PlotlyInstructions['traces'][0]) {
  let out = [...rows];
  for (const tx of t.transforms ?? []) {
    if (tx.type === 'filter' && tx.filters) {
      for (const f of tx.filters) {
        if (!f.target || !f.operation || f.value === undefined) continue;
        out = out.filter(r => evalExpr(r[f.target], f.operation, f.value));
      }
    }
    if (tx.type === 'aggregate' && tx.aggregations) {
      const groups = new Map<string, any[]>();
      for (const r of out) {
        const key = t.groups ? String(r[t.groups]) : 'all';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(r);
      }
      out = Array.from(groups.entries()).map(([g, arr]) => {
        const row: any = { [t.groups ?? 'group']: g };
        for (const agg of tx.aggregations!) {
          if (!agg.target || !agg.func) continue;
          const vals = arr.map(r => Number(r[agg.target])).filter(v => !isNaN(v));
          if (vals.length === 0) {
              row[agg.target] = 0;
              continue;
          }
          row[agg.target] = agg.func === 'sum' ? vals.reduce((a, b) => a + b, 0)
                             : agg.func === 'avg' ? vals.reduce((a, b) => a + b, 0) / vals.length
                             : agg.func === 'max' ? Math.max(...vals)
                             : agg.func === 'min' ? Math.min(...vals)
                             : vals[0];
        }
        return row;
      });
    }
  }
  return out;
}

const BUILDERS: Record<string, (t: any, rows: any[]) => any> = {
    line: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), type: 'scatter', mode: t.mode || 'lines+markers', name: t.name, marker: t.marker, line: t.line }),
    bar: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), type: 'bar', name: t.name, marker: t.marker }),
    scatter: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), type: 'scatter', mode: 'markers', name: t.name, marker: t.marker }),
    heatmap: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), z: rows.map(r => r[t.z] ?? 0), type: 'heatmap', colorscale: 'Viridis' }),
    box: (t, rows) => ({ y: rows.map(r => r[t.y]), x: t.x ? rows.map(r => r[t.x]) : undefined, type: 'box', name: t.name, marker: t.marker }),
    violin: (t, rows) => ({ y: rows.map(r => r[t.y]), x: t.x ? rows.map(r => r[t.x]) : undefined, type: 'violin', name: t.name, marker: t.marker }),
    histogram: (t, rows) => ({ x: rows.map(r => r[t.x]), type: 'histogram', name: t.name, marker: t.marker }),
    sunburst: (t, rows) => ({ labels: rows.map(r => r[t.x]), parents: rows.map(r => r[t.y]), values: rows.map(r => r[t.z]), type: 'sunburst', name: t.name }),
    treemap: (t, rows) => ({ labels: rows.map(r => r[t.x]), parents: rows.map(r => r[t.y]), values: rows.map(r => r[t.z]), type: 'treemap', name: t.name }),
};

async function buildPlot(instructions: PlotlyInstructions, allRows: any[]): Promise<{ fig: PlotlyFigure; desc: string }> {
    try {
        const cappedRows = allRows.slice(0, MAX_ROWS);
        const builderFn = BUILDERS[instructions.type];
        if (!builderFn) {
            throw new Error(`Unknown plot type: ${instructions.type}`);
        }

        const data = instructions.traces.map(trace => {
            const transformedRows = applyTransforms(cappedRows, trace);
            const newTrace = {...trace};
            if(trace.transforms?.some(tx => tx.type === 'aggregate') && trace.groups) {
                newTrace.x = trace.groups;
                newTrace.y = trace.transforms.find(tx => tx.type === 'aggregate')?.aggregations?.[0]?.target || trace.y;
            }
            return builderFn(newTrace, transformedRows);
        });

        const fig: PlotlyFigure = {
            data,
            layout: instructions.layout
        };

        return { fig, desc: instructions.desc };
    } catch (e) {
        console.error("Error building plot:", e);
        const errorMessage = e instanceof Error ? e.message : "An unknown error occurred";
        throw new Error(`Failed to build plot. ${errorMessage}`);
    }
};

export async function runPipeline(prompt: string, csvText: string): Promise<PipelineResult> {
    const headers = Object.keys(parse(csvText, { columns: true, skip_empty_lines: true, trim: true, to: 1 })[0] ?? {});
    if (headers.length === 0) {
         throw new Error('Could not read data headers. Please check the CSV file format.');
    }
    const plotPrompt = prompt.trim() === '' ? "Summarize the data in this file with a suitable chart." : prompt;
    
    const rawResult = await analyseRequest(plotPrompt, headers);

    const allRows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        cast: true,
        trim: true,
    });

    if (rawResult.mode === 'dashboard') {
        let filteredRows = [...allRows];
        for (const f of rawResult.dashboard.globalFilters ?? []) {
          filteredRows = filteredRows.filter(r => evalExpr(r[f.field], f.op, f.value));
        }

        const chartPromises = rawResult.dashboard.charts.map(async instructions => {
            const { fig } = await buildPlot(instructions, filteredRows);
            return { figure: fig, instructions };
        });

        const charts = await Promise.all(chartPromises);

        const processedDashboard: ProcessedDashboard = {
            title: rawResult.dashboard.title,
            desc: rawResult.dashboard.desc,
            charts: charts
        };
        return { kind: 'dashboard', data: processedDashboard };
    } else {
        // Fallback to single chart
        const singleResult = await buildPlot(rawResult.single, allRows);
        return { kind: 'single', data: singleResult };
    }
}