import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { env } from "../config/env";

export interface StoredFile {
  url: string;
}

// The rest of the app only ever talks to this interface, so the local-disk
// implementation below can be swapped for an S3/Cloudinary-backed one later
// (upload code and DB schema - VendorPortfolio.url is just a string - don't
// need to change).
export interface StorageProvider {
  saveImage(file: { buffer: Buffer; originalExtension: string }): Promise<StoredFile>;
  deleteByUrl(url: string): Promise<void>;
}

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const PORTFOLIO_DIR = path.join(UPLOAD_ROOT, "portfolio");

class LocalDiskStorageProvider implements StorageProvider {
  constructor() {
    fs.mkdirSync(PORTFOLIO_DIR, { recursive: true });
  }

  async saveImage(file: { buffer: Buffer; originalExtension: string }): Promise<StoredFile> {
    const filename = `${randomUUID()}${file.originalExtension}`;
    const filePath = path.join(PORTFOLIO_DIR, filename);
    await fs.promises.writeFile(filePath, file.buffer);
    return { url: `${env.BACKEND_PUBLIC_URL}/uploads/portfolio/${filename}` };
  }

  async deleteByUrl(url: string): Promise<void> {
    if (!url.startsWith(`${env.BACKEND_PUBLIC_URL}/uploads/portfolio/`)) {
      // Not a file we manage (e.g. an externally hosted video URL) - nothing to delete.
      return;
    }
    const filename = path.basename(url);
    const filePath = path.join(PORTFOLIO_DIR, filename);
    await fs.promises.unlink(filePath).catch(() => undefined);
  }
}

export const storage: StorageProvider = new LocalDiskStorageProvider();
