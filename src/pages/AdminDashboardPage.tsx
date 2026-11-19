import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Flag,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  XCircle,
} from 'lucide-react';
import { AdminLayout, type AdminSection } from '../components/AdminLayout';
import { BusinessInsightsPanel } from '../components/admin/BusinessInsightsPanel';
import { useAuth } from '../lib/authContext';
import {
  clearDemoListingsAdmin,
  ensureDefaultCategoriesSeeded,
  fetchAllRequestsForAdmin,
  formatINR,
  formatTimestamp,
  getCustomerProfileAdmin,
  grantAdminAccess,
  moderateListingAdmin,
  revokeAdminAccess,
  saveCategory,
  seedDemoListingsAdmin,
  setStudentVerificationAdmin,
  setUserStatusAdmin,
  subscribeAdminsList,
  subscribeAllListingsAdmin,
  subscribeAllUsersAdmin,
  subscribeCategories,
  subscribeConversationMessages,
  subscribeReportedConversationsAdmin,
  subscribeReportsAdmin,
  updateReportModerationAdmin,
} from '../lib/firestoreService';
import type {
  AdminRecord,
  Category,
  ChatMessage,
  Conversation,
  CustomerProfile,
  ExchangeRequest,
  Inquiry,
  Listing,
  ListingStatus,
  RentalRequest,
  ReportRecord,
  UserRecord,
} from '../types/campusloop';

