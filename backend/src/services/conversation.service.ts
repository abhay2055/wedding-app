import { Role } from "@prisma/client";
import { ApiError } from "../utils/apiError";
import * as conversationRepository from "../repositories/conversation.repository";
import * as vendorRepository from "../repositories/vendor.repository";
import * as bookingRepository from "../repositories/booking.repository";
import { CreateConversationInput } from "../validators/conversation.validator";

// Never trust a conversation id from the client without checking the
// caller is actually one of its two participants - 404 (not 403) so the
// response never confirms a conversation with that id exists at all.
export async function requireParticipant(conversationId: string, userId: string, role: Role) {
  const conversation = await conversationRepository.findConversationById(conversationId);
  if (!conversation) {
    throw ApiError.notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }

  const isCustomerParty = role === Role.CUSTOMER && conversation.customerId === userId;
  const isVendorParty = role === Role.VENDOR && conversation.vendor.userId === userId;
  if (!isCustomerParty && !isVendorParty) {
    throw ApiError.notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  return conversation;
}

export async function getOrCreateConversation(userId: string, role: Role, input: CreateConversationInput) {
  if (input.bookingId) {
    const booking = await bookingRepository.findBookingById(input.bookingId);
    if (!booking) {
      throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
    }

    let isParty = role === Role.CUSTOMER && booking.customerId === userId;
    if (!isParty && role === Role.VENDOR) {
      const vendor = await vendorRepository.findVendorByUserId(userId);
      isParty = Boolean(vendor && vendor.id === booking.vendorId);
    }
    if (!isParty) {
      throw ApiError.notFound("Booking not found", "BOOKING_NOT_FOUND");
    }

    // One thread per (customer, vendor) pair, reused across bookings - see
    // @@unique([customerId, vendorId]) on Conversation.
    const existing = await conversationRepository.findConversationByCustomerAndVendor(booking.customerId, booking.vendorId);
    if (existing) {
      if (!existing.bookingId) {
        await conversationRepository.attachBookingIfUnset(existing.id, booking.id);
        return conversationRepository.findConversationById(existing.id);
      }
      return existing;
    }
    return conversationRepository.createConversation(booking.customerId, booking.vendorId, booking.id);
  }

  // vendorId-only path: a customer-initiated pre-booking inquiry.
  if (role !== Role.CUSTOMER) {
    throw ApiError.forbidden("Only a customer can start a conversation by vendor id", "FORBIDDEN");
  }
  const vendor = await vendorRepository.findPublicVendorById(input.vendorId!);
  if (!vendor) {
    throw ApiError.notFound("Vendor not found", "VENDOR_NOT_FOUND");
  }

  const existing = await conversationRepository.findConversationByCustomerAndVendor(userId, vendor.id);
  if (existing) return existing;
  return conversationRepository.createConversation(userId, vendor.id);
}

export async function listMyConversations(userId: string, role: Role) {
  if (role === Role.VENDOR) {
    const vendor = await vendorRepository.findVendorByUserId(userId);
    if (!vendor) {
      throw ApiError.notFound("Vendor profile not found", "VENDOR_PROFILE_NOT_FOUND");
    }
    return conversationRepository.findConversationsForVendor(userId, vendor.id);
  }
  return conversationRepository.findConversationsForCustomer(userId);
}

export async function getConversation(userId: string, role: Role, conversationId: string) {
  return requireParticipant(conversationId, userId, role);
}
