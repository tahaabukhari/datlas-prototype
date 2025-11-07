import { parse } from 'csv-parse/sync';

const MAX_ROWS = 500;

// --- HELPERS ---

type ColumnType = 'number' | 'date' | 'string';

const getColumnTypes = (rows: any[]): Record<string, ColumnType> => {
    if (rows.length === 0) return {};
    const sample = rows[0];
    const types: Record<string, ColumnType> = {};
    for (const key in sample) {
        const value = sample[key];
        if (typeof value === 'number' && isFinite(value)) {
            types[key] = 'number';
        } else if (typeof value === 'object' && value instanceof Date && !isNaN(value.getTime())) {
            types[key] = 'date';
        } else {
            types[key] = 'string';
        }
    }
    return types;
};

const findColumns = (types: Record<string, ColumnType>): { timeCol?: string, numCol?: string, catCol?: string, numCol2?: string, numCol3?: string } => {
    const keys = Object.keys(types);
    const timeCol = keys.find(k => types[k] === 'date') || keys.find(k => k.toLowerCase().includes('year') || k.toLowerCase().includes('date'));
    const numCols = keys.filter(k => types[k] === 'number');
    const catCols = keys.filter(k => types[k] === 'string');
    return {
        timeCol: timeCol || catCols[0] || keys[0],
        numCol: numCols[0] || keys[1] || keys[0],
        catCol: catCols[0] || keys[0],
        numCol2: numCols[1] || keys[2] || keys[1],
        numCol3: numCols[2] || keys[3] || keys[2],
    };
};

const darkThemeConfig = {
    background: null,
    autosize: { type: 'fit', contains: 'padding' },
    axis: {
        labelColor: "#a1a1aa", // zinc-400
        titleColor: "#d4d4d8", // zinc-300
        gridColor: "#ffffff1a",
        domainColor: "#a1a1aa",
        tickColor: "#a1a1aa",
        titlePadding: 15,
        labelPadding: 5,
        titleFontSize: 12,
        labelFontSize: 11,
    },
    legend: {
        labelColor: "#a1a1aa",
        titleColor: "#d4d4d8",
        titlePadding: 10,
        labelFontSize: 11,
        titleFontSize: 12,
    },
    view: {
        stroke: "transparent"
    }
};

const getSampleData = (recipe: string) => {
    switch (recipe) {
        case 'barChart': return `category,value\nAlpha,28\nBravo,55\nCharlie,43\nDelta,91\nEcho,81\nFoxtrot,53`;
        case 'scatter': return `x,y,size\n10,20,5\n15,35,12\n22,18,8\n30,50,20\n35,25,10`;
        case 'heatMap': return `x,y,value\n-1,-1,5\n-1,1,10\n1,-1,15\n1,1,2`;
        case 'timeBrush': return `date,value\n2023-01-01,10\n2023-02-01,13\n2023-03-01,20\n2023-04-01,15\n2023-05-01,25\n2023-06-01,22`;
        default: return `date,value\n2023-01-01,10\n2023-02-01,13\n2023-03-01,20\n2023-04-01,15\n2023-05-01,25\n2023-06-01,22`;
    }
}

// --- RECIPES ---

function lineChart(rows: any[]): { spec: object; desc: string } {
    const types = getColumnTypes(rows);
    const { timeCol, numCol } = findColumns(types);

    const yValues = rows.map(r => r[numCol]).filter((v): v is number => typeof v === 'number');
    const meanY = yValues.reduce((a, b) => a + b, 0) / (yValues.length || 1);

    return {
        spec: {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: rows },
            width: "container",
            mark: { type: "line", stroke: "#e5e7eb", point: { filled: false, stroke: "#e5e7eb", strokeWidth: 2, size: 60 }, tooltip: true },
            encoding: {
                x: { field: timeCol, type: types[timeCol || ''] === 'date' ? "temporal" : "ordinal", title: timeCol },
                y: { field: numCol, type: "quantitative", title: numCol, scale: { zero: false } },
            },
            config: darkThemeConfig,
        },
        desc: `Average **${meanY.toFixed(1)}** over **${rows.length}** data points.`,
    };
}

function barChart(rows: any[]): { spec: object; desc: string } {
    const types = getColumnTypes(rows);
    const { catCol, numCol } = findColumns(types);
    const total = rows.map(r => r[numCol]).filter((v): v is number => typeof v === 'number').reduce((a, b) => a + b, 0);

    return {
        spec: {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: rows },
            width: "container",
            mark: { type: "bar", fill: "#e5e7eb", cornerRadius: 4, tooltip: true },
            encoding: {
                x: { field: catCol, type: "nominal", sort: '-y', title: catCol },
                y: { field: numCol, type: "quantitative", title: numCol },
            },
            config: darkThemeConfig,
        },
        desc: `Total of **${numCol}** is **${total.toFixed(1)}** across ${new Set(rows.map(r => r[catCol])).size} categories.`,
    };
}

