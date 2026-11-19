import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_CATEGORIES,
  FIELD_LIMITS,
  INITIAL_BUSINESS_INSIGHTS,
  type AdminAnalyticsDoc,
  type AdminRecord,
  type AppNotification,
  type BusinessInsightsState,
  type Category,
  type ChatMessage,
  type Conversation,
  type CustomerProfile,
  type ExchangeRequest,
  type Inquiry,
  type Listing,
  type ListingAvailability,
  type ListingCondition,
  type ListingStatus,
  type ListingType,
  type NotificationType,
  type RentalRequest,
  type ReportRecord,
  type RequestStatus,
  type UserRecord,
  type UserStatus,
  type VerificationStatus,
} from '../types/campusloop';

export function generateSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '');
  const randomPart =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 14)
      : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${cleanPrefix}_${randomPart}`;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'Just now';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  if (ts instanceof Date) {
    return ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return 'Recent';
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------
export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}): Promise<void> {
  const notificationId = generateSafeId('notif');
  const path = `notifications/${notificationId}`;
  try {
    await setDoc(doc(db, 'notifications', notificationId), {
      notificationId,
      userId: input.userId,
      type: input.type,
      title: input.title.slice(0, 140),
      body: input.body.slice(0, 500),
      link: (input.link || '/customer/dashboard').slice(0, 240),
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Notification creation failed:', error);
  }
}

export function subscribeUserNotifications(
  userId: string,
  callback: (items: AppNotification[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as AppNotification);
      items.sort((a, b) => {
        const tA = a.createdAt && 'toMillis' in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.createdAt && 'toMillis' in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'),
  );
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

// -----------------------------------------------------------------------------
// Categories
// -----------------------------------------------------------------------------
export function subscribeCategories(
  includeInactive: boolean,
  callback: (categories: Category[]) => void,
): Unsubscribe {
  const q = includeInactive
    ? query(collection(db, 'categories'))
    : query(collection(db, 'categories'), where('isActive', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty && !includeInactive) {
        callback(
          DEFAULT_CATEGORIES.map((c) => ({
            ...c,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );
        return;
      }
      const list = snap.docs.map((d) => d.data() as Category);
      list.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
      callback(list);
    },
    (error) => {
      console.warn('Category fetch fallback:', error.message);
      callback(
        DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      );
    },
  );
}

export async function ensureDefaultCategoriesSeeded(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (!snap.empty) return;
    await Promise.all(
      DEFAULT_CATEGORIES.map((cat) =>
        setDoc(doc(db, 'categories', cat.categoryId), {
          ...cat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'categories');
  }
}

export async function saveCategory(cat: {
  categoryId?: string;
  name: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
}): Promise<void> {
  const categoryId = cat.categoryId || generateSafeId('cat');
  const ref = doc(db, 'categories', categoryId);
  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        name: cat.name.trim().slice(0, 80),
        description: cat.description.trim().slice(0, 300),
        imageUrl: cat.imageUrl.trim().slice(0, 1000),
        isActive: cat.isActive,
        sortOrder: Number(cat.sortOrder) || 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        categoryId,
        name: cat.name.trim().slice(0, 80),
        description: cat.description.trim().slice(0, 300),
        imageUrl: cat.imageUrl.trim().slice(0, 1000),
        isActive: cat.isActive,
        sortOrder: Number(cat.sortOrder) || 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `categories/${categoryId}`);
  }
}

// -----------------------------------------------------------------------------
// Listings
// -----------------------------------------------------------------------------
export function subscribeApprovedListings(callback: (listings: Listing[]) => void): Unsubscribe {
  const q = query(collection(db, 'listings'), where('status', '==', 'approved'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Listing);
      items.sort((a, b) => {
        const tA = a.createdAt && 'toMillis' in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.createdAt && 'toMillis' in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'listings'),
  );
}

export function subscribeSellerListings(
  sellerId: string,
  callback: (listings: Listing[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'listings'), where('sellerId', '==', sellerId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Listing);
      items.sort((a, b) => {
        const tA = a.updatedAt && 'toMillis' in a.updatedAt ? (a.updatedAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.updatedAt && 'toMillis' in b.updatedAt ? (b.updatedAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'listings'),
  );
}

export function subscribeAllListingsAdmin(callback: (listings: Listing[]) => void): Unsubscribe {
  const q = query(collection(db, 'listings'));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Listing);
      items.sort((a, b) => {
        const tA = a.createdAt && 'toMillis' in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.createdAt && 'toMillis' in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'listings'),
  );
}

export async function getListingById(listingId: string): Promise<Listing | null> {
  try {
    const snap = await getDoc(doc(db, 'listings', listingId));
    return snap.exists() ? (snap.data() as Listing) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `listings/${listingId}`);
  }
}

export async function createListing(input: {
  sellerId: string;
  sellerName: string;
  sellerVerified: boolean;
  productName: string;
  category: string;
  listingType: ListingType;
  description: string;
  price: number;
  rentalPrice?: number;
  rentalDuration?: string;
  condition: ListingCondition;
  images: string[];
  campus: string;
  availability: ListingAvailability;
  contactPreference: 'In-App Chat' | 'In-App + Phone';
}): Promise<string> {
  const listingId = generateSafeId('lst');
  const payload = {
    listingId,
    sellerId: input.sellerId,
    sellerName: input.sellerName.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    sellerVerified: Boolean(input.sellerVerified),
    productName: input.productName.trim().slice(0, FIELD_LIMITS.PRODUCT_NAME_MAX),
    category: input.category.trim().slice(0, 80),
    listingType: input.listingType,
    description: input.description.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
    price: Math.max(0, Math.min(FIELD_LIMITS.MAX_PRICE, Number(input.price) || 0)),
    rentalPrice: Math.max(0, Math.min(FIELD_LIMITS.MAX_PRICE, Number(input.rentalPrice) || 0)),
    rentalDuration: (input.rentalDuration || '').trim().slice(0, 40),
    condition: input.condition,
    images: input.images.slice(0, FIELD_LIMITS.MAX_IMAGES),
    campus: input.campus.trim().slice(0, 120),
    availability: input.availability,
    contactPreference: input.contactPreference,
    status: 'pending' as ListingStatus,
    rejectionReason: '',
    isFlagged: false,
    isDemo: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'listings', listingId), payload);
    return listingId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `listings/${listingId}`);
  }
}

export async function updateSellerListing(
  listingId: string,
  existingStatus: ListingStatus,
  updates: {
    productName: string;
    category: string;
    listingType: ListingType;
    description: string;
    price: number;
    rentalPrice?: number;
    rentalDuration?: string;
    condition: ListingCondition;
    images: string[];
    campus: string;
    availability: ListingAvailability;
    contactPreference: 'In-App Chat' | 'In-App + Phone';
  },
): Promise<void> {
  const ref = doc(db, 'listings', listingId);
  try {
    if (existingStatus === 'approved') {
      await updateDoc(ref, {
        availability: updates.availability,
        price: Math.max(0, Math.min(FIELD_LIMITS.MAX_PRICE, Number(updates.price) || 0)),
        rentalPrice: Math.max(0, Math.min(FIELD_LIMITS.MAX_PRICE, Number(updates.rentalPrice) || 0)),
        rentalDuration: (updates.rentalDuration || '').trim().slice(0, 40),
        description: updates.description.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
        contactPreference: updates.contactPreference,
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        productName: updates.productName.trim().slice(0, FIELD_LIMITS.PRODUCT_NAME_MAX),
        category: updates.category.trim().slice(0, 80),
        listingType: updates.listingType,
        description: updates.description.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
        price: Math.max(0, Math.min(FIELD_LIMITS.MAX_PRICE, Number(updates.price) || 0)),
        rentalPrice: Math.max(0, Math.min(FIELD_LIMITS.MAX_PRICE, Number(updates.rentalPrice) || 0)),
        rentalDuration: (updates.rentalDuration || '').trim().slice(0, 40),
        condition: updates.condition,
        images: updates.images.slice(0, FIELD_LIMITS.MAX_IMAGES),
        campus: updates.campus.trim().slice(0, 120),
        availability: updates.availability,
        contactPreference: updates.contactPreference,
        status: 'pending',
        rejectionReason: '',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `listings/${listingId}`);
  }
}

export async function deleteListing(listingId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'listings', listingId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `listings/${listingId}`);
  }
}

export async function moderateListingAdmin(
  listing: Listing,
  action: 'approved' | 'rejected' | 'removed' | 'flagged',
  reason = '',
): Promise<void> {
  const ref = doc(db, 'listings', listing.listingId);
  try {
    await updateDoc(ref, {
      status: action,
      rejectionReason: action === 'rejected' ? reason.trim().slice(0, FIELD_LIMITS.REJECTION_MAX) : '',
      isFlagged: action === 'flagged',
      updatedAt: serverTimestamp(),
    });

    if (action === 'approved') {
      await createNotification({
        userId: listing.sellerId,
        type: 'listing_approved',
        title: 'Listing Approved',
        body: `Your listing "${listing.productName}" is now live on the CampusLoop marketplace.`,
        link: `/listing/${listing.listingId}`,
      });
    } else if (action === 'rejected') {
      await createNotification({
        userId: listing.sellerId,
        type: 'listing_rejected',
        title: 'Listing Needs Revision',
        body: `"${listing.productName}" was rejected: ${reason || 'Please review listing guidelines.'}`,
        link: '/customer/my-listings',
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `listings/${listing.listingId}`);
  }
}

export async function seedDemoListingsAdmin(adminUid: string, adminName: string): Promise<number> {
  const demoItems: Array<Omit<Listing, 'listingId' | 'createdAt' | 'updatedAt'>> = [
    {
      sellerId: adminUid,
      sellerName: `${adminName} (Demo Seller)`,
      sellerVerified: true,
      productName: 'MBA Core Strategy & Finance Textbook Bundle (5 Books) [DEMO DATA]',
      category: 'Books and Study Materials',
      listingType: 'sell',
      description:
        'DEMO DATA: Complete Semester 1 & 2 textbook bundle including Kotler Marketing Management, Financial Management, and Casio fx-991EX calculator. Clean pages with minimal pencil notes.',
      price: 1450,
      rentalPrice: 0,
      rentalDuration: '',
      condition: 'Like New',
      images: ['/src/assets/images/demo_books_study_1795073411211.jpg'],
      campus: 'DGU / Doon Business School (Selaqui)',
      availability: 'available',
      contactPreference: 'In-App Chat',
      status: 'approved',
      rejectionReason: '',
      isFlagged: false,
      isDemo: true,
    },
    {
      sellerId: adminUid,
      sellerName: `${adminName} (Demo Seller)`,
      sellerVerified: true,
      productName: 'Tailored Navy Placement Blazer + White Shirt [DEMO DATA]',
      category: 'Formal Clothes and Interview Wear',
      listingType: 'rent',
      description:
        'DEMO DATA: Raymond slim-fit navy blazer (Size 40 / M) available for placement interviews, case competitions, and convocation weeks. Freshly dry-cleaned.',
      price: 2800,
      rentalPrice: 350,
      rentalDuration: 'per week',
      condition: 'Like New',
      images: ['/src/assets/images/demo_formal_interview_1795073411758.jpg'],
      campus: 'DGU / Doon Business School (Selaqui)',
      availability: 'available',
      contactPreference: 'In-App Chat',
      status: 'approved',
      rejectionReason: '',
      isFlagged: false,
      isDemo: true,
    },
    {
      sellerId: adminUid,
      sellerName: `${adminName} (Demo Seller)`,
      sellerVerified: true,
      productName: 'Stainless Electric Kettle + Aluminum LED Study Lamp [DEMO DATA]',
      category: 'Hostel Appliances',
      listingType: 'sell',
      description:
        'DEMO DATA: 1.5L Prestige stainless steel kettle and touch-dimmable aluminum study lamp ideal for hostel rooms. Working 100%, selling before graduation.',
      price: 950,
      rentalPrice: 0,
      rentalDuration: '',
      condition: 'Good',
      images: ['/src/assets/images/demo_hostel_appliances_1795073411772.jpg'],
      campus: 'UPES (Bidholi Campus)',
      availability: 'available',
      contactPreference: 'In-App Chat',
      status: 'approved',
      rejectionReason: '',
      isFlagged: false,
      isDemo: true,
    },
    {
      sellerId: adminUid,
      sellerName: `${adminName} (Demo Seller)`,
      sellerVerified: true,
      productName: 'Noise-Cancelling Headphones + Anker USB-C Hub [DEMO DATA]',
      category: 'Electronics and Gadgets',
      listingType: 'exchange',
      description:
        'DEMO DATA: Looking to exchange my over-ear wireless headphones and 6-in-1 USB-C hub for a standard college bicycle or ergonomic hostel chair.',
      price: 3200,
      rentalPrice: 0,
      rentalDuration: '',
      condition: 'Good',
      images: ['/src/assets/images/demo_electronics_gadgets_1795073412282.jpg'],
      campus: 'Graphic Era University (Clement Town)',
      availability: 'available',
      contactPreference: 'In-App Chat',
      status: 'approved',
      rejectionReason: '',
      isFlagged: false,
      isDemo: true,
    },
  ];

  try {
    await Promise.all(
      demoItems.map((item) => {
        const listingId = generateSafeId('demo_lst');
        return setDoc(doc(db, 'listings', listingId), {
          ...item,
          listingId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }),
    );
    return demoItems.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'listings');
  }
}

export async function clearDemoListingsAdmin(): Promise<number> {
  try {
    const snap = await getDocs(query(collection(db, 'listings'), where('isDemo', '==', true)));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    return snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'listings');
  }
}

// -----------------------------------------------------------------------------
// Buy, Rent & Exchange Workflows
// -----------------------------------------------------------------------------
export async function submitBuyInquiry(input: {
  listing: Listing;
  buyerId: string;
  buyerName: string;
  offerPrice?: number;
  message: string;
}): Promise<string> {
  const inquiryId = generateSafeId('inq');
  try {
    await setDoc(doc(db, 'inquiries', inquiryId), {
      inquiryId,
      listingId: input.listing.listingId,
      listingTitle: input.listing.productName.slice(0, 140),
      listingImage: (input.listing.images[0] || '').slice(0, 350000),
      buyerId: input.buyerId,
      buyerName: input.buyerName.slice(0, 120),
      sellerId: input.listing.sellerId,
      sellerName: input.listing.sellerName.slice(0, 120),
      offerPrice: Number(input.offerPrice ?? input.listing.price) || 0,
      message: input.message.trim().slice(0, FIELD_LIMITS.INQUIRY_MAX),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: input.listing.sellerId,
      type: 'inquiry',
      title: 'New Buy Inquiry',
      body: `${input.buyerName} sent an inquiry for "${input.listing.productName}".`,
      link: '/customer/orders',
    });

    return inquiryId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `inquiries/${inquiryId}`);
  }
}

export async function submitRentalRequest(input: {
  listing: Listing;
  buyerId: string;
  buyerName: string;
  startDate: string;
  endDate: string;
  agreedTerms: string;
}): Promise<string> {
  const requestId = generateSafeId('rent');
  try {
    await setDoc(doc(db, 'rentalRequests', requestId), {
      requestId,
      listingId: input.listing.listingId,
      listingTitle: input.listing.productName.slice(0, 140),
      listingImage: (input.listing.images[0] || '').slice(0, 350000),
      buyerId: input.buyerId,
      buyerName: input.buyerName.slice(0, 120),
      sellerId: input.listing.sellerId,
      sellerName: input.listing.sellerName.slice(0, 120),
      startDate: input.startDate.slice(0, 32),
      endDate: input.endDate.slice(0, 32),
      agreedTerms: input.agreedTerms.trim().slice(0, FIELD_LIMITS.INQUIRY_MAX),
      rentalPrice: Number(input.listing.rentalPrice || input.listing.price) || 0,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: input.listing.sellerId,
      type: 'rental_request',
      title: 'New Rental Request',
      body: `${input.buyerName} requested to rent "${input.listing.productName}" (${input.startDate} to ${input.endDate}).`,
      link: '/customer/orders',
    });

    return requestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rentalRequests/${requestId}`);
  }
}

