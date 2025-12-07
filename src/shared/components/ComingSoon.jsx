import React from 'react';

export default function ComingSoon({ title, icon, onBack }) {
  return (
    <div className="text-center py-20 space-y-6 animate-fade-in">
      <div className="w-24 h-24 bg-slate-200 rounded-full mx-auto flex items-center justify-center text-slate-400">{icon}</div>
      <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
      <p className="text-slate-500">This module is under development.</p>
      <button onClick={onBack} className="text-blue-600 font-bold hover:underline">Go Back</button>
    </div>
  );
}