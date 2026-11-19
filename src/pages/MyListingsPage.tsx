import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { useAuth } from '../lib/authContext';
import {
  deleteListing,
  formatINR,
  formatTimestamp,
  subscribeSellerListings,
} from '../lib/firestoreService';
import type { Listing, ListingStatus } from '../types/campusloop';

export function MyListingsPage() {
  const { firebaseUser } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [filter, setFilter] = useState<'all' | ListingStatus>('all');
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeSellerListings(firebaseUser.uid, (items) => {
      setListings(items);
      setLoading(false);
    });
    return () => unsub();
  }, [firebaseUser]);

  const filtered = listings.filter((l) => (filter === 'all' ? true : l.status === filter));

  const handleDelete = async (listingId: string) => {
    setErrorMsg(null);
    try {
      await deleteListing(listingId);
      setConfirmDeleteId(null);
    } catch {
      setErrorMsg('Cloud save failed. Please retry.');
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900">My Listings</h1>
            <p className="text-sm text-slate-600 mt-1">
              Track admin approval status, view rejection reasons, and manage your items.
            </p>
          </div>
          <Link
            to="/customer/sell"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 whitespace-nowrap self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Sell or Rent an Item
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-6">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md capitalize transition-colors cursor-pointer ${
                filter === status
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-600">No listings found under this filter.</p>
            <Link
              to="/customer/sell"
              className="mt-4 inline-block px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
            >
              Create Your First Listing
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <div
                key={item.listingId}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-24 h-20 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                    {item.images?.[0] && (
                      <img
                        src={item.images[0]}
                        alt={item.productName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span
                        className={`font-semibold capitalize ${
                          item.status === 'approved'
                            ? 'text-teal-700'
                            : item.status === 'rejected' || item.status === 'removed'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="uppercase">{item.listingType}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Updated {formatTimestamp(item.updatedAt)}</span>
                    </div>

                    <h3 className="mt-1 text-base font-semibold text-slate-900 truncate">
                      {item.productName}
                    </h3>
                    <p className="mt-0.5 text-sm font-medium text-slate-800 tabular-nums">
                      {item.listingType === 'rent' && item.rentalPrice
                        ? `${formatINR(item.rentalPrice)} ${item.rentalDuration || ''}`
                        : formatINR(item.price)}
                    </p>

                    {item.status === 'rejected' && item.rejectionReason && (
                      <p className="mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <strong>Rejection Reason:</strong> {item.rejectionReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {item.status === 'approved' && (
                    <Link
                      to={`/listing/${item.listingId}`}
                      className="px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      View Live
                    </Link>
                  )}
                  <Link
                    to={`/customer/edit/${item.listingId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {item.status === 'rejected' ? 'Fix & Resubmit' : 'Edit'}
                  </Link>

                  {confirmDeleteId === item.listingId ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.listingId)}
                        className="px-3 py-2 text-xs font-semibold bg-red-700 text-white rounded-lg hover:bg-red-800 cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-2 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.listingId)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
