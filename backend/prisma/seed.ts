import { AvailabilityStatus, BookingStatus, PortfolioMediaType, PrismaClient, Role, VerificationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { slugify } from "../src/utils/slug";
import * as bookingRepository from "../src/repositories/booking.repository";
import * as commissionService from "../src/services/commission.service";

const prisma = new PrismaClient();

// Obviously-fake development-only credentials. Never use these values,
// or reuse this password, outside a local/dev environment.
const DEV_PASSWORD = "DevPassword123";

const CATEGORY_NAMES = [
  "Photography",
  "Videography",
  "Catering",
  "Decoration",
  "DJ & Music",
  "Banquet Hall / Venue",
  "Mehendi",
  "Makeup Artist",
  "Bridal Wear",
  "Groom Wear",
  "Florist",
  "Wedding Planner",
  "Invitation / Cards",
  "Tent / Event Equipment",
  "Other",
] as const;

// A small, category-appropriate item list for the "Basic" and "Premium"
// demo package every seeded vendor gets.
const PACKAGE_ITEMS: Record<string, { basic: string[]; premium: string[] }> = {
  Photography: {
    basic: ["1 photographer", "300 edited photos", "1-day coverage"],
    premium: ["2 photographers", "Cinematic video", "Drone coverage", "700 edited photos"],
  },
  Videography: {
    basic: ["Highlight reel (3-5 min)", "1 videographer", "1-day coverage"],
    premium: ["Full ceremony film", "Drone shots", "Same-day edit", "2 videographers"],
  },
  Catering: {
    basic: ["Veg menu (8 items)", "Buffet service", "Basic crockery"],
    premium: ["Veg + non-veg menu (15 items)", "Live counters", "Premium crockery", "Dedicated service staff"],
  },
  Decoration: {
    basic: ["Stage backdrop", "Basic floral", "Entrance decor"],
    premium: ["Theme-based decor", "Premium floral", "Fairy light ceiling", "Photo booth setup"],
  },
  "DJ & Music": {
    basic: ["4-hour DJ set", "Basic sound system", "1 MC"],
    premium: ["8-hour DJ set", "Premium sound & lighting", "Live singer", "Dhol performance"],
  },
  "Banquet Hall / Venue": {
    basic: ["Half-day hall booking", "Basic seating (200 pax)", "Parking"],
    premium: ["Full-day hall booking", "Seating for 500 pax", "AC hall", "Valet parking"],
  },
  Mehendi: {
    basic: ["Bridal mehendi (both hands)", "2-hour session"],
    premium: ["Bridal mehendi (hands & feet)", "Family mehendi (10 guests)", "Arabic + traditional designs", "4-hour session"],
  },
  "Makeup Artist": {
    basic: ["Bridal makeup (1 look)", "Basic hairstyling"],
    premium: ["Bridal makeup (3 looks)", "HD makeup", "Hairstyling & draping", "Airbrush finish"],
  },
  "Bridal Wear": {
    basic: ["1 bridal outfit rental", "Basic alterations"],
    premium: ["3 bridal outfit rentals", "Custom tailoring", "Jewelry styling", "Dupatta draping"],
  },
  "Groom Wear": {
    basic: ["1 sherwani rental", "Basic alterations"],
    premium: ["2 outfit rentals (sherwani + reception)", "Custom tailoring", "Turban styling", "Footwear included"],
  },
  Florist: {
    basic: ["Entrance floral arrangement", "Bridal bouquet"],
    premium: ["Full venue floral decor", "Bridal bouquet", "Car decoration", "Fresh flower ceiling"],
  },
  "Wedding Planner": {
    basic: ["Day-of coordination", "Vendor recommendations"],
    premium: ["Full wedding planning", "Budget management", "Vendor negotiation", "On-site coordination team"],
  },
  "Invitation / Cards": {
    basic: ["Digital invite design", "50 printed cards"],
    premium: ["Custom digital + printed invites", "200 printed cards", "Premium packaging", "RSVP tracking"],
  },
  "Tent / Event Equipment": {
    basic: ["Basic tent (100 pax)", "Standard seating"],
    premium: ["Premium tent (500 pax)", "AC tent", "Premium seating & carpeting", "Generator backup"],
  },
  Other: {
    basic: ["Event anchoring (3 hours)", "Script preparation"],
    premium: ["Full event anchoring", "Bilingual hosting", "Game segments", "Rehearsal session"],
  },
};

interface DemoVendorSpec {
  email: string;
  businessName: string;
  category: (typeof CATEGORY_NAMES)[number];
  city: string;
  locality: string;
  startingPrice: number;
  yearsExperience: number;
  verificationStatus: VerificationStatus;
  description: string;
  hasVideo?: boolean;
  // Demo availability calendar entries, keyed to WEDDING_DATE (see below)
  // by day offset so they line up with the demo customer's wedding event.
  // Vendors with no `availability` entry are a deliberate "no record yet"
  // (unknown) demo case, matching the Phase 3 spec's "Vendor D" example.
  availability?: { dayOffset: number; status: "AVAILABLE" | "UNAVAILABLE" | "BLOCKED"; note?: string }[];
}

// The demo customer's wedding date (also used below when creating their
// WeddingEvent) - every vendor `availability` entry above is a dayOffset
// relative to this, so they line up for the "available on my wedding date"
// and multi-day-range demo flows.
const WEDDING_DATE = new Date("2027-02-15T00:00:00.000Z");

function offsetDate(days: number): Date {
  const d = new Date(WEDDING_DATE);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

interface DemoBookingSpec {
  vendorEmail: string;
  packageTier: "basic" | "premium";
  dayOffsetStart: number;
  dayOffsetEnd?: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED";
  guestCount?: number;
  customerNotes?: string;
  vendorNotes?: string;
}

// 10 demo bookings against the demo customer's wedding event, deliberately
// spanning every Phase 4/6 status so the customer/vendor booking dashboards
// and the admin read-only view all have something real to show. All
// against fictional (Demo) vendors - see DEMO_VENDORS above. The three
// COMPLETED ones (added in Phase 6) exist specifically to hang a demo
// Review off of - see the "Demo reviews" section below - and are given a
// deliberately past `dayOffsetStart` so a COMPLETED status is internally
// consistent with this seed's own fictional "today", even though the
// customer's actual wedding (WEDDING_DATE) is still ahead of it.
const DEMO_BOOKINGS: DemoBookingSpec[] = [
  {
    vendorEmail: "demo-videographer1@example.test",
    packageTier: "basic",
    dayOffsetStart: 0,
    status: "PENDING",
    guestCount: 300,
    customerNotes: "Would love a same-day highlight reel if possible.",
  },
  {
    vendorEmail: "demo-makeup1@example.test",
    packageTier: "basic",
    dayOffsetStart: 0,
    status: "PENDING",
    guestCount: 300,
  },
  {
    // A PENDING-verification vendor is still publicly visible/bookable
    // (see publicVendorWhere) - this demonstrates that.
    vendorEmail: "demo-invites1@example.test",
    packageTier: "basic",
    dayOffsetStart: 0,
    status: "PENDING",
    guestCount: 300,
    customerNotes: "Need 300 invites printed by January.",
  },
  {
    vendorEmail: "demo-planner1@example.test",
    packageTier: "basic",
    dayOffsetStart: 0,
    dayOffsetEnd: 2,
    status: "DECLINED",
    guestCount: 300,
    vendorNotes: "Already committed to another wedding that week - sorry!",
  },
  {
    // Fully available for all 3 event days in seed data (see DEMO_VENDORS
    // above) - accepting this one demonstrates the multi-day BOOKED flip.
    vendorEmail: "demo-photographer1@example.test",
    packageTier: "premium",
    dayOffsetStart: 0,
    dayOffsetEnd: 2,
    status: "ACCEPTED",
    guestCount: 300,
    customerNotes: "We'd like a second shooter for the reception.",
    vendorNotes: "Confirmed - looking forward to it!",
  },
  {
    vendorEmail: "demo-decor1@example.test",
    packageTier: "premium",
    dayOffsetStart: 0,
    status: "ACCEPTED",
    guestCount: 300,
    vendorNotes: "Confirmed, will send mood board next week.",
  },
  {
    vendorEmail: "demo-tent1@example.test",
    packageTier: "basic",
    dayOffsetStart: 0,
    status: "CANCELLED",
    guestCount: 300,
    customerNotes: "Venue already includes seating, no longer needed.",
  },
  // --- Phase 6: COMPLETED bookings, each with a demo review below ---
  {
    vendorEmail: "demo-caterer1@example.test",
    packageTier: "premium",
    dayOffsetStart: -200,
    status: "COMPLETED",
    guestCount: 280,
    customerNotes: "An earlier (already-completed) event catered by this vendor.",
  },
  {
    vendorEmail: "demo-venue1@example.test",
    packageTier: "basic",
    dayOffsetStart: -180,
    status: "COMPLETED",
    guestCount: 250,
  },
  {
    vendorEmail: "demo-dj1@example.test",
    packageTier: "basic",
    dayOffsetStart: -160,
    status: "COMPLETED",
    guestCount: 200,
  },
];

// 20 fictional demo vendors spread across every category and several
// Indian cities, with a deliberate mix of verification states so the admin
// UI and public marketplace can both be exercised against realistic data.
// None of these are real businesses.
const DEMO_VENDORS: DemoVendorSpec[] = [
  {
    email: "vendor@example.test",
    businessName: "Sample Decor Co. (seed data - not a real business)",
    category: "Decoration",
    city: "New Delhi",
    locality: "Connaught Place",
    startingPrice: 40000,
    yearsExperience: 6,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Placeholder vendor profile created by the seed script for local development only.",
    // Matches the "Vendor A" example from the Phase 3 spec exactly.
    availability: [
      { dayOffset: -2, status: "BLOCKED", note: "Setup day for another event" },
      { dayOffset: -1, status: "AVAILABLE" },
      { dayOffset: 0, status: "AVAILABLE" },
      { dayOffset: 1, status: "AVAILABLE" },
      { dayOffset: 2, status: "UNAVAILABLE" },
      { dayOffset: 5, status: "AVAILABLE" },
    ],
  },
  {
    email: "demo-photographer1@example.test",
    businessName: "Demo Wedding Photography",
    category: "Photography",
    city: "Jalandhar",
    locality: "Model Town",
    startingPrice: 50000,
    yearsExperience: 8,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Candid and traditional wedding photography across Punjab. (Demo vendor - not a real business.)",
    // Available for the demo customer's whole 3-day wedding window - a good
    // example vendor for the multi-day "available for my whole event" flow.
    availability: [
      { dayOffset: -1, status: "AVAILABLE" },
      { dayOffset: 0, status: "AVAILABLE" },
      { dayOffset: 1, status: "AVAILABLE" },
      { dayOffset: 2, status: "AVAILABLE" },
      { dayOffset: 4, status: "UNAVAILABLE" },
    ],
  },
  {
    email: "demo-photographer2@example.test",
    businessName: "Frame & Forever Photography (Demo)",
    category: "Photography",
    city: "Mumbai",
    locality: "Andheri",
    startingPrice: 75000,
    yearsExperience: 4,
    verificationStatus: VerificationStatus.PENDING,
    description: "Cinematic wedding storytelling. Awaiting verification. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-videographer1@example.test",
    businessName: "CineVows Films (Demo)",
    category: "Videography",
    city: "Bengaluru",
    locality: "Indiranagar",
    startingPrice: 60000,
    yearsExperience: 7,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Full-length cinematic wedding films with drone coverage. (Demo vendor - not a real business.)",
    hasVideo: true,
  },
  {
    email: "demo-caterer1@example.test",
    businessName: "Royal Feast Caterers (Demo)",
    category: "Catering",
    city: "Chandigarh",
    locality: "Sector 22",
    startingPrice: 800,
    yearsExperience: 12,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "North Indian and Mughlai wedding catering. (Demo vendor - not a real business.)",
    // Matches the "Vendor B" example from the Phase 3 spec: unavailable on
    // the demo customer's wedding date, so it's correctly excluded by the
    // availableOn filter.
    availability: [{ dayOffset: 0, status: "UNAVAILABLE" }],
  },
  {
    email: "demo-caterer2@example.test",
    businessName: "Spice Route Catering (Demo)",
    category: "Catering",
    city: "Jaipur",
    locality: "C-Scheme",
    startingPrice: 650,
    yearsExperience: 3,
    verificationStatus: VerificationStatus.PENDING,
    description: "Multi-cuisine wedding buffets. Awaiting verification. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-decor1@example.test",
    businessName: "Dreamscape Decor (Demo)",
    category: "Decoration",
    city: "Amritsar",
    locality: "Ranjit Avenue",
    startingPrice: 40000,
    yearsExperience: 9,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Theme weddings, floral installations and stage design. (Demo vendor - not a real business.)",
    // Matches the "Vendor C" example from the Phase 3 spec: available on
    // the demo customer's wedding date.
    availability: [{ dayOffset: 0, status: "AVAILABLE" }],
  },
  {
    email: "demo-dj1@example.test",
    businessName: "BeatDrop Entertainment (Demo)",
    category: "DJ & Music",
    city: "Ludhiana",
    locality: "Civil Lines",
    startingPrice: 30000,
    yearsExperience: 5,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "DJ, live band and sound & lighting for sangeet nights. (Demo vendor - not a real business.)",
    hasVideo: true,
    // Matches the "Vendor D" example from the Phase 3 spec: deliberately no
    // availability record at all, to demonstrate "unknown" is never treated
    // as available and shows as "Availability not updated" in the UI.
  },
  {
    email: "demo-venue1@example.test",
    businessName: "Grand Celebration Banquets (Demo)",
    category: "Banquet Hall / Venue",
    city: "New Delhi",
    locality: "Rohini",
    startingPrice: 200000,
    yearsExperience: 15,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Air-conditioned banquet hall seating up to 500 guests. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-venue2@example.test",
    businessName: "Riverside Lawns (Demo)",
    category: "Banquet Hall / Venue",
    city: "Lucknow",
    locality: "Gomti Nagar",
    startingPrice: 150000,
    yearsExperience: 2,
    verificationStatus: VerificationStatus.REJECTED,
    description: "Outdoor lawn venue. Verification was rejected (demo state). (Demo vendor - not a real business.)",
  },
  {
    email: "demo-mehendi1@example.test",
    businessName: "Heena Artistry (Demo)",
    category: "Mehendi",
    city: "Jalandhar",
    locality: "Urban Estate",
    startingPrice: 15000,
    yearsExperience: 6,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Bridal and Arabic mehendi design. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-makeup1@example.test",
    businessName: "Glow Bridal Studio (Demo)",
    category: "Makeup Artist",
    city: "Mumbai",
    locality: "Bandra",
    startingPrice: 25000,
    yearsExperience: 10,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "HD and airbrush bridal makeup. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-makeup2@example.test",
    businessName: "Radiance Makeovers (Demo)",
    category: "Makeup Artist",
    city: "Pune",
    locality: "Kothrud",
    startingPrice: 20000,
    yearsExperience: 3,
    verificationStatus: VerificationStatus.PENDING,
    description: "Bridal and party makeup. Awaiting verification. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-bridalwear1@example.test",
    businessName: "Lehenga Legacy (Demo)",
    category: "Bridal Wear",
    city: "Jaipur",
    locality: "Malviya Nagar",
    startingPrice: 45000,
    yearsExperience: 11,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Designer bridal lehengas for rent and purchase. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-groomwear1@example.test",
    businessName: "Sherwani Studio (Demo)",
    category: "Groom Wear",
    city: "New Delhi",
    locality: "Karol Bagh",
    startingPrice: 20000,
    yearsExperience: 8,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Sherwanis, bandhgalas and reception wear for grooms. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-florist1@example.test",
    businessName: "Petal Tales Florists (Demo)",
    category: "Florist",
    city: "Chandigarh",
    locality: "Sector 35",
    startingPrice: 12000,
    yearsExperience: 1,
    verificationStatus: VerificationStatus.REJECTED,
    description: "Fresh flower decor and bouquets. Verification was rejected (demo state). (Demo vendor - not a real business.)",
  },
  {
    email: "demo-planner1@example.test",
    businessName: "Forever After Events (Demo)",
    category: "Wedding Planner",
    city: "Bengaluru",
    locality: "Koramangala",
    startingPrice: 100000,
    yearsExperience: 9,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "End-to-end wedding planning and vendor coordination. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-invites1@example.test",
    businessName: "Inked Invitations (Demo)",
    category: "Invitation / Cards",
    city: "Amritsar",
    locality: "Lawrence Road",
    startingPrice: 5000,
    yearsExperience: 4,
    verificationStatus: VerificationStatus.PENDING,
    description: "Custom digital and printed wedding invitations. Awaiting verification. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-tent1@example.test",
    businessName: "Shaan Tent House (Demo)",
    category: "Tent / Event Equipment",
    city: "Ludhiana",
    locality: "Model Gram",
    startingPrice: 35000,
    yearsExperience: 14,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Tents, seating and generator setup for outdoor weddings. (Demo vendor - not a real business.)",
  },
  {
    email: "demo-other1@example.test",
    businessName: "Wedding Anchor Rahul (Demo)",
    category: "Other",
    city: "Mumbai",
    locality: "Powai",
    startingPrice: 15000,
    yearsExperience: 5,
    verificationStatus: VerificationStatus.VERIFIED,
    description: "Bilingual wedding event anchoring and hosting. (Demo vendor - not a real business.)",
  },
];

async function upsertUser(params: { name: string; email: string; phone: string; role: Role }) {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email: params.email },
    update: {},
    create: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash,
      role: params.role,
    },
  });
}

