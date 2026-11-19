import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight, Shield } from 'lucide-react';
import { useAuth } from '../lib/authContext';

export function AdminLoginPage() {
  const { firebaseUser, isAdmin, authReady, authBusy, signInAsAdmin, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady) return;
    if (firebaseUser && isAdmin) {
      navigate('/admin/dashboard', { replace: true });
    } else if (firebaseUser && !isAdmin) {
      setDeniedMessage('Access Denied. You are not authorized to access the Admin Portal.');
    }
  }, [authReady, firebaseUser, isAdmin, navigate]);

  const handleAdminSignIn = async () => {
    setDeniedMessage(null);
    const res = await signInAsAdmin();
    if (res.ok) {
      navigate('/admin/dashboard', { replace: true });
    } else {
      setDeniedMessage(res.message || 'Access Denied. You are not authorized to access the Admin Portal.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B192C] flex flex-col">
      <header className="border-b border-white/10 px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display font-bold text-lg text-white tracking-tight">
          CampusLoop
        </Link>
        <Link
          to="/login"
          className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
        >
          Customer Portal Login
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 sm:p-10">
          <div className="w-11 h-11 rounded-xl bg-[#0B192C] text-teal-400 flex items-center justify-center mb-5">
            <Shield className="w-5 h-5" />
          </div>

          <h1 className="text-2xl font-display font-bold text-slate-900">
            CampusLoop Admin Portal
          </h1>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Restricted operations console for listing moderation, student verification, trust &amp; safety, and venture planning. Only authorized administrators verified by the server-side allowlist may enter.
          </p>

          {deniedMessage && (
            <div className="mt-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900">
              <div className="flex items-start gap-2.5">
                <AlertOctagon className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold">{deniedMessage}</p>
                  <p className="mt-1 text-red-700">
                    Customer accounts do not have administrative privileges.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/customer/dashboard')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  Go to Customer Portal
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {firebaseUser && (
                  <button
                    type="button"
                    onClick={async () => {
                      await signOutUser();
                      setDeniedMessage(null);
                    }}
                    className="px-3 py-1.5 border border-red-300 text-red-800 text-xs font-medium rounded-lg hover:bg-red-100 cursor-pointer"
                  >
                    Switch Google Account
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={authBusy}
            onClick={handleAdminSignIn}
            className="mt-6 w-full inline-flex items-center justify-center gap-3 px-5 py-3 bg-[#0B192C] text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
            {authBusy ? 'Verifying Admin Role...' : 'Sign in with Google'}
          </button>

          <p className="mt-6 text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-4">
            Role verification is enforced via Cloud Firestore Security Rules (<code className="font-mono text-[11px]">admins/&#123;uid&#125;</code>). Self-registration as admin is disabled.
          </p>
        </div>
      </div>
    </div>
  );
}
