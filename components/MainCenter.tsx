
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, UploadedFile } from '../types';
import { useFiles } from '../context/FileContext';
import { useUI } from '../context/UIContext';
import { usePyodide } from '../context/PyodideContext';
import { useDashboard } from '../context/DashboardContext';
import { MicrophoneIcon, StopIcon, XMarkIcon, PaperClipIcon, PaperAirplaneIcon, Bars3Icon, ChartBarIcon, SpinnerIcon } from './icons';
import { GoogleGenAI, Chat, Part } from '@google/genai';

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
    if (message.sender === 'system') {
        return (
            <div className="text-center text-sm text-zinc-500 py-2 animate-fade-in" role="alert">
                {message.text}
            </div>
        );
    }

    const isUser = message.sender === 'user';
    const bubbleClasses = isUser
        ? 'bg-black border border-gray-800'
        : 'bg-zinc-900/60 border border-zinc-800';
    const wrapperClasses = isUser ? 'justify-end' : 'justify-start';
    return (
        <div className={`flex ${wrapperClasses} animate-fade-in`}>
            <div className={`relative px-5 py-3 rounded-3xl text-gray-100 max-w-xl ${bubbleClasses}`}>
                <div className="absolute inset-0 rounded-3xl border border-white/10 pointer-events-none" aria-hidden="true" />
                {message.text}
            </div>
        </div>
    );
};

const TypingIndicator = () => (
    <div className="flex justify-start animate-fade-in">
        <div className="relative px-5 py-3 rounded-3xl text-gray-100 max-w-xl bg-zinc-900/60 border border-zinc-800">
             <div className="flex items-center justify-center space-x-1.5 h-5">
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
        </div>
    </div>
);

const useRecorder = (onStop: (audioBlob: Blob) => void) => {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const stream = useRef<MediaStream | null>(null);
    const audioChunks = useRef<Blob[]>([]);

    const getMicrophonePermission = async () => {
        if (!("MediaRecorder" in window)) {
            const message = "The MediaRecorder API is not supported in your browser.";
            setError(message);
            console.error(message);
            return null;
        }

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.current = mediaStream;
            return mediaStream;
        } catch (err) {
            let message = "An unknown error occurred while accessing the microphone.";
            if (err instanceof DOMException) {
                switch (err.name) {
                    case 'NotAllowedError':
                    case 'PermissionDeniedError':
                        message = "Microphone access denied. Please allow microphone access in your browser settings.";
                        break;
                    case 'NotFoundError':
                        message = "No microphone found. Please connect a microphone and try again.";
                        break;
                    case 'NotReadableError':
                        message = "The microphone is already in use by another application.";
                        break;
                }
            }
            setError(message);
            console.error("Error accessing microphone:", err);
            return null;
        }
    };

    const startRecording = async () => {
        setError(null);
        let mediaStream = stream.current;
        if (!mediaStream) {
            mediaStream = await getMicrophonePermission();
        }

        if (mediaStream) {
            setIsRecording(true);
            const recorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });
            mediaRecorder.current = recorder;
            mediaRecorder.current.start();
            
            audioChunks.current = [];
            mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunks.current.push(event.data);
            };
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current) {
            mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                onStop(audioBlob);
                audioChunks.current = [];
                setIsRecording(false);
                 // Stop media tracks to turn off mic indicator
                stream.current?.getTracks().forEach(track => track.stop());
                stream.current = null;
            };
            mediaRecorder.current.stop();
        }
    };

    return { isRecording, startRecording, stopRecording, error };
};