export async function submitExchangeRequest(input: {
  listing: Listing;
  buyerId: string;
  buyerName: string;
  offeredItemTitle: string;
  offeredItemDescription: string;
  offeredItemCondition: ListingCondition;
}): Promise<string> {
  const requestId = generateSafeId('exch');
  try {
    await setDoc(doc(db, 'exchangeRequests', requestId), {
      requestId,
      listingId: input.listing.listingId,
      listingTitle: input.listing.productName.slice(0, 140),
      listingImage: (input.listing.images[0] || '').slice(0, 350000),
      buyerId: input.buyerId,
      buyerName: input.buyerName.slice(0, 120),
      sellerId: input.listing.sellerId,
      sellerName: input.listing.sellerName.slice(0, 120),
      offeredItemTitle: input.offeredItemTitle.trim().slice(0, 140),
      offeredItemDescription: input.offeredItemDescription.trim().slice(0, FIELD_LIMITS.INQUIRY_MAX),
      offeredItemCondition: input.offeredItemCondition,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: input.listing.sellerId,
      type: 'exchange_request',
      title: 'New Exchange Proposal',
      body: `${input.buyerName} proposed exchanging "${input.offeredItemTitle}" for "${input.listing.productName}".`,
      link: '/customer/orders',
    });

    return requestId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `exchangeRequests/${requestId}`);
  }
}

