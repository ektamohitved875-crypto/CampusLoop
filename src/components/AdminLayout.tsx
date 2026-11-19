import React, { useState } from 'react';
import {
  BarChart3,
  Flag,
  FolderTree,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  PackageCheck,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/authContext';
import { useNavigate } from 'react-router-dom';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'listings'
  | 'categories'
  | 'reports'
  | 'analytics'
  | 'insights'
  | 'profile';

interface AdminLayoutProps {
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  pendingListingsCount?: number;
  openReportsCount?: number;
  children: React.ReactNode;
}

export function AdminLayout({
  activeSection,
  onSelectSection,
  pendingListingsCount = 0,
  openReportsCount = 0,
  children,
}: AdminLayoutProps) {
  const { firebaseUser, adminRecord, signOutUser } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems: Array<{
    id: AdminSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'listings', label: 'Listing Management', icon: PackageCheck, count: pendingListingsCount },
    { id: 'categories', label: 'Category Management', icon: FolderTree },
    { id: 'reports', label: 'Reports & Complaints', icon: Flag, count: openReportsCount },
    { id: 'analytics', label: 'Marketplace Analytics', icon: BarChart3 },
    { id: 'insights', label: 'CampusLoop Business Insights', icon: Lightbulb },
    { id: 'profile', label: 'Admin Profile', icon: ShieldCheck },
  ];

  const activeTitle = navItems.find((i) => i.id === activeSection)?.label || 'Overview';

  const handleSignOut = async () => {
    await signOutUser();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-68 lg:flex-col bg-[#0B192C] text-slate-100 shrink-0">
        <div className="h-16 px-6 flex items-center border-b border-white/10">
          <span className="font-display font-bold text-lg tracking-tight text-white">
            CampusLoop Admin
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/15 text-white shrink-0">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-slate-300 truncate font-medium">
            {adminRecord?.name || firebaseUser?.displayName || 'Administrator'}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {adminRecord?.email || firebaseUser?.email}
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-200 bg-white/10 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-72 max-w-full bg-[#0B192C] text-slate-100 flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-white/10">
              <span className="font-display font-bold text-base text-white">CampusLoop Admin</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectSection(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium cursor-pointer ${
                      active ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="text-xs font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/15">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-white/10">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-white/10 rounded-lg cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open admin navigation"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span>Admin Portal</span>
              <span className="mx-2">/</span>
              <span className="font-semibold text-slate-900">{activeTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-slate-600">
              {adminRecord?.email || firebaseUser?.email}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
