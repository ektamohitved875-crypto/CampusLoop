import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type ListingType = 'sell' | 'rent' | 'exchange';
export type ListingCondition = 'New' | 'Like New' | 'Good' | 'Used';
export type ListingAvailability = 'available' | 'reserved' | 'sold' | 'rented' | 'unavailable';
export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'removed' | 'flagged';
export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
export type ContactPreference = 'In-App Chat' | 'In-App + Phone';

export type NotificationType =
  | 'inquiry'
  | 'listing_approved'
  | 'listing_rejected'
  | 'message'
  | 'rental_request'
  | 'exchange_request'
  | 'request_update'
  | 'verification';

export interface AdminRecord {
  uid: string;
  email: string;
  name: string;
  grantedBy?: string;
  createdAt?: Timestamp | Date;
}

export interface UserRecord {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt?: Timestamp | Date;
  lastLoginAt?: Timestamp | Date;
}

export interface CustomerProfile {
  uid: string;
  fullName: string;
  photoURL?: string;
  email: string;
  college?: string;
  course?: string;
  academicYear?: string;
  campus?: string;
  contactNumber?: string;
  studentIdNumber?: string;
  verificationStatus: VerificationStatus;
  savedListingIds?: string[];
  updatedAt?: Timestamp | Date;
}

