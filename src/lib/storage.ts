import "server-only";

import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";

/**
 * Storage abstraction. Files are never stored in PostgreSQL.
 * The database only keeps keys + URLs.
 *
 * Current implementation: local disk (dev).
 * For S3-compatible storage (AWS S3 / Cloudflare R2 / Supabase) implement
 * S3StorageProvider and switch STORAGE_PROVIDER in the environment.
 */

export type StorageProvider = {
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  url(key: string): string;
};

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const MAX_UPLOAD_BYTES = MAX_FILE_SIZE;

class LocalStorageProvider implements StorageProvider {
  private dir: string;

  constructor() {
    this.dir = path.join(process.cwd(), process.env.STORAGE_LOCAL_DIR || "storage");
  }

  private fullPath(key: string) {
    return path.join(this.dir, key);
  }

  async put(key: string, data: Buffer, _contentType: string): Promise<string> {
    const target = this.fullPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return `/api/files/${key}`;
  }

  async delete(key: string): Promise<void> {
    // Best effort; the audit trail keeps records even if a file is removed.
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(this.fullPath(key));
    } catch {
      /* ignore */
    }
  }

  url(key: string): string {
    return `/api/files/${key}`;
  }
}

// TODO: implement S3-compatible provider (AWS SDK v3) when STORAGE_PROVIDER=s3
// export class S3StorageProvider implements StorageProvider { ... }

export function getStorage(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "local") {
    return new LocalStorageProvider();
  }
  throw new Error(`Storage provider "${provider}" is not implemented yet.`);
}

export function validateUpload(file: { type: string; size: number }): string | null {
  if (file.size > MAX_FILE_SIZE) return "File exceeds the 10MB size limit.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Only image files are allowed (JPEG, PNG, WebP, HEIC).";
  return null;
}

export function verifyMagicBytes(data: Buffer, claimedType: string): boolean {
  if (data.length < 4) return false;
  // JPEG: FF D8 FF
  if (claimedType === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  // PNG: 89 50 4E 47
  if (claimedType === "image/png") return data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  // WebP: 52 49 46 46 (RIFF) — further check for WEBP at offset 8
  if (claimedType === "image/webp") {
    return data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data.length >= 12 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50;
  }
  // HEIC/HEIF: ftyp at offset 4, then heic/heix/mif1/etc
  if (claimedType === "image/heic" || claimedType === "image/heif") {
    return data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70;
  }
  return false;
}

export function buildFileKey(orgId: string, folder: string, originalName: string): string {
  const ext = path.extname(originalName || "photo.jpg").toLowerCase() || ".jpg";
  const safe = ext.replace(/[^a-zA-Z0-9.]/g, "");
  return `${orgId}/${folder}/${randomUUID()}${safe}`;
}

/**
 * Resolves a storage key to an absolute path, or null when the key would
 * escape the storage root. Uses path.relative containment rather than a
 * bare startsWith, which wrongly accepts sibling directories such as
 * "<root>-evil" (prefix-match bug).
 */
export function resolveStoragePath(key: string): string | null {
  const storageDir = process.env.STORAGE_LOCAL_DIR || "storage";
  const root = path.resolve(process.cwd(), storageDir);
  const target = path.resolve(root, key);
  if (target === root) return null; // never serve the root itself
  const rel = path.relative(root, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}

export async function fileKeyToBuffer(key: string): Promise<Buffer> {
  const filePath = resolveStoragePath(key);
  if (!filePath) throw new Error("Invalid file path");
  return readFile(filePath);
}

export { pipeline, createReadStream };
