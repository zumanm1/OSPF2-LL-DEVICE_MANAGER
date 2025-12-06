import React, { useState, useEffect } from 'react';
import { API_BASE_URL, BACKEND_URL } from '../config';

interface AuthStatus {
  security_enabled: boolean;
  authenticated: boolean;
  login_count: number;
  max_login_uses: number;
  password_expired: boolean;
  logins_remaining: number | string;
  has_custom_password?: boolean;
  session?: {
    username: string;
    logins_remaining: number | string;
  };
}

interface PasswordStatus {
  has_custom_password: boolean;
  password_type: string;
  message: string;
}

interface LoginProps {
  onLoginSuccess: (token: string, username: string) => void;
}

type ViewMode = 'login' | 'change-password' | 'reset-password';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<PasswordStatus | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('login');

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // PIN reset field
  const [resetPin, setResetPin] = useState('');

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    checkPasswordStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/status`, {
        credentials: 'include',
      });
      const status = await response.json();
      setAuthStatus(status);

      // If already authenticated, auto-login
      if (status.authenticated && status.session) {
        onLoginSuccess('', status.session.username);
      }

      // If security is disabled, auto-login
      if (!status.security_enabled) {
        onLoginSuccess('', 'admin');
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      setError('Unable to connect to server. Please ensure the backend is running.');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const checkPasswordStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-status`, {
        credentials: 'include',
      });
      const status = await response.json();
      setPasswordStatus(status);
    } catch (error) {
      console.error('Failed to check password status:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        // Store token in localStorage as backup
        if (data.session_token) {
          localStorage.setItem('session_token', data.session_token);
        }
        onLoginSuccess(data.session_token || '', data.username);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setSuccess('Password changed successfully! You can now login with your new password.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        checkPasswordStatus();
        setTimeout(() => setViewMode('login'), 2000);
      } else {
        setError(data.detail || data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Change password error:', error);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password-with-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ pin: resetPin }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setSuccess('Password reset to default (netviz_admin/V3ry$trongAdm1n!2025). You can now login.');
        setResetPin('');
        checkPasswordStatus();
        setTimeout(() => setViewMode('login'), 2000);
      } else {
        setError(data.detail || data.message || 'Invalid PIN or reset failed');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('Unable to connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="text-white text-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          Checking authentication...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">NetMan OSPF</h1>
          <p className="text-gray-400">Device Manager</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-gray-700">
          {/* View Mode Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4">
            <button
              onClick={() => { setViewMode('login'); setError(null); setSuccess(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'login'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setViewMode('change-password'); setError(null); setSuccess(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'change-password'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Change Password
            </button>
            <button
              onClick={() => { setViewMode('reset-password'); setError(null); setSuccess(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'reset-password'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Reset
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-300 text-sm">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{success}</span>
              </div>
            </div>
          )}

          {/* Password Status Banner */}
          {passwordStatus && viewMode === 'login' && (
            <div className={`mb-4 p-3 rounded-lg text-xs ${
              passwordStatus.has_custom_password
                ? 'bg-purple-900/50 border border-purple-700 text-purple-300'
                : 'bg-blue-900/50 border border-blue-700 text-blue-300'
            }`}>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                </svg>
                <span>{passwordStatus.message}</span>
              </div>
            </div>
          )}

          {/* LOGIN VIEW */}
          {viewMode === 'login' && (
            <>
              <h2 className="text-2xl font-semibold text-white mb-6 text-center">Sign In</h2>

              {/* Password Expired Warning */}
              {authStatus?.password_expired && (
                <div className="mb-6 p-4 bg-amber-900/50 border border-amber-700 rounded-lg text-amber-300 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <strong>Password Expired</strong>
                      <p className="mt-1">Please update your password in .env.local and restart the backend.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your username"
                    required
                    autoFocus
                    disabled={authStatus?.password_expired}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    required
                    disabled={authStatus?.password_expired}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || authStatus?.password_expired}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Sign In
                    </>
                  )}
                </button>
              </form>

              {/* Login Info */}
              {authStatus && !authStatus.password_expired && authStatus.max_login_uses > 0 && (
                <div className="mt-6 p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-xs text-gray-400 text-center">
                    Login count: {authStatus.login_count} / {authStatus.max_login_uses}
                    <br />
                    <span className="text-gray-500">Password expires after {authStatus.max_login_uses} logins</span>
                  </p>
                </div>
              )}
            </>
          )}

          {/* CHANGE PASSWORD VIEW */}
          {viewMode === 'change-password' && (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 text-center">Change Password</h2>
              <p className="text-gray-400 text-sm text-center mb-6">
                Set a permanent custom password. Once set, only PIN reset can restore defaults.
              </p>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label htmlFor="current-password" className="block text-sm font-medium text-gray-300 mb-2">
                    Current Password
                  </label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter new password (min 6 chars)"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Confirm new password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Changing...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                <p className="text-xs text-amber-400 text-center">
                  Password is securely hashed and cannot be recovered. Use PIN reset if forgotten.
                </p>
              </div>
            </>
          )}

          {/* RESET PASSWORD VIEW */}
          {viewMode === 'reset-password' && (
            <>
              <h2 className="text-2xl font-semibold text-white mb-2 text-center">Reset Password</h2>
              <p className="text-gray-400 text-sm text-center mb-6">
                Enter the admin PIN to reset password to default (netviz_admin/V3ry$trongAdm1n!2025).
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label htmlFor="reset-pin" className="block text-sm font-medium text-gray-300 mb-2">
                    Admin Reset PIN
                  </label>
                  <input
                    id="reset-pin"
                    type="password"
                    value={resetPin}
                    onChange={(e) => setResetPin(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all text-center text-2xl tracking-widest"
                    placeholder="*****"
                    required
                    maxLength={10}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !resetPin}
                  className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset to Default
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p className="text-xs text-red-400 text-center">
                  This will remove any custom password and restore default credentials.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-gray-500 text-sm">
          NetMan OSPF Device Manager &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default Login;
