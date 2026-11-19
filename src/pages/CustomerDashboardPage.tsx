import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Search, ShieldAlert } from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../lib/authContext';
import {
  formatINR,
  subscribeApprovedListings,
  subscribeCategories,
  subscribeParticipantRequests,
  subscribeSellerListings,
} from '../lib/firestoreService';
import type {
  Category,
  ExchangeRequest,
  Inquiry,
  Listing,
  RentalRequest,
} from '../types/campusloop';

const RECENTLY_VIEWED_KEY = 'campusloop_recent_viewed_ids';

export function CustomerDashboardPage() {
  const { firebaseUser, customerProfile } = useAuth();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [approvedListings, setApprovedListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<{
    inquiries: Inquiry[];
    rentals: RentalRequest[];
    exchanges: ExchangeRequest[];
  }>({ inquiries: [], rentals: [], exchanges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubApproved = subscribeApprovedListings((items) => {
      setApprovedListings(items);
      setLoading(false);
    });
    const unsubCats = subscribeCategories(false, setCategories);

    let unsubMine: (() => void) | null = null;
    let unsubReqs: (() => void) | null = null;
    if (firebaseUser) {
      unsubMine = subscribeSellerListings(firebaseUser.uid, setMyListings);
      unsubReqs = subscribeParticipantRequests(firebaseUser.uid, setRequests);
    }

    return () => {
      unsubApproved();
      unsubCats();
      if (unsubMine) unsubMine();
      if (unsubReqs) unsubReqs();
    };
  }, [firebaseUser]);

  const recentViewedListings = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(RECENTLY_VIEWED_KEY);
      if (!raw) return [];
      const ids: string[] = JSON.parse(raw);
      return ids
        .map((id) => approvedListings.find((l) => l.listingId === id))
        .filter((l): l is Listing => Boolean(l))
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [approvedListings]);

  const recommendedListings = useMemo(() => {
    const campus = customerProfile?.campus;
    if (campus) {
      const sameCampus = approvedListings.filter((l) => l.campus === campus);
      if (sameCampus.length > 0) return sameCampus.slice(0, 3);
    }
    return approvedListings.slice(0, 3);
  }, [approvedListings, customerProfile?.campus]);

  const activeMyListings = useMemo(
    () => myListings.filter((l) => l.status === 'approved' || l.status === 'pending'),
    [myListings],
  );

  const pendingRequestsCount = useMemo(() => {
    const p1 = requests.inquiries.filter((r) => r.status === 'pending').length;
    const p2 = requests.rentals.filter((r) => r.status === 'pending').length;
    const p3 = requests.exchanges.filter((r) => r.status === 'pending').length;
    return p1 + p2 + p3;
  }, [requests]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/explore?q=${encodeURIComponent(searchInput.trim())}`);
  };

  return (
    <CustomerLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Welcome & Search Focal Header */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900">
                Welcome to CampusLoop!
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
                Find affordable products, sell what you no longer need, and rent what you only need temporarily.
              </p>
            </div>

            <Link
              to="/customer/sell"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Sell or Rent an Item
            </Link>
          </div>

          <form onSubmit={handleSearch} className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search books, electronics, formalwear, hostel essentials..."
                className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-600 focus:bg-white"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Search Marketplace
            </button>
          </form>

          {customerProfile && customerProfile.verificationStatus !== 'verified' && (
            <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-700">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Student Verification Status:{' '}
                  <strong className="capitalize">{customerProfile.verificationStatus}</strong>. Complete your college &amp; campus details to verify student eligibility.
                </span>
              </div>
              <Link
                to="/customer/profile"
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
              >
                Complete Verification →
              </Link>
            </div>
          )}
        </section>

        {/* Quick Activity Summary Strip */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/customer/my-listings"
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500">My Active &amp; Pending Listings</p>
            <p className="mt-2 text-2xl font-display font-bold text-slate-900 tabular-nums">
              {activeMyListings.length}
            </p>
            <p className="mt-1 text-xs text-teal-700 font-medium">Manage listings →</p>
          </Link>

          <Link
            to="/customer/orders"
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500">My Pending Requests</p>
            <p className="mt-2 text-2xl font-display font-bold text-slate-900 tabular-nums">
              {pendingRequestsCount}
            </p>
            <p className="mt-1 text-xs text-teal-700 font-medium">View inquiries, rentals &amp; swaps →</p>
          </Link>

          <Link
            to="/customer/messages"
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500">Approved Marketplace Items</p>
            <p className="mt-2 text-2xl font-display font-bold text-slate-900 tabular-nums">
              {approvedListings.length}
            </p>
            <p className="mt-1 text-xs text-teal-700 font-medium">Open messages &amp; chat →</p>
          </Link>
        </section>

        {/* Popular Categories */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold text-slate-900">Popular Categories</h2>
            <Link to="/explore" className="text-xs font-semibold text-teal-700 hover:text-teal-800">
              Browse all →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.slice(0, 5).map((cat) => (
              <Link
                key={cat.categoryId}
                to={`/explore?category=${encodeURIComponent(cat.name)}`}
                className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-teal-600 transition-colors"
              >
                <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                  {cat.imageUrl && (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-slate-900 line-clamp-2">{cat.name}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recently Added Listings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold text-slate-900">
              Recently Added Listings
            </h2>
            <Link
              to="/explore"
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              Explore all
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : approvedListings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <p className="text-sm text-slate-600">
                No approved listings are live yet. Submit an item or ask an admin to approve pending items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {approvedListings.slice(0, 6).map((item) => (
                <ListingCard key={item.listingId} listing={item} />
              ))}
            </div>
          )}
        </section>

        {/* Recommended Campus Products */}
        {recommendedListings.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-slate-900">
                Recommended Campus Products
              </h2>
              {customerProfile?.campus && (
                <span className="text-xs text-slate-500">{customerProfile.campus}</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recommendedListings.map((item) => (
                <ListingCard key={`rec_${item.listingId}`} listing={item} />
              ))}
            </div>
          </section>
        )}

        {/* My Active Listings Preview */}
        {myListings.length > 0 && (
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-bold text-slate-900">My Active Listings</h2>
              <Link to="/customer/my-listings" className="text-xs font-semibold text-teal-700">
                Manage all →
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {myListings.slice(0, 4).map((l) => (
                <div key={l.listingId} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{l.productName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {l.category} · {formatINR(l.listingType === 'rent' && l.rentalPrice ? l.rentalPrice : l.price)} · Status: <span className="capitalize font-medium">{l.status}</span>
                    </p>
                  </div>
                  <Link
                    to={`/customer/edit/${l.listingId}`}
                    className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
                  >
                    Edit
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recently Viewed Products */}
        {recentViewedListings.length > 0 && (
          <section>
            <h2 className="text-lg font-display font-bold text-slate-900 mb-4">
              Recently Viewed Products
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentViewedListings.map((item) => (
                <ListingCard key={`rv_${item.listingId}`} listing={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </CustomerLayout>
  );
}
