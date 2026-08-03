import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getErrorMessage } from '../../lib/api';
import { LogIn, Mail, Lock, Sparkles } from 'lucide-react';
import { branding } from '../../branding';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    if (!email) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid credentials. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-brand-600 p-4 rounded-lg">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="text-4xl font-extrabold text-slate-900">
            Sign In
          </h2>
          <p className="mt-3 text-lg text-slate-600 font-medium">
            {branding.appName} - Enterprise Resource Planning
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-sm p-8 border border-slate-200">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-800 font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-transparent transition-colors"
                    placeholder="admin@mulaerp.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus:border-transparent transition-colors"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent text-base font-medium rounded-lg text-white bg-brand-600 hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Sign in to Dashboard
                  </>
                )}
              </button>
            </div>

            {/* Deployment hardening: only ever render in dev/e2e builds (import.meta.env.DEV is
                false in a production Vite build) - a deployed test-prod instance must not show
                the default admin credentials in plaintext to anyone who loads the login page. */}
            {import.meta.env.DEV && (
              <div className="text-center">
                <p className="text-sm text-slate-600">
                  Default credentials: <span className="font-semibold text-brand-600">admin@mulaerp.com</span> / <span className="font-semibold text-brand-600">admin123</span>
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-slate-600">
          {branding.copyright}
        </p>
      </div>
    </div>
  );
}
