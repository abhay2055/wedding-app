import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import vendorRoutes from "./vendor.routes";
import adminRoutes from "./admin.routes";
import categoryRoutes from "./category.routes";
import eventRoutes from "./event.routes";
import favoriteRoutes from "./favorite.routes";
import bookingRoutes from "./booking.routes";
import conversationRoutes from "./conversation.routes";
import paymentRoutes from "./payment.routes";
import reviewRoutes from "./review.routes";
import notificationRoutes from "./notification.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/vendors", vendorRoutes);
router.use("/admin", adminRoutes);
router.use("/categories", categoryRoutes);
router.use("/events", eventRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/bookings", bookingRoutes);
router.use("/conversations", conversationRoutes);
router.use("/payments", paymentRoutes);
router.use("/reviews", reviewRoutes);
router.use("/notifications", notificationRoutes);

export default router;
