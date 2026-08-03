import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { useShopAuth } from '../../contexts/ShopAuthContext';
import { Input, Button } from '../../components/ui';
import { getErrorMessage } from '../../lib/api';

/**
 * Customer registration for the storefront account area. `register()` (POST /shop/auth/register)
 * does not itself sign the customer in - no cookie is set by that endpoint - so on success this
 * immediately follows up with `login()` using the same credentials for a one-step signup flow,
 * then lands on the account skeleton page.
 */
export default function ShopRegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, login } = useShopAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, fullName, phone);
      await login(email, password);
      navigate('/shop/account');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create your account. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Create an account</h1>
          <p className="text-sm text-slate-500 mb-6">
            Track orders and keep your loyalty points and store credit in one place.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Input
              label="Full name"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Input
              label="Phone"
              type="tel"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              helperText="At least 8 characters."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <Button type="submit" loading={loading} className="w-full" icon={<UserPlus className="h-4 w-4" />}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/shop/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
