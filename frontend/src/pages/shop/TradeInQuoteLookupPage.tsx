import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import PublicLayout from '../../components/PublicLayout';
import { Button } from '../../components/ui';
import { useShopAuth } from '../../contexts/ShopAuthContext';

/**
 * Trade-in quotes now always live in {@code /shop/account} (Trade-ins tab) - this page no longer
 * performs a guest quote-number+email lookup (OWNER DECISION, 2026-08: online trade-in requests
 * are members-only, and the backend guest lookup endpoint, {@code GET
 * /api/v1/public/shop/quotes/{quoteNumber}?email=}, has been deleted). The route is kept (rather
 * than removed outright) so an old bookmark/link to {@code /shop/trade-in/lookup} still lands
 * somewhere useful instead of 404ing, per the task's "remove or repoint" instruction - repointed
 * here to a prompt towards sign-in/account rather than a redirect, so the visitor understands WHY
 * the old lookup form is gone rather than being silently bounced.
 */
export default function TradeInQuoteLookupPage() {
  const { isAuthenticated } = useShopAuth();
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">Check a trade-in quote</h1>
          <p className="text-slate-600">
            Trade-in quotes are now shown on your account page (Trade-ins tab), alongside their status and any
            final offer from our staff - there is no separate guest lookup any more.
          </p>
          {isAuthenticated ? (
            <Button className="w-full sm:w-auto" onClick={() => navigate('/shop/account')}>
              Go to my account
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                icon={<UserPlus className="w-4 h-4" />}
                className="w-full sm:w-auto"
                onClick={() => navigate('/shop/register')}
              >
                Create an account
              </Button>
              <Button
                variant="secondary"
                icon={<LogIn className="w-4 h-4" />}
                className="w-full sm:w-auto"
                onClick={() => navigate('/shop/login')}
              >
                Sign in
              </Button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
