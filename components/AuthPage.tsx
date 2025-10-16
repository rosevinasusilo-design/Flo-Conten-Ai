import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Spinner } from './Spinner';
import { AuthInput } from './AuthInput';
import Button from './Button';

const SuccessPopup = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm m-4 p-6 border border-gray-700 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center items-center mx-auto h-12 w-12 rounded-full bg-emerald-500/20">
          <i className="fa-solid fa-check text-2xl text-emerald-400"></i>
        </div>
        <h3 className="mt-4 text-lg font-medium text-white">Pendaftaran Berhasil</h3>
        <p className="mt-2 text-sm text-gray-400">
          untuk aktivasi WA 0819696162
        </p>
        <div className="mt-6">
          <Button onClick={onClose} className="w-full justify-center">
            Mengerti
          </Button>
        </div>
      </div>
    </div>
);

const ActivationPopup = ({ onClose }: { onClose: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm m-4 p-6 border border-gray-700 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center items-center mx-auto h-12 w-12 rounded-full bg-yellow-500/20">
          <i className="fa-solid fa-triangle-exclamation text-2xl text-yellow-400"></i>
        </div>
        <h3 className="mt-4 text-lg font-medium text-white">Aktivasi Diperlukan</h3>
        <p className="mt-2 text-sm text-gray-400">
          Akun Anda belum diaktifkan Admin, silahkan hubungi WA 0819696162.
        </p>
        <div className="mt-6">
          <Button onClick={onClose} className="w-full justify-center">
            Mengerti
          </Button>
        </div>
      </div>
    </div>
);

const AuthPage: React.FC = () => {
    const { login, register } = useAuth();
    const { t } = useLanguage();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [showActivationPopup, setShowActivationPopup] = useState(false);
    const [formErrors, setFormErrors] = useState<{ email?: string; password?: string }>({});

    const validateForm = () => {
        const errors: { email?: string; password?: string } = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email.trim()) {
            errors.email = t('emailRequired');
        } else if (!emailRegex.test(email)) {
            errors.email = t('emailInvalid');
        }

        if (!password) {
            errors.password = t('passwordRequired');
        } else if (password.length < 6) {
            errors.password = t('passwordMinLength');
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(email, password);
                setShowSuccessPopup(true);
            }
        } catch (err: any) {
             const defaultError = 'Terjadi kesalahan yang tidak diketahui.';
             let errorMessage = err.message || defaultError;

             if (errorMessage.includes("Akun Anda belum diaktifkan oleh administrator")) {
                setShowActivationPopup(true);
             } else {
                 if (errorMessage.includes("Invalid login credentials")) {
                    errorMessage = "Email atau password salah. Silakan coba lagi.";
                 } else if (errorMessage.includes("User not found")) {
                     errorMessage = "Pengguna tidak ditemukan.";
                 } else if (errorMessage.includes("rate limit")) {
                     errorMessage = "Terlalu banyak percobaan. Silakan coba lagi nanti.";
                 }
                setError(errorMessage);
             }
        } finally {
            setLoading(false);
        }
    };

    const switchMode = (newMode: 'login' | 'register') => {
        setMode(newMode);
        setError(null);
        setFormErrors({});
        setEmail('');
        setPassword('');
    }

    const handleClosePopup = () => {
        setShowSuccessPopup(false);
        switchMode('login');
    };

    return (
        <>
            <div className="flex min-h-screen w-full items-center justify-center bg-gray-900 p-4">
                <div className="w-full max-w-sm md:max-w-4xl grid md:grid-cols-2 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
                    {/* Left Panel */}
                    <div className="relative hidden md:flex flex-col items-center justify-center p-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-700 via-gray-900 to-black text-white text-center">
                        <div className="relative z-10 flex flex-col items-center">
                            <div className="flex items-center justify-center mb-6">
                                <svg width="80" height="80" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-24 h-24">
                                    <defs>
                                        <linearGradient id="logo-swirl-1" x1="50" y1="0" x2="150" y2="200" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#34D399"/>
                                            <stop offset="1" stopColor="#059669"/>
                                        </linearGradient>
                                        <linearGradient id="logo-swirl-2" x1="150" y1="0" x2="50" y2="200" gradientUnits="userSpaceOnUse">
                                            <stop stopColor="#6EE7B7"/>
                                            <stop offset="1" stopColor="#10B981"/>
                                        </linearGradient>
                                    </defs>
                                    <path d="M150 50 C180 80 180 120 150 150 C120 180 80 180 50 150 C20 120 20 80 50 50 C80 20 120 20 150 50 Z" stroke="url(#logo-swirl-1)" strokeWidth="20" strokeLinecap="round" transform="rotate(45 100 100)" />
                                    <path d="M130 70 C150 90 150 110 130 130 C110 150 90 150 70 130 C50 110 50 90 70 70 C90 50 110 50 130 70 Z" stroke="url(#logo-swirl-2)" strokeWidth="20" strokeLinecap="round" transform="rotate(-45 100 100)" />
                                </svg>
                            </div>
                            <h1 className="text-4xl font-bold">Flo's Content Ai</h1>
                        </div>
                    </div>
                    {/* Right Panel */}
                    <div className="p-8 sm:p-12 bg-gray-800">
                        <h2 className="text-2xl font-bold text-white">{mode === 'login' ? 'Login disini' : 'Buat Akun Baru'}</h2>
                        
                        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                             <div>
                                <AuthInput
                                    id="email"
                                    label="Email"
                                    type="email"
                                    placeholder="anda@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                                {formErrors.email && <p className="text-xs text-red-400 mt-1 pl-1">{formErrors.email}</p>}
                            </div>
                             <div>
                                <AuthInput
                                    id="password"
                                    label="Password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                                {formErrors.password && <p className="text-xs text-red-400 mt-1 pl-1">{formErrors.password}</p>}
                            </div>
                            
                            {mode === 'login' && (
                                <div className="text-right">
                                    <a href="#" className="text-xs font-medium text-emerald-400 hover:text-emerald-300">Lupa Password?</a>
                                </div>
                            )}

                            {error && <p className="text-xs text-center text-red-400 bg-red-900/30 p-2 rounded-md">{error}</p>}

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                                >
                                    {loading ? <Spinner /> : (mode === 'login' ? 'Login' : 'Daftar')}
                                </button>
                            </div>

                            <div className="text-center text-sm">
                                {mode === 'login' ? (
                                    <p className="text-slate-400">Belum punya akun? <button type="button" onClick={() => switchMode('register')} className="font-medium text-emerald-400 hover:text-emerald-300">Daftar di sini</button></p>
                                ) : (
                                    <p className="text-slate-400">Sudah punya akun? <button type="button" onClick={() => switchMode('login')} className="font-medium text-emerald-400 hover:text-emerald-300">Login di sini</button></p>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            </div>
            {showSuccessPopup && <SuccessPopup onClose={handleClosePopup} />}
            {showActivationPopup && <ActivationPopup onClose={() => setShowActivationPopup(false)} />}
            <style>{`
                @keyframes fadeIn {
                  from { opacity: 0; transform: scale(0.95); }
                  to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in-fast {
                  animation: fadeIn 0.2s ease-in-out;
                }
            `}</style>
        </>
    );
};

export default AuthPage;