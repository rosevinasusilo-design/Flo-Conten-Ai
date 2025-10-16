import React from 'react';
import type { User } from '@supabase/supabase-js';
import type { Tab } from '../types';
import { 
    DashboardIcon, CreativeHubIcon, BrandKitIcon, ChatTutorIcon, 
    GenerationSuiteIcon, StudioSuiteIcon, JagoYtIcon, CtStoryIcon, 
    CtAdvancedIcon, CtProSuiteIcon, InfoIcon, SettingsIcon, 
    UserIcon, LogoutIcon, XIcon, FashionStudioIcon, MagnifyingGlassIcon
} from './icons';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SidebarProps {
  user: User;
  logout: () => void;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon, label, isActive, onClick, disabled }) => {
  const baseClasses = "relative flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-colors w-full text-left";
  const activeClasses = "bg-gray-900 text-emerald-400 font-semibold";
  const inactiveClasses = "text-gray-400 hover:bg-gray-700 hover:text-white";
  const disabledClasses = "text-gray-600 cursor-not-allowed opacity-50";

  const getClasses = () => {
    if (disabled) return `${baseClasses} ${disabledClasses}`;
    if (isActive) return `${baseClasses} ${activeClasses}`;
    return `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <button onClick={onClick} className={getClasses()} disabled={disabled}>
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-2/3 w-1 bg-emerald-400 rounded-r-full"></span>}
      <span className="w-5 h-5">{icon}</span>
      <span>{label}</span>
    </button>
  );
};

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <h3 className="px-4 pt-4 pb-2 text-xs font-semibold tracking-wider text-gray-500 uppercase">
    {label}
  </h3>
);

const Sidebar: React.FC<SidebarProps> = ({ user, logout, activeTab, setActiveTab, setIsSettingsOpen, isOpen, onClose }) => {
  
  const handleNavClick = (tab: Tab) => {
    setActiveTab(tab);
    onClose();
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    onClose();
  };

  const handleLogoutClick = () => {
    logout();
    onClose();
  };

  return (
    <>
      {/* Backdrop Overlay for Mobile */}
      <div 
        className={`fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <aside className={`w-64 bg-gray-800 flex flex-col flex-shrink-0 border-r border-gray-700 
                        fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-20 px-4 border-b border-gray-700 flex-shrink-0">
         <div className="flex items-center gap-3">
            <svg width="40" height="40" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                <defs>
                    <linearGradient id="logo-swirl-1-sidebar" x1="50" y1="0" x2="150" y2="200" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#34D399"/>
                        <stop offset="1" stopColor="#059669"/>
                    </linearGradient>
                    <linearGradient id="logo-swirl-2-sidebar" x1="150" y1="0" x2="50" y2="200" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6EE7B7"/>
                        <stop offset="1" stopColor="#10B981"/>
                    </linearGradient>
                </defs>
                <path d="M150 50 C180 80 180 120 150 150 C120 180 80 180 50 150 C20 120 20 80 50 50 C80 20 120 20 150 50 Z" stroke="url(#logo-swirl-1-sidebar)" strokeWidth="20" strokeLinecap="round" transform="rotate(45 100 100)" />
                <path d="M130 70 C150 90 150 110 130 130 C110 150 90 150 70 130 C50 110 50 90 70 70 C90 50 110 50 130 70 Z" stroke="url(#logo-swirl-2-sidebar)" strokeWidth="20" strokeLinecap="round" transform="rotate(-45 100 100)" />
            </svg>
            <div>
                <h1 className="text-md font-bold text-white leading-tight">Flo's Conten Ai</h1>
            </div>
         </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={onClose} aria-label="Close sidebar">
              <XIcon className="w-6 h-6" />
           </button>
        </div>
        
        {/* User Welcome */}
        <div className="px-4 py-4 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-3">
                <UserIcon className="w-8 h-8 text-gray-400 p-1.5 bg-gray-700 rounded-full" />
                <div>
                    <p className="text-sm font-medium text-gray-400">Welcome,</p>
                    <p className="text-sm font-semibold text-white truncate">{user.email}</p>
                </div>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            <li><NavItem icon={<DashboardIcon />} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} /></li>
            
            <li><NavItem icon={<FashionStudioIcon />} label="Fashion Studio" isActive={activeTab === 'fashionStudio'} onClick={() => handleNavClick('fashionStudio')} /></li>
            <li><NavItem icon={<MagnifyingGlassIcon />} label="Analisa Produk" isActive={activeTab === 'productAnalysis'} onClick={() => handleNavClick('productAnalysis')} /></li>
            <li><NavItem icon={<CtStoryIcon />} label="Ide Cerita" isActive={activeTab === 'ideCerita'} onClick={() => handleNavClick('ideCerita')} /></li>
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-gray-700 flex-shrink-0 space-y-1">
            <NavItem icon={<SettingsIcon />} label="Settings" onClick={handleSettingsClick} disabled={true} />
            <NavItem icon={<LogoutIcon />} label="Logout" onClick={handleLogoutClick} />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;