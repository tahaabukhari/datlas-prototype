import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { UploadedFile } from '../types';

interface FileContextType {
    files: UploadedFile[];
    addFiles: (incomingFiles: FileList | null) => void;
    removeFile: (urlToRemove: string) => void;
}

const FileContext = createContext<FileContextType | undefined>(undefined);

// The global XLSX object is available from the script tag in index.html
declare var XLSX: any;

const processFileContent = (file: File): Promise<{ base64Data: string; mimeType: string; rawContent: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = (error) => {
            reader.abort();
            reject(new Error('Error reading file.'));
        };
        reader.onload = () => {
            try {
                let textContent: string;
                // Check for xls/xlsx files and parse them
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const data = new Uint8Array(reader.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    if (!workbook.SheetNames.length) {
                        throw new Error('Spreadsheet is empty.');
                    }
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    textContent = XLSX.utils.sheet_to_csv(worksheet);
                } else {
                    // Assume CSV/text for all other allowed types
                    textContent = reader.result as string;
                }
                // Encode the final text content to base64 and set a uniform, supported MIME type
                const base64Data = btoa(textContent);
                resolve({ base64Data, mimeType: 'text/csv', rawContent: textContent });
            } catch (err) {
                console.error("Error processing file content:", err);
                reject(err instanceof Error ? err : new Error('Failed to parse file content.'));
            }
        };

        // Read xls/xlsx as an ArrayBuffer for parsing, read others as plain text.
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    });
};


export const FileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [files, setFiles] = useState<UploadedFile[]>([]);

    const addFiles = async (incomingFiles: FileList | null) => {
        if (!incomingFiles) return;

        // FIX: Add an explicit return type to the map callback to ensure type compatibility with the `UploadedFile` type guard in the filter.
        const newFileEntries: UploadedFile[] = Array.from(incomingFiles).map((f): UploadedFile | null => {
             // Filter for spreadsheet/csv types
            if (!f.type.includes('sheet') && !f.type.includes('csv') && !f.name.endsWith('.csv') && !f.name.endsWith('.xls') && !f.name.endsWith('.xlsx')) {
                console.warn(`Skipping unsupported file type: ${f.name} (${f.type})`);
                return null;
            }
            return {
                name: f.name,
                size: f.size,
                url: URL.createObjectURL(f),
                type: f.type,
                status: 'uploading',
            };
        }).filter((f): f is UploadedFile => f !== null);

        if (newFileEntries.length === 0) return;

        setFiles(prev => [...prev, ...newFileEntries]);

        for (const fileEntry of newFileEntries) {
            const originalFile = Array.from(incomingFiles).find(f => fileEntry.name === f.name && fileEntry.size === f.size);
            if (!originalFile) continue;

            try {
                const { base64Data, mimeType, rawContent } = await processFileContent(originalFile);
                setFiles(prev => prev.map(f => 
                    f.url === fileEntry.url 
                        ? { ...f, status: 'ready', base64Data, type: mimeType, rawContent } 
                        : f
                ));
            } catch (error) {
                console.error(`Error processing file ${fileEntry.name}:`, error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
                setFiles(prev => prev.map(f => 
                    f.url === fileEntry.url 
                        ? { ...f, status: 'error', errorMessage } 
                        : f
                ));
            }
        }
    };

    const removeFile = (urlToRemove: string) => {
        setFiles((prev) => {
            const fileToRemove = prev.find(f => f.url === urlToRemove);
            if (fileToRemove) {
                URL.revokeObjectURL(fileToRemove.url);
            }
            return prev.filter((f) => f.url !== urlToRemove);
        });
    };

    // Effect for cleaning up all URLs on unmount
    useEffect(() => {
        return () => {
            files.forEach((f) => URL.revokeObjectURL(f.url));
        };
    }, [files]);


    return (
        <FileContext.Provider value={{ files, addFiles, removeFile }}>
            {children}
        </FileContext.Provider>
    );
};

export const useFiles = () => {
    const context = useContext(FileContext);
    if (context === undefined) {
        throw new Error('useFiles must be used within a FileProvider');
    }
    return context;
};