function scatter(rows: any[]): { spec: object; desc: string } {
    const types = getColumnTypes(rows);
    const { numCol, numCol2 } = findColumns(types);

    return {
        spec: {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: rows },
            width: "container",
            mark: { type: "point", filled: true, fill: "#fff", stroke: "transparent", size: 80, opacity: 0.7, tooltip: true },
            encoding: {
                x: { field: numCol, type: "quantitative", title: numCol },
                y: { field: numCol2, type: "quantitative", title: numCol2 },
            },
            config: darkThemeConfig,
        },
        desc: `Correlation plot between **${numCol}** and **${numCol2}**.`,
    };
}

function heatMap(rows: any[]): { spec: object; desc: string } {
    const types = getColumnTypes(rows);
    const { catCol, numCol, numCol2 } = findColumns(types);
    const yCol = Object.keys(types).find(k => k !== catCol && types[k] === 'string') || numCol2;
    
    return {
        spec: {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: rows },
            width: "container",
            mark: { type: "rect", tooltip: true },
            encoding: {
                x: { field: catCol, type: "nominal", title: catCol },
                y: { field: yCol, type: "nominal", title: yCol },
                color: { 
                    field: numCol, 
                    type: "quantitative", 
                    aggregate: "sum", 
                    title: `Sum of ${numCol}`,
                    scale: { range: ["#27272a", "#e5e7eb"] }
                },
            },
            config: { ...darkThemeConfig, legend: { ...darkThemeConfig.legend, orient: "bottom", padding: 10 } }
        },
        desc: `Heatmap of **${catCol}** vs. **${yCol}** by **${numCol}**.`,
    };
}

function timeBrush(rows: any[]): { spec: object; desc: string } {
    const types = getColumnTypes(rows);
    const { timeCol, numCol } = findColumns(types);

    return {
        spec: {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: rows },
            width: "container",
            vconcat: [{
                mark: { type: "line", stroke: "#e5e7eb", tooltip: true },
                encoding: {
                    x: { field: timeCol, type: types[timeCol || ''] === 'date' ? "temporal" : "ordinal", scale: { domain: { param: "brush" } }, title: null },
                    y: { field: numCol, type: "quantitative", title: numCol, scale: { zero: false } },
                }
            }, {
                height: 50,
                mark: { type: "line", stroke: "#a1a1aa" },
                params: [{ name: "brush", select: { type: "interval", encodings: ["x"] } }],
                encoding: {
                    x: { field: timeCol, type: types[timeCol || ''] === 'date' ? "temporal" : "ordinal", title: timeCol },
                    y: { field: numCol, type: "quantitative", axis: { tickCount: 3, grid: false, labels: false, ticks: false } }
                }
            }],
            config: darkThemeConfig
        },
        desc: `Interactive time-series for **${numCol}**. Drag on the bottom chart to zoom.`,
    };
}

// --- EXPORTED FUNCTIONS ---

const recipes: Record<string, (rows: any[]) => { spec: object; desc: string }> = {
    lineChart, barChart, scatter, heatMap, timeBrush,
};

export function chooseRecipe(prompt: string): string {
    const p = prompt.toLowerCase();
    if (p.includes('bar') || p.includes('compare') || p.includes('distribution')) return 'barChart';
    if (p.includes('heat') || p.includes('matrix')) return 'heatMap';
    if (p.includes('scatter') || p.includes('correlation')) return 'scatter';
    if (p.includes('brush') || p.includes('zoom') || p.includes('interactive')) return 'timeBrush';
    return 'lineChart'; // Default
}

export function isPlotRequest(prompt: string): boolean {
    const p = prompt.toLowerCase();
    const keywords = ['plot', 'graph', 'chart', 'visualize', 'draw', 'show me', 'line', 'bar', 'scatter', 'heat', 'brush', 'zoom'];
    return keywords.some(keyword => p.includes(keyword));
}

export async function runRecipe(recipeName: string, csvText: string): Promise<{ spec: object; desc: string }> {
    let effectiveCsvText = csvText;
    if (!csvText) {
        effectiveCsvText = getSampleData(recipeName);
    }

    try {
        const rows = parse(effectiveCsvText, {
            columns: true,
            skip_empty_lines: true,
            cast: true,
            trim: true,
        });

        const cappedRows = rows.slice(0, MAX_ROWS);
        const recipeFn = recipes[recipeName];
        if (!recipeFn) throw new Error(`Unknown recipe: ${recipeName}`);

        return recipeFn(cappedRows);
    } catch (e) {
        console.error("Error parsing CSV or running recipe:", e);
        throw new Error("Failed to parse data. Please check if it's a valid CSV.");
    }
}