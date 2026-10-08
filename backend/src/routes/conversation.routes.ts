import { Router } from "express";
import { Role } from "@prisma/client";
import * as conversationController from "../controllers/conversation.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import {
  conversationIdParamSchema,
  createConversationSchema,
  listMessagesSchema,
  sendMessageSchema,
} from "../validators/conversation.validator";

const router = Router();

// Either a CUSTOMER or a VENDOR can use messaging - unlike most other
// resources here, this isn't role-exclusive.
router.use(requireAuth, requireRole(Role.CUSTOMER, Role.VENDOR));

router.get("/", conversationController.listConversations);
router.post("/", validate(createConversationSchema), conversationController.createConversation);
router.get("/:id", validate(conversationIdParamSchema), conversationController.getConversation);
router.get("/:id/messages", validate(listMessagesSchema), conversationController.listMessages);
router.post("/:id/messages", validate(sendMessageSchema), conversationController.sendMessage);
router.patch("/:id/read", validate(conversationIdParamSchema), conversationController.markRead);

export default router;
