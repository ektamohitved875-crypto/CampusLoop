import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, LogOut, ShieldCheck } from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { ListingCard } from '../components/ListingCard';
import { useAuth } from '../lib/authContext';
import {
  subscribeApprovedListings,
  subscribeParticipantRequests,
  subscribeSellerListings,
  updateCustomerProfile,
} from '../lib/firestoreService';
import {
  DEHRADUN_CAMPUSES,
  type ExchangeRequest,
  type Inquiry,
  type Listing,
  type RentalRequest,
} from '../types/campusloop';

export function ProfilePage() {
  const { firebaseUser, userRecord, customerProfile, signOutUser } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [campus, setCampus] = useState<string>(DEHRADUN_CAMPUSES[0]);
  const [contactNumber, setContactNumber] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');

  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [approvedListings, setApprovedListings] = useState<Listing[]>([]);
  const [requests, setRequests] = useState<{
    inquiries: Inquiry[];
    rentals: RentalRequest[];
    exchanges: ExchangeRequest[];
  }>({ inquiries: [], rentals: [], exchanges: [] });

  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'saved' | 'transactions'>('profile');

  useEffect(() => {
    if (!customerProfile) return;
    setFullName(customerProfile.fullName || userRecord?.name || '');
    setCollege(customerProfile.college || '');
    setCourse(customerProfile.course || '');
    setAcademicYear(customerProfile.academicYear || '');
    setCampus(customerProfile.campus || DEHRADUN_CAMPUSES[0]);
    setContactNumber(customerProfile.contactNumber || '');
    setStudentIdNumber(customerProfile.studentIdNumber || '');
  }, [customerProfile, userRecord?.name]);

  useEffect(() => {
    const unsubApproved = subscribeApprovedListings(setApprovedListings);
    let unsubMine: (() => void) | null = null;
    let unsubReqs: (() => void) | null = null;
    if (firebaseUser) {
      unsubMine = subscribeSellerListings(firebaseUser.uid, setMyListings);
      unsubReqs = subscribeParticipantRequests(firebaseUser.uid, setRequests);
    }
    return () => {
      unsubApproved();
      if (unsubMine) unsubMine();
      if (unsubReqs) unsubReqs();
    };
  }, [firebaseUser]);

  const savedListings = useMemo(() => {
    const savedIds = customerProfile?.savedListingIds || [];
    return approvedListings.filter((l) => savedIds.includes(l.listingId));
  }, [approvedListings, customerProfile?.savedListingIds]);

  const completedTransactions = useMemo(() => {
    const c1 = requests.inquiries
      .filter((r) => r.status === 'completed')
      .map((r) => ({ id: r.inquiryId, title: r.listingTitle, type: 'Buy Inquiry' }));
    const c2 = requests.rentals
      .filter((r) => r.status === 'completed')
      .map((r) => ({ id: r.requestId, title: r.listingTitle, type: 'Rental' }));
    const c3 = requests.exchanges
      .filter((r) => r.status === 'completed')
      .map((r) => ({ id: r.requestId, title: r.listingTitle, type: 'Exchange' }));
    return [...c1, ...c2, ...c3];
  }, [requests]);

  const handleSave = async (e: React.FormEvent, requestVerification: boolean) => {
    e.preventDefault();
    if (!firebaseUser || !customerProfile) return;

    if (requestVerification && (!college.trim() || !course.trim() || !studentIdNumber.trim())) {
      setSaveFeedback({
        type: 'err',
        text: 'Please fill in your College / University, Course, and Student ID / Roll Number to request student verification.',
      });
      return;
    }

    setSaving(true);
    setSaveFeedback(null);
    try {
      await updateCustomerProfile(firebaseUser.uid, customerProfile.verificationStatus, {
        fullName,
        college,
        course,
        academicYear,
        campus,
        contactNumber,
        studentIdNumber,
        requestVerification,
      });
      setSaveFeedback({
        type: 'ok',
        text: requestVerification
          ? 'Profile saved and student verification submitted for admin review.'
          : 'Profile settings saved to Firestore.',
      });
    } catch {
      setSaveFeedback({ type: 'err', text: 'Cloud save failed. Please retry.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Profile Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {firebaseUser?.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt={fullName || 'Student'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600">
                {(fullName || 'S').charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-display font-bold text-slate-900">
                {customerProfile?.fullName || userRecord?.name || 'Student Profile'}
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">{firebaseUser?.email}</p>
              <p className="text-xs mt-1.5 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <span>
                  Student Verification:{' '}
                  <strong className="capitalize">
                    {customerProfile?.verificationStatus || 'unverified'}
                  </strong>
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOutUser();
              navigate('/login');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-700 rounded-xl hover:bg-slate-50 cursor-pointer self-start sm:self-auto"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              activeTab === 'profile' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Profile &amp; Student Verification
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              activeTab === 'saved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Saved Products ({savedListings.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
              activeTab === 'transactions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Listings &amp; Transactions
          </button>
        </div>

        {activeTab === 'profile' && (
          <form
            onSubmit={(e) => handleSave(e, false)}
            className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5"
          >
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900">
                Academic &amp; Campus Details
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Google Sign-In authenticates your email. Submit your college and student ID details below for campus student verification.
              </p>
            </div>

            {saveFeedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  saveFeedback.type === 'ok'
                    ? 'bg-teal-50 border border-teal-200 text-teal-900'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {saveFeedback.type === 'ok' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{saveFeedback.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email (Managed by Google Sign-In)
                </label>
                <input
                  type="email"
                  disabled
                  value={firebaseUser?.email || ''}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 rounded-lg text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  College / University
                </label>
                <input
                  type="text"
                  value={college}
                  onChange={(e) => setCollege(e.target.value)}
                  placeholder="e.g., Doon Business School (DGU)"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course</label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g., MBA / B.Tech CSE / BBA"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Academic Year
                </label>
                <select
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  <option value="">Select Year</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                  <option value="Postgraduate Year 1">Postgraduate Year 1</option>
                  <option value="Postgraduate Year 2">Postgraduate Year 2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campus</label>
                <select
                  value={campus}
                  onChange={(e) => setCampus(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  {DEHRADUN_CAMPUSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Number (Optional)
                </label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="Optional WhatsApp / Call number"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Student ID / Enrollment Number
                </label>
                <input
                  type="text"
                  disabled={customerProfile?.verificationStatus === 'verified'}
                  value={studentIdNumber}
                  onChange={(e) => setStudentIdNumber(e.target.value)}
                  placeholder="Required for student verification"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>

              {customerProfile?.verificationStatus !== 'verified' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={(e) => handleSave(e, true)}
                  className="px-5 py-2.5 bg-teal-700 text-white text-xs font-semibold rounded-xl hover:bg-teal-800 cursor-pointer"
                >
                  Submit for Student Verification
                </button>
              )}
            </div>
          </form>
        )}

        {activeTab === 'saved' && (
          <div>
            {savedListings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
                No saved products yet. Click &ldquo;Save&rdquo; on any marketplace listing to bookmark it here.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {savedListings.map((item) => (
                  <ListingCard key={item.listingId} listing={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">
                  My Listings ({myListings.length})
                </h3>
                <Link to="/customer/my-listings" className="text-xs font-medium text-teal-700">
                  Manage →
                </Link>
              </div>
              {myListings.length === 0 ? (
                <p className="text-xs text-slate-500">No listings created yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {myListings.map((l) => (
                    <div key={l.listingId} className="py-2.5 flex justify-between">
                      <span className="font-medium text-slate-800 truncate">{l.productName}</span>
                      <span className="capitalize text-slate-500 shrink-0 ml-2">{l.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">
                  Completed Transactions ({completedTransactions.length})
                </h3>
                <Link to="/customer/orders" className="text-xs font-medium text-teal-700">
                  All Requests →
                </Link>
              </div>
              {completedTransactions.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No completed transactions recorded yet. Completed handovers appear here once confirmed.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {completedTransactions.map((tx) => (
                    <div key={tx.id} className="py-2.5 flex justify-between">
                      <span className="font-medium text-slate-800 truncate">{tx.title}</span>
                      <span className="text-teal-700 shrink-0 ml-2">{tx.type}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
