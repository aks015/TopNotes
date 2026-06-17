// ── Auth ─────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'SELLER' | 'BUYER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type NoteStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  tokenType: string;
  userId: number;
  email: string;
  fullName: string;
  phone?: string;
  profileImageUrl?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt?: string;
}

export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  profileImageUrl?: string;
  classLevel?: string;
  institution?: string;
  bio?: string;
  isVerified?: boolean;
  testPassed?: boolean;
  testScore?: number;
  marksheetApproved?: boolean;
  marksheetUrl?: string;
  createdAt?: string;
}

// ── Notification ─────────────────────────────────────────────────
export type NotificationType = 'SALE' | 'PAYMENT' | 'VERIFICATION' | 'REVIEW' | 'SYSTEM';

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt?: string;
}

// ── Note ─────────────────────────────────────────────────────────
export interface SellerProfile {
  id: number;
  fullName: string;
  classLevel?: string;
  institution?: string;
  bio?: string;
  profileImageUrl?: string;
  verified?: boolean;
  totalNotes?: number;
  totalSales?: number;
}

/** Full public seller profile (the /u/:id page). */
export interface SellerFullProfile {
  id: number;
  fullName: string;
  profileImageUrl?: string;
  verified?: boolean;
  institution?: string;
  classLevel?: string;
  bio?: string;
  joinedAt?: string;
  totalNotes: number;
  totalSales: number;
  learners: number;
  averageRating: number;
  reviewCount: number;
  domains: string[];
  exams: string[];
  subjects: string[];
}

export interface Note {
  id: number;
  title: string;
  description: string;
  /** Optional level/stage, e.g. "Class 12", "Prelims". */
  level?: string;
  category?: string;
  exam?: string;
  classLevel?: string;
  subject?: string;
  /** @deprecated superseded by the dynamic `exam`/`category` taxonomy. */
  examType?: string;
  price: number;
  thumbnailUrl?: string;
  previewUrl?: string;
  totalPages?: number;
  status?: NoteStatus;
  purchaseCount?: number;
  averageRating?: number;
  reviewCount?: number;
  seller?: SellerProfile;
  createdAt?: string;
  isPurchased?: boolean;
  // ── Seller-only analytics (from getSellerNotes) ──
  viewCount?: number;
  revenue?: number;
  lastSoldAt?: string;
  suggestedPrice?: number;
  salesTrend?: number[];
}

// ── Purchase & Review ─────────────────────────────────────────────
export interface Purchase {
  id: number;
  note?: Note;
  amount: number;
  platformShare?: number;
  sellerShare?: number;
  transactionId?: string;
  invoiceNumber?: string;
  status?: PaymentStatus;
  purchasedAt?: string;
}

export interface PaymentOrder {
  provider: string;
  mode: 'sandbox' | 'production' | string;
  orderId: string;
  paymentSessionId: string;
  amount: number;
  currency: string;
  noteId: number;
  noteTitle: string;
}

export interface SellerEarnings {
  totalEarned: number;
  paidOut: number;
  inProgress: number;
  available: number;
  minWithdraw: number;
  upiSet: boolean;
}

export interface PayoutRow {
  id: number;
  sellerId: number;
  sellerName: string;
  upiId: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | string;
  reference?: string;
  failureReason?: string;
  requestedAt?: string;
  paidAt?: string;
}

export interface PayoutStats {
  pendingCount: number;
  pendingAmount: number;
  paidCount: number;
  paidAmount: number;
  failedCount: number;
  failedAmount: number;
}

export interface LandingContent {
  hero?: {
    enabled?: boolean;
    trustBadge?: string;
    /** Full headline with any word(s) wrapped in ==double-equals== to highlight them. */
    headline?: string;
    /** Highlighter swipe colour behind highlighted words (defaults to brand yellow). */
    highlightColor?: string;
    /** Legacy 3-part headline — kept as a fallback for content saved before `headline`. */
    title?: string;
    highlight?: string;
    titleAfter?: string;
    subtitle?: string;
    ctaPrimary?: string;
    /** Where the primary button points (internal path or external URL). */
    ctaPrimaryLink?: string;
    ctaSecondary?: string;
    /** Where the secondary button points for logged-out visitors. */
    ctaSecondaryLink?: string;
    /** Decorative collage labels on the hero note-card. */
    badgeVerified?: string;
    handwritingNote?: string;
  };
  marquee?: {
    enabled?: boolean;
    items?: string[];
    /** Divider drawn between phrases ('✦' default; '' = none). */
    separator?: string;
    /** Scroll speed of the strip. */
    speed?: 'slow' | 'medium' | 'fast';
    /** Auto-mix in the exams you actually cover (from the taxonomy). Default true. */
    includeCoverage?: boolean;
  };
  stats?: { enabled?: boolean; items?: { value: string; label: string }[] };
  notesPreview?: {
    enabled?: boolean;
    eyebrow?: string;
    heading?: string;
    linkText?: string;
    /** Where the "View all" link points (internal path or external URL). */
    linkHref?: string;
    /** How many note cards to showcase. */
    count?: number;
    /** Which notes to pull: featured | rating | newest | popular. */
    sort?: string;
  };
  howItWorks?: {
    enabled?: boolean;
    eyebrow?: string;
    heading?: string;
    /** Column pill labels (default "For students" / "For toppers"). */
    buyerLabel?: string;
    sellerLabel?: string;
    buyer?: { title: string; desc: string }[];
    seller?: { title: string; desc: string }[];
  };
  features?: {
    enabled?: boolean;
    eyebrow?: string;
    heading?: string;
    items?: { icon?: string; title: string; desc: string }[];
  };
  testimonials?: {
    enabled?: boolean;
    eyebrow?: string;
    heading?: string;
    items?: { name: string; exam: string; rating: number; quote: string; photoUrl?: string }[];
  };
  founders?: {
    enabled?: boolean;
    eyebrow?: string;
    heading?: string;
    story?: string;
    items?: { name: string; role: string; bio: string; photoUrl?: string; linkedin?: string; verified?: boolean }[];
  };
  faq?: { enabled?: boolean; eyebrow?: string; heading?: string; firstOpen?: boolean; items?: { q: string; a: string }[] };
  cta?: { enabled?: boolean; eyebrow?: string; title?: string; subtitle?: string; button?: string; buttonLink?: string };
  footer?: {
    tagline?: string;
    social?: { instagram?: string; x?: string; linkedin?: string; youtube?: string };
    columns?: { title: string; links: { label: string; href: string }[] }[];
    /** Bottom bar: the line after "© {year} TopNotes ·" and the right-side credit. */
    legalLine?: string;
    madeIn?: string;
  };
}

