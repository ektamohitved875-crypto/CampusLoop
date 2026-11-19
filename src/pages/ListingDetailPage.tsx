import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Flag,
  MessageSquare,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { useAuth } from '../lib/authContext';
import {
  formatINR,
  formatTimestamp,
  getListingById,
  getOrCreateConversation,
  submitBuyInquiry,
  submitExchangeRequest,
  submitRentalRequest,
  submitReport,
  toggleSavedListing,
} from '../lib/firestoreService';
import type { Listing, ListingCondition } from '../types/campusloop';

const RECENTLY_VIEWED_KEY = 'campusloop_recent_viewed_ids';

export function ListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { firebaseUser, userRecord, customerProfile } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  // Workflow forms state
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agreedTerms, setAgreedTerms] = useState('');
  const [offeredItemTitle, setOfferedItemTitle] = useState('');
  const [offeredItemDesc, setOfferedItemDesc] = useState('');
  const [offeredItemCond, setOfferedItemCond] = useState<ListingCondition>('Good');

  const [submitting, setSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Report modal
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Misleading product information');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    if (!listingId) return;
    setLoading(true);
    getListingById(listingId)
      .then((item) => {
        setListing(item);
        if (item) {
          setOfferPrice(String(item.price || 0));
          try {
            const raw = sessionStorage.getItem(RECENTLY_VIEWED_KEY);
            const prev: string[] = raw ? JSON.parse(raw) : [];
            const next = [item.listingId, ...prev.filter((id) => id !== item.listingId)].slice(0, 6);
            sessionStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
          } catch {
            // ignore sessionStorage limits
          }
        }
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load listing.');
      })
      .finally(() => setLoading(false));
  }, [listingId]);

  const isSaved = Boolean(
    listing && customerProfile?.savedListingIds?.includes(listing.listingId),
  );
  const isOwnListing = Boolean(firebaseUser && listing && listing.sellerId === firebaseUser.uid);

  const handleMessageSeller = async () => {
    if (!firebaseUser || !listing) {
      navigate('/login');
      return;
    }
    if (isOwnListing) return;
    setSubmitting(true);
    try {
      const convId = await getOrCreateConversation({
        listing,
        buyerId: firebaseUser.uid,
        buyerName: userRecord?.name || firebaseUser.displayName || 'Student',
        initialMessage: `Hi ${listing.sellerName}, is "${listing.productName}" still available on ${listing.campus}?`,
      });
      navigate(`/customer/messages?thread=${convId}`);
    } catch {
      setActionFeedback({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSave = async () => {
    if (!firebaseUser || !listing) {
      navigate('/login');
      return;
    }
    try {
      await toggleSavedListing(
        firebaseUser.uid,
        customerProfile?.savedListingIds || [],
        listing.listingId,
      );
    } catch {
      setActionFeedback({ type: 'err', text: 'Cloud save failed. Please retry.' });
    }
  };

  const handleSubmitWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !listing) {
      navigate('/login');
      return;
    }
    if (isOwnListing) return;

    setSubmitting(true);
    setActionFeedback(null);
    const buyerName = userRecord?.name || firebaseUser.displayName || 'Student';

    try {
      if (listing.listingType === 'sell') {
        if (!inquiryMessage.trim()) {
          setActionFeedback({ type: 'err', text: 'Please enter a message for the seller.' });
          setSubmitting(false);
          return;
        }
        await submitBuyInquiry({
          listing,
          buyerId: firebaseUser.uid,
          buyerName,
          offerPrice: Number(offerPrice) || listing.price,
          message: inquiryMessage,
        });
        setInquiryMessage('');
        setActionFeedback({
          type: 'ok',
          text: 'Buy inquiry sent to the seller. Track responses in My Orders / Requests.',
        });
      } else if (listing.listingType === 'rent') {
        if (!startDate || !endDate || !agreedTerms.trim()) {
          setActionFeedback({
            type: 'err',
            text: 'Please specify rental start date, end date, and proposed handover terms.',
          });
          setSubmitting(false);
          return;
        }
        await submitRentalRequest({
          listing,
          buyerId: firebaseUser.uid,
          buyerName,
          startDate,
          endDate,
          agreedTerms,
        });
        setStartDate('');
        setEndDate('');
        setAgreedTerms('');
        setActionFeedback({
          type: 'ok',
          text: 'Rental request submitted. Waiting for seller acceptance.',
        });
      } else {
        if (!offeredItemTitle.trim() || offeredItemDesc.trim().length < 5) {
          setActionFeedback({
            type: 'err',
            text: 'Please describe the item you are offering to exchange (at least 5 characters).',
          });
          setSubmitting(false);
          return;
        }
        await submitExchangeRequest({
          listing,
          buyerId: firebaseUser.uid,
          buyerName,
          offeredItemTitle,
          offeredItemDescription: offeredItemDesc,
          offeredItemCondition: offeredItemCond,
        });
        setOfferedItemTitle('');
        setOfferedItemDesc('');
        setActionFeedback({
          type: 'ok',
          text: 'Exchange proposal sent to the seller.',
        });
      }
    } catch {
      setActionFeedback({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !listing) {
      navigate('/login');
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({
        reporterId: firebaseUser.uid,
        reporterName: userRecord?.name || firebaseUser.displayName || 'Student',
        targetType: 'listing',
        targetId: listing.listingId,
        targetTitle: listing.productName,
        reason: reportReason,
        details: reportDetails,
      });
      setReportOpen(false);
      setReportDetails('');
      setActionFeedback({ type: 'ok', text: 'Report submitted to CampusLoop moderators.' });
    } catch {
      setActionFeedback({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Marketplace
        </Link>

        {loading ? (
          <div className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        ) : errorMsg || !listing ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-900">Listing not available</h2>
            <p className="mt-2 text-sm text-slate-600">
              {errorMsg || 'This listing may still be awaiting admin approval or has been removed.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Gallery & Product Narrative (Left) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="aspect-[4/3] bg-slate-100 relative">
                  {listing.images?.[activeImgIdx] ? (
                    <img
                      src={listing.images[activeImgIdx]}
                      alt={listing.productName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Package className="w-10 h-10" />
                    </div>
                  )}
                  {listing.isDemo && (
                    <span className="absolute top-4 left-4 bg-slate-900 text-white text-xs font-mono px-2.5 py-1 rounded">
                      DEMO DATA
                    </span>
                  )}
                </div>

                {listing.images.length > 1 && (
                  <div className="p-4 flex gap-3 overflow-x-auto border-t border-slate-100">
                    {listing.images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImgIdx(idx)}
                        className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                          activeImgIdx === idx ? 'border-teal-600' : 'border-transparent opacity-70'
                        }`}
                      >
                        <img
                          src={img}
                          alt={`${listing.productName} view ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
                <h2 className="text-base font-display font-bold text-slate-900">
                  Product Description
                </h2>
                <p className="mt-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {listing.description}
                </p>

                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block">Condition</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">
                      {listing.condition}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Campus Location</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">
                      {listing.campus}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Posted On</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block">
                      {formatTimestamp(listing.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Purchase / Request Module (Right) */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-7">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span className="font-semibold text-teal-700 uppercase tracking-wide">
                    {listing.listingType === 'sell'
                      ? 'For Sale'
                      : listing.listingType === 'rent'
                        ? 'For Rent'
                        : 'Open to Exchange'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{listing.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="capitalize">{listing.availability}</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 leading-snug">
                  {listing.productName}
                </h1>

                <div className="mt-4 pb-5 border-b border-slate-100 flex items-baseline justify-between gap-4">
                  <div>
                    {listing.listingType === 'rent' ? (
                      <>
                        <span className="text-2xl font-display font-bold text-slate-900 tabular-nums">
                          {formatINR(listing.rentalPrice || listing.price)}
                        </span>
                        <span className="text-sm text-slate-600 ml-1.5">
                          {listing.rentalDuration || 'per week'}
                        </span>
                      </>
                    ) : (
                      <span className="text-2xl font-display font-bold text-slate-900 tabular-nums">
                        {listing.listingType === 'exchange' && listing.price === 0
                          ? 'Direct Student Exchange'
                          : formatINR(listing.price)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleToggleSave}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                      isSaved
                        ? 'bg-teal-50 border-teal-300 text-teal-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    {isSaved ? 'Saved' : 'Save'}
                  </button>
                </div>

                {/* Seller Overview (Privacy-safe: no raw email/phone exposed unless needed) */}
                <div className="py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">Listed by</p>
                    <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                      {listing.sellerName}
                      {listing.sellerVerified && (
                        <ShieldCheck className="w-4 h-4 text-teal-600" aria-label="Verified student" />
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {listing.campus} · {listing.contactPreference}
                    </p>
                  </div>

                  {!isOwnListing && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleMessageSeller}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 text-slate-900 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Message Seller
                    </button>
                  )}
                </div>

                {actionFeedback && (
                  <div
                    className={`mt-4 p-3.5 rounded-xl text-xs leading-relaxed flex items-start gap-2 ${
                      actionFeedback.type === 'ok'
                        ? 'bg-teal-50 border border-teal-200 text-teal-900'
                        : 'bg-red-50 border border-red-200 text-red-900'
                    }`}
                  >
                    {actionFeedback.type === 'ok' && (
                      <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    )}
                    <span>{actionFeedback.text}</span>
                  </div>
                )}

                {/* Workflow Form */}
                {isOwnListing ? (
                  <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-700">
                      This is your listing (Status: <strong className="capitalize">{listing.status}</strong>).
                    </p>
                    <Link
                      to={`/customer/edit/${listing.listingId}`}
                      className="mt-3 inline-block px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800"
                    >
                      Edit Listing Details
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitWorkflow} className="mt-5 space-y-4">
                    {listing.listingType === 'sell' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Your Offer Price (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={offerPrice}
                            onChange={(e) => setOfferPrice(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Inquiry Message to Seller
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={inquiryMessage}
                            onChange={(e) => setInquiryMessage(e.target.value)}
                            placeholder="Hi! When and where on campus can I inspect and pick this up?"
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {submitting ? 'Sending Inquiry...' : 'Send Buy Inquiry'}
                        </button>
                      </>
                    )}

                    {listing.listingType === 'rent' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              required
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              End Date
                            </label>
                            <input
                              type="date"
                              required
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Proposed Handover &amp; Return Terms
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={agreedTerms}
                            onChange={(e) => setAgreedTerms(e.target.value)}
                            placeholder="Example: Will pick up from DBS main gate and return in clean condition after placement week."
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {submitting ? 'Sending Request...' : 'Submit Rental Request'}
                        </button>
                      </>
                    )}

                    {listing.listingType === 'exchange' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Item You Are Offering to Exchange
                          </label>
                          <input
                            type="text"
                            required
                            value={offeredItemTitle}
                            onChange={(e) => setOfferedItemTitle(e.target.value)}
                            placeholder="e.g., Firefox Campus Bicycle or Semester 3 Books"
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Offered Item Condition
                          </label>
                          <select
                            value={offeredItemCond}
                            onChange={(e) => setOfferedItemCond(e.target.value as ListingCondition)}
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                          >
                            <option value="New">New</option>
                            <option value="Like New">Like New</option>
                            <option value="Good">Good</option>
                            <option value="Used">Used</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Description &amp; Exchange Note
                          </label>
                          <textarea
                            rows={3}
                            required
                            value={offeredItemDesc}
                            onChange={(e) => setOfferedItemDesc(e.target.value)}
                            placeholder="Describe item condition and where on campus you can meet for swap."
                            className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="w-full py-3 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                        >
                          {submitting ? 'Sending Proposal...' : 'Send Exchange Proposal'}
                        </button>
                      </>
                    )}
                  </form>
                )}

                <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                  Peer-to-peer handover notice: CampusLoop connects buyers, sellers, and renters. Payments and product handovers are arranged directly between students.
                </p>

                {!isOwnListing && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setReportOpen((p) => !p)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Report Listing
                    </button>
                  </div>
                )}

                {reportOpen && (
                  <form onSubmit={handleReportSubmit} className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <p className="text-xs font-semibold text-slate-900">Report Listing to Admin</p>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option>Misleading product information</option>
                      <option>Suspicious pricing or scam risk</option>
                      <option>Prohibited campus item</option>
                      <option>Duplicate or spam listing</option>
                    </select>
                    <textarea
                      rows={2}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Additional details for moderators..."
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReportOpen(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-3 py-1.5 bg-red-700 text-white text-xs font-medium rounded-lg cursor-pointer"
                      >
                        Submit Report
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
