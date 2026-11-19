import React, { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { markNotificationRead, subscribeUserNotifications } from '../lib/firestoreService';
import type { AppNotification } from '../types/campusloop';

interface CustomerLayoutProps {
  children: React.ReactNode;
}

export function CustomerLayout({ children }: CustomerLayoutProps) {
  const { firebaseUser, userRecord, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!firebaseUser) {
      setNotifications([]);
      return;
    }
    const unsub = subscribeUserNotifications(firebaseUser.uid, setNotifications);
    return () => unsub();
  }, [firebaseUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems = [
    { to: '/customer/dashboard', label: 'Home' },
    { to: '/explore', label: 'Explore' },
    { to: '/customer/sell', label: 'Sell / Rent' },
    { to: '/customer/my-listings', label: 'My Listings' },
    { to: '/customer/orders', label: 'My Orders' },
    { to: '/customer/messages', label: 'Messages' },
    { to: '/customer/profile', label: 'My Profile' },
  ];

  const handleSignOut = async () => {
    await signOutUser();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <Link
            to={firebaseUser ? '/customer/dashboard' : '/'}
            className="text-xl font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            CampusLoop
          </Link>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                    isActive
                      ? 'text-teal-700 border-teal-700 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {firebaseUser ? (
              <>
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Notifications"
                    onClick={() => setNotifOpen((prev) => !prev)}
                    className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-teal-600 text-white text-[10px] font-mono font-semibold rounded flex items-center justify-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">Notifications</span>
                        <button
                          type="button"
                          onClick={() => setNotifOpen(false)}
                          className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          Close
                        </button>
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-sm text-slate-500">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.slice(0, 12).map((n) => (
                            <button
                              key={n.notificationId}
                              type="button"
                              onClick={async () => {
                                if (!n.read) await markNotificationRead(n.notificationId);
                                setNotifOpen(false);
                                if (n.link) navigate(n.link);
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                                !n.read ? 'bg-teal-50/40' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                                {!n.read && <span className="text-[11px] font-medium text-teal-700">New</span>}
                              </div>
                              <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.body}</p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200">
                  {firebaseUser.photoURL && (
                    <img
                      src={firebaseUser.photoURL}
                      alt={userRecord?.name || 'Student'}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover border border-slate-200"
                    />
                  )}
                  <span className="text-xs font-medium text-slate-700 max-w-[110px] truncate">
                    {userRecord?.name || firebaseUser.displayName || 'Student'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-teal-700 text-white text-xs font-medium rounded-lg hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
              >
                Student Sign In
              </Link>
            )}

            <button
              type="button"
              aria-label="Toggle navigation menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {firebaseUser && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  void handleSignOut();
                }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 cursor-pointer"
              >
                Sign Out
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-900">CampusLoop</span>
            <span className="mx-2">·</span>
            <span>Buy. Sell. Rent. Repeat.</span>
            <span className="mx-2">·</span>
            <span>Dehradun Student Circular Marketplace</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/explore" className="hover:text-slate-900">
              Marketplace
            </Link>
            <Link to="/customer/sell" className="hover:text-slate-900">
              Sell or Rent an Item
            </Link>
            <Link to="/admin/login" className="hover:text-slate-900">
              Admin Portal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
