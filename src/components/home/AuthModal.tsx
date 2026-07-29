import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Mail, Lock, Shield, Check } from 'lucide-react';
import { User } from '../../types';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onClose, onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let loggedInUser: User | null = null;

      // 1. Attempt standard Supabase Auth
      try {
        if (isRegister) {
          const { data, error: sbError } = await supabase.auth.signUp({
            email,
            password,
          });

          if (!sbError && data?.user) {
            const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
            loggedInUser = {
              id: typeof data.user.id === 'number' ? data.user.id : Math.abs(hashCode(data.user.id)),
              email: data.user.email || email,
              role,
            };
            setSuccessMsg('Supabase account created successfully!');
          } else if (sbError && !sbError.message.includes('FetchError') && !sbError.message.includes('Failed to fetch')) {
            throw new Error(sbError.message);
          }
        } else {
          const { data, error: sbError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!sbError && data?.user) {
            const role = email.toLowerCase().includes('admin') ? 'admin' : 'user';
            loggedInUser = {
              id: typeof data.user.id === 'number' ? data.user.id : Math.abs(hashCode(data.user.id)),
              email: data.user.email || email,
              role,
            };
          } else if (sbError && !sbError.message.includes('FetchError') && !sbError.message.includes('Failed to fetch')) {
            throw new Error(sbError.message);
          }
        }
      } catch (sbErr: any) {
        // If it's an explicit auth error (e.g., wrong password), surface it
        if (sbErr?.message && !sbErr.message.includes('URL') && !sbErr.message.includes('fetch')) {
          throw sbErr;
        }
      }

      // 2. Fallback to API endpoint authentication if Supabase client is unconfigured or returns offline
      if (!loggedInUser) {
        const url = isRegister ? '/api/auth/register' : '/api/auth/login';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const contentType = res.headers.get('content-type');
        let data: any = {};
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          throw new Error(text || `HTTP error! Status: ${res.status}`);
        }

        if (!res.ok) {
          throw new Error(data?.error || 'Authentication failed');
        }

        loggedInUser = data.user;
        if (isRegister) {
          setSuccessMsg('Account registered successfully!');
        }
      }

      if (loggedInUser) {
        const userToLogin = loggedInUser;
        if (isRegister) {
          setTimeout(() => {
            onLoginSuccess(userToLogin);
            onClose();
          }, 1000);
        } else {
          onLoginSuccess(userToLogin);
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Auth submit error:', err);
      const errorStr = String(err.message || err);
      if (errorStr.toUpperCase().includes('JSON') || errorStr.toUpperCase().includes('TOKEN <')) {
        setError('Database server error. Please try again.');
      } else {
        setError(errorStr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Helper string hash to generate numeric ID if UUID is returned
  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.18)] max-w-md w-full relative z-10 border border-slate-100 overflow-hidden font-sans"
      >
        {/* Decorative Top Accent line */}
        <div className="h-2 w-full bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 animate-pulse" />

        <div className="p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight leading-tight">
                {isRegister ? 'Create Account' : 'Welcome to MadaTours'}
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mt-1">
                {isRegister ? 'Get interactive favorites & revisits' : 'Log in to sync your island list'}
              </span>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div className="text-left">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Email Coordinates</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Mail size={15} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="text-left">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Pass-key Secure Code</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 pointer-events-none">
                  <Lock size={15} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-orange-500 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="bg-red-50 border border-red-100 p-3 rounded-xl text-[10px] font-bold text-red-650 text-center uppercase tracking-wide">
                ⚠️ {error}
              </div>
            )}

            {/* Success banner */}
            {successMsg && (
              <div className="bg-green-50 border border-green-100 p-3 rounded-xl text-[10px] font-bold text-green-700 text-center uppercase tracking-wide flex items-center justify-center gap-1.5">
                <Check size={12} className="stroke-[3]" /> {successMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-100 text-white disabled:text-slate-400 font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all border-none cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>{isRegister ? 'Register SQL User' : 'Sign In To Account'}</span>
              )}
            </button>
          </form>

          {/* Quick toggle link */}
          <div className="mt-5 text-center text-xs font-semibold text-slate-500">
            {isRegister ? (
              <span>Already have an account? <button onClick={() => { setIsRegister(false); setError(null); }} className="text-orange-600 font-bold hover:underline bg-transparent border-none p-0">Login here</button></span>
            ) : (
              <span>Need an account? <button onClick={() => { setIsRegister(true); setError(null); }} className="text-orange-600 font-bold hover:underline bg-transparent border-none p-0">Register here</button></span>
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col items-center gap-2">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none">
              <Shield size={10} /> Configured Access Profiles
            </div>
            <div className="grid grid-cols-2 gap-2 w-full text-[10px] font-medium text-slate-400">
              <button 
                type="button"
                onClick={() => {
                  setEmail('admin@madatours.com');
                  setPassword('admin');
                }}
                className="bg-slate-50 border border-slate-150 hover:bg-slate-100 p-2.5 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
              >
                <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[9px]">🔐 Administrator</span>
                <span className="text-[8px] text-slate-500 font-mono">admin@madatours.com / admin</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('user@madatours.com');
                  setPassword('user');
                }}
                className="bg-slate-50 border border-slate-150 hover:bg-slate-100 p-2.5 rounded-xl text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
              >
                <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[9px]">👤 Normal Member</span>
                <span className="text-[8px] text-slate-500 font-mono">user@madatours.com / user</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
