import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { updateMeSchema } from "../validators/user.validator";

const router = Router();

router.get("/me", requireAuth, userController.getMe);
router.patch("/me", requireAuth, validate(updateMeSchema), userController.updateMe);

export default router;
