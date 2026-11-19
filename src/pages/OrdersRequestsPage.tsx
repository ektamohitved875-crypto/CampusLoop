import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerLayout } from '../components/CustomerLayout';
import { useAuth } from '../lib/authContext';
import {
  formatINR,
  formatTimestamp,
  subscribeParticipantRequests,
  updateWorkflowStatus,
} from '../lib/firestoreService';
import type {
  ExchangeRequest,
  Inquiry,
  RentalRequest,
  RequestStatus,
} from '../types/campusloop';

export function OrdersRequestsPage() {
  const { firebaseUser } = useAuth();
  const [tab, setTab] = useState<'inquiries' | 'rentals' | 'exchanges'>('inquiries');
  const [roleFilter, setRoleFilter] = useState<'all' | 'incoming' | 'sent'>('all');
  const [data, setData] = useState<{
    inquiries: Inquiry[];
    rentals: RentalRequest[];
    exchanges: ExchangeRequest[];
  }>({ inquiries: [], rentals: [], exchanges: [] });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = subscribeParticipantRequests(firebaseUser.uid, setData);
    return () => unsub();
  }, [firebaseUser]);

  const handleTransition = async (
    collectionName: 'inquiries' | 'rentalRequests' | 'exchangeRequests',
    docId: string,
    nextStatus: RequestStatus,
    notifyUid: string,
    listingTitle: string,
  ) => {
    setBusyId(docId);
    setFeedback(null);
    try {
      await updateWorkflowStatus(collectionName, docId, nextStatus, notifyUid, listingTitle);
      setFeedback(`Updated request status to "${nextStatus}".`);
    } catch {
      setFeedback('Cloud save failed. Please retry.');
    } finally {
      setBusyId(null);
    }
  };

  const renderStatusLabel = (status: RequestStatus) => {
    const color =
      status === 'accepted' || status === 'completed'
        ? 'text-teal-700'
        : status === 'rejected' || status === 'cancelled'
          ? 'text-red-700'
          : 'text-amber-700';
    return <span className={`font-semibold capitalize ${color}`}>{status}</span>;
  };

  const uid = firebaseUser?.uid || '';

  const filteredInquiries = data.inquiries.filter((r) =>
    roleFilter === 'incoming' ? r.sellerId === uid : roleFilter === 'sent' ? r.buyerId === uid : true,
  );
  const filteredRentals = data.rentals.filter((r) =>
    roleFilter === 'incoming' ? r.sellerId === uid : roleFilter === 'sent' ? r.buyerId === uid : true,
  );
  const filteredExchanges = data.exchanges.filter((r) =>
    roleFilter === 'incoming' ? r.sellerId === uid : roleFilter === 'sent' ? r.buyerId === uid : true,
  );

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-slate-900">
            My Orders &amp; Requests
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage buy inquiries, rental bookings, and exchange proposals. Payments and handovers occur directly on campus.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setTab('inquiries')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                tab === 'inquiries' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Buy Inquiries ({filteredInquiries.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('rentals')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                tab === 'rentals' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Rentals ({filteredRentals.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('exchanges')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                tab === 'exchanges' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Exchanges ({filteredExchanges.length})
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(['all', 'incoming', 'sent'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                  roleFilter === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {r === 'all' ? 'All' : r === 'incoming' ? 'Received (Seller)' : 'Sent (Buyer)'}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div className="mb-4 p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900">
            {feedback}
          </div>
        )}

        {tab === 'inquiries' && (
          <div className="space-y-4">
            {filteredInquiries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
                No buy inquiries found.
              </div>
            ) : (
              filteredInquiries.map((inq) => {
                const isSeller = inq.sellerId === uid;
                const otherUid = isSeller ? inq.buyerId : inq.sellerId;
                return (
                  <div
                    key={inq.inquiryId}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                        <span>{isSeller ? `From Buyer: ${inq.buyerName}` : `To Seller: ${inq.sellerName}`}</span>
                        <span aria-hidden="true">·</span>
                        {renderStatusLabel(inq.status)}
                        <span aria-hidden="true">·</span>
                        <span>{formatTimestamp(inq.createdAt)}</span>
                      </div>
                      <Link
                        to={`/listing/${inq.listingId}`}
                        className="text-base font-semibold text-slate-900 hover:text-teal-700 block"
                      >
                        {inq.listingTitle}
                      </Link>
                      {typeof inq.offerPrice === 'number' && (
                        <p className="text-xs font-medium text-slate-700 tabular-nums">
                          Proposed Offer: {formatINR(inq.offerPrice)}
                        </p>
                      )}
                      <p className="text-sm text-slate-600">{inq.message}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isSeller && inq.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === inq.inquiryId}
                            onClick={() =>
                              handleTransition('inquiries', inq.inquiryId, 'accepted', otherUid, inq.listingTitle)
                            }
                            className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 cursor-pointer"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={busyId === inq.inquiryId}
                            onClick={() =>
                              handleTransition('inquiries', inq.inquiryId, 'rejected', otherUid, inq.listingTitle)
                            }
                            className="px-3.5 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isSeller && inq.status === 'accepted' && (
                        <button
                          type="button"
                          disabled={busyId === inq.inquiryId}
                          onClick={() =>
                            handleTransition('inquiries', inq.inquiryId, 'completed', otherUid, inq.listingTitle)
                          }
                          className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                        >
                          Mark Handover Completed
                        </button>
                      )}
                      {!isSeller && (inq.status === 'pending' || inq.status === 'accepted') && (
                        <button
                          type="button"
                          disabled={busyId === inq.inquiryId}
                          onClick={() =>
                            handleTransition('inquiries', inq.inquiryId, 'cancelled', otherUid, inq.listingTitle)
                          }
                          className="px-3.5 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel Inquiry
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'rentals' && (
          <div className="space-y-4">
            {filteredRentals.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
                No rental requests found.
              </div>
            ) : (
              filteredRentals.map((req) => {
                const isSeller = req.sellerId === uid;
                const otherUid = isSeller ? req.buyerId : req.sellerId;
                return (
                  <div
                    key={req.requestId}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                        <span>{isSeller ? `Renter: ${req.buyerName}` : `Owner: ${req.sellerName}`}</span>
                        <span aria-hidden="true">·</span>
                        {renderStatusLabel(req.status)}
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {req.startDate} to {req.endDate}
                        </span>
                      </div>
                      <Link
                        to={`/listing/${req.listingId}`}
                        className="text-base font-semibold text-slate-900 hover:text-teal-700 block"
                      >
                        {req.listingTitle}
                      </Link>
                      <p className="text-sm text-slate-600">Terms: {req.agreedTerms}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isSeller && req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === req.requestId}
                            onClick={() =>
                              handleTransition('rentalRequests', req.requestId, 'accepted', otherUid, req.listingTitle)
                            }
                            className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 cursor-pointer"
                          >
                            Accept Rental
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.requestId}
                            onClick={() =>
                              handleTransition('rentalRequests', req.requestId, 'rejected', otherUid, req.listingTitle)
                            }
                            className="px-3.5 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isSeller && req.status === 'accepted' && (
                        <button
                          type="button"
                          disabled={busyId === req.requestId}
                          onClick={() =>
                            handleTransition('rentalRequests', req.requestId, 'completed', otherUid, req.listingTitle)
                          }
                          className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                        >
                          Mark Returned &amp; Completed
                        </button>
                      )}
                      {!isSeller && (req.status === 'pending' || req.status === 'accepted') && (
                        <button
                          type="button"
                          disabled={busyId === req.requestId}
                          onClick={() =>
                            handleTransition('rentalRequests', req.requestId, 'cancelled', otherUid, req.listingTitle)
                          }
                          className="px-3.5 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel Request
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'exchanges' && (
          <div className="space-y-4">
            {filteredExchanges.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
                No exchange proposals found.
              </div>
            ) : (
              filteredExchanges.map((req) => {
                const isSeller = req.sellerId === uid;
                const otherUid = isSeller ? req.buyerId : req.sellerId;
                return (
                  <div
                    key={req.requestId}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                        <span>{isSeller ? `From: ${req.buyerName}` : `To: ${req.sellerName}`}</span>
                        <span aria-hidden="true">·</span>
                        {renderStatusLabel(req.status)}
                        <span aria-hidden="true">·</span>
                        <span>Condition: {req.offeredItemCondition}</span>
                      </div>
                      <Link
                        to={`/listing/${req.listingId}`}
                        className="text-base font-semibold text-slate-900 hover:text-teal-700 block"
                      >
                        Target Item: {req.listingTitle}
                      </Link>
                      <p className="text-xs font-semibold text-teal-800">
                        Offered in Exchange: {req.offeredItemTitle}
                      </p>
                      <p className="text-sm text-slate-600">{req.offeredItemDescription}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {isSeller && req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === req.requestId}
                            onClick={() =>
                              handleTransition('exchangeRequests', req.requestId, 'accepted', otherUid, req.listingTitle)
                            }
                            className="px-3.5 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800 cursor-pointer"
                          >
                            Accept Swap
                          </button>
                          <button
                            type="button"
                            disabled={busyId === req.requestId}
                            onClick={() =>
                              handleTransition('exchangeRequests', req.requestId, 'rejected', otherUid, req.listingTitle)
                            }
                            className="px-3.5 py-2 border border-red-200 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isSeller && req.status === 'accepted' && (
                        <button
                          type="button"
                          disabled={busyId === req.requestId}
                          onClick={() =>
                            handleTransition('exchangeRequests', req.requestId, 'completed', otherUid, req.listingTitle)
                          }
                          className="px-3.5 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
                        >
                          Mark Swap Completed
                        </button>
                      )}
                      {!isSeller && (req.status === 'pending' || req.status === 'accepted') && (
                        <button
                          type="button"
                          disabled={busyId === req.requestId}
                          onClick={() =>
                            handleTransition('exchangeRequests', req.requestId, 'cancelled', otherUid, req.listingTitle)
                          }
                          className="px-3.5 py-2 border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          Cancel Proposal
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
