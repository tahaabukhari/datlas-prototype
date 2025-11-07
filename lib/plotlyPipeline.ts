import { GoogleGenAI, Type } from '@google/genai';
import { parse } from 'csv-parse/sync';
import { PlotlyFigure } from '../types';

type PlotlyInstructions = {
  type: 'line' | 'bar' | 'scatter' | 'heatmap' | 'box' | 'violin';
  traces: {
    x: string;
    y: string;
    z?: string; 
    name?: string;
    mode?: 'lines' | 'markers' | 'lines+markers';
    marker?: { color: string };
  }[];
  layout: {
    title: string;
    xaxis: { title: string };
    yaxis: { title: string };
    paper_bgcolor: 'transparent';
    plot_bgcolor: 'transparent';
    font: { color: '#fff' };
    margin: { l: number; r: number; t: number; b: number };
    grid?: { rows: number; columns: number };
  };
  desc: string;
};

const MAX_ROWS = 1000;

export const choosePlot = async (prompt: string, headers: string[]): Promise<PlotlyInstructions> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const schema = {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['line', 'bar', 'scatter', 'heatmap', 'box', 'violin'] },
            traces: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        x: { type: Type.STRING },
                        y: { type: Type.STRING },
                        z: { type: Type.STRING },
                        name: { type: Type.STRING },
                        mode: { type: Type.STRING, enum: ['lines', 'markers', 'lines+markers'] },
                        marker: {
                            type: Type.OBJECT,
                            properties: {
                                color: { type: Type.STRING }
                            }
                        }
                    },
                    required: ['y']
                }
            },
            layout: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING },
                    xaxis: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ['title'] },
                    yaxis: { type: Type.OBJECT, properties: { title: { type: Type.STRING } }, required: ['title'] },
                    paper_bgcolor: { type: Type.STRING },
                    plot_bgcolor: { type: Type.STRING },
                    font: { type: Type.OBJECT, properties: { color: { type: Type.STRING } }, required: ['color'] },
                    margin: {
                        type: Type.OBJECT,
                        properties: {
                            l: { type: Type.INTEGER },
                            r: { type: Type.INTEGER },
                            t: { type: Type.INTEGER },
                            b: { type: Type.INTEGER }
                        },
                        required: ['l', 'r', 't', 'b']
                    },
                    grid: {
                        type: Type.OBJECT,
                        properties: {
                            rows: { type: Type.INTEGER },
                            columns: { type: Type.INTEGER }
                        }
                    }
                },
                required: ['title', 'xaxis', 'yaxis', 'paper_bgcolor', 'plot_bgcolor', 'font', 'margin']
            },
            desc: { type: Type.STRING }
        },
        required: ['type', 'traces', 'layout', 'desc']
    };

    const fullPrompt = `User prompt: "${prompt}"\nCSV Headers: [${headers.join(', ')}]`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            systemInstruction: `You are Phoni-Plotly.
Reply ONLY with a JSON object that matches TypeScript type PlotlyInstructions.
Never write markdown, never explain.
Use only column names that exist in the CSV header.
Pick colours from this midnight palette:
#fff #22d3ee #a78bfa #f472b6 #fbbf24 #34d399
Make title, axis titles and trace names concise and relevant.`,
            responseMimeType: "application/json",
            responseSchema: schema,
        },
    });

    try {
        const jsonText = response.text.trim();
        const instructions = JSON.parse(jsonText);
        return instructions as PlotlyInstructions;
    } catch (e) {
        console.error("Failed to parse AI response as JSON:", e, response.text);
        throw new Error("AI failed to generate valid plot instructions.");
    }
};

const BUILDERS: Record<string, (t: any, rows: any[]) => any> = {
    line: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), type: 'scatter', mode: 'lines+markers', name: t.name, marker: t.marker }),
    bar: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), type: 'bar', name: t.name, marker: t.marker }),
    scatter: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), type: 'scatter', mode: 'markers', name: t.name, marker: t.marker }),
    heatmap: (t, rows) => ({ x: rows.map(r => r[t.x]), y: rows.map(r => r[t.y]), z: rows.map(r => r[t.z] ?? 0), type: 'heatmap', colorscale: 'Blues' }),
    box: (t, rows) => ({ y: rows.map(r => r[t.y]), type: 'box', name: t.name, marker: t.marker }),
    violin: (t, rows) => ({ y: rows.map(r => r[t.y]), type: 'violin', name: t.name, marker: t.marker }),
};

export const buildPlot = async (instructions: PlotlyInstructions, csvText: string): Promise<{ fig: PlotlyFigure; desc: string }> => {
    try {
        const rows = parse(csvText, {
            columns: true,
            skip_empty_lines: true,
            cast: true,
            trim: true,
        });

        const cappedRows = rows.slice(0, MAX_ROWS);
        const builderFn = BUILDERS[instructions.type];
        if (!builderFn) {
            throw new Error(`Unknown plot type: ${instructions.type}`);
        }

        const data = instructions.traces.map(trace => builderFn(trace, cappedRows));

        const fig: PlotlyFigure = {
            data,
            layout: instructions.layout
        };

        return { fig, desc: instructions.desc };
    } catch (e) {
        console.error("Error building plot:", e);
        throw new Error("Failed to parse data or build plot from instructions.");
    }
};

export function isPlotRequest(prompt: string): boolean {
    const p = prompt.toLowerCase();
    const keywords = ['plot', 'graph', 'chart', 'visualize', 'draw', 'show me', 'line', 'bar', 'scatter', 'heat', 'box', 'violin'];
    return keywords.some(keyword => p.includes(keyword));
}
