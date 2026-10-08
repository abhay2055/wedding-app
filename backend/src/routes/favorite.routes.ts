import { Router } from "express";
import { Role } from "@prisma/client";
import * as favoriteController from "../controllers/favorite.controller";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { favoriteVendorParamSchema } from "../validators/favorite.validator";

const router = Router();

router.use(requireAuth, requireRole(Role.CUSTOMER));

router.get("/", favoriteController.listMyFavorites);
router.post("/:vendorId", validate(favoriteVendorParamSchema), favoriteController.addFavorite);
router.delete("/:vendorId", validate(favoriteVendorParamSchema), favoriteController.removeFavorite);

export default router;
