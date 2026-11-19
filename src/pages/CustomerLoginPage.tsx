import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/authContext';

export function CustomerLoginPage() {
  const { firebaseUser, authReady, authBusy, authError, clearAuthError, signInAsCustomer } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && firebaseUser) {
      navigate('/customer/dashboard', { replace: true });
    }
  }, [authReady, firebaseUser, navigate]);

  const handleGoogleSignIn = async () => {
    clearAuthError();
    const ok = await signInAsCustomer();
    if (ok) {
      navigate('/customer/dashboard', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-6 h-16 flex items-center justify-between">
        <Link to="/" className="font-display font-bold text-xl text-slate-900 tracking-tight">
          CampusLoop
        </Link>
        <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
          <Link to="/explore" className="hover:text-slate-900">
            Browse Marketplace
          </Link>
          <Link to="/admin/login" className="hover:text-slate-900">
            Admin Portal
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-8 sm:p-10 flex flex-col justify-between bg-[#0B192C] text-white">
            <div>
              <p className="text-xs font-medium text-teal-400 tracking-wide">
                Student Peer-to-Peer Marketplace
              </p>
              <h1 className="mt-3 text-3xl font-display font-bold tracking-tight text-balance">
                CampusLoop
              </h1>
              <p className="mt-2 text-base text-slate-300 font-medium">
                Buy. Sell. Rent. Repeat.
              </p>
              <p className="mt-5 text-sm text-slate-300 leading-relaxed">
                Built for college and hostel students across DGU / Doon Business School and Dehradun campuses to exchange textbooks, formalwear, electronics, and dorm essentials affordably.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>Admin-moderated listings ensure genuine campus products.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <span>
                  Google Sign-In authenticates your account; student verification is completed in your profile with your college &amp; student ID details.
                </span>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10 flex flex-col justify-center">
            <h2 className="text-2xl font-display font-bold text-slate-900">
              Student Sign In
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Sign in with your Google account to access your CampusLoop dashboard, post listings, and message campus sellers.
            </p>

            {authError && (
              <div className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-relaxed">
                {authError}
              </div>
            )}

            <button
              type="button"
              disabled={authBusy}
              onClick={handleGoogleSignIn}
              className="mt-6 w-full inline-flex items-center justify-center gap-3 px-5 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                />
              </svg>
              {authBusy ? 'Authenticating...' : 'Continue with Google'}
            </button>

            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Want to explore first?</span>
              <Link
                to="/explore"
                className="inline-flex items-center gap-1 font-medium text-teal-700 hover:text-teal-800"
              >
                Open Marketplace
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