export function AdminDashboardPage() {
  const { firebaseUser, adminRecord, signOutUser } = useAuth();
  const [section, setSection] = useState<AdminSection>('overview');

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [reportedConvs, setReportedConvs] = useState<Conversation[]>([]);
  const [adminsList, setAdminsList] = useState<AdminRecord[]>([]);
  const [requestsSummary, setRequestsSummary] = useState<{
    inquiries: Inquiry[];
    rentals: RentalRequest[];
    exchanges: ExchangeRequest[];
  }>({ inquiries: [], rentals: [], exchanges: [] });

  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // User Management local UI state
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState<CustomerProfile | null>(null);

  // Listing Management local UI state
  const [listingStatusFilter, setListingStatusFilter] = useState<'all' | ListingStatus>('all');
  const [listingCatFilter, setListingCatFilter] = useState('all');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Category Management form
  const [catForm, setCatForm] = useState({
    categoryId: '',
    name: '',
    description: '',
    imageUrl: '',
    isActive: true,
    sortOrder: 10,
  });

  // Report Moderation local UI
  const [decisionMap, setDecisionMap] = useState<Record<string, string>>({});
  const [inspectConvId, setInspectConvId] = useState<string | null>(null);
  const [inspectConvMsgs, setInspectConvMsgs] = useState<ChatMessage[]>([]);

  // Grant Admin form
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');

  useEffect(() => {
    void ensureDefaultCategoriesSeeded();
    const unsubs = [
      subscribeAllUsersAdmin(setUsers),
      subscribeAllListingsAdmin(setListings),
      subscribeCategories(true, setCategories),
      subscribeReportsAdmin(setReports),
      subscribeReportedConversationsAdmin(setReportedConvs),
      subscribeAdminsList(setAdminsList),
    ];
    fetchAllRequestsForAdmin()
      .then(setRequestsSummary)
      .catch(() => {});
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!inspectConvId) {
      setInspectConvMsgs([]);
      return;
    }
    const unsub = subscribeConversationMessages(inspectConvId, setInspectConvMsgs);
    return () => unsub();
  }, [inspectConvId]);

  const stats = useMemo(() => {
    const customers = users.filter((u) => u.role === 'customer');
    const pending = listings.filter((l) => l.status === 'pending').length;
    const approved = listings.filter((l) => l.status === 'approved').length;
    const rejected = listings.filter((l) => l.status === 'rejected').length;
    const completedTx =
      requestsSummary.inquiries.filter((r) => r.status === 'completed').length +
      requestsSummary.rentals.filter((r) => r.status === 'completed').length +
      requestsSummary.exchanges.filter((r) => r.status === 'completed').length;

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newUsers = customers.filter((u) => {
      const ms =
        u.createdAt && 'toMillis' in u.createdAt
          ? (u.createdAt as { toMillis: () => number }).toMillis()
          : 0;
      return ms >= sevenDaysAgo;
    }).length;

    return {
      totalCustomers: customers.length,
      activeListings: approved,
      pendingApprovals: pending,
      approvedListings: approved,
      rejectedListings: rejected,
      completedTransactions: completedTx,
      newUsers,
      openReports: reports.filter((r) => r.status === 'open' || r.status === 'under_review').length,
    };
  }, [users, listings, requestsSummary, reports]);

  const analytics = useMemo(() => {
    const byCategory = new Map<string, number>();
    listings.forEach((l) => {
      byCategory.set(l.category, (byCategory.get(l.category) || 0) + 1);
    });
    const categoryEntries = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);

    const buyCount = listings.filter((l) => l.listingType === 'sell').length;
    const rentCount = listings.filter((l) => l.listingType === 'rent').length;
    const exchangeCount = listings.filter((l) => l.listingType === 'exchange').length;

    return { categoryEntries, buyCount, rentCount, exchangeCount };
  }, [listings]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      );
    });
  }, [users, userSearch]);

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (listingStatusFilter !== 'all' && l.status !== listingStatusFilter) return false;
      if (listingCatFilter !== 'all' && l.category !== listingCatFilter) return false;
      return true;
    });
  }, [listings, listingStatusFilter, listingCatFilter]);

  const handleInspectUser = async (user: UserRecord) => {
    setSelectedUser(user);
    setSelectedUserProfile(null);
    try {
      const profile = await getCustomerProfileAdmin(user.uid);
      setSelectedUserProfile(profile);
    } catch {
      setSelectedUserProfile(null);
    }
  };

  const handleModerateListing = async (
    listing: Listing,
    action: 'approved' | 'rejected' | 'removed' | 'flagged',
    reason = '',
  ) => {
    setBusy(true);
    setActionMsg(null);
    try {
      await moderateListingAdmin(listing, action, reason);
      setRejectingId(null);
      setRejectionReason('');
      setActionMsg({
        type: 'ok',
        text: `Listing "${listing.productName}" updated to ${action}.`,
      });
    } catch {
      setActionMsg({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      const count = await seedDemoListingsAdmin(
        firebaseUser.uid,
        adminRecord?.name || firebaseUser.displayName || 'Admin',
      );
      setActionMsg({
        type: 'ok',
        text: `Added ${count} clearly-labeled DEMO DATA listings to the marketplace.`,
      });
    } catch {
      setActionMsg({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setBusy(false);
    }
  };

  const handleClearDemo = async () => {
    setBusy(true);
    try {
      const removed = await clearDemoListingsAdmin();
      setActionMsg({ type: 'ok', text: `Removed ${removed} DEMO DATA listings.` });
    } catch {
      setActionMsg({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout
      activeSection={section}
      onSelectSection={(s) => {
        setSection(s);
        setActionMsg(null);
      }}
      pendingListingsCount={stats.pendingApprovals}
      openReportsCount={stats.openReports}
    >
      {actionMsg && (
        <div
          className={`mb-6 p-3.5 rounded-xl text-xs flex items-center justify-between ${
            actionMsg.type === 'ok'
              ? 'bg-teal-50 border border-teal-200 text-teal-900'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. OVERVIEW */}
      {section === 'overview' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900">
                Marketplace Operations Overview
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Live Firestore metrics across customers, listing moderation, and peer-to-peer requests.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={handleSeedDemo}
                className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 cursor-pointer"
              >
                Load Sample DEMO DATA Listings
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleClearDemo}
                className="px-3.5 py-2 border border-slate-200 bg-white text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Remove DEMO DATA
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Registered Customers', val: stats.totalCustomers },
              { label: 'Total Active Listings', val: stats.activeListings },
              { label: 'Pending Listing Approvals', val: stats.pendingApprovals, highlight: stats.pendingApprovals > 0 },
              { label: 'Approved Listings', val: stats.approvedListings },
              { label: 'Rejected Listings', val: stats.rejectedListings },
              { label: 'Completed Transactions (Recorded)', val: stats.completedTransactions },
              { label: 'New Users (Last 7 Days)', val: stats.newUsers },
              { label: 'Open Reports & Complaints', val: stats.openReports },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-xs text-slate-500">{kpi.label}</p>
                <p
                  className={`mt-2 text-2xl font-display font-bold tabular-nums ${
                    kpi.highlight ? 'text-amber-700' : 'text-slate-900'
                  }`}
                >
                  {kpi.val}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="text-base font-display font-bold text-slate-900 mb-4">
              Recent Activities
            </h2>
            {listings.length === 0 && users.length === 0 ? (
              <p className="text-xs text-slate-500">No marketplace activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {listings.slice(0, 6).map((l) => (
                  <div key={l.listingId} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900">{l.productName}</span>
                      <span className="text-slate-500"> — by {l.sellerName}</span>
                    </div>
                    <span className="capitalize font-medium text-slate-700 shrink-0">
                      {l.status} · {formatTimestamp(l.updatedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. USER MANAGEMENT */}
      {section === 'users' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-display font-bold text-slate-900">User Management</h1>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, UID..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">
                      {formatTimestamp(u.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold capitalize ${
                          u.status === 'active' ? 'text-teal-700' : 'text-red-700'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleInspectUser(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 rounded-md hover:bg-slate-100 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Profile &amp; Listings
                      </button>
                      {u.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => setUserStatusAdmin(u.uid, 'suspended')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 text-red-700 rounded-md hover:bg-red-50 cursor-pointer"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setUserStatusAdmin(u.uid, 'active')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-teal-200 text-teal-800 rounded-md hover:bg-teal-50 cursor-pointer"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedUser && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Customer Details: {selectedUser.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedUser.email} · UID: <span className="font-mono">{selectedUser.uid}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Close
                </button>
              </div>

              {selectedUserProfile && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">College &amp; Course</span>
                    <span className="font-semibold text-slate-900">
                      {selectedUserProfile.college || 'Not provided'} ({selectedUserProfile.course || '-'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Campus &amp; Student ID</span>
                    <span className="font-semibold text-slate-900">
                      {selectedUserProfile.campus || '-'} · ID: {selectedUserProfile.studentIdNumber || '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-500 block">Verification Status</span>
                      <span className="font-semibold capitalize text-slate-900">
                        {selectedUserProfile.verificationStatus}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await setStudentVerificationAdmin(selectedUser.uid, 'verified');
                          setSelectedUserProfile((p) =>
                            p ? { ...p, verificationStatus: 'verified' } : p,
                          );
                        }}
                        className="px-2.5 py-1 bg-teal-700 text-white rounded-md font-medium cursor-pointer"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await setStudentVerificationAdmin(selectedUser.uid, 'rejected');
                          setSelectedUserProfile((p) =>
                            p ? { ...p, verificationStatus: 'rejected' } : p,
                          );
                        }}
                        className="px-2.5 py-1 border border-red-200 text-red-700 rounded-md font-medium cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-700 mb-2">
                  Listings by {selectedUser.name}
                </h3>
                <div className="divide-y divide-slate-100 text-xs">
                  {listings
                    .filter((l) => l.sellerId === selectedUser.uid)
                    .map((l) => (
                      <div key={l.listingId} className="py-2 flex justify-between">
                        <span>{l.productName}</span>
                        <span className="capitalize font-medium">{l.status}</span>
                      </div>
                    ))}
                  {listings.filter((l) => l.sellerId === selectedUser.uid).length === 0 && (
                    <p className="text-slate-500">No listings created by this user.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. LISTING MANAGEMENT */}
      {section === 'listings' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h1 className="text-2xl font-display font-bold text-slate-900">Listing Management</h1>
            <div className="flex flex-wrap gap-2">
              <select
                value={listingStatusFilter}
                onChange={(e) => setListingStatusFilter(e.target.value as 'all' | ListingStatus)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="flagged">Flagged</option>
                <option value="removed">Removed</option>
              </select>

              <select
                value={listingCatFilter}
                onChange={(e) => setListingCatFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredListings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                No listings match the selected filters.
              </div>
            ) : (
              filteredListings.map((l) => (
                <div
                  key={l.listingId}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-24 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {l.images?.[0] && (
                          <img
                            src={l.images[0]}
                            alt={l.productName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span
                            className={`font-semibold capitalize ${
                              l.status === 'approved'
                                ? 'text-teal-700'
                                : l.status === 'rejected' || l.status === 'removed'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                            }`}
                          >
                            {l.status}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="uppercase">{l.listingType}</span>
                          <span aria-hidden="true">·</span>
                          <span>{l.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums font-semibold text-slate-900">
                            {formatINR(l.listingType === 'rent' && l.rentalPrice ? l.rentalPrice : l.price)}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">{l.productName}</h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Seller: {l.sellerName} ({l.campus})
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{l.description}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busy || l.status === 'approved'}
                        onClick={() => handleModerateListing(l, 'approved')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 disabled:opacity-40 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setRejectingId(l.listingId);
                          setRejectionReason(l.rejectionReason || '');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg hover:bg-amber-50 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleModerateListing(l, 'flagged')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        Flag
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleModerateListing(l, 'removed')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-700 text-xs font-medium rounded-lg hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </div>
                  </div>

                  {rejectingId === l.listingId && (
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Enter clear rejection reason (visible to seller)..."
                        className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                      />
                      <button
                        type="button"
                        disabled={!rejectionReason.trim() || busy}
                        onClick={() => handleModerateListing(l, 'rejected', rejectionReason)}
                        className="px-4 py-2 bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer"
                      >
                        Confirm Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="px-3 py-2 text-xs text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. CATEGORY MANAGEMENT */}
      {section === 'categories' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-display font-bold text-slate-900">Category Management</h1>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!catForm.name.trim()) return;
              setBusy(true);
              try {
                await saveCategory(catForm);
                setCatForm({
                  categoryId: '',
                  name: '',
                  description: '',
                  imageUrl: '',
                  isActive: true,
                  sortOrder: categories.length + 1,
                });
                setActionMsg({ type: 'ok', text: 'Category saved to Firestore.' });
              } catch {
                setActionMsg({ type: 'err', text: 'Cloud save failed. Please retry.' });
              } finally {
                setBusy(false);
              }
            }}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-900">
              {catForm.categoryId ? 'Edit Category' : 'Add New Category'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <input
                type="text"
                required
                value={catForm.name}
                onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Category Name"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={catForm.imageUrl}
                onChange={(e) => setCatForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="Category Image URL (e.g. /src/assets/images/...)"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={catForm.description}
                onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Short category description"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={catForm.isActive}
                    onChange={(e) => setCatForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  <span>Active in Marketplace</span>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="ml-auto inline-flex items-center gap-1 px-4 py-2 bg-teal-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Save Category
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div key={cat.categoryId} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{cat.name}</p>
                    <p className="text-xs text-slate-500">
                      {cat.isActive ? 'Active' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-600 line-clamp-2">{cat.description}</p>
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setCatForm({
                        categoryId: cat.categoryId,
                        name: cat.name,
                        description: cat.description || '',
                        imageUrl: cat.imageUrl || '',
                        isActive: cat.isActive,
                        sortOrder: cat.sortOrder,
                      })
                    }
                    className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      saveCategory({
                        categoryId: cat.categoryId,
                        name: cat.name,
                        description: cat.description || '',
                        imageUrl: cat.imageUrl || '',
                        isActive: !cat.isActive,
                        sortOrder: cat.sortOrder,
                      })
                    }
                    className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    {cat.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. REPORTS & COMPLAINTS */}
      {section === 'reports' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Reports &amp; Complaints
          </h1>

          <div className="space-y-4">
            {reports.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                No user or listing reports submitted yet.
              </div>
            ) : (
              reports.map((rep) => (
                <div key={rep.reportId} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-900">
                      [{rep.targetType.toUpperCase()}] {rep.targetTitle || rep.targetId}
                    </span>
                    <span className="capitalize font-semibold text-amber-700">{rep.status}</span>
                  </div>
                  <p className="text-xs text-slate-700">
                    <strong>Reason:</strong> {rep.reason}
                  </p>
                  {rep.details && <p className="text-xs text-slate-600">{rep.details}</p>}
                  <p className="text-[11px] text-slate-400">
                    Reported by {rep.reporterName || rep.reporterId} · {formatTimestamp(rep.createdAt)}
                  </p>

                  {rep.targetType === 'conversation' && (
                    <button
                      type="button"
                      onClick={() =>
                        setInspectConvId((prev) => (prev === rep.targetId ? null : rep.targetId))
                      }
                      className="text-xs font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      {inspectConvId === rep.targetId
                        ? 'Hide Reported Chat Transcript'
                        : 'Inspect Reported Chat Transcript'}
                    </button>
                  )}

                  {inspectConvId === rep.targetId && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 max-h-48 overflow-y-auto text-xs">
                      {inspectConvMsgs.map((m) => (
                        <div key={m.messageId}>
                          <strong>{m.senderName}:</strong> {m.text}
                        </div>
                      ))}
                      {inspectConvMsgs.length === 0 && <p>No messages in thread.</p>}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={decisionMap[rep.reportId] ?? rep.moderationDecision ?? ''}
                      onChange={(e) =>
                        setDecisionMap((p) => ({ ...p, [rep.reportId]: e.target.value }))
                      }
                      placeholder="Record moderation decision..."
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        firebaseUser &&
                        updateReportModerationAdmin(
                          rep.reportId,
                          'resolved',
                          decisionMap[rep.reportId] || 'Action taken by admin',
                          firebaseUser.uid,
                        )
                      }
                      className="px-3 py-1.5 bg-teal-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        firebaseUser &&
                        updateReportModerationAdmin(
                          rep.reportId,
                          'dismissed',
                          decisionMap[rep.reportId] || 'Dismissed after review',
                          firebaseUser.uid,
                        )
                      }
                      className="px-3 py-1.5 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {reportedConvs.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-3">
                Flagged Conversations ({reportedConvs.length})
              </h2>
              <div className="divide-y divide-slate-100 text-xs">
                {reportedConvs.map((c) => (
                  <div key={c.conversationId} className="py-2 flex justify-between">
                    <span>
                      {c.listingTitle} ({c.buyerName} &amp; {c.sellerName})
                    </span>
                    <button
                      type="button"
                      onClick={() => setInspectConvId(c.conversationId)}
                      className="text-teal-700 font-semibold cursor-pointer"
                    >
                      View Thread
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. MARKETPLACE ANALYTICS */}
      {section === 'analytics' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Marketplace Analytics
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Listings by Category</h2>
              {analytics.categoryEntries.length === 0 ? (
                <p className="text-xs text-slate-500">No listing data available yet.</p>
              ) : (
                <div className="space-y-3">
                  {analytics.categoryEntries.map(([catName, count]) => {
                    const pct = Math.round((count / Math.max(1, listings.length)) * 100);
                    return (
                      <div key={catName} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-slate-800">{catName}</span>
                          <span className="tabular-nums text-slate-600">
                            {count} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
              <h2 className="text-sm font-bold text-slate-900">
                Buy vs. Rent vs. Exchange Mix
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500">Buy (Sell)</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                    {analytics.buyCount}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500">Rent</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                    {analytics.rentCount}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-xs text-slate-500">Exchange</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">
                    {analytics.exchangeCount}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Approval Rate</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {listings.length > 0
                      ? `${Math.round((stats.approvedListings / listings.length) * 100)}%`
                      : '0%'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Recorded Requests</span>
                  <span className="text-base font-bold text-slate-900 tabular-nums">
                    {requestsSummary.inquiries.length +
                      requestsSummary.rentals.length +
                      requestsSummary.exchanges.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. CAMPUSLOOP BUSINESS INSIGHTS */}
      {section === 'insights' && <BusinessInsightsPanel />}

      {/* 8. ADMIN PROFILE & PROVISIONING */}
      {section === 'profile' && (
        <div className="space-y-6">
          <h1 className="text-2xl font-display font-bold text-slate-900">
            Admin Profile &amp; Access Provisioning
          </h1>

          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#0B192C] text-teal-400 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-900">
                  {adminRecord?.name || firebaseUser?.displayName || 'CampusLoop Admin'}
                </p>
                <p className="text-xs text-slate-600">{adminRecord?.email || firebaseUser?.email}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  UID: {firebaseUser?.uid}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={signOutUser}
              className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>

          {/* Authorized Admin Allowlist */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Authorized Administrators Allowlist
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Only UIDs present in <code className="font-mono">admins/&#123;uid&#125;</code> (or the verified project owner bootstrap identity) are permitted to enter the Admin Portal.
              </p>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {adminsList.map((adm) => (
                <div key={adm.uid} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900">{adm.name}</p>
                    <p className="text-slate-500">
                      {adm.email} · <span className="font-mono">{adm.uid}</span>
                    </p>
                  </div>
                  {adm.uid !== firebaseUser?.uid && (
                    <button
                      type="button"
                      onClick={() => revokeAdminAccess(adm.uid)}
                      className="px-3 py-1 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!firebaseUser || !newAdminUid.trim() || !newAdminEmail.trim()) return;
                setBusy(true);
                try {
                  await grantAdminAccess({
                    uid: newAdminUid,
                    email: newAdminEmail,
                    name: newAdminName || 'CampusLoop Admin',
                    grantedBy: firebaseUser.uid,
                  });
                  setNewAdminUid('');
                  setNewAdminEmail('');
                  setNewAdminName('');
                  setActionMsg({ type: 'ok', text: 'Admin access granted to specified UID.' });
                } catch {
                  setActionMsg({ type: 'err', text: 'Failed to add admin record.' });
                } finally {
                  setBusy(false);
                }
              }}
              className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
            >
              <input
                type="text"
                required
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                placeholder="Target Firebase UID"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
              />
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Verified Google Email"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <input
                type="text"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Admin Display Name"
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 bg-[#0B192C] text-white font-semibold rounded-lg hover:bg-teal-700 cursor-pointer"
              >
                Grant Admin Access
              </button>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
