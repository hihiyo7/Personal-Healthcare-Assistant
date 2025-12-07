import React, { useEffect } from 'react';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [onClose, duration]);

  const styles = {
    success: {
      bg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
      icon: <CheckCircle size={22} />,
    },
    error: {
      bg: 'bg-gradient-to-r from-red-500 to-rose-500',
      icon: <AlertCircle size={22} />,
    },
    info: {
      bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      icon: <Info size={22} />,
    },
  };

  const style = styles[type] || styles.success;

  return (
    <div className="fixed inset-0 flex items-start justify-center z-[100] pointer-events-none pt-20">
      <div 
        className={`${style.bg} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto animate-toast-in`}
        style={{
          animation: 'toastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {style.icon}
        <span className="font-semibold text-sm">{message}</span>
        <button 
          onClick={onClose} 
          className="ml-2 p-1 rounded-full hover:bg-white/20 transition"
        >
          <X size={16} />
        </button>
      </div>
      <style>{`
        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}



