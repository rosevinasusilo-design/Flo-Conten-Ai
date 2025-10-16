import React, { useState, useEffect } from 'react';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import { useApiKey } from './contexts/ApiKeyContext';
import type { Tab } from './types';
import CtStory from './components/CtStory';
import AuthPage from './components/AuthPage';
import { Spinner } from './components/Spinner';
import { isSupabaseConfigured } from './lib/supabaseClient';
import SupabaseConfigNotice from './components/SupabaseConfigNotice';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CreativeHub from './components/CreativeHub';
import CtGenerate from './components/CtGenerate';
import SettingsModal from './components/SettingsModal';
import FashionStudio from './components/FashionStudio';
import ProductAnalysis from './components/ProductAnalysis';
import IdeCerita from './components/IdeCerita';

const TAB_TITLES: Record<Tab, string> = {
  dashboard: 'Dashboard',
  creativeHub: 'Creative Hub',
  videoPrompt: 'Prompt Story',
  ctGenerate: 'Prompt Generator',
  fashionStudio: 'Fashion Studio',
  productAnalysis: 'Analisa Produk',
  ideCerita: 'Ide Cerita',
};


export default function App() {
  const { t } = useLanguage();
  const { user, loading: authLoading, logout, verifySession } = useAuth();
  const { isInitializing: apiKeyInitializing } = useApiKey();
  const [activeTab, setActiveTab] = useState<Tab>('fashionStudio');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  if (!isSupabaseConfigured) {
    return <SupabaseConfigNotice />;
  }

  useEffect(() => {
    if (!user) return;
    
    const intervalId = setInterval(() => {
      verifySession();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [user, verifySession]);

  const loading = authLoading || apiKeyInitializing;

  if (loading) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
            <Spinner className="h-10 w-10" />
        </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <div className="bg-gray-900 text-gray-300 font-sans flex h-screen">
        <Sidebar 
          user={user} 
          logout={logout} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          setIsSettingsOpen={setIsSettingsOpen}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col overflow-y-hidden">
          <header className="p-4 md:p-6 flex-shrink-0 flex items-center gap-4 border-b border-gray-800 md:border-b-0">
             <button 
              className="md:hidden text-gray-400 hover:text-white" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {TAB_TITLES[activeTab]}
            </h1>
          </header>

          <div className="flex-1 overflow-y-auto">
            {/* Keep all components mounted to preserve state, use CSS to toggle visibility */}
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }} className="h-full">
              <Dashboard />
            </div>
            <div style={{ display: activeTab === 'creativeHub' ? 'block' : 'none' }} className="h-full">
              <CreativeHub />
            </div>
            <div style={{ display: activeTab === 'ctGenerate' ? 'block' : 'none' }} className="h-full">
              <CtGenerate />
            </div>
            <div style={{ display: activeTab === 'videoPrompt' ? 'block' : 'none' }} className="h-full">
              <CtStory />
            </div>
            <div style={{ display: activeTab === 'fashionStudio' ? 'block' : 'none' }} className="h-full">
              <FashionStudio />
            </div>
            <div style={{ display: activeTab === 'productAnalysis' ? 'block' : 'none' }} className="h-full">
              <ProductAnalysis />
            </div>
             <div style={{ display: activeTab === 'ideCerita' ? 'block' : 'none' }} className="h-full">
              <IdeCerita />
            </div>
          </div>
        </main>
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}