// ── Seller qualifications (per-category) ──────────────────────────
export interface Qualification {
  categoryId: number;
  categoryName: string;
  status: string | null; // null = NOT_STARTED
  bestScore: number;
  attemptsUsed: number;
  attemptsLeft: number | null;
  testAvailable: boolean;
  poolSize: number;
  passScore: number;
  timeLimitMinutes: number;
  marksheetUrl?: string | null;
  rejectionReason?: string | null;
}
export interface SellerTestQuestion {
  id: number;
  questionText: string;
  subject?: string;
  options: { optionKey: string; optionText: string }[];
}
export interface SellerTest {
  categoryId: number;
  categoryName: string;
  passScore: number;
  timeLimitMinutes: number;
  questions: SellerTestQuestion[];
}
export interface TestResult {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  status: string;
  message: string;
}
export interface QualificationReview {
  id: number;
  sellerId: number;
  sellerName: string;
  email: string;
  institution?: string;
  categoryId: number;
  categoryName: string;
  bestScore: number;
  status: string;
  marksheetUrl?: string;
  submittedAt?: string;
}

// ── Exam taxonomy (admin-configurable) ────────────────────────────
export interface TaxonomySubject {
  id: number;
  name: string;
  active?: boolean;
}
export interface TaxonomyExam {
  id: number;
  name: string;
  active?: boolean;
  subjects: TaxonomySubject[];
}
export interface TaxonomyCategory {
  id: number;
  name: string;
  active?: boolean;
  exams: TaxonomyExam[];
}
export interface Taxonomy {
  categories: TaxonomyCategory[];
}

/** Live social-proof numbers for the landing hero (computed, never hardcoded). */
export interface SocialStats {
  averageRating: number;
  reviewCount: number;
  learners: number;
  notesCount: number;
  sellers: number;
  verifiedSellers: number;
  sales: number;
}

export interface Review {
  id: number;
  buyerName?: string;
  rating: number;
  comment?: string;
  createdAt?: string;
}

export interface ReviewStats {
  average: number;
  total: number;
  /** star (1-5) → count; keys arrive as strings over JSON */
  counts: Record<string, number>;
}

// ── Dashboard ─────────────────────────────────────────────────────
export interface AdminDashboard {
  totalRevenue: number;
  platformRevenue: number;
  sellerRevenue: number;
  totalUsers: number;
  totalSellers: number;
  totalBuyers: number;
  totalNotes: number;
  totalPurchases: number;
  todayRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  dailyRevenue: ChartPoint[];
  monthlyRevenue: ChartPoint[];
  pendingSellerApprovals: number;
}

export interface SellerDashboard {
  totalEarnings: number;
  monthEarnings: number;
  todayEarnings: number;
  totalNotes: number;
  totalSales: number;
  averageRating: number;
  salesChart: ChartPoint[];
  recentNotes: Note[];
  isVerified: boolean;
  testPassed: boolean;
  marksheetUploaded: boolean;
}

export interface ChartPoint {
  date?: string;
  month?: string;
  year?: string;
  revenue: number;
}

// ── API Envelope ──────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

// ── Test ──────────────────────────────────────────────────────────
export interface TestConfig {
  id?: number;
  categoryId?: number | null;
  categoryName?: string | null;
  passScorePercent: number;
  timeLimitMinutes: number;
  maxAttempts: number;
  questionsPerTest: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  isActive: boolean;
  totalActiveQuestions?: number;
  updatedAt?: string;
}

/** One row of the admin Test Manager overview matrix. */
export interface TestOverview {
  categoryId: number | null; // null = General (shared) pool
  categoryName: string;
  configActive: boolean;
  passScore: number;
  questionsPerTest: number;
  ownQuestions: number;
  activeQuestions: number;
  attempts: number;
  passRate: number;
}

export interface TestOptionAdmin {
  id?: number;
  optionKey: string;
  optionText: string;
  isCorrect: boolean;
}

export interface TestQuestionAdmin {
  id?: number;
  questionText: string;
  subject?: string;
  categoryId?: number | null;
  displayOrder?: number;
  isActive: boolean;
  correctAnswerKey: string;
  options: TestOptionAdmin[];
  createdAt?: string;
}