export async function updateWorkflowStatus(
  collectionName: 'inquiries' | 'rentalRequests' | 'exchangeRequests',
  docId: string,
  newStatus: RequestStatus,
  notifyUserId: string,
  listingTitle: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, collectionName, docId), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      userId: notifyUserId,
      type: 'request_update',
      title: `Request ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      body: `Your request for "${listingTitle}" is now marked as ${newStatus}.`,
      link: '/customer/orders',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${docId}`);
  }
}

export function subscribeParticipantRequests(
  uid: string,
  callback: (data: {
    inquiries: Inquiry[];
    rentals: RentalRequest[];
    exchanges: ExchangeRequest[];
  }) => void,
): Unsubscribe {
  const state = {
    inquiriesBuy: [] as Inquiry[],
    inquiriesSell: [] as Inquiry[],
    rentalsBuy: [] as RentalRequest[],
    rentalsSell: [] as RentalRequest[],
    exchangesBuy: [] as ExchangeRequest[],
    exchangesSell: [] as ExchangeRequest[],
  };

  const emit = () => {
    const dedupe = <T extends object>(arr: T[], key: keyof T): T[] => {
      const map = new Map<string, T>();
      arr.forEach((item) => map.set(String(item[key]), item));
      return Array.from(map.values());
    };
    callback({
      inquiries: dedupe([...state.inquiriesBuy, ...state.inquiriesSell], 'inquiryId'),
      rentals: dedupe([...state.rentalsBuy, ...state.rentalsSell], 'requestId'),
      exchanges: dedupe([...state.exchangesBuy, ...state.exchangesSell], 'requestId'),
    });
  };

  const unsubs = [
    onSnapshot(
      query(collection(db, 'inquiries'), where('buyerId', '==', uid)),
      (s) => {
        state.inquiriesBuy = s.docs.map((d) => d.data() as Inquiry);
        emit();
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'inquiries'),
    ),
    onSnapshot(
      query(collection(db, 'inquiries'), where('sellerId', '==', uid)),
      (s) => {
        state.inquiriesSell = s.docs.map((d) => d.data() as Inquiry);
        emit();
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'inquiries'),
    ),
    onSnapshot(
      query(collection(db, 'rentalRequests'), where('buyerId', '==', uid)),
      (s) => {
        state.rentalsBuy = s.docs.map((d) => d.data() as RentalRequest);
        emit();
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'rentalRequests'),
    ),
    onSnapshot(
      query(collection(db, 'rentalRequests'), where('sellerId', '==', uid)),
      (s) => {
        state.rentalsSell = s.docs.map((d) => d.data() as RentalRequest);
        emit();
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'rentalRequests'),
    ),
    onSnapshot(
      query(collection(db, 'exchangeRequests'), where('buyerId', '==', uid)),
      (s) => {
        state.exchangesBuy = s.docs.map((d) => d.data() as ExchangeRequest);
        emit();
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'exchangeRequests'),
    ),
    onSnapshot(
      query(collection(db, 'exchangeRequests'), where('sellerId', '==', uid)),
      (s) => {
        state.exchangesSell = s.docs.map((d) => d.data() as ExchangeRequest);
        emit();
      },
      (e) => handleFirestoreError(e, OperationType.LIST, 'exchangeRequests'),
    ),
  ];

  return () => unsubs.forEach((u) => u());
}

