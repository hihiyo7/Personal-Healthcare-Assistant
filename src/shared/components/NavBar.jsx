import React from 'react';
import { LogOut, Moon, Sun } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function NavBar({ user, setView, currentView, onLogout, onLogoClick, isDarkMode, toggleTheme }) {
  return (
    <nav className={`border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 transition-colors duration-300 
      ${isDarkMode ? 'bg-slate-900 border-slate-800 shadow-lg shadow-blue-900/10' : 'bg-white border-slate-200 shadow-sm'}`}>
      
      <div className="flex items-center gap-3 cursor-pointer" onClick={onLogoClick}>
        <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md">
          <img src={logo} alt="PHA Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <span className={`text-2xl font-bold block tracking-wide ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            Personal Healthcare Assistant
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button 
          onClick={toggleTheme} 
          className={`p-2 rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <NavBtn active={currentView === 'dashboard'} onClick={() => setView('dashboard')} isDarkMode={isDarkMode}>Dashboard</NavBtn>
        <NavBtn active={currentView === 'profile'} onClick={() => setView('profile')} isDarkMode={isDarkMode}>Profile</NavBtn>
        
        <div className={`h-4 w-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></div>
        
        <button onClick={onLogout} className="text-slate-400 hover:text-red-500 flex items-center gap-2 text-sm font-medium transition-colors">
          <LogOut size={16}/> Sign Out
        </button>
      </div>
    </nav>
  );
}

const NavBtn = ({ children, active, onClick, isDarkMode }) => (
  <button 
    onClick={onClick} 
    className={`text-sm font-medium transition-all duration-300 ${
      active 
      ? 'text-blue-500 font-bold' 
      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    {children}
  </button>
);
