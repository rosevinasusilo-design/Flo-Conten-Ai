import React, { useState } from 'react';
import VideoGenerator from './VideoGenerator';
import BatchVideoGenerator from './BatchVideoGenerator';
import BatchKuGenerator from './BatchKuGenerator';
import BatchTxtGenerator from './BatchTxtGenerator';
import BatchJsonGenerator from './BatchJsonGenerator';

type SubTab = 'manual' | 'batch' | 'batchKu' | 'batchTxt' | 'batchJson';

const SubTabButton: React.FC<{
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ label, isActive, onClick, disabled }) => {
  const baseClasses = "px-4 py-2 text-sm font-medium transition-colors duration-200 border-b-2";
  const activeClasses = "border-emerald-500 text-emerald-500";
  const inactiveClasses = "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-200";
  const disabledClasses = "text-gray-600 cursor-not-allowed border-transparent";

  const getClasses = () => {
    if (disabled) return `${baseClasses} ${disabledClasses}`;
    if (isActive) return `${baseClasses} ${activeClasses}`;
    return `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <button onClick={onClick} className={getClasses()} disabled={disabled}>
      {label}
    </button>
  );
};

const CtGenerate: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('batch');

  const renderContent = () => {
    switch (activeSubTab) {
      case 'manual':
        // The original component is scene-based, which serves as a good manual generator.
        return <VideoGenerator />; 
      case 'batch':
        return <BatchVideoGenerator />;
      case 'batchKu':
        return <BatchKuGenerator />;
      case 'batchTxt':
        return <BatchTxtGenerator />;
      case 'batchJson':
        return <BatchJsonGenerator />;
      default:
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 bg-gray-800/50 rounded-lg">
                <h3 className="text-lg font-semibold">Segera Hadir</h3>
                <p>Fitur ini sedang dalam pengembangan.</p>
            </div>
        );
    }
  };

  return (
    <div className="p-0 sm:p-2 lg:p-4 h-full">
        <div className="flex flex-col gap-4 h-full">
            <div className="flex-shrink-0 border-b border-gray-700">
                <div className="flex items-center gap-2 px-4">
                    <SubTabButton label="Manual" isActive={activeSubTab === 'manual'} onClick={() => setActiveSubTab('manual')} />
                    <SubTabButton label="Batch" isActive={activeSubTab === 'batch'} onClick={() => setActiveSubTab('batch')} />
                    <SubTabButton label="BatchKu" isActive={activeSubTab === 'batchKu'} onClick={() => setActiveSubTab('batchKu')} />
                    <SubTabButton label="Batch (.txt)" isActive={activeSubTab === 'batchTxt'} onClick={() => setActiveSubTab('batchTxt')} />
                    <SubTabButton label="Batch (JSON)" isActive={activeSubTab === 'batchJson'} onClick={() => setActiveSubTab('batchJson')} />
                </div>
            </div>
            <div className="flex-grow overflow-hidden">
                {renderContent()}
            </div>
        </div>
    </div>
  );
}

export default CtGenerate;