import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import logo from '../../assets/logo.png';

export default function Login({ onLogin, onSignup, isDarkMode, toggleTheme }) {
  const [isSignupState, setIsSignupState] = useState(false);
  const [input, setInput] = useState({ name: '', id: '', pw: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.id || !input.pw) { alert("정보를 입력해주세요."); return; }

    if (isSignupState) {
      if (!input.name) { alert("이름을 입력해주세요."); return; }
      const success = onSignup(input.name, input.id, input.pw);
      if (success) {
        setIsSignupState(false);
        setInput({ name: '', id: '', pw: '' });
      }
    } else {
      onLogin(input.id, input.pw);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 font-sans transition-colors duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-100'}`}>
      <div className={`p-10 rounded-3xl shadow-2xl w-full max-w-md border transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden shadow-lg">
            <img src={logo} alt="PHA Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{isSignupState ? "Join PHA" : "Welcome Back"}</h1>
          <p className="text-slate-500 text-sm mt-2">Personal Healthcare Assistant</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignupState && (
            <input 
              type="text" placeholder="Full Name" 
              className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-colors
                ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
              value={input.name} onChange={e => setInput({...input, name: e.target.value})} 
            />
          )}
          <input 
            type="text" placeholder="ID" 
            className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-colors
              ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
            value={input.id} onChange={e => setInput({...input, id: e.target.value})} 
          />
          <input 
            type="password" placeholder="Password" 
            className={`w-full p-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 transition-colors
              ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'}`}
            value={input.pw} onChange={e => setInput({...input, pw: e.target.value})} 
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2">
            {isSignupState ? "Create Account" : "Login"} <ArrowRight size={18} />
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isSignupState ? "Already have an account?" : "No account?"} 
          <span onClick={() => setIsSignupState(!isSignupState)} className="text-blue-500 font-bold cursor-pointer ml-1 hover:underline">
            {isSignupState ? "Log in" : "Sign up"}
          </span>
        </p>
      </div>
    </div>
  );
}
