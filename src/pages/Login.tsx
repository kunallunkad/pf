import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Star, Eye, EyeOff, User } from 'lucide-react';
import { usernameToEmail } from '../lib/utils';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'user' as 'admin' | 'user' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim()) { setError('Username is required'); return; }
    setLoading(true);
    const email = usernameToEmail(form.username.trim());
    if (mode === 'login') {
      const { error } = await signIn(email, form.password);
      if (error) setError('Invalid username or password');
    } else {
      const { error } = await signUp(email, form.password, form.displayName || form.username, form.role);
      if (error) setError(error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-neutral-900">
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-neutral-900 via-[#1a0a00] to-primary-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-white rounded-full"
              style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`, opacity: (i % 5) * 0.2 + 0.1 }} />
          ))}
        </div>
        <div className="relative">
          <img src="/Prachi_Fulfagar_Logo.png" alt="Prachi Fulfagar" className="h-20 object-contain brightness-200" />
        </div>
        <div className="relative space-y-6">
          <div>
            <p className="text-3xl font-bold text-white leading-tight">Your Celestial<br />Business Hub</p>
            <p className="text-neutral-300 mt-3 text-sm leading-relaxed">
              Complete management system for Vastu consultancy,<br />
              astrology practice, and product business — all in one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'CRM & Client Profiles' },
              { label: 'Professional Invoicing' },
              { label: 'Schedule & Travel' },
              { label: 'Inventory Management' },
            ].map(f => (
              <div key={f.label} className="bg-white/10 rounded-xl p-3 flex items-center gap-2.5">
                <div className="w-2 h-2 bg-primary-400 rounded-full shrink-0" />
                <p className="text-xs font-medium text-white">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[10px] text-neutral-500">© 2024 Prachi Fulfagar · Vastu Expert · Palmist · Astrologer</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-white fill-white" />
            </div>
            <p className="text-base font-bold text-neutral-800">Prachi Fulfagar</p>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            {mode === 'login' ? 'Sign in with your username and password' : 'Set up your access'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Display Name</label>
                <input
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  className="input"
                  placeholder="Your full name"
                />
              </div>
            )}
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  className="input pl-9"
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {mode === 'signup' && (
              <div>
                <label className="label">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))} className="input">
                  <option value="admin">Admin (Full Access)</option>
                  <option value="user">Staff (Limited Access)</option>
                </select>
                <p className="text-[10px] text-neutral-400 mt-1">Admin can view profits and purchase prices. Staff cannot.</p>
              </div>
            )}

            {error && (
              <div className="bg-error-50 border border-error-200 rounded-lg px-3 py-2 text-xs text-error-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-2.5 text-sm rounded-lg"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {mode === 'login' && import.meta.env.DEV && (
            <div className="mt-4 p-3 bg-neutral-50 rounded-lg border border-neutral-200">
              <p className="text-[10px] text-neutral-500 font-semibold mb-1">Default Login</p>
              <p className="text-xs text-neutral-600">Username: <span className="font-mono font-semibold">admin</span></p>
              <p className="text-xs text-neutral-600">Password: <span className="font-mono font-semibold">admin123</span></p>
            </div>
          )}

          <p className="text-center text-sm text-neutral-500 mt-5">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              className="text-primary-600 font-semibold hover:underline">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
