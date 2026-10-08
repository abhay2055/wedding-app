import { Notification, Role } from "../types/api";

// Maps a notification's (entityType, entityId) plus the viewer's role to
// where clicking it should navigate - the same entityType means a
// different destination depending on whether the viewer is a customer,
// vendor or admin (e.g. "booking" -> /dashboard/bookings/:id for a
// customer, /vendor/bookings/:id for a vendor). Returns null when there's
// nowhere sensible to send the viewer (falls back to just marking it read).
export function notificationTarget(notification: Notification, role: Role): string | null {
  const { entityType, entityId } = notification;
  switch (entityType) {
    case "booking":
      if (!entityId) return null;
      if (role === "CUSTOMER") return `/dashboard/bookings/${entityId}`;
      if (role === "VENDOR") return `/vendor/bookings/${entityId}`;
      return "/admin/bookings";
    case "payment":
      if (role === "CUSTOMER") return "/dashboard/payments";
      if (role === "VENDOR") return "/vendor/payments";
      return "/admin/payments";
    case "conversation":
      if (!entityId) return null;
      if (role === "CUSTOMER") return `/dashboard/messages/${entityId}`;
      if (role === "VENDOR") return `/vendor/messages/${entityId}`;
      return null;
    case "review":
      if (role === "CUSTOMER") return "/dashboard/reviews";
      if (role === "VENDOR") return "/vendor/reviews";
      return "/admin/reviews";
    case "vendor":
      if (role === "VENDOR") return "/vendor";
      if (role === "ADMIN") return "/admin/vendors";
      return null;
    default:
      return null;
  }
}
