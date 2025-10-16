import React from 'react';
// FIX: Updated imports to use icons consistent with App.tsx tabs.
import { LightbulbIcon, AspectRatioIcon, VideoIcon } from './icons';
import type { Tab } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface BottomNavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const NavItem = ({ icon, label, isActive, onClick }: { icon: React.ReactNode; label: string; isActive: boolean; onClick: () => void; }) => {
  const baseClasses = "flex flex-col items-center justify-center gap-1 w-full h-full p-2 rounded-lg transition-colors duration-200";
  const activeClasses = "bg-indigo-600 text-white";
  const inactiveClasses = "text-gray-400 hover:bg-gray-700 hover:text-gray-200";
  
  return (
    <button onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`} aria-pressed={isActive}>
      <div className="w-6 h-6">{icon}</div>
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
};

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const { t } = useLanguage();
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-20 bg-gray-800/80 backdrop-blur-lg border-t border-gray-700/50 z-50">
      <div className="max-w-screen-lg mx-auto h-full flex items-center justify-center p-2">
        <div className="w-32">
            {/* FIX: Aligned with 'videoPrompt' tab from App.tsx and used the correct icon. */}
            <NavItem 
              icon={<LightbulbIcon />}
              label={t('navVideoPrompt')}
              isActive={activeTab === 'videoPrompt'}
              onClick={() => onTabChange('videoPrompt')}
            />
        </div>
      </div>
    </nav>
  );
};