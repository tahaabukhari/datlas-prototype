
export interface User {
  id: string;
  name: string;
  email: string;
  image: string;
}

export interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot' | 'system';
}

export type FileStatus = 'uploading' | 'ready' | 'error';

export interface UploadedFile {
    name: string;
    size: number;
    url: string; // Blob URL for client-side reference
    type: string;
    status: FileStatus;
    base64Data?: string;
    rawContent?: string;
    errorMessage?: string;
}

export interface DashboardContent {
  id: string;
  description: string;
  spec: object; // Vega-Lite spec object
}