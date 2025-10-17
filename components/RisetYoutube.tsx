import React from 'react';

const RisetYoutube: React.FC = () => {
  return (
    <div className="flex h-full items-center justify-center bg-dots-pattern text-gray-500 p-8">
      <div className="text-center bg-gray-800/50 backdrop-blur-sm p-12 rounded-2xl border border-gray-700 max-w-lg">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="mt-6 text-2xl font-bold text-gray-300">Segera Hadir</h2>
        <p className="mt-2 text-gray-400">Fitur "Riset Youtube" sedang dalam pengembangan dan akan segera tersedia untuk Anda gunakan.</p>
      </div>
    </div>
  );
};

export default RisetYoutube;