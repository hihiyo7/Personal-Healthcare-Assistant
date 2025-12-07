import React from 'react';
import { Trophy, X } from 'lucide-react';

export default function Achievement({ show, onClose, title, desc }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-10 right-10 z-50 animate-bounce-up">
      <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white p-4 rounded-2xl shadow-2xl border border-yellow-300 flex items-start gap-4 pr-10 relative">
        <div className="bg-white/20 p-2 rounded-full">
          <Trophy size={24} className="text-yellow-100" />
        </div>
        <div>
          <h4 className="font-bold text-lg drop-shadow-sm">{title}</h4>
          <p className="text-sm text-yellow-100">{desc}</p>
        </div>
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 text-white/70 hover:text-white transition"
        >
          <X size={16}/>
        </button>
      </div>
    </div>
  );
}