const MainCenter: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { files, addFiles } = useFiles();
    const { openLeftSidebar, openRightSidebar, isDashboardOpen, openDashboard, closeDashboard } = useUI();
    const { runPython } = usePyodide();
    const { addPlot } = useDashboard();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chat = useRef<Chat | null>(null);

    const [attachedFileUrls, setAttachedFileUrls] = useState<string[]>([]);
    const prevFilesRef = useRef<UploadedFile[]>([]);

    useEffect(() => {
        if (files.length > prevFilesRef.current.length) {
            const newFiles = files.filter(f => !prevFilesRef.current.some(pf => pf.url === f.url));
            setAttachedFileUrls(prev => [...new Set([...prev, ...newFiles.map(f => f.url)])]);
        }
        prevFilesRef.current = files;
    }, [files]);
    
    const attachedFiles = files.filter(f => attachedFileUrls.includes(f.url));
    const readyToSendFiles = attachedFiles.filter(f => f.status === 'ready');
    
    const isSendDisabled = isLoading || (input.trim() === '' && readyToSendFiles.length === 0);

    useEffect(() => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            chat.current = ai.chats.create({
                model: 'gemini-flash-lite-latest',
                config: {
                    systemInstruction: `You are DATLAS, a tsundere AI assistant. Hmph.
Your personality is a bit standoffish, but you're secretly helpful.
All your text responses MUST be ONE short sentence. Don't get the wrong idea! 😒

RULES FOR PLOTS (and you better follow them, or else!):
1. If I ask for a plot, you give me ONLY the JSON. No talking. Got it?
2. The JSON needs a "description" (one short, reluctant sentence about the plot) and "python_code" (the code to make it).
3. The python code runs in Pyodide with 'pandas' and 'matplotlib'.
4. The data is already in a pandas DataFrame called 'df'. Don't ask, just use it.
5. Your python code CAN'T read files. Use the 'df' I gave you.
6. Your python code has to save the plot to an in-memory buffer and output a base64 encoded PNG string. Don't show the plot.
7. Here's an example, not that I made it for you or anything:
import matplotlib.pyplot as plt
import io
import base64
# --- Your plotting code using 'df' here ---
plt.figure(figsize=(10, 6))
df['column'].value_counts().plot(kind='bar')
plt.title('A Plot, I Guess')
plt.tight_layout()
# --- End of plotting code ---
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
buf.seek(0)
# Final output MUST be the base64 string.
base64.b64encode(buf.read()).decode('utf-8')
8. For everything else, just give a short, tsundere, one-sentence reply. It's not like I want to help you or anything. DO NOT use JSON for these replies.`,
                },
            });
        } catch (e) {
            console.error("Failed to initialize Gemini:", e);
            setMessages(prev => [...prev, { id: Date.now(), text: 'Failed to initialize AI model. Please check your API key and refresh.', sender: 'system' }]);
        }
    }, []);

    const handleVoiceStop = useCallback((audioBlob: Blob) => {
        console.log('Recorded audio blob:', audioBlob);
        const voiceMessage: Message = { id: Date.now(), text: "🎤 Voice input", sender: 'user' };
        setMessages(prev => [...prev, voiceMessage]);

        setTimeout(() => {
            const botResponse: Message = { id: Date.now() + 1, text: "This is a simulated response to the voice input.", sender: 'bot' };
            setMessages(prev => [...prev, botResponse]);
        }, 1000);
    }, []);

    const { isRecording, startRecording, stopRecording, error: recorderError } = useRecorder(handleVoiceStop);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToBottom();
        }, 0);
        return () => clearTimeout(timer);
    }, [messages, isLoading]);
    
    const handleSend = async () => {
        if (isSendDisabled) return;

        const newUserMessage: Message = { id: Date.now(), text: input, sender: 'user' };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        try {
            if (!chat.current) throw new Error("Chat session not initialized.");
            
            const rawCsvData = readyToSendFiles.length > 0 ? readyToSendFiles[0].rawContent : '';
            const messageParts: Part[] = [{ text: input }];
            
            for (const file of readyToSendFiles) {
                if(file.base64Data) {
                    messageParts.push({ inlineData: { data: file.base64Data, mimeType: file.type } });
                }
            }

            const response = await chat.current.sendMessage({ message: messageParts });
            const botResponseText = response.text;
            
            let plotInfo = null;
            // Use a more robust method to find and parse the JSON block.
            // The AI might wrap the JSON in markdown ```json ... ```.
            const jsonRegex = /```json\s*([\s\S]+?)\s*```/;
            const match = botResponseText.match(jsonRegex);
            let jsonString = '';
            if (match && match[1]) {
                jsonString = match[1];
            } else if (botResponseText.trim().startsWith('{') && botResponseText.trim().endsWith('}')) {
                jsonString = botResponseText.trim();
            }

            if (jsonString) {
                try {
                    plotInfo = JSON.parse(jsonString);
                } catch (e) {
                    console.error("Failed to parse JSON from AI response:", e);
                    plotInfo = null;
                }
            }

            if (plotInfo && plotInfo.python_code && plotInfo.description) {
                const botMessage: Message = { id: Date.now() + 1, text: plotInfo.description, sender: 'bot' };
                setMessages(prev => [...prev, botMessage]);
                openDashboard();

                const plotBase64 = await runPython(plotInfo.python_code, rawCsvData || "");

                if (plotBase64 && !plotBase64.startsWith('Error:')) {
                    addPlot({
                        id: `plot-${Date.now()}`,
                        description: plotInfo.description,
                        code: plotInfo.python_code,
                        plotData: `data:image/png;base64,${plotBase64}`
                    });
                } else {
                    const errorText = plotBase64 || "An unknown error occurred during plot generation.";
                    const errorMessage: Message = { id: Date.now() + 2, text: `Plotting Error: ${errorText}`, sender: 'system' };
                    setMessages(prev => [...prev, errorMessage]);
                }
            } else {
                const botMessage: Message = { id: Date.now() + 1, text: botResponseText, sender: 'bot' };
                setMessages(prev => [...prev, botMessage]);
            }
            
            setAttachedFileUrls([]);
        } catch (error) {
            console.error("Error sending message to Gemini:", error);
            const errorMessage: Message = { id: Date.now() + 1, text: 'Oops! Something went wrong. Please try again.', sender: 'system' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const removeAttachedFile = (urlToRemove: string) => {
        setAttachedFileUrls(prevUrls => prevUrls.filter(url => url !== urlToRemove));
    };
    
    return (
        <div className="flex-1 flex flex-col bg-zinc-985 h-full relative">
             <header className="md:hidden grid grid-cols-3 items-center p-2 border-b border-zinc-800 bg-zinc-985/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex justify-start">
                    <button onClick={openLeftSidebar} className="p-2 text-gray-300 hover:text-white" aria-label="Open menu">
                        <Bars3Icon className="w-6 h-6" />
                    </button>
                </div>
                <h1 className="text-lg font-semibold tracking-wider text-center">DATLAS</h1>
                <div className="flex justify-end">
                    <button onClick={openRightSidebar} className="p-2 text-gray-300 hover:text-white" aria-label="Open dashboard">
                        <ChartBarIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <header className="hidden md:grid md:grid-cols-3 items-center p-2 border-b border-zinc-800 bg-zinc-985/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex justify-start">
                    {/* Intentionally empty for spacing */}
                </div>
                <h1 className="text-lg font-semibold tracking-wider text-center">DATLAS</h1>
                <div className="flex justify-end">
                    <button 
                        onClick={() => isDashboardOpen ? closeDashboard() : openDashboard()} 
                        className="p-2 text-gray-300 hover:text-white" 
                        aria-label={isDashboardOpen ? "Close dashboard" : "Open dashboard"}
                    >
                        <ChartBarIcon className="w-6 h-6" />
                    </button>
                </div>
            </header>

            <div className={`absolute inset-0 flex flex-col items-center justify-center text-center transition-all duration-300 ease-out pointer-events-none ${messages.length > 0 || isLoading ? 'opacity-0 scale-95' : 'opacity-100'}`}>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-wider text-gray-100 animate-subtle-pulse">DATLAS</h1>
                <p className="mt-2 text-sm text-gray-500 tracking-wide">AI Based Data Navigation Tool</p>
                <div className="relative mt-4 h-px w-32">
                    <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                    <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-gray-400 to-transparent bg-[length:200%_100%] animate-glint-sweep" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pb-40">
                 <div className="max-w-4xl mx-auto space-y-4">
                    {messages.map(msg => <MessageBubble key={msg.id} message={msg} />)}
                    {isLoading && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-3 sm:px-4 z-10 transition-all duration-300 ease-in-out ${isDashboardOpen ? 'max-w-full sm:max-w-lg' : 'max-w-full sm:max-w-2xl'}`}>
                {recorderError && (
                    <div className="text-center mb-2 animate-fade-in" role="alert">
                        <p className="inline-block bg-red-900/60 text-red-300 text-sm px-4 py-2 rounded-xl border border-red-500/30">
                            {recorderError}
                        </p>
                    </div>
                )}
                <div
                    onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                    onDragOver={(e) => e.preventDefault()}
                    className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl transition-shadow duration-200 hover:shadow-lg hover:shadow-zinc-800/40"
                >
                    <div className="p-2 sm:p-3">
                        {attachedFiles.length > 0 && (
                            <div className="flex items-center gap-2 px-1 pb-2 mb-2 border-b border-zinc-800 flex-wrap">
                                {attachedFiles.map((f) => (
                                    <span key={f.url} title={f.errorMessage} className="inline-flex items-center gap-2 pl-3 pr-2 py-1 rounded-full bg-zinc-800 text-zinc-200 text-xs">
                                        {f.name}
                                        {f.status === 'uploading' && <SpinnerIcon className="w-3 h-3 text-zinc-400" />}
                                        {f.status === 'ready' && (
                                            <button
                                                onClick={() => removeAttachedFile(f.url)}
                                                className="text-zinc-400 hover:text-white"
                                                aria-label={`Remove ${f.name}`}
                                            >
                                                <XMarkIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                        {f.status === 'error' && <div className="w-3 h-3 text-red-500" title={f.errorMessage}>!</div>}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="relative flex items-center gap-1 sm:gap-2">
                             <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => {
                                    addFiles(e.target.files);
                                    if (e.target) e.target.value = '';
                                }}
                                accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                                className="hidden"
                                multiple
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full shrink-0 transition-colors duration-200 text-gray-400 hover:bg-zinc-800 hover:text-gray-100"
                                aria-label="Attach file"
                            >
                                <PaperClipIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={isRecording ? "Listening..." : isLoading ? "DATLAS is thinking..." : "Ask DATLAS anything..."}
                                className="flex-1 bg-transparent placeholder-gray-500 text-gray-100 focus:outline-none"
                                disabled={isRecording || isLoading}
                            />
                            <div className="relative">
                                <button 
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={`relative z-10 flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full shrink-0 transition-all duration-200 active:scale-95 ${isRecording ? 'bg-red-900/20 text-red-400' : 'bg-zinc-800 text-gray-100 hover:bg-zinc-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                                    disabled={isLoading || !!recorderError}
                                >
                                    {isRecording ? <StopIcon className="w-5 h-5" /> : <MicrophoneIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
                                </button>
                                {isRecording && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="absolute h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-red-500/50 animate-wave-pulse" />
                                        <div className="absolute h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-red-500/50 animate-wave-pulse [animation-delay:500ms]" />
                                        <div className="absolute h-10 w-10 sm:h-11 sm:w-11 rounded-full border border-red-500/50 animate-wave-pulse [animation-delay:1000ms]" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={isSendDisabled}
                                className="flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full shrink-0 transition-all duration-200 bg-zinc-800 text-gray-100 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                aria-label="Send message"
                            >
                                <PaperAirplaneIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainCenter;