export interface Listing {
  listingId: string;
  sellerId: string;
  sellerName: string;
  sellerVerified?: boolean;
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
  contactPreference: ContactPreference;
  status: ListingStatus;
  rejectionReason?: string;
  isFlagged?: boolean;
  isDemo?: boolean;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface Inquiry {
  inquiryId: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  offerPrice?: number;
  message: string;
  status: RequestStatus;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface RentalRequest {
  requestId: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  startDate: string;
  endDate: string;
  agreedTerms: string;
  rentalPrice?: number;
  status: RequestStatus;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface ExchangeRequest {
  requestId: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  offeredItemTitle: string;
  offeredItemDescription: string;
  offeredItemCondition: ListingCondition;
  status: RequestStatus;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface Conversation {
  conversationId: string;
  participantIds: string[];
  buyerId: string;
  buyerName?: string;
  sellerId: string;
  sellerName?: string;
  listingId: string;
  listingTitle: string;
  listingImage?: string;
  lastMessage: string;
  lastSenderId?: string;
  unreadByBuyer: boolean;
  unreadBySeller: boolean;
  isReported: boolean;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt?: Timestamp | Date;
}

export interface AppNotification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt?: Timestamp | Date;
}

export interface Category {
  categoryId: string;
  name: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface ReportRecord {
  reportId: string;
  reporterId: string;
  reporterName?: string;
  targetType: 'listing' | 'user' | 'conversation';
  targetId: string;
  targetTitle?: string;
  reason: string;
  details?: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  moderationDecision?: string;
  moderatedBy?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface AdminAnalyticsDoc {
  documentId: string;
  totalCompletedTransactions: number;
  recentActivities?: Array<{
    id: string;
    label: string;
    detail: string;
    timestamp: string;
  }>;
  updatedAt?: Timestamp | Date;
}

export interface ScenarioAssumptions {
  transactionValue: number;
  commissionRate: number; // percentage e.g. 10 means 10%
  variableCost: number;
  monthlyFixedCost: number;
  expectedPayingCustomers: number;
  transactionsPerCustomer: number;
}

export interface GTMChannelPlan {
  id: string;
  channel: string;
  budget: number;
  expectedLeads: number;
  expectedCustomers: number;
  reason: string;
  evidence: string;
}

export interface GTMWeekExperiment {
  week: string;
  title: string;
  action: string;
  channel: string;
  target: string;
  metric: string;
  owner: string;
  learningQuestion: string;
}

export interface BusinessInsightsState {
  documentId: string;
  revenuePricing: {
    completed: boolean;
    revenueModel: 'Commission' | 'Featured Listings' | 'Seller Promotion Fees' | 'Premium Membership' | 'Other';
    activeScenario: 'conservative' | 'base' | 'ambitious';
    scenarios: {
      conservative: ScenarioAssumptions;
      base: ScenarioAssumptions;
      ambitious: ScenarioAssumptions;
    };
    evidenceNotes: {
      transactionValue: string;
      commissionRate: string;
      variableCost: string;
      monthlyFixedCost: string;
      payingCustomers: string;
    };
  };
  marketDemand: {
    completed: boolean;
    totalPotentialCustomers: number;
    serviceableCustomers: number;
    obtainableCustomers: number;
    annualSpendPerCustomer: number;
    evidence: {
      tam: string;
      sam: string;
      som: string;
      annualSpend: string;
    };
  };
  gtmLaunch: {
    completed: boolean;
    targetSegment: string;
    channels: GTMChannelPlan[];
    experiments: GTMWeekExperiment[];
  };
  updatedAt?: Timestamp | Date;
}

// Synchronized validation limits matching firestore.rules
export const FIELD_LIMITS = {
  NAME_MAX: 120,
  PRODUCT_NAME_MAX: 140,
  DESCRIPTION_MAX: 2000,
  MESSAGE_MAX: 2000,
  INQUIRY_MAX: 1000,
  REJECTION_MAX: 500,
  MAX_PRICE: 10000000,
  MAX_IMAGES: 5,
} as const;

export const DEHRADUN_CAMPUSES = [
  'DGU / Doon Business School (Selaqui)',
  'Graphic Era University (Clement Town)',
  'UPES (Bidholi Campus)',
  'UPES (Kandoli Campus)',
  'Uttaranchal University (Prem Nagar)',
  'DIT University (Mussorie Road)',
  'IMS Unison University',
  'Dehradun City / Nearby Colleges',
] as const;

export const DEFAULT_CATEGORIES: Array<Omit<Category, 'createdAt' | 'updatedAt'>> = [
  {
    categoryId: 'books_study_materials',
    name: 'Books and Study Materials',
    description: 'Textbooks, MBA case packs, competitive exam guides, and calculators.',
    imageUrl: '/src/assets/images/demo_books_study_1795073411211.jpg',
    isActive: true,
    sortOrder: 1,
  },
  {
    categoryId: 'electronics_gadgets',
    name: 'Electronics and Gadgets',
    description: 'Laptops, headphones, USB-C hubs, monitors, and study peripherals.',
    imageUrl: '/src/assets/images/demo_electronics_gadgets_1795073412282.jpg',
    isActive: true,
    sortOrder: 2,
  },
  {
    categoryId: 'formal_clothes_interview',
    name: 'Formal Clothes and Interview Wear',
    description: 'Blazers, suits, formal shirts, and placement interview attire.',
    imageUrl: '/src/assets/images/demo_formal_interview_1795073411758.jpg',
    isActive: true,
    sortOrder: 3,
  },
  {
    categoryId: 'hostel_appliances',
    name: 'Hostel Appliances',
    description: 'Electric kettles, study lamps, irons, induction tops, and fans.',
    imageUrl: '/src/assets/images/demo_hostel_appliances_1795073411772.jpg',
    isActive: true,
    sortOrder: 4,
  },
  {
    categoryId: 'furniture',
    name: 'Furniture',
    description: 'Study desks, ergonomic chairs, bookshelves, and foldable tables.',
    imageUrl: '/src/assets/images/hero_campus_marketplace_1795073411587.jpg',
    isActive: true,
    sortOrder: 5,
  },
  {
    categoryId: 'cycles_sports',
    name: 'Cycles and Sports Equipment',
    description: 'Campus bicycles, badminton rackets, football gear, and yoga mats.',
    imageUrl: '/src/assets/images/hero_campus_marketplace_1795073411587.jpg',
    isActive: true,
    sortOrder: 6,
  },
  {
    categoryId: 'accessories',
    name: 'Accessories',
    description: 'Backpacks, laptop sleeves, watches, and hostel organizers.',
    imageUrl: '/src/assets/images/demo_electronics_gadgets_1795073412282.jpg',
    isActive: true,
    sortOrder: 7,
  },
  {
    categoryId: 'event_outfits',
    name: 'Event Outfits',
    description: 'Festive ethnic wear, convocation attire, and cultural fest outfits.',
    imageUrl: '/src/assets/images/demo_formal_interview_1795073411758.jpg',
    isActive: true,
    sortOrder: 8,
  },
  {
    categoryId: 'other_college_essentials',
    name: 'Other College Essentials',
    description: 'Lab coats, drawing boards, storage trunks, and everyday dorm items.',
    imageUrl: '/src/assets/images/demo_hostel_appliances_1795073411772.jpg',
    isActive: true,
    sortOrder: 9,
  },
];

export const INITIAL_BUSINESS_INSIGHTS: Omit<BusinessInsightsState, 'updatedAt'> = {
  documentId: 'nexus_venture_labs',
  revenuePricing: {
    completed: false,
    revenueModel: 'Commission',
    activeScenario: 'base',
    scenarios: {
      conservative: {
        transactionValue: 1200,
        commissionRate: 10,
        variableCost: 150,
        monthlyFixedCost: 60000,
        expectedPayingCustomers: 250,
        transactionsPerCustomer: 1.0,
      },
      base: {
        transactionValue: 1500,
        commissionRate: 12,
        variableCost: 150,
        monthlyFixedCost: 60000,
        expectedPayingCustomers: 500,
        transactionsPerCustomer: 1.2,
      },
      ambitious: {
        transactionValue: 1800,
        commissionRate: 15,
        variableCost: 150,
        monthlyFixedCost: 60000,
        expectedPayingCustomers: 850,
        transactionsPerCustomer: 1.5,
      },
    },
    evidenceNotes: {
      transactionValue: '',
      commissionRate: '',
      variableCost: '',
      monthlyFixedCost: '',
      payingCustomers: '',
    },
  },
  marketDemand: {
    completed: false,
    totalPotentialCustomers: 10000,
    serviceableCustomers: 3000,
    obtainableCustomers: 300,
    annualSpendPerCustomer: 5000,
    evidence: {
      tam: '',
      sam: '',
      som: '',
      annualSpend: '',
    },
  },
  gtmLaunch: {
    completed: false,
    targetSegment: 'College and university students (ages 18-25), especially hostel and outstation students in Dehradun.',
    channels: [
      {
        id: 'ch_1',
        channel: 'Campus ambassadors',
        budget: 2000,
        expectedLeads: 250,
        expectedCustomers: 75,
        reason: 'Direct peer trust inside DGU / Doon Business School hostels.',
        evidence: '',
      },
      {
        id: 'ch_2',
        channel: 'WhatsApp groups',
        budget: 1000,
        expectedLeads: 300,
        expectedCustomers: 60,
        reason: 'Batch and hostel broadcast groups already drive informal buying/selling.',
        evidence: '',
      },
      {
        id: 'ch_3',
        channel: 'Student referrals',
        budget: 2000,
        expectedLeads: 200,
        expectedCustomers: 65,
        reason: 'Word-of-mouth between incoming juniors and graduating seniors.',
        evidence: '',
      },
    ],
    experiments: [
      {
        week: 'Week 1',
        title: 'Prepare',
        action: 'Onboard 5 student hostel ambassadors and collect 25 initial verified listings before campus push.',
        channel: 'Campus ambassadors',
        target: '25 approved listings across 4 core categories',
        metric: 'Listings submitted & approved before launch day',
        owner: 'Founder & Campus Ops Lead',
        learningQuestion: 'Which categories do seniors most readily list prior to semester end?',
      },
      {
        week: 'Week 2',
        title: 'Launch',
        action: 'Roll out CampusLoop QR flyers in DGU / DBS hostels and share curated listing digests in WhatsApp batch groups.',
        channel: 'WhatsApp groups',
        target: '150 student sign-ins and 40 product inquiries',
        metric: 'Google sign-ins & inquiry conversion rate',
        owner: 'Growth & Community Lead',
        learningQuestion: 'Do hostel students engage more with rental formalwear or used textbooks?',
      },
      {
        week: 'Week 3',
        title: 'Measure',
        action: 'Track buyer-seller chat response times, rental acceptance rate, and completed handovers.',
        channel: 'Student referrals',
        target: '20 accepted buy/rent/exchange requests',
        metric: 'Inquiry-to-accepted request ratio',
        owner: 'Product & Analytics Lead',
        learningQuestion: 'Where do conversations drop off before arranging an on-campus handover?',
      },
      {
        week: 'Week 4',
        title: 'Learn & Adjust',
        action: 'Interview 15 active buyers/sellers, refine commission/rental pricing assumptions, and drop low-yield channels.',
        channel: 'Campus ambassadors',
        target: 'Validated CAC and unit contribution report',
        metric: 'Verified CAC vs initial ₹5,000 budget',
        owner: 'Founding Team',
        learningQuestion: 'Is student willingness to pay sufficient to sustain our target commission rate?',
      },
    ],
  },
};
