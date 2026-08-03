import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { useShopAuth } from '../../contexts/ShopAuthContext';
import { Input, Button } from '../../components/ui';
import { getErrorMessage } from '../../lib/api';

/**
 * Customer sign-in for the storefront account area. Deliberately separate from the staff
 * `LoginPage` - posts to `shopApi` (`/shop/auth/login`, MULAERP_SHOP cookie) via
 * `useShopAuth()`, never the staff `AuthContext`.
 */
export default function ShopLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useShopAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/shop/account');
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-6">Access your account, orders, and rewards.</p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" loading={loading} className="w-full" icon={<LogIn className="h-4 w-4" />}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            New here?{' '}
            <Link to="/shop/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
