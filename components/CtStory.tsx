import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useApiKey } from '../contexts/ApiKeyContext';
import type { Universe, StorybookProject, LtxProject, SharedFormProps } from '../types';
import UniverseHubForm from './form/UniverseHubForm';
import StoryWeaverForm from './form/StoryWeaverForm';
import StorybookForm from './form/StorybookForm';
import Button from './Button';

type CtStorySubTab = 'universeHub' | 'storyWeaver' | 'storybook';

type Log = {
    message: string;
    type: 'info' | 'error' | 'warning' | 'status';
    timestamp: string;
};

const initialStorybookProjectState: StorybookProject = {
    id: 'default',
    idea: 'Kucing pemberani yang belajar terbang',
    pages: [],
    fullStoryText: ''
};

const LogPanel: React.FC<{ logs: Log[]; onClear: () => void; }> = ({ logs, onClear }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = 0;
        }
    }, [logs]);

    const getIcon = (type: Log['type']) => {
        switch (type) {
            case 'error': return { icon: 'fa-triangle-exclamation', color: 'text-red-400' };
            case 'warning': return { icon: 'fa-circle-exclamation', color: 'text-yellow-400' };
            case 'info': return { icon: 'fa-circle-info', color: 'text-sky-400' };
            case 'status': return { icon: 'fa-spinner fa-spin', color: 'text-gray-400' };
        }
    };

    return (
        <div className="h-full flex flex-col bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex justify-between items-center p-2 border-b border-gray-700 flex-shrink-0">
                <h3 className="text-sm font-semibold text-white">Logs</h3>
                <Button onClick={onClear} size="sm" variant="secondary" className="!py-1">Clear</Button>
            </div>
            <div ref={logContainerRef} className="flex-grow p-2 overflow-y-auto text-xs font-mono">
                {logs.length === 0 ? <span className="text-gray-500">Logs will appear here...</span> :
                 logs.map((log, index) => {
                    const { icon, color } = getIcon(log.type);
                    return (
                        <div key={index} className="flex items-start gap-2 mb-1">
                            <span className="text-gray-500">{log.timestamp}</span>
                            <i className={`fa-solid ${icon} ${color} mt-0.5`}></i>
                            <span className="flex-1 text-gray-300">{log.message}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const CtStory: React.FC = () => {
    const [activeSubTab, setActiveSubTab] = useState<CtStorySubTab>('storyWeaver');
    
    // Global states managed by this hub
    const [universe, setUniverse] = useState<Universe>({ characters: [] });
    const [storybookProjects, setStorybookProjects] = useState<StorybookProject[]>([initialStorybookProjectState]);
    const [activeStorybookIndex, setActiveStorybookIndex] = useState(0);
    const [logs, setLogs] = useState<Log[]>([]);
    
    const { apiKey, isApiKeySet } = useApiKey();
    const runningRef = useRef(false);

    const addLog = useCallback((message: string, type: 'info' | 'error' | 'warning' | 'status') => {
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        setLogs(prev => [{ message, type, timestamp }, ...prev].slice(0, 100));
    }, []);

    const clearLogs = useCallback(() => setLogs([]), []);

    const executeApiCallWithKeyRotation = useCallback(async <T,>(
        apiCall: (ai: GoogleGenAI) => Promise<T>,
        description: string
    ): Promise<[T, { apiKey: string | null }]> => {
        if (!isApiKeySet) {
            const errorMsg = 'API Key is not set. Please configure it in the main settings.';
            addLog(errorMsg, 'error');
            throw new Error(errorMsg);
        }

        addLog(`Starting API call: ${description}...`, 'status');
        try {
            const ai = new GoogleGenAI({ apiKey });
            const result = await apiCall(ai);
            addLog(`API call successful: ${description}.`, 'info');
            return [result, { apiKey }];
        } catch (error) {
            console.error(`Error during API call (${description}):`, error);
            const friendlyMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            addLog(`API call failed: ${description}. Error: ${friendlyMessage}`, 'error');
            throw error; // Re-throw to be handled by the specific component
        }
    }, [apiKey, isApiKeySet, addLog]);

    const sharedProps: SharedFormProps = {
        addLog,
        getNextApiKey: () => apiKey,
        logUsage: (type) => console.log(`Usage logged for: ${type}`),
        universe,
        setUniverse,
        executeApiCallWithKeyRotation,
        addToMediaLibrary: (item) => addLog(`Added to media library: ${item.type}`, 'info'),
        runningRef,
        setStatus: (status) => {
            addLog(`Status set to: ${status}`, 'info');
            runningRef.current = status === 'Running';
        },
        setModalVideoUrl: (url) => console.log(`Show video modal: ${url}`),
        setModalImageUrl: (url) => console.log(`Show image modal: ${url}`),
        getFileSaveDirectory: async (type) => {
            addLog(`Requesting save directory for: ${type}`, 'info');
            return null;
        },
    };

    const renderContent = () => {
        switch (activeSubTab) {
            case 'universeHub':
                return <UniverseHubForm {...sharedProps} />;
            case 'storyWeaver':
                return <StoryWeaverForm {...sharedProps} />;
            case 'storybook':
                return <StorybookForm 
                          {...sharedProps} 
                          storybookProjects={storybookProjects} 
                          setStorybookProjects={setStorybookProjects} 
                          activeStorybookIndex={activeStorybookIndex} 
                          setActiveStorybookIndex={setActiveStorybookIndex} 
                       />;
            default:
                return (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 bg-gray-800/50 rounded-lg p-8">
                        <i className="fa-solid fa-person-digging text-5xl mb-4"></i>
                        <h3 className="text-lg font-semibold text-white">Segera Hadir</h3>
                        <p>Fitur ini sedang dalam pengembangan.</p>
                    </div>
                );
        }
    };

    const NavButton: React.FC<{ tab: CtStorySubTab; icon: string; label: string; }> = ({ tab, icon, label }) => (
        <button
            onClick={() => setActiveSubTab(tab)}
            className={`relative w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeSubTab === tab 
                ? 'bg-gray-900 text-emerald-400' 
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
        >
            {activeSubTab === tab && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-2/3 w-1 bg-emerald-400 rounded-r-full"></span>}
            <i className={`fa-solid ${icon} w-5 text-center`}></i>
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex h-full">
            <aside className="w-64 bg-gray-800 p-3 border-r border-gray-700 flex-shrink-0">
                <nav className="space-y-1">
                    <NavButton tab="universeHub" icon="fa-star" label="Universe Hub" />
                    <NavButton tab="storyWeaver" icon="fa-scroll" label="Story Weaver" />
                    <NavButton tab="storybook" icon="fa-book-open" label="Storybook" />
                </nav>
            </aside>
            <main className="flex-1 p-6 overflow-y-auto flex flex-col gap-6">
                <div className="flex-grow">
                  {renderContent()}
                </div>
                <div className="flex-shrink-0 h-48">
                    <LogPanel logs={logs} onClear={clearLogs} />
                </div>
            </main>
        </div>
    );
};

export default CtStory;