function portfolioImageUrls(slug: string): string[] {
  return [1, 2, 3].map((n) => `https://picsum.photos/seed/${slug}-${n}/800/600`);
}

async function main() {
  const admin = await upsertUser({
    name: "Dev Admin",
    email: "admin@example.test",
    phone: "9999900001",
    role: Role.ADMIN,
  });

  const customerOne = await upsertUser({
    name: "Dev Customer One",
    email: "customer@example.test",
    phone: "9999900002",
    role: Role.CUSTOMER,
  });

  const customerTwo = await upsertUser({
    name: "Dev Customer Two",
    email: "customer2@example.test",
    phone: "9999900003",
    role: Role.CUSTOMER,
  });

  // Demo vendor data (vendors, packages, portfolio, bookings, messages) is
  // fully wiped and recreated on every seed run so re-running `npm run
  // seed` always produces the same known-good state. Wedding events for
  // the demo customer are reset for the same reason. Notifications/reviews/
  // messages/conversations/payments/commissions/bookings/bookingCounters
  // are deleted first since Booking has a Restrict (not Cascade) relation
  // to Vendor/WeddingEvent, and Payment/Commission/Review all reference
  // Booking. Notifications/reviews are wiped unscoped (not just for vendor
  // users) since they can belong to the persistent seed customers/admin too.
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.paymentAttempt.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.paymentWebhookEvent.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.bookingCounter.deleteMany();
  await prisma.weddingEventCategory.deleteMany();
  await prisma.weddingEvent.deleteMany({ where: { userId: customerOne.id } });
  await prisma.vendorAvailability.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany({ where: { role: Role.VENDOR } });
  await prisma.vendorCategory.deleteMany();

  const categories = new Map<string, string>();
  for (const name of CATEGORY_NAMES) {
    const category = await prisma.vendorCategory.create({
      data: { name, slug: slugify(name) },
    });
    categories.set(name, category.id);
  }

  let verifiedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;

  interface DemoVendorRecord {
    vendorId: string;
    basicPackageId: string;
    premiumPackageId: string;
  }
  const vendorRecordsByEmail = new Map<string, DemoVendorRecord>();

  for (const spec of DEMO_VENDORS) {
    const vendorUser = await upsertUser({
      name: `${spec.businessName.replace(/\s*\(Demo\)|\s*\(seed data.*\)/g, "")} Owner`,
      email: spec.email,
      phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
      role: Role.VENDOR,
    });

    const slug = slugify(spec.businessName);
    const vendor = await prisma.vendor.create({
      data: {
        userId: vendorUser.id,
        businessName: spec.businessName,
        slug,
        description: spec.description,
        city: spec.city,
        locality: spec.locality,
        categoryId: categories.get(spec.category),
        startingPrice: spec.startingPrice,
        yearsExperience: spec.yearsExperience,
        verificationStatus: spec.verificationStatus,
        eventsCompleted: Math.floor(spec.yearsExperience * 4.5),
      },
    });

    if (spec.verificationStatus === VerificationStatus.VERIFIED) verifiedCount += 1;
    else if (spec.verificationStatus === VerificationStatus.PENDING) pendingCount += 1;
    else rejectedCount += 1;

    const items = PACKAGE_ITEMS[spec.category];
    const basicPackage = await prisma.vendorPackage.create({
      data: {
        vendorId: vendor.id,
        name: `Basic ${spec.category}`,
        description: `Essential ${spec.category.toLowerCase()} package.`,
        price: spec.startingPrice,
        items: { create: items.basic.map((name, i) => ({ name, sortOrder: i })) },
      },
    });
    const premiumPackage = await prisma.vendorPackage.create({
      data: {
        vendorId: vendor.id,
        name: `Premium ${spec.category}`,
        description: `Full-service ${spec.category.toLowerCase()} package.`,
        price: spec.startingPrice * 2,
        items: { create: items.premium.map((name, i) => ({ name, sortOrder: i })) },
      },
    });
    vendorRecordsByEmail.set(spec.email, {
      vendorId: vendor.id,
      basicPackageId: basicPackage.id,
      premiumPackageId: premiumPackage.id,
    });

    const imageUrls = portfolioImageUrls(slug);
    await prisma.vendorPortfolio.createMany({
      data: imageUrls.map((url, i) => ({
        vendorId: vendor.id,
        type: PortfolioMediaType.IMAGE,
        url,
        thumbnailUrl: url,
        title: `${spec.businessName} - sample ${i + 1}`,
        sortOrder: i,
      })),
    });
    if (spec.hasVideo) {
      await prisma.vendorPortfolio.create({
        data: {
          vendorId: vendor.id,
          type: PortfolioMediaType.VIDEO,
          url: "https://www.youtube.com/watch?v=demo-placeholder",
          title: `${spec.businessName} - showreel`,
          sortOrder: imageUrls.length,
        },
      });
    }

    if (spec.availability) {
      await prisma.vendorAvailability.createMany({
        data: spec.availability.map((a) => ({
          vendorId: vendor.id,
          date: offsetDate(a.dayOffset),
          status: a.status,
          note: a.note,
        })),
      });
    }
  }

  const weddingEvent = await prisma.weddingEvent.create({
    data: {
      userId: customerOne.id,
      name: "Dev Customer's Wedding",
      city: "Jalandhar",
      weddingDate: WEDDING_DATE,
      // A 3-day multi-day event (15-17 Feb), matching demo-photographer1's
      // seeded availability so the multi-day "available for my whole
      // event" flow has a real example to find.
      endDate: offsetDate(2),
      guestCount: 300,
      budgetMin: 1000000,
      budgetMax: 1500000,
      notes: "Demo wedding event created by the seed script.",
      interestedCategories: {
        create: [
          { categoryId: categories.get("Photography")! },
          { categoryId: categories.get("Catering")! },
          { categoryId: categories.get("Decoration")! },
        ],
      },
    },
  });

  // --- Demo bookings ---
  // Goes through the same shape of work booking.service.createBooking does
  // (availability check, snapshot, sequential number, and for ACCEPTED
  // bookings the AVAILABLE->BOOKED flip) so the seeded data is internally
  // consistent with what the real API would have produced.
  const bookingsByVendorEmail = new Map<string, string>();

  for (const spec of DEMO_BOOKINGS) {
    const vendorRecord = vendorRecordsByEmail.get(spec.vendorEmail);
    if (!vendorRecord) continue;

    const weddingDate = offsetDate(spec.dayOffsetStart);
    const eventEndDate = spec.dayOffsetEnd !== undefined ? offsetDate(spec.dayOffsetEnd) : null;
    const requiredDates: Date[] = [];
    for (let d = spec.dayOffsetStart; d <= (spec.dayOffsetEnd ?? spec.dayOffsetStart); d += 1) {
      requiredDates.push(offsetDate(d));
    }

    // Make sure every required date is AVAILABLE before "requesting" the
    // booking - upsert so this is safe even for vendors that already have
    // an AVAILABLE record there from the availability demo data above.
    for (const date of requiredDates) {
      await prisma.vendorAvailability.upsert({
        where: { vendorId_date: { vendorId: vendorRecord.vendorId, date } },
        update: { status: AvailabilityStatus.AVAILABLE },
        create: { vendorId: vendorRecord.vendorId, date, status: AvailabilityStatus.AVAILABLE },
      });
    }

    const packageId = spec.packageTier === "basic" ? vendorRecord.basicPackageId : vendorRecord.premiumPackageId;
    const pkg = await prisma.vendorPackage.findUniqueOrThrow({ where: { id: packageId } });
    // Same snapshot formula as booking.service.createBooking - kept in sync
    // by hand since the seed script builds bookings directly through the
    // repository rather than the service.
    const advanceAmount = Math.round((pkg.price * pkg.advancePercentage) / 100);

    const booking = await prisma.$transaction(async (tx) => {
      const bookingNumber = await bookingRepository.nextBookingNumber(tx, new Date().getUTCFullYear());
      return bookingRepository.createBooking(tx, {
        bookingNumber,
        customerId: customerOne.id,
        vendorId: vendorRecord.vendorId,
        eventId: weddingEvent.id,
        packageId: pkg.id,
        eventNameSnapshot: weddingEvent.name,
        packageNameSnapshot: pkg.name,
        packageDescriptionSnapshot: pkg.description,
        packagePriceSnapshot: pkg.price,
        weddingDate,
        eventEndDate,
        guestCount: spec.guestCount,
        totalAmount: pkg.price,
        advanceAmount,
        paymentStatus: advanceAmount > 0 ? "PENDING" : "NOT_REQUIRED",
        customerNotes: spec.customerNotes,
        status: BookingStatus.PENDING,
      });
    });

    if (spec.status === "ACCEPTED") {
      await prisma.vendorAvailability.updateMany({
        where: { vendorId: vendorRecord.vendorId, date: { in: requiredDates }, status: AvailabilityStatus.AVAILABLE },
        data: { status: AvailabilityStatus.BOOKED },
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.ACCEPTED, acceptedAt: new Date(), vendorNotes: spec.vendorNotes },
      });
    } else if (spec.status === "DECLINED") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.DECLINED, declinedAt: new Date(), vendorNotes: spec.vendorNotes },
      });
    } else if (spec.status === "CANCELLED") {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED, cancelledAt: new Date() },
      });
    } else if (spec.status === "COMPLETED") {
      // Written directly as COMPLETED (skipping the
      // ACCEPTED/CONFIRMED/payment steps the real state machine would
      // require) purely so there's a booking to hang a demo Review off of
      // - see review.service.ts's "only a COMPLETED booking is reviewable"
      // rule and the "Demo reviews" section below. Its payment fields stay
      // at their creation-time defaults (no advance paid) rather than
      // faking a Payment record that doesn't exist - see Phase 5's "do not
      // fake payments" rule, which applies here too.
      await prisma.vendorAvailability.updateMany({
        where: { vendorId: vendorRecord.vendorId, date: { in: requiredDates }, status: AvailabilityStatus.AVAILABLE },
        data: { status: AvailabilityStatus.BOOKED },
      });
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.COMPLETED,
          acceptedAt: new Date(),
          confirmedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    bookingsByVendorEmail.set(spec.vendorEmail, booking.id);
  }

  // --- Demo payments/commission ---
  // Fictional (Demo) payment records only - these provider ids are made up,
  // not real Razorpay ids, and nothing here talks to any payment provider.
  // Two of the seven demo bookings are ACCEPTED, so they're used to show
  // the two payment outcomes that matter most: a fully captured advance
  // (booking -> CONFIRMED, with its commission recorded) and a failed
  // attempt followed by a still-pending retry (booking stays ACCEPTED).

  const photographerBookingRow = await prisma.booking.findUnique({
    where: { id: bookingsByVendorEmail.get("demo-photographer1@example.test") },
  });
  if (photographerBookingRow && photographerBookingRow.advanceAmount) {
    const amount = photographerBookingRow.advanceAmount;
    const payment = await prisma.payment.create({
      data: {
        bookingId: photographerBookingRow.id,
        customerId: photographerBookingRow.customerId,
        vendorId: photographerBookingRow.vendorId,
        provider: "RAZORPAY",
        providerOrderId: "order_demo_photographer_advance",
        providerPaymentId: "pay_demo_photographer_advance",
        providerSignature: "demo_signature_not_real",
        amount,
        currency: "INR",
        status: "CAPTURED",
        paymentType: "ADVANCE",
        paidAt: new Date(),
        metadata: { demo: true, note: "Fictional seed data - not a real transaction." },
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        provider: "RAZORPAY",
        providerOrderId: payment.providerOrderId,
        providerPaymentId: payment.providerPaymentId,
        amount,
        status: "CAPTURED",
      },
    });
    const commission = commissionService.calculate(amount);
    await prisma.commission.create({
      data: {
        bookingId: photographerBookingRow.id,
        vendorId: photographerBookingRow.vendorId,
        paymentId: payment.id,
        type: "PERCENTAGE",
        percentage: commission.percentage,
        grossAmount: commission.grossAmount,
        commissionAmount: commission.commissionAmount,
        vendorAmount: commission.vendorAmount,
        status: "APPLIED",
      },
    });
    await prisma.booking.update({
      where: { id: photographerBookingRow.id },
      data: {
        status: BookingStatus.CONFIRMED,
        confirmedAt: new Date(),
        advancePaidAmount: amount,
        paymentStatus: "PAID",
      },
    });
  }

  const decorBookingRow = await prisma.booking.findUnique({
    where: { id: bookingsByVendorEmail.get("demo-decor1@example.test") },
  });
  if (decorBookingRow && decorBookingRow.advanceAmount) {
    const amount = decorBookingRow.advanceAmount;
    const failedPayment = await prisma.payment.create({
      data: {
        bookingId: decorBookingRow.id,
        customerId: decorBookingRow.customerId,
        vendorId: decorBookingRow.vendorId,
        provider: "RAZORPAY",
        providerOrderId: "order_demo_decor_advance_1",
        providerPaymentId: "pay_demo_decor_advance_1",
        amount,
        currency: "INR",
        status: "FAILED",
        paymentType: "ADVANCE",
        failureReason: "Card declined by issuing bank (demo data).",
        metadata: { demo: true, note: "Fictional seed data - not a real transaction." },
      },
    });
    await prisma.paymentAttempt.create({
      data: {
        paymentId: failedPayment.id,
        provider: "RAZORPAY",
        providerOrderId: failedPayment.providerOrderId,
        providerPaymentId: failedPayment.providerPaymentId,
        amount,
        status: "FAILED",
        errorMessage: "Card declined by issuing bank (demo data).",
      },
    });
    // Deliberately no second "retry" Payment row here: unlike the CAPTURED/
    // FAILED rows above (which are only ever read, never acted on further),
    // a PENDING row would be found by createPaymentOrder's "reuse an active
    // order" check the moment someone actually clicks "Pay advance" on this
    // booking in the app - but a PENDING row inserted directly via Prisma
    // was never registered with the stub payment provider's in-memory
    // order store, so completing checkout against it would fail. Leaving
    // this booking on the FAILED payment status means the live app is free
    // to create a real (provider-registered) order the next time someone
    // pays here - see payment.service.createPaymentOrder's ACTIVE_STATUSES
    // check, which does not treat FAILED as still-active.
    await prisma.booking.update({
      where: { id: decorBookingRow.id },
      data: { paymentStatus: "FAILED" },
    });
  }

  // --- Demo conversations/messages ---
  // Fictional back-and-forth between the demo customer and two demo
  // vendors, one linked to an accepted booking and one to a still-pending
  // request, so the messaging UI has real unread state and history to show.
  const photographerVendorId = vendorRecordsByEmail.get("demo-photographer1@example.test")?.vendorId;
  const photographerBookingId = bookingsByVendorEmail.get("demo-photographer1@example.test");
  if (photographerVendorId && photographerBookingId) {
    const conversation = await prisma.conversation.create({
      data: { customerId: customerOne.id, vendorId: photographerVendorId, bookingId: photographerBookingId },
    });
    const photographerUser = await prisma.vendor
      .findUniqueOrThrow({ where: { id: photographerVendorId } })
      .then((v) => v.userId);
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, senderId: customerOne.id, body: "Hi! Excited to have you shoot our wedding.", isRead: true },
        { conversationId: conversation.id, senderId: photographerUser, body: "Likewise! I'll bring a second shooter for the reception as discussed.", isRead: true },
        { conversationId: conversation.id, senderId: customerOne.id, body: "Perfect, thank you!", isRead: false },
      ],
    });
  }

  const videographerVendorId = vendorRecordsByEmail.get("demo-videographer1@example.test")?.vendorId;
  const videographerBookingId = bookingsByVendorEmail.get("demo-videographer1@example.test");
  if (videographerVendorId && videographerBookingId) {
    const conversation = await prisma.conversation.create({
      data: { customerId: customerOne.id, vendorId: videographerVendorId, bookingId: videographerBookingId },
    });
    const videographerUser = await prisma.vendor
      .findUniqueOrThrow({ where: { id: videographerVendorId } })
      .then((v) => v.userId);
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, senderId: customerOne.id, body: "Would you be able to do a same-day highlight reel?", isRead: false },
        { conversationId: conversation.id, senderId: videographerUser, body: "Yes, that's included in our premium package!", isRead: false },
      ],
    });
  }

  // --- Demo reviews ---
  // One review per COMPLETED demo booking above, deliberately spanning
  // PUBLISHED/PENDING/REJECTED so the customer/vendor/admin review UIs all
  // have something real to show. Clearly fictional - see each vendor's
  // "(Demo)" business name; never presented as a genuine customer review.
  const catererBookingId = bookingsByVendorEmail.get("demo-caterer1@example.test");
  const caterer1 = vendorRecordsByEmail.get("demo-caterer1@example.test");
  if (catererBookingId && caterer1) {
    await prisma.review.create({
      data: {
        bookingId: catererBookingId,
        customerId: customerOne.id,
        vendorId: caterer1.vendorId,
        rating: 5,
        title: "Absolutely wonderful food!",
        comment: "Royal Feast Caterers handled our reception beautifully - the food was a huge hit with 280 guests, and the service staff were prompt and courteous throughout. Would book again.",
        status: "PUBLISHED",
      },
    });
    // Only one PUBLISHED review exists for this vendor, so its aggregate is
    // just that one review - see review.service.ts's recalculateVendorRating
    // for the real (aggregate-query) version of this used at runtime.
    await prisma.vendor.update({ where: { id: caterer1.vendorId }, data: { averageRating: 5, reviewCount: 1 } });
  }

  const venueBookingId = bookingsByVendorEmail.get("demo-venue1@example.test");
  const venue1 = vendorRecordsByEmail.get("demo-venue1@example.test");
  if (venueBookingId && venue1) {
    await prisma.review.create({
      data: {
        bookingId: venueBookingId,
        customerId: customerOne.id,
        vendorId: venue1.vendorId,
        rating: 4,
        title: "Great hall, tight parking",
        comment: "Grand Celebration Banquets has a beautiful air-conditioned hall that easily fit our 250 guests. Only downside was limited parking - worth planning ahead for. Awaiting admin review.",
        status: "PENDING",
      },
    });
  }

  const djBookingId = bookingsByVendorEmail.get("demo-dj1@example.test");
  const dj1 = vendorRecordsByEmail.get("demo-dj1@example.test");
  if (djBookingId && dj1) {
    await prisma.review.create({
      data: {
        bookingId: djBookingId,
        customerId: customerOne.id,
        vendorId: dj1.vendorId,
        rating: 1,
        comment: "Showed up an hour late with no explanation!!! Ruined the start of our sangeet, would NOT recommend.",
        status: "REJECTED",
      },
    });
  }

  // --- Demo notifications ---
  // A small, realistic mix (unread and read) for the demo customer and the
  // photographer vendor, so the notification bell/center have something
  // real to show without needing to drive the whole app through its paces
  // first. Every notification here corresponds to something the seed data
  // above actually did (the photographer booking really was accepted and
  // confirmed, the caterer review really was published), not a fabricated
  // event.
  if (photographerBookingId) {
    const photographerBooking = await prisma.booking.findUniqueOrThrow({ where: { id: photographerBookingId } });
    await prisma.notification.createMany({
      data: [
        {
          userId: customerOne.id,
          type: "BOOKING_ACCEPTED",
          title: "Booking accepted",
          message: `Your booking ${photographerBooking.bookingNumber} has been accepted.`,
          entityType: "booking",
          entityId: photographerBooking.id,
          isRead: true,
          readAt: new Date(),
        },
        {
          userId: customerOne.id,
          type: "BOOKING_CONFIRMED",
          title: "Booking confirmed",
          message: `Your booking ${photographerBooking.bookingNumber} is confirmed - advance payment received.`,
          entityType: "booking",
          entityId: photographerBooking.id,
          isRead: false,
        },
      ],
    });
  }
  if (caterer1) {
    const caterer1User = await prisma.vendor.findUniqueOrThrow({ where: { id: caterer1.vendorId } });
    await prisma.notification.create({
      data: {
        userId: caterer1User.userId,
        type: "REVIEW_RECEIVED",
        title: "New review received",
        message: "You received a new 5-star review.",
        entityType: "review",
        isRead: false,
      },
    });
  }

  // --- Demo admin actions (audit log) ---
  // Matches what verifying/activating a vendor through the real admin API
  // would have recorded - see vendor.service.setVendorVerificationStatus/
  // setVendorActiveStatus, which write these same action names.
  const rejectedVendor = vendorRecordsByEmail.get("demo-venue2@example.test");
  if (rejectedVendor) {
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: "VENDOR_REJECTED",
        targetType: "vendor",
        targetId: rejectedVendor.vendorId,
        metadata: { from: "PENDING", to: "REJECTED" },
      },
    });
  }
  if (caterer1) {
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: "VENDOR_VERIFIED",
        targetType: "vendor",
        targetId: caterer1.vendorId,
        metadata: { from: "PENDING", to: "VERIFIED" },
      },
    });
  }

  console.log("Seed complete. Development accounts (password for all: %s):", DEV_PASSWORD);
  console.log(`  ADMIN    -> ${admin.email}`);
  console.log(`  CUSTOMER -> ${customerOne.email}`);
  console.log(`  CUSTOMER -> ${customerTwo.email}`);
  console.log(`  VENDOR   -> ${DEMO_VENDORS.length} demo vendors (e.g. vendor@example.test)`);
  console.log(
    `  Vendors by status: ${verifiedCount} VERIFIED, ${pendingCount} PENDING, ${rejectedCount} REJECTED`,
  );
  console.log(`  Categories: ${CATEGORY_NAMES.length}`);
  console.log(`  Demo wedding event: "${weddingEvent.name}" for ${customerOne.email}`);
  console.log(
    `  Demo bookings: ${DEMO_BOOKINGS.length} (3 PENDING, 1 ACCEPTED, 1 CONFIRMED, 1 DECLINED, 1 CANCELLED, 3 COMPLETED)`,
  );
  console.log(
    "  Demo payments (fictional): 1 CAPTURED + commission (photographer1, booking now CONFIRMED), " +
      "1 FAILED (decor1, booking still ACCEPTED, ready for a fresh Pay Advance attempt)",
  );
  console.log("  Demo conversations: 2, with messages (including unread state)");
  console.log(
    "  Demo reviews (fictional): 1 PUBLISHED (caterer1, vendor rating now 5.0), 1 PENDING (venue1), 1 REJECTED (dj1)",
  );
  console.log("  Demo notifications: 3 (2 for the demo customer, 1 for the caterer vendor)");
  console.log("  Demo admin actions: 2 (1 VENDOR_VERIFIED, 1 VENDOR_REJECTED)");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
