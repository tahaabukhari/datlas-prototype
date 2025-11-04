import React, { createContext, useState, useContext, ReactNode, useEffect, useRef } from 'react';

// Pyodide is loaded from a script tag in index.html
declare global {
  interface Window {
    loadPyodide: (config?: any) => Promise<any>;
  }
}

interface PyodideContextType {
  isPyodideReady: boolean;
  pyodideMessage: string;
  runPython: (code: string, data: string) => Promise<string | null>;
}

const PyodideContext = createContext<PyodideContextType | undefined>(undefined);

export const PyodideProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPyodideReady, setIsPyodideReady] = useState(false);
  const [pyodideMessage, setPyodideMessage] = useState('Initializing Python environment...');
  const pyodide = useRef<any>(null);

  useEffect(() => {
    const initPyodide = async () => {
      try {
        setPyodideMessage('Loading Pyodide runtime...');
        pyodide.current = await window.loadPyodide();
        setPyodideMessage('Loading micropip...');
        await pyodide.current.loadPackage("micropip");
        const micropip = pyodide.current.pyimport("micropip");
        setPyodideMessage('Installing pandas...');
        await micropip.install('pandas');
        setPyodideMessage('Installing matplotlib...');
        await micropip.install('matplotlib');
        setPyodideMessage('Python environment ready.');
        setIsPyodideReady(true);
      } catch (error) {
        console.error("Pyodide initialization failed:", error);
        setPyodideMessage('Failed to initialize Python environment.');
      }
    };
    initPyodide();
  }, []);

  const runPython = async (code: string, data: string): Promise<string | null> => {
    if (!isPyodideReady || !pyodide.current) {
      console.error("Pyodide is not ready.");
      return "Pyodide is not ready.";
    }
    try {
      pyodide.current.globals.set('csv_data', data);
      
      const fullCode = `
import pandas as pd
import io

try:
    # Load the data passed from JavaScript
    csv_file = io.StringIO(csv_data)
    df = pd.read_csv(csv_file)

    # --- User-generated code starts here ---
${code}
    # --- User-generated code ends here ---
except Exception as e:
    e
      `;

      const result = await pyodide.current.runPythonAsync(fullCode);
      return result;
    } catch (error) {
      console.error("Error executing Python code:", error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  return (
    <PyodideContext.Provider value={{ isPyodideReady, pyodideMessage, runPython }}>
      {children}
    </PyodideContext.Provider>
  );
};

export const usePyodide = () => {
  const context = useContext(PyodideContext);
  if (context === undefined) {
    throw new Error('usePyodide must be used within a PyodideProvider');
  }
  return context;
};