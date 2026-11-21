'use client';

import Logo from './Logo';

const COUNTRIES = [
  'China',
  'United States',
  'Japan',
  'South Korea',
  'Singapore',
  'India',
  'Germany',
  'France',
  'Spain',
  'United Kingdom',
  'Brazil',
  'Australia',
  'UAE',
  'Other',
];

const SEX_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export default function AuthScreen({
  mode,
  setMode,
  registerForm,
  setRegisterForm,
  loginForm,
  setLoginForm,
  busy,
  error,
  onRegister,
  onLogin,
}) {
  return (
    <div className="welcome">
      <div className="welcome-card auth-card">
        <Logo size={48} />
        <h1>Brain Aid</h1>
        <p className="lede">Learn together across devices — one account, any browser.</p>

        <div className="chips auth-tabs">
          <button
            type="button"
            className={`chip ${mode === 'register' ? 'on' : ''}`}
            onClick={() => setMode('register')}
          >
            Create account
          </button>
          <button
            type="button"
            className={`chip ${mode === 'login' ? 'on' : ''}`}
            onClick={() => setMode('login')}
          >
            Log in
          </button>
        </div>

        {mode === 'login' ? (
          <>
            <div className="field">
              <label>Username</label>
              <input
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="your_username"
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="toast bad">{error}</p>}
            <button type="button" className="btn primary" disabled={busy} onClick={onLogin}>
              Log in
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label>Display name</label>
              <input
                value={registerForm.name}
                maxLength={32}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                placeholder="e.g. Alex"
              />
            </div>
            <div className="field">
              <label>Username</label>
              <input
                value={registerForm.username}
                onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                placeholder="alex_learn"
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                placeholder="At least 4 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label>Country</label>
              <select
                value={registerForm.country}
                onChange={(e) => setRegisterForm({ ...registerForm, country: e.target.value })}
              >
                <option value="">Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>Age</label>
                <input
                  type="number"
                  min={13}
                  max={120}
                  value={registerForm.age}
                  onChange={(e) => setRegisterForm({ ...registerForm, age: e.target.value })}
                  placeholder="25"
                />
              </div>
              <div className="field">
                <label>Sex</label>
                <select
                  value={registerForm.sex}
                  onChange={(e) => setRegisterForm({ ...registerForm, sex: e.target.value })}
                >
                  <option value="">Select</option>
                  {SEX_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {error && <p className="toast bad">{error}</p>}
            <button type="button" className="btn primary" disabled={busy} onClick={onRegister}>
              Create account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
