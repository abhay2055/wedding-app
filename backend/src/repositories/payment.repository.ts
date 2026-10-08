import { Prisma, PaymentStatus, PaymentType } from "@prisma/client";
import { prisma } from "../config/prisma";

const paymentInclude = {
  booking: { select: { id: true, bookingNumber: true, status: true, eventNameSnapshot: true } },
  vendor: { select: { id: true, businessName: true, slug: true } },
  attempts: { orderBy: { createdAt: Prisma.SortOrder.asc } },
} satisfies Prisma.PaymentInclude;

export function findPaymentById(id: string) {
  return prisma.payment.findUnique({ where: { id }, include: paymentInclude });
}

// Ownership-agnostic lookup used internally before deciding which
// customer-vs-vendor authorization check applies.
export function findPaymentByIdRaw(id: string) {
  return prisma.payment.findUnique({ where: { id } });
}

export function findPaymentByProviderOrderId(providerOrderId: string) {
  return prisma.payment.findUnique({ where: { providerOrderId } });
}

export function findPaymentByProviderPaymentId(providerPaymentId: string) {
  return prisma.payment.findUnique({ where: { providerPaymentId } });
}

// Non-terminal statuses for a given booking+type - used to reuse an
// in-flight order instead of creating a duplicate (see payment.service.createPaymentOrder).
const ACTIVE_STATUSES: PaymentStatus[] = [PaymentStatus.CREATED, PaymentStatus.PENDING, PaymentStatus.AUTHORIZED];

export function findActivePaymentForBooking(bookingId: string, paymentType: PaymentType) {
  return prisma.payment.findFirst({
    where: { bookingId, paymentType, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

export function createPayment(data: Prisma.PaymentUncheckedCreateInput) {
  return prisma.payment.create({ data });
}

export function updatePayment(tx: Prisma.TransactionClient, id: string, data: Prisma.PaymentUpdateInput) {
  return tx.payment.update({ where: { id }, data });
}

export function createAttempt(tx: Prisma.TransactionClient, data: Prisma.PaymentAttemptUncheckedCreateInput) {
  return tx.paymentAttempt.create({ data });
}

export interface PaymentListFilters {
  status?: PaymentStatus;
  page: number;
  limit: number;
}

export async function findPaymentsByCustomer(customerId: string, filters: PaymentListFilters) {
  const where: Prisma.PaymentWhereInput = { customerId, ...(filters.status ? { status: filters.status } : {}) };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: filters.limit, include: paymentInclude }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}

export async function findPaymentsByVendor(vendorId: string, filters: PaymentListFilters) {
  const where: Prisma.PaymentWhereInput = { vendorId, ...(filters.status ? { status: filters.status } : {}) };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: filters.limit, include: paymentInclude }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}

export interface AdminPaymentListFilters {
  status?: PaymentStatus;
  vendorId?: string;
  customerId?: string;
  bookingId?: string;
  page: number;
  limit: number;
}

export async function findPaymentsForAdmin(filters: AdminPaymentListFilters) {
  const where: Prisma.PaymentWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.bookingId ? { bookingId: filters.bookingId } : {}),
  };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      include: {
        ...paymentInclude,
        customer: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);
  return { items, total };
}
