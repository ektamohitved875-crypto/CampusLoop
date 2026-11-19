import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ImagePlus, Trash2, Upload } from 'lucide-react';
import { CustomerLayout } from '../components/CustomerLayout';
import { useAuth } from '../lib/authContext';
import {
  createListing,
  getListingById,
  subscribeCategories,
  updateSellerListing,
} from '../lib/firestoreService';
import { compressImageFallback, uploadListingImageToStorage } from '../lib/storage';
import {
  DEHRADUN_CAMPUSES,
  DEFAULT_CATEGORIES,
  FIELD_LIMITS,
  type Category,
  type ContactPreference,
  type Listing,
  type ListingAvailability,
  type ListingCondition,
  type ListingType,
} from '../types/campusloop';

export function CreateEditListingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const isEditing = Boolean(listingId);

  const { firebaseUser, userRecord, customerProfile } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>(
    DEFAULT_CATEGORIES.map((c) => ({ ...c, createdAt: new Date(), updatedAt: new Date() })),
  );
  const [existingListing, setExistingListing] = useState<Listing | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(isEditing);

  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0].name);
  const [listingType, setListingType] = useState<ListingType>('sell');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [rentalPrice, setRentalPrice] = useState('');
  const [rentalDuration, setRentalDuration] = useState('per week');
  const [condition, setCondition] = useState<ListingCondition>('Good');
  const [images, setImages] = useState<string[]>([]);
  const [campus, setCampus] = useState<string>(DEHRADUN_CAMPUSES[0]);
  const [availability, setAvailability] = useState<ListingAvailability>('available');
  const [contactPreference, setContactPreference] = useState<ContactPreference>('In-App Chat');

  const [uploadingImage, setUploadingImage] = useState(false);
  const [storageFailureFile, setStorageFailureFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeCategories(false, (cats) => {
      if (cats.length > 0) setCategories(cats);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!listingId) return;
    setLoadingExisting(true);
    getListingById(listingId)
      .then((item) => {
        if (!item) {
          setFormError('Listing not found.');
          return;
        }
        if (firebaseUser && item.sellerId !== firebaseUser.uid) {
          setFormError('You can only edit your own listings.');
          return;
        }
        setExistingListing(item);
        setProductName(item.productName);
        setCategory(item.category);
        setListingType(item.listingType);
        setDescription(item.description);
        setPrice(String(item.price));
        setRentalPrice(item.rentalPrice ? String(item.rentalPrice) : '');
        setRentalDuration(item.rentalDuration || 'per week');
        setCondition(item.condition);
        setImages(item.images || []);
        setCampus(item.campus);
        setAvailability(item.availability);
        setContactPreference(item.contactPreference);
      })
      .finally(() => setLoadingExisting(false));
  }, [listingId, firebaseUser]);

  useEffect(() => {
    if (!isEditing && customerProfile?.campus) {
      setCampus(customerProfile.campus);
    }
  }, [isEditing, customerProfile?.campus]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !firebaseUser) return;

    if (images.length >= FIELD_LIMITS.MAX_IMAGES) {
      setUploadError(`You can upload up to ${FIELD_LIMITS.MAX_IMAGES} images per listing.`);
      return;
    }

    setUploadingImage(true);
    setUploadError(null);
    setStorageFailureFile(null);

    try {
      const url = await uploadListingImageToStorage(firebaseUser.uid, file);
      setImages((prev) => [...prev, url]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Image upload to Firebase Storage failed.';
      setUploadError(msg);
      setStorageFailureFile(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUseCompressedFallback = async () => {
    if (!storageFailureFile) return;
    setUploadingImage(true);
    setUploadError(null);
    try {
      const dataUrl = await compressImageFallback(storageFailureFile);
      setImages((prev) => [...prev, dataUrl]);
      setStorageFailureFile(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image compression failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      navigate('/login');
      return;
    }

    setFormError(null);
    setSuccessMsg(null);

    const trimmedName = productName.trim();
    const trimmedDesc = description.trim();
    const parsedPrice = Number(price === '' ? 0 : price);
    const parsedRental = Number(rentalPrice === '' ? 0 : rentalPrice);

    if (trimmedName.length < 2) {
      setFormError('Product name is mandatory (at least 2 characters).');
      return;
    }
    if (trimmedDesc.length < 10) {
      setFormError('Product description is mandatory (at least 10 characters).');
      return;
    }
    if (!category) {
      setFormError('Category is mandatory.');
      return;
    }
    if (!listingType) {
      setFormError('Listing type is mandatory.');
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setFormError('Price must be a valid non-negative number.');
      return;
    }
    if (listingType === 'rent' && (Number.isNaN(parsedRental) || parsedRental <= 0)) {
      setFormError('Please enter a valid positive rental price for rental listings.');
      return;
    }
    if (images.length === 0) {
      setFormError('At least one product image is required.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && existingListing) {
        await updateSellerListing(existingListing.listingId, existingListing.status, {
          productName: trimmedName,
          category,
          listingType,
          description: trimmedDesc,
          price: parsedPrice,
          rentalPrice: listingType === 'rent' ? parsedRental : 0,
          rentalDuration: listingType === 'rent' ? rentalDuration : '',
          condition,
          images,
          campus,
          availability,
          contactPreference,
        });
        setSuccessMsg(
          existingListing.status === 'approved'
            ? 'Your listing changes have been saved.'
            : 'Your listing has been updated and submitted for admin approval.',
        );
      } else {
        await createListing({
          sellerId: firebaseUser.uid,
          sellerName: userRecord?.name || firebaseUser.displayName || 'CampusLoop Student',
          sellerVerified: customerProfile?.verificationStatus === 'verified',
          productName: trimmedName,
          category,
          listingType,
          description: trimmedDesc,
          price: parsedPrice,
          rentalPrice: listingType === 'rent' ? parsedRental : 0,
          rentalDuration: listingType === 'rent' ? rentalDuration : '',
          condition,
          images,
          campus,
          availability,
          contactPreference,
        });
        setSuccessMsg('Your listing has been submitted successfully and is awaiting admin approval.');
      }
    } catch {
      setFormError('Cloud save failed. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to="/customer/my-listings"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to My Listings
        </Link>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8">
          <h1 className="text-2xl font-display font-bold text-slate-900">
            {isEditing ? 'Edit Listing' : 'Sell or Rent an Item'}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            All new or resubmitted listings are reviewed by a CampusLoop admin before appearing in the public marketplace.
          </p>

          {existingListing?.status === 'rejected' && existingListing.rejectionReason && (
            <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p className="font-semibold">Previous Rejection Reason:</p>
              <p className="mt-1">{existingListing.rejectionReason}</p>
              <p className="mt-1 text-amber-800">
                Make corrections below and save to resubmit for admin approval.
              </p>
            </div>
          )}

          {loadingExisting ? (
            <div className="mt-6 h-64 bg-slate-100 rounded-xl animate-pulse" />
          ) : successMsg ? (
            <div className="mt-6 p-6 rounded-xl bg-teal-50 border border-teal-200">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-teal-950">{successMsg}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to="/customer/my-listings"
                      className="px-4 py-2 bg-teal-700 text-white text-xs font-semibold rounded-lg hover:bg-teal-800"
                    >
                      View My Listings
                    </Link>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setSuccessMsg(null);
                          setProductName('');
                          setDescription('');
                          setPrice('');
                          setRentalPrice('');
                          setImages([]);
                        }}
                        className="px-4 py-2 border border-teal-300 text-teal-900 text-xs font-semibold rounded-lg hover:bg-teal-100 cursor-pointer"
                      >
                        Post Another Item
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={FIELD_LIMITS.PRODUCT_NAME_MAX}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g., Kotler Marketing Management Textbook (15th Ed)"
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Category *
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {categories.map((cat) => (
                      <option key={cat.categoryId} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Listing Type *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg">
                    {(['sell', 'rent', 'exchange'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setListingType(t)}
                        className={`py-2 text-xs font-semibold rounded-md capitalize transition-colors cursor-pointer ${
                          listingType === t
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Product Description *
                </label>
                <textarea
                  rows={4}
                  required
                  maxLength={FIELD_LIMITS.DESCRIPTION_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Include edition, brand, age, defects (if any), and preferred campus handover point."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {listingType === 'exchange' ? 'Estimated Item Value (₹)' : 'Selling / Base Price (₹) *'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={FIELD_LIMITS.MAX_PRICE}
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g., 850"
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                  />
                </div>

                {listingType === 'rent' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Rental Price (₹) *
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={rentalPrice}
                        onChange={(e) => setRentalPrice(e.target.value)}
                        placeholder="e.g., 250"
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:border-teal-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Rental Duration
                      </label>
                      <select
                        value={rentalDuration}
                        onChange={(e) => setRentalDuration(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                      >
                        <option value="per day">Per Day</option>
                        <option value="per week">Per Week</option>
                        <option value="per month">Per Month</option>
                        <option value="per semester">Per Semester</option>
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Product Condition *
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as ListingCondition)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Used">Used</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    College / Campus *
                  </label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Availability
                  </label>
                  <select
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value as ListingAvailability)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="rented">Rented</option>
                    <option value="sold">Sold</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Contact Preference
                  </label>
                  <select
                    value={contactPreference}
                    onChange={(e) => setContactPreference(e.target.value as ContactPreference)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    <option value="In-App Chat">In-App Chat</option>
                    <option value="In-App + Phone">In-App + Phone</option>
                  </select>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Product Images * (1–5 photos via Firebase Storage)
                </label>

                <div className="flex flex-wrap gap-3 items-center">
                  {images.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-24 h-20 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                    >
                      <img
                        src={url}
                        alt={`Upload ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 p-1 bg-slate-900/80 text-white rounded-md hover:bg-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {images.length < FIELD_LIMITS.MAX_IMAGES && (
                    <label className="w-36 h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-xs text-slate-600 hover:border-teal-600 hover:text-teal-700 cursor-pointer transition-colors">
                      {uploadingImage ? (
                        <span>Uploading...</span>
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5 mb-1" />
                          <span>Upload Photo</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {uploadError && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                    <p>
                      <strong>Firebase Storage Upload Error:</strong> {uploadError}
                    </p>
                    <p className="text-amber-800">
                      Ensure Firebase Storage is enabled in your Firebase Console, or store a compressed cloud image snapshot below so your listing is not lost.
                    </p>
                    {storageFailureFile && (
                      <button
                        type="button"
                        onClick={handleUseCompressedFallback}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Compress &amp; Attach Image Snapshot
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Link
                  to="/customer/my-listings"
                  className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || uploadingImage}
                  className="px-6 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-xl hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting
                    ? 'Saving to Cloud...'
                    : isEditing
                      ? 'Save & Resubmit Listing'
                      : 'Submit Listing for Approval'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
