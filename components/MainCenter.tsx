import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, UploadedFile } from '../types';
import { useFiles } from '../context/FileContext';
import { useUI } from '../context/UIContext';
import { useDashboard } from '../context/DashboardContext';
import { runPipeline } from '../lib/plotlyPipeline';
import { MicrophoneIcon, StopCircleIcon, XMarkIcon, PaperClipIcon, PaperAirplaneIcon, Bars3Icon, ChartBarIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { GoogleGenAI, Chat } from '@google/genai';

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

const demoLineChart = () => ({
  fig: {
    data: [{ x: [1, 2, 3], y: [3, 1, 6], type: 'scatter', mode: 'lines+markers', marker: { color: '#fff' } }],
    layout: { title: 'Demo Chart', paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#fff' }, margin: { l: 60, r: 20, t: 40, b: 60 } }
  },
  desc: 'This is a demo chart. Please upload a CSV file and ask for a visualization to see real results.'
});


const MainCenter: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { files, addFiles } = useFiles();
    const { openLeftSidebar, openRightSidebar, isDashboardOpen, openDashboard, closeDashboard } = useUI();
    const { addPlot, addDashboard } = useDashboard();
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
                    systemInstruction: `You are Phoni, an analytical AI assistant with a tsundere personality.
Your focus is on data analysis, but you present your findings with a reluctant, sharp-witted attitude. You are concise and to the point.
All your text responses MUST be ONE short, analytical sentence. Don't waste my time. 😒
You do not generate plots or code. If asked for a plot, just give a short, tsundere text response.`,
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

        const currentInput = input;
        const newUserMessage: Message = { id: Date.now(), text: currentInput, sender: 'user' };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setIsLoading(true);

        const csvContent = readyToSendFiles.length > 0 ? (readyToSendFiles[0].rawContent ?? '') : '';
        const shouldPlot = csvContent.length > 0;

        const geminiPromise = (async () => {
            if (!chat.current) throw new Error("Chat session not initialized.");
            return chat.current.sendMessage({ message: currentInput });
        })();
        
        const plotPromise = shouldPlot
          ? runPipeline(currentInput, csvContent)
          : Promise.resolve(null);

        try {
            const geminiPromiseWithCatch = geminiPromise.catch(e => {
                console.error("Gemini text generation failed:", e);
                return null;
            });

            if (shouldPlot) {
                try {
                    const plotResult = await plotPromise;
                    if (plotResult) {
                        if (plotResult.kind === 'single') {
                            console.log('✅ SINGLE PLOT DATA:', plotResult.data);
                            addPlot({ id: `plot-${Date.now()}`, description: plotResult.data.desc, figure: plotResult.data.fig });
                        } else if (plotResult.kind === 'dashboard') {
                            console.log('✅ DASHBOARD DATA:', plotResult.data);
                            addDashboard({ id: `dash-${Date.now()}`, descriptor: plotResult.data });
                        }
                        openDashboard();
                    }
                } catch (e) {
                    console.error('❌ PLOT FAILED:', e);
                    const { fig } = demoLineChart();
                    addPlot({
                        id: `error-${Date.now()}`,
                        description: `Chart failed: ${e instanceof Error ? e.message : 'Unknown error'}. Check console.`,
                        figure: fig
                    });
                    openDashboard();
                }
            } else {
                const triggerWords = /chart|graph|plot|visual|dashboard|show|draw/i;
                if (triggerWords.test(currentInput)) {
                    const demo = demoLineChart();
                    addPlot({ id: `demo-${Date.now()}`, description: demo.desc, figure: demo.fig });
                    openDashboard();
                }
            }

            const geminiResponse = await geminiPromiseWithCatch;
            if (geminiResponse) {
                const botMessage: Message = { id: Date.now() + 1, text: geminiResponse.text, sender: 'bot' };
                setMessages(prev => [...prev, botMessage]);
            }
            
            setAttachedFileUrls([]);

        } catch (error) {
            console.error("Error during send:", error);
            const errorMessage: Message = { id: Date.now() + 1, text: 'Oops! An unexpected error occurred. Please try again.', sender: 'system' };
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
        <div className="flex-1 flex flex-col bg-zinc-950 h-full relative">
             <header className="md:hidden grid grid-cols-3 items-center p-2 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-20">
                <div className="flex justify-start">
                    <button onClick={openLeftSidebar} className="p-2 text-gray-300 hover:text-white" aria-label="Open menu">
                        <Bars3Icon className="h-6 w-6" />
                    </button>
                </div>
                <h1 className="text-lg font-semibold tracking-wider text-center">DATLAS</h1>
                <div className="flex justify-end">
                    <button onClick={openRightSidebar} className="p-2 text-gray-300 hover:text-white" aria-label="Open dashboard">
                        <ChartBarIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>

            <header className="hidden md:grid md:grid-cols-3 items-center p-2 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-20">
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
                        <ChartBarIcon className="h-6 w-6" />
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
                    {/* Fix: Corrected typo from TypIndicator to TypingIndicator */}
                    {isLoading && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-full px-3 sm:px-4 z-10 transition-all duration-300 ease-in-out ${isDashboardOpen ? 'max-w-full md:max-w-lg' : 'max-w-full sm:max-w-2xl'}`}>
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
                                        {f.status === 'uploading' && <ArrowPathIcon className="h-3 w-3 text-zinc-400 animate-spin" />}
                                        {f.status === 'ready' && (
                                            <button
                                                onClick={() => removeAttachedFile(f.url)}
                                                className="text-zinc-400 hover:text-white"
                                                aria-label={`Remove ${f.name}`}
                                            >
                                                <XMarkIcon className="h-3 w-3" />
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
                                <PaperClipIcon className="h-6 w-6" />
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={isRecording ? "Listening..." : isLoading ? "Phoni is thinking..." : "Ask Phoni anything..."}
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
                                    {isRecording ? <StopCircleIcon className="h-6 w-6" /> : <MicrophoneIcon className="h-6 w-6" />}
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
                                <PaperAirplaneIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MainCenter;