// -----------------------------------------------------------------------------
// Messaging & Conversations
// -----------------------------------------------------------------------------
export async function getOrCreateConversation(input: {
  listing: Listing;
  buyerId: string;
  buyerName: string;
  initialMessage?: string;
}): Promise<string> {
  const safeId = `conv_${input.listing.listingId.slice(0, 32)}_${input.buyerId.slice(0, 24)}_${input.listing.sellerId.slice(0, 24)}`.replace(
    /[^a-zA-Z0-9_-]/g,
    '',
  );
  const convRef = doc(db, 'conversations', safeId);

  try {
    const snap = await getDoc(convRef);
    if (!snap.exists()) {
      await setDoc(convRef, {
        conversationId: safeId,
        participantIds: [input.buyerId, input.listing.sellerId],
        buyerId: input.buyerId,
        buyerName: input.buyerName.slice(0, 120),
        sellerId: input.listing.sellerId,
        sellerName: input.listing.sellerName.slice(0, 120),
        listingId: input.listing.listingId,
        listingTitle: input.listing.productName.slice(0, 140),
        listingImage: (input.listing.images[0] || '').slice(0, 350000),
        lastMessage: (input.initialMessage || 'Started conversation').slice(0, 500),
        lastSenderId: input.buyerId,
        unreadByBuyer: false,
        unreadBySeller: true,
        isReported: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (input.initialMessage) {
        await sendMessageToConversation({
          conversationId: safeId,
          senderId: input.buyerId,
          senderName: input.buyerName,
          recipientId: input.listing.sellerId,
          isBuyerSender: true,
          text: input.initialMessage,
          listingTitle: input.listing.productName,
        });
      }
    }
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conversations/${safeId}`);
  }
}

export async function sendMessageToConversation(input: {
  conversationId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  isBuyerSender: boolean;
  text: string;
  listingTitle: string;
}): Promise<void> {
  const messageId = generateSafeId('msg');
  const trimmed = input.text.trim().slice(0, FIELD_LIMITS.MESSAGE_MAX);
  if (!trimmed) return;

  try {
    await setDoc(doc(db, 'conversations', input.conversationId, 'messages', messageId), {
      messageId,
      senderId: input.senderId,
      senderName: input.senderName.slice(0, 120),
      text: trimmed,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'conversations', input.conversationId), {
      lastMessage: trimmed.slice(0, 500),
      lastSenderId: input.senderId,
      unreadByBuyer: !input.isBuyerSender,
      unreadBySeller: input.isBuyerSender,
      updatedAt: serverTimestamp(),
    });

    await createNotification({
      userId: input.recipientId,
      type: 'message',
      title: `New message from ${input.senderName}`,
      body: `${input.listingTitle}: "${trimmed.slice(0, 120)}"`,
      link: `/customer/messages?thread=${input.conversationId}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `conversations/${input.conversationId}/messages/${messageId}`);
  }
}

export async function markConversationRead(
  conversationId: string,
  isBuyer: boolean,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      ...(isBuyer ? { unreadByBuyer: false } : { unreadBySeller: false }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Mark read failed:', error);
  }
}

export function subscribeUserConversations(
  uid: string,
  callback: (items: Conversation[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'conversations'), where('participantIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as Conversation);
      items.sort((a, b) => {
        const tA = a.updatedAt && 'toMillis' in a.updatedAt ? (a.updatedAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.updatedAt && 'toMillis' in b.updatedAt ? (b.updatedAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'conversations'),
  );
}

export function subscribeConversationMessages(
  conversationId: string,
  callback: (msgs: ChatMessage[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => d.data() as ChatMessage));
    },
    (error) => handleFirestoreError(error, OperationType.LIST, `conversations/${conversationId}/messages`),
  );
}

// -----------------------------------------------------------------------------
// Customer Profile & Saved Items
// -----------------------------------------------------------------------------
export async function updateCustomerProfile(
  uid: string,
  existingStatus: VerificationStatus,
  updates: {
    fullName: string;
    college: string;
    course: string;
    academicYear: string;
    campus: string;
    contactNumber: string;
    studentIdNumber?: string;
    requestVerification?: boolean;
  },
): Promise<void> {
  const ref = doc(db, 'users', uid, 'profile', 'details');
  try {
    if (updates.requestVerification && existingStatus !== 'verified') {
      await updateDoc(ref, {
        fullName: updates.fullName.trim().slice(0, 120),
        college: updates.college.trim().slice(0, 160),
        course: updates.course.trim().slice(0, 120),
        academicYear: updates.academicYear.trim().slice(0, 40),
        campus: updates.campus.trim().slice(0, 120),
        contactNumber: updates.contactNumber.trim().slice(0, 24),
        studentIdNumber: (updates.studentIdNumber || '').trim().slice(0, 64),
        verificationStatus: 'pending',
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        fullName: updates.fullName.trim().slice(0, 120),
        college: updates.college.trim().slice(0, 160),
        course: updates.course.trim().slice(0, 120),
        academicYear: updates.academicYear.trim().slice(0, 40),
        campus: updates.campus.trim().slice(0, 120),
        contactNumber: updates.contactNumber.trim().slice(0, 24),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/profile/details`);
  }
}

export async function toggleSavedListing(
  uid: string,
  currentSaved: string[],
  listingId: string,
): Promise<string[]> {
  const exists = currentSaved.includes(listingId);
  const next = exists
    ? currentSaved.filter((id) => id !== listingId)
    : [listingId, ...currentSaved].slice(0, 50);
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'details'), {
      savedListingIds: next,
      updatedAt: serverTimestamp(),
    });
    return next;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/profile/details`);
  }
}

// -----------------------------------------------------------------------------
// Reports & Moderation
// -----------------------------------------------------------------------------
export async function submitReport(input: {
  reporterId: string;
  reporterName: string;
  targetType: 'listing' | 'user' | 'conversation';
  targetId: string;
  targetTitle: string;
  reason: string;
  details: string;
}): Promise<void> {
  const reportId = generateSafeId('rep');
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reportId,
      reporterId: input.reporterId,
      reporterName: input.reporterName.slice(0, 120),
      targetType: input.targetType,
      targetId: input.targetId,
      targetTitle: input.targetTitle.slice(0, 160),
      reason: input.reason.trim().slice(0, 160),
      details: input.details.trim().slice(0, 1500),
      status: 'open',
      moderationDecision: '',
      moderatedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.targetType === 'conversation') {
      await updateDoc(doc(db, 'conversations', input.targetId), {
        isReported: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reports/${reportId}`);
  }
}

export function subscribeReportsAdmin(callback: (reports: ReportRecord[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'reports'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as ReportRecord);
      items.sort((a, b) => {
        const tA = a.createdAt && 'toMillis' in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.createdAt && 'toMillis' in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'reports'),
  );
}

export async function updateReportModerationAdmin(
  reportId: string,
  status: 'under_review' | 'resolved' | 'dismissed',
  decision: string,
  adminUid: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      moderationDecision: decision.trim().slice(0, 500),
      moderatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export function subscribeReportedConversationsAdmin(
  callback: (items: Conversation[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'conversations'), where('isReported', '==', true));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => d.data() as Conversation)),
    (error) => handleFirestoreError(error, OperationType.LIST, 'conversations'),
  );
}

// -----------------------------------------------------------------------------
// Admin: User Management, Admin Allowlist, Analytics & Business Insights
// -----------------------------------------------------------------------------
export function subscribeAllUsersAdmin(callback: (users: UserRecord[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const items = snap.docs.map((d) => d.data() as UserRecord);
      items.sort((a, b) => {
        const tA = a.createdAt && 'toMillis' in a.createdAt ? (a.createdAt as { toMillis: () => number }).toMillis() : 0;
        const tB = b.createdAt && 'toMillis' in b.createdAt ? (b.createdAt as { toMillis: () => number }).toMillis() : 0;
        return tB - tA;
      });
      callback(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'users'),
  );
}

export async function getCustomerProfileAdmin(uid: string): Promise<CustomerProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'profile', 'details'));
    return snap.exists() ? (snap.data() as CustomerProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}/profile/details`);
  }
}

export async function setUserStatusAdmin(uid: string, status: UserStatus): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid), {
      status,
      lastLoginAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function setStudentVerificationAdmin(
  uid: string,
  verificationStatus: VerificationStatus,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', uid, 'profile', 'details'), {
      verificationStatus,
      updatedAt: serverTimestamp(),
    });
    await createNotification({
      userId: uid,
      type: 'verification',
      title: `Student Verification ${verificationStatus === 'verified' ? 'Approved' : 'Updated'}`,
      body:
        verificationStatus === 'verified'
          ? 'Your student identity has been verified for CampusLoop.'
          : `Your student verification status was updated to "${verificationStatus}".`,
      link: '/customer/profile',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}/profile/details`);
  }
}

export function subscribeAdminsList(callback: (admins: AdminRecord[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'admins'),
    (snap) => callback(snap.docs.map((d) => d.data() as AdminRecord)),
    (error) => handleFirestoreError(error, OperationType.LIST, 'admins'),
  );
}

export async function grantAdminAccess(input: {
  uid: string;
  email: string;
  name: string;
  grantedBy: string;
}): Promise<void> {
  const cleanUid = input.uid.trim();
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      email: input.email.trim().slice(0, 200),
      name: input.name.trim().slice(0, 120),
      grantedBy: input.grantedBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `admins/${cleanUid}`);
  }
}

export async function revokeAdminAccess(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${uid}`);
  }
}

export async function fetchAllRequestsForAdmin(): Promise<{
  inquiries: Inquiry[];
  rentals: RentalRequest[];
  exchanges: ExchangeRequest[];
}> {
  try {
    const [inqSnap, rentSnap, exchSnap] = await Promise.all([
      getDocs(collection(db, 'inquiries')),
      getDocs(collection(db, 'rentalRequests')),
      getDocs(collection(db, 'exchangeRequests')),
    ]);
    return {
      inquiries: inqSnap.docs.map((d) => d.data() as Inquiry),
      rentals: rentSnap.docs.map((d) => d.data() as RentalRequest),
      exchanges: exchSnap.docs.map((d) => d.data() as ExchangeRequest),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'inquiries/rentalRequests/exchangeRequests');
  }
}

export async function loadOrInitAdminAnalytics(): Promise<AdminAnalyticsDoc> {
  const ref = doc(db, 'adminAnalytics', 'marketplace_summary');
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data() as AdminAnalyticsDoc;
    const initial = {
      documentId: 'marketplace_summary',
      totalCompletedTransactions: 0,
      recentActivities: [],
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, initial);
    return {
      documentId: 'marketplace_summary',
      totalCompletedTransactions: 0,
      recentActivities: [],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'adminAnalytics/marketplace_summary');
  }
}

export async function loadOrInitBusinessInsights(): Promise<BusinessInsightsState> {
  const ref = doc(db, 'businessInsights', INITIAL_BUSINESS_INSIGHTS.documentId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as BusinessInsightsState;
    }
    await setDoc(ref, {
      ...INITIAL_BUSINESS_INSIGHTS,
      updatedAt: serverTimestamp(),
    });
    return { ...INITIAL_BUSINESS_INSIGHTS };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `businessInsights/${INITIAL_BUSINESS_INSIGHTS.documentId}`);
  }
}

export async function saveBusinessInsights(state: BusinessInsightsState): Promise<void> {
  const ref = doc(db, 'businessInsights', state.documentId);
  try {
    await setDoc(ref, {
      ...state,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `businessInsights/${state.documentId}`);
  }
}
