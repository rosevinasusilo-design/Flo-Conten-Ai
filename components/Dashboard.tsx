import React from 'react';

const Dashboard: React.FC = () => {
    return (
        <div className="p-4 sm:p-6 lg:p-8 h-full flex items-center justify-center bg-dots-pattern">
            <div className="text-center relative z-10 bg-gray-900/50 backdrop-blur-sm p-6 md:p-12 rounded-2xl border border-gray-800 flex flex-col items-center">
                <div className="flex items-center justify-center mb-6">
                    <svg width="80" height="80" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 sm:w-24 sm:h-24">
                        <defs>
                            <linearGradient id="logo-swirl-1-dashboard" x1="50" y1="0" x2="150" y2="200" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#34D399"/>
                                <stop offset="1" stopColor="#059669"/>
                            </linearGradient>
                            <linearGradient id="logo-swirl-2-dashboard" x1="150" y1="0" x2="50" y2="200" gradientUnits="userSpaceOnUse">
                                <stop stopColor="#6EE7B7"/>
                                <stop offset="1" stopColor="#10B981"/>
                            </linearGradient>
                        </defs>
                        <path d="M150 50 C180 80 180 120 150 150 C120 180 80 180 50 150 C20 120 20 80 50 50 C80 20 120 20 150 50 Z" stroke="url(#logo-swirl-1-dashboard)" strokeWidth="20" strokeLinecap="round" transform="rotate(45 100 100)" />
                        <path d="M130 70 C150 90 150 110 130 130 C110 150 90 150 70 130 C50 110 50 90 70 70 C90 50 110 50 130 70 Z" stroke="url(#logo-swirl-2-dashboard)" strokeWidth="20" strokeLinecap="round" transform="rotate(-45 100 100)" />
                    </svg>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">Flo's</span> Content Ai
                </h1>
                <p className="mt-6 max-w-3xl mx-auto text-slate-400 leading-relaxed">
                    adalah asisten digital cerdas yang membantu menghasilkan ide, naskah, dan visual konten dengan cepat dan presisi. Dirancang untuk kreator modern, AI ini mampu menganalisis tren, menyesuaikan gaya bahasa sesuai target audiens, serta menghasilkan konten video, gambar, maupun teks yang menarik, efisien, dan siap publikasi. Cocok untuk brand, marketer, dan kreator yang ingin mempercepat produksi konten tanpa mengorbankan kualitas.
                </p>
            </div>
        </div>
    );
};

export default Dashboard;