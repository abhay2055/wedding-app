import { Router } from "express";
import { Role } from "@prisma/client";
import * as eventController from "../controllers/event.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { createEventSchema, eventIdParamSchema, updateEventSchema } from "../validators/event.validator";

const router = Router();

router.use(requireAuth, requireRole(Role.CUSTOMER));

router.get("/", eventController.listMyEvents);
router.post("/", validate(createEventSchema), eventController.createEvent);
router.get("/:id", validate(eventIdParamSchema), eventController.getMyEvent);
router.patch("/:id", validate(updateEventSchema), eventController.updateEvent);
router.delete("/:id", validate(eventIdParamSchema), eventController.deleteEvent);

export default router;
