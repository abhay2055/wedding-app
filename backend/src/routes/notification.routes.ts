import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { notificationIdParamSchema, notificationListSchema } from "../validators/notification.validator";

// Any authenticated role (customer/vendor/admin) - every notification is
// scoped to req.user.id server-side (see notification.service.ts's
// requireOwnNotification), never trusted from the URL alone.
const router = Router();

router.use(requireAuth);

router.get("/", validate(notificationListSchema), notificationController.listMyNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllRead);
router.patch("/:id/read", validate(notificationIdParamSchema), notificationController.markRead);
router.delete("/:id", validate(notificationIdParamSchema), notificationController.deleteNotification);

export default router;
