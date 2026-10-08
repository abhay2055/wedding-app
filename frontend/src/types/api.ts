export type Role = "CUSTOMER" | "VENDOR" | "ADMIN";
export type VerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type PortfolioMediaType = "IMAGE" | "VIDEO";
export type VendorSortOption = "relevance" | "price_asc" | "price_desc" | "newest" | "most_events" | "rating";
// BOOKED is reserved for Phase 4 (booking) - the vendor-facing availability
// UI never lets a vendor set it, but it's a valid value the calendar must
// still be able to render safely if it's ever encountered.
export type AvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "BLOCKED" | "BOOKED";
export type VendorSettableAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE" | "BLOCKED";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { vendors: number };
}

export interface PortfolioItem {
  id: string;
  vendorId: string;
  type: PortfolioMediaType;
  url: string;
  thumbnailUrl: string | null;
  title: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackageItem {
  id: string;
  packageId: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

export interface VendorPackage {
  id: string;
  vendorId: string;
  name: string;
  description: string | null;
  price: number;
  // Whole-percent (0-100) of `price` required as an advance payment -
  // snapshotted onto Booking.advanceAmount when a booking is created from
  // this package (see Booking.advanceAmount below).
  advancePercentage: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: PackageItem[];
}

// Fields common to every vendor shape the API returns.
export interface VendorBase {
  id: string;
  businessName: string;
  slug: string;
  description: string | null;
  city: string;
  locality: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  categoryId: string | null;
  category: Category | null;
  startingPrice: number | null;
  yearsExperience: number | null;
  eventsCompleted: number;
  verificationStatus: VerificationStatus;
  isActive: boolean;
  // Denormalized from this vendor's PUBLISHED reviews only - see
  // Vendor.averageRating in the backend schema. 0/0 means no published
  // reviews yet, not "unrated".
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

// GET /vendors/me and admin vendor detail - no portfolio/packages included.
export interface Vendor extends VendorBase {
  userId: string;
}

// A single card in vendor search results - has a preview (first) image only.
export interface VendorSearchResult extends VendorBase {
  portfolio: PortfolioItem[];
}

// GET /vendors/:id and /vendors/slug/:slug - full public profile.
export interface VendorPublicProfile extends VendorBase {
  portfolio: PortfolioItem[];
  packages: VendorPackage[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export interface WeddingEventCategoryLink {
  id: string;
  categoryId: string;
  category: Category;
}

export interface WeddingEvent {
  id: string;
  userId: string;
  name: string;
  city: string;
  weddingDate: string;
  endDate: string | null;
  guestCount: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  interestedCategories: WeddingEventCategoryLink[];
}

export interface FavoriteVendor {
  id: string;
  userId: string;
  vendorId: string;
  createdAt: string;
  vendor: VendorSearchResult;
}

// A vendor's own (or an admin's) view of one calendar day - includes the
// private note.
export interface VendorAvailabilityDay {
  id: string;
  vendorId: string;
  date: string;
  status: AvailabilityStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

// What the public availability endpoint returns - date + status only,
// never a note or any id.
export interface PublicAvailabilityDay {
  date: string;
  status: AvailabilityStatus;
}

// PAYMENT_PENDING/COMPLETED stay reserved beyond Phase 5 - PAYMENT_PENDING
// is unreachable (in-flight payment state lives on Payment.status /
// Booking.paymentStatus, not Booking.status - see BookingPaymentStatus
// below) and COMPLETED awaits a later phase's definition of "completed".
// CONFIRMED is produced by Phase 5, only as a side effect of a verified
// captured advance payment - never settable directly by any client.
export type BookingStatus =
  | "PENDING"
  | "ACCEPTED"
  | "DECLINED"
  | "CANCELLED"
  | "COMPLETED"
  | "PAYMENT_PENDING"
  | "CONFIRMED";

export type BookingPaymentStatus = "NOT_REQUIRED" | "PENDING" | "PARTIALLY_PAID" | "PAID" | "FAILED" | "REFUNDED";

// Booking-scoped views of a vendor/event/package - deliberately not the
// full VendorPublicProfile/WeddingEvent/VendorPackage shapes, matching what
// the backend's booking includes actually return.
export interface BookingVendorSummary {
  id: string;
  businessName: string;
  slug: string;
  city: string;
  locality: string | null;
  category: Category | null;
}

export interface BookingEventSummary {
  id: string;
  name: string;
  city: string;
}

export interface BookingCustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  email: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  customerId: string;
  vendorId: string;
  eventId: string;
  packageId: string | null;
  eventNameSnapshot: string;
  packageNameSnapshot: string | null;
  packageDescriptionSnapshot: string | null;
  packagePriceSnapshot: number | null;
  weddingDate: string;
  eventEndDate: string | null;
  guestCount: number | null;
  totalAmount: number;
  advanceAmount: number | null;
  advancePaidAmount: number;
  paymentStatus: BookingPaymentStatus;
  customerNotes: string | null;
  vendorNotes: string | null;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  cancelledAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  // Present depending on whether this came from a customer- or
  // vendor-facing endpoint.
  vendor?: BookingVendorSummary;
  customer?: BookingCustomerSummary;
  event?: BookingEventSummary;
  package?: VendorPackage | null;
  // Present (id + status only) once a review exists for this booking - see
  // booking.repository.ts's customerBookingInclude/vendorBookingInclude.
  review?: { id: string; status: ReviewStatus } | null;
}

export interface ConversationCustomerSummary {
  id: string;
  name: string;
}

export interface ConversationVendorSummary {
  id: string;
  businessName: string;
  slug: string;
  userId: string;
}

export interface ConversationBookingSummary {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
}

export interface Conversation {
  id: string;
  customerId: string;
  vendorId: string;
  bookingId: string | null;
  createdAt: string;
  updatedAt: string;
  customer: ConversationCustomerSummary;
  vendor: ConversationVendorSummary;
  booking: ConversationBookingSummary | null;
  // Only present on the list endpoint - unread messages for the *current*
  // viewer in this conversation.
  _count?: { messages: number };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "AUTHORIZED"
  | "CAPTURED"
  | "FAILED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type PaymentType = "ADVANCE" | "BALANCE" | "REFUND";

export interface PaymentBookingSummary {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
  eventNameSnapshot: string;
}

export interface PaymentVendorSummary {
  id: string;
  businessName: string;
  slug: string;
}

export interface PaymentCustomerSummary {
  id: string;
  name: string;
  email: string;
}

export interface PaymentAttempt {
  id: string;
  paymentId: string;
  provider: "RAZORPAY";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number;
  status: PaymentStatus;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// The provider's signature is never sent to the frontend (see
// payment.service.toSafePayment on the backend) - deliberately absent here.
export interface Payment {
  id: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  provider: "RAZORPAY";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentType: PaymentType;
  refundOfPaymentId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  booking?: PaymentBookingSummary;
  vendor?: PaymentVendorSummary;
  customer?: PaymentCustomerSummary;
  attempts?: PaymentAttempt[];
}

// POST /bookings/:bookingId/payment/order - just enough for Razorpay
// Checkout to open. razorpayKeyId is the *public* key id, safe to expose.
export interface PaymentOrder {
  paymentId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  bookingNumber: string;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  providerSignature: string;
}

export interface VerifyPaymentResult {
  payment: Payment;
  booking?: Booking;
}

export type ReviewStatus = "PENDING" | "PUBLISHED" | "HIDDEN" | "REJECTED";

export interface ReviewCustomerSummary {
  id: string;
  name: string;
}

export interface ReviewVendorSummary {
  id: string;
  businessName: string;
  slug: string;
}

export interface ReviewBookingSummary {
  id: string;
  bookingNumber: string;
  status: BookingStatus;
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  rating: number;
  title: string | null;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  customer?: ReviewCustomerSummary;
  vendor?: ReviewVendorSummary;
  booking?: ReviewBookingSummary;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface VendorReviewSummary {
  averageRating: number;
  reviewCount: number;
  distribution: RatingDistribution;
}

export interface VendorReviewListResult {
  items: Review[];
  pagination: Pagination;
  summary: VendorReviewSummary;
}

export type NotificationType =
  | "BOOKING_CREATED"
  | "BOOKING_ACCEPTED"
  | "BOOKING_DECLINED"
  | "BOOKING_CANCELLED"
  | "BOOKING_CONFIRMED"
  | "BOOKING_COMPLETED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "NEW_MESSAGE"
  | "REVIEW_RECEIVED"
  | "REVIEW_PUBLISHED"
  | "REVIEW_REJECTED"
  | "VENDOR_VERIFIED"
  | "VENDOR_REJECTED"
  | "VENDOR_ACTIVATED"
  | "VENDOR_DEACTIVATED";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { weddingEvents: number; bookings: number };
}

export interface AdminDashboardStats {
  customers: { total: number };
  vendors: { total: number; verified: number; pending: number; active: number };
  bookings: { total: number; pending: number; confirmed: number; completed: number };
  payments: { totalVolume: number; successful: number; failed: number };
  reviews: { total: number; pending: number };
}

export type AdminAnalyticsRange = "7d" | "30d" | "90d" | "1y";

export interface AdminAnalyticsBucket {
  bucket: string;
  value: number;
}

export interface AdminAnalytics {
  range: AdminAnalyticsRange;
  bookingsByStatus: Partial<Record<BookingStatus, number>>;
  bookingsOverTime: AdminAnalyticsBucket[];
  paymentVolumeOverTime: AdminAnalyticsBucket[];
  newCustomersOverTime: AdminAnalyticsBucket[];
  newVendorsOverTime: AdminAnalyticsBucket[];
  reviewCount: number;
  pendingReviews: number;
  bookingConversionRate: number;
}
