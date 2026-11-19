import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowRight } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './lib/authContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { CreateEditListingPage } from './pages/CreateEditListingPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { CustomerLoginPage } from './pages/CustomerLoginPage';
import { ListingDetailPage } from './pages/ListingDetailPage';
import { MarketplaceExplorePage } from './pages/MarketplaceExplorePage';
import { MessagesPage } from './pages/MessagesPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { OrdersRequestsPage } from './pages/OrdersRequestsPage';
import { ProfilePage } from './pages/ProfilePage';

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="text-sm font-medium text-slate-600">Verifying CampusLoop session...</div>
    </div>
  );
}

function RequireCustomer({ children }: { children: React.ReactNode }) {
  const { firebaseUser, authReady } = useAuth();
  if (!authReady) return <AuthLoadingScreen />;
  if (!firebaseUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isAdmin, authReady } = useAuth();
  const navigate = useNavigate();

  if (!authReady) return <AuthLoadingScreen />;
  if (!firebaseUser) return <Navigate to="/admin/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0B192C] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 text-red-700 mb-3">
            <AlertOctagon className="w-6 h-6 shrink-0" />
            <h1 className="text-lg font-display font-bold text-slate-900">Access Denied</h1>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            Access Denied. You are not authorized to access the Admin Portal.
          </p>
          <button
            type="button"
            onClick={() => navigate('/customer/dashboard', { replace: true })}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 transition-colors cursor-pointer"
          >
            Return to Customer Portal
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Storefront & Explore */}
            <Route path="/" element={<MarketplaceExplorePage mode="landing" />} />
            <Route path="/explore" element={<MarketplaceExplorePage mode="explore" />} />
            <Route path="/listing/:listingId" element={<ListingDetailPage />} />

            {/* Customer Auth & Portal */}
            <Route path="/login" element={<CustomerLoginPage />} />
            <Route
              path="/customer/dashboard"
              element={
                <RequireCustomer>
                  <CustomerDashboardPage />
                </RequireCustomer>
              }
            />
            <Route
              path="/customer/sell"
              element={
                <RequireCustomer>
                  <CreateEditListingPage />
                </RequireCustomer>
              }
            />
            <Route
              path="/customer/edit/:listingId"
              element={
                <RequireCustomer>
                  <CreateEditListingPage />
                </RequireCustomer>
              }
            />
            <Route
              path="/customer/my-listings"
              element={
                <RequireCustomer>
                  <MyListingsPage />
                </RequireCustomer>
              }
            />
            <Route
              path="/customer/orders"
              element={
                <RequireCustomer>
                  <OrdersRequestsPage />
                </RequireCustomer>
              }
            />
            <Route
              path="/customer/messages"
              element={
                <RequireCustomer>
                  <MessagesPage />
                </RequireCustomer>
              }
            />
            <Route
              path="/customer/profile"
              element={
                <RequireCustomer>
                  <ProfilePage />
                </RequireCustomer>
              }
            />

            {/* Separate Admin Auth & Portal */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route
              path="/admin/dashboard"
              element={
                <RequireAdmin>
                  <AdminDashboardPage />
                </RequireAdmin>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
