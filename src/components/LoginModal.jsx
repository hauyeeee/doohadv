import React from 'react';
import { X, Loader2 } from 'lucide-react';

const LoginModal = ({ isOpen, onClose, handleGoogleLogin, isLoginLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl max-w-[450px] w-full p-8 relative flex flex-col items-center">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={20}/></button>
                <h1 className="text-2xl font-normal mb-2 text-center text-[#202124]">Sign in</h1>
                <button onClick={handleGoogleLogin} disabled={isLoginLoading} className="bg-[#1a73e8] text-white font-medium text-sm px-6 py-2 rounded-[4px] hover:bg-[#1557b0] transition-colors disabled:opacity-70 flex items-center gap-2">
                    {isLoginLoading && <Loader2 size={16} className="animate-spin" />} Sign in with Google
                </button>
            </div>
        </div>
    );
};
export default LoginModal;