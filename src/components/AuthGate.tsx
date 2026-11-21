import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import type { AuthStatusResponse, AuthUser } from '../shared/types';
import { ROLE_PROFILES, SchoolCrest } from './RoleAvatar';

export function AuthGate({
  status,
  onAuthenticated,
}: {
  status: AuthStatusResponse;
  onAuthenticated: (token: string, user: AuthUser) => void;
}) {
  const isSetup = status.requiresInitialSetup;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Could not create School Owner account.');
      }
      onAuthenticated(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Sign in failed.');
      }
      onAuthenticated(data.token, data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#EEF4FF] via-[#F4F7FB] to-[#ECFDF5] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-lg items-stretch">
        {/* Left Institutional Panel */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0F1E4A] via-[#163172] to-[#1D4ED8] text-white p-7 sm:p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-3.5">
              <SchoolCrest size="md" />
              <div className="min-w-0">
                <div className="text-base font-bold text-white truncate">
                  {status.schoolName || 'My School Management System'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-white leading-snug tracking-tight" style={{ textWrap: 'balance' }}>
                {isSetup
                  ? 'Welcome! Set Up Your School Account'
                  : 'Welcome Back! Sign In'}
              </h1>
              <p className="text-xs text-blue-100/90 leading-relaxed">
                {isSetup
                  ? 'Manage student admissions, school fees, defaulters, staff salaries, and daily expenses in Ugandan Shillings (UGX) — saved safely on your local computer with zero monthly fees.'
                  : 'Enter your staff username and password to open your school dashboard.'}
              </p>
            </div>

            <div className="pt-5 border-t border-white/15 space-y-3">
              <div className="text-xs font-medium text-blue-200">Included School Dashboards</div>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{ROLE_PROFILES.owner.roleLabel}</div>
                    <div className="text-blue-100/85">Approve expenses, check profit &amp; loss, and create staff logins</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-sky-400/20 text-sky-300 flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{ROLE_PROFILES.headteacher.roleLabel}</div>
                    <div className="text-blue-100/85">Check classes, attendance, teachers, and school notices</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{ROLE_PROFILES.bursar.roleLabel}</div>
                    <div className="text-blue-100/85">Collect fees, see defaulters, pay salaries, and track expenses</div>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-400/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{ROLE_PROFILES.registrar.roleLabel}</div>
                    <div className="text-blue-100/85">Register new students, assign IDs, and manage classes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-white/15 text-[11px] text-blue-200/85">
            100% Free Local Database · Simple &amp; Easy to Use
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center bg-white">
          {isSetup ? (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-emerald-700 mb-1">Quick 1-Minute Setup · No Internet Required</div>
                <h2 className="text-xl font-semibold text-slate-900">Create School Owner Login</h2>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Type your name and choose a simple username and password. Once inside, you can set your school&apos;s name and add logins for your Head Teacher, Bursar, and Registrar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Grace Namazzi"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Choose a Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g., owner"
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password (at least 6 letters/numbers) *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Type Password Again *</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl hover:from-blue-800 hover:to-indigo-800 disabled:opacity-50 transition-all shadow-sm"
              >
                {submitting ? 'Setting Up Your School System...' : 'Create Account & Open School System'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <div className="text-xs font-semibold text-blue-700 mb-1">Staff &amp; Leadership Portal</div>
                <h2 className="text-xl font-semibold text-slate-900">Sign In to Your School</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Type the username and password given to you by the School Owner.
                </p>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Type your username"
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Type your password"
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-700 to-indigo-700 rounded-xl hover:from-blue-800 hover:to-indigo-800 disabled:opacity-50 transition-all shadow-sm"
              >
                {submitting ? 'Signing In...' : 'Sign In Now'}
              </button>

              <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                Need a login for a Head Teacher / Headmaster, Bursar, or Registrar? Ask the School Owner to add it under <span className="font-medium text-slate-700">User Logins</span>.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
