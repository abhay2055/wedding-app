import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ApiError } from "../utils/apiError";

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_MIME_TYPES, file.mimetype)) {
      cb(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }
    cb(null, true);
  },
});

export function extensionForMimeType(mimeType: string): string {
  return ALLOWED_MIME_TYPES[mimeType] ?? "";
}

// Wraps multer's single-file upload so its errors go through the same
// ApiError -> centralized error handler path as every other route, instead
// of multer's own error shape.
const uploadSingleFile = upload.single("file");

export function optionalSingleImageUpload(req: Request, res: Response, next: NextFunction): void {
  uploadSingleFile(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        next(ApiError.badRequest("Image must be 5MB or smaller", "FILE_TOO_LARGE"));
        return;
      }
      next(ApiError.badRequest(`Invalid file upload: ${err.message}`, "INVALID_FILE_UPLOAD"));
      return;
    }
    if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
      next(ApiError.badRequest("Only JPEG, PNG and WEBP images are supported", "UNSUPPORTED_FILE_TYPE"));
      return;
    }
    next(err);
  });
}
