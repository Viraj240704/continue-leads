import "server-only";
import { promises as fs } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { env } from "../env";
import { S3Storage } from "./s3";

// Storage adapter. Local driver writes to the filesystem, mirroring the S3
// preview/live prefix model (spec §2). An "s3" driver plugs in behind this interface.
export interface Storage {
  put(key: string, content: string, contentType?: string): Promise<string>;
  get(key: string): Promise<string | null>;
  putBytes(key: string, bytes: Buffer, contentType?: string): Promise<string>;
  getBytes(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
}

class LocalFsStorage implements Storage {
  private root = resolve(process.cwd(), env.storageRoot);

  private path(key: string) {
    // prevent path traversal
    const safe = key.replace(/\.\.+/g, "").replace(/^\/+/, "");
    return join(this.root, safe);
  }

  async put(key: string, content: string) {
    const full = this.path(key);
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
    return key;
  }
  async get(key: string) {
    try {
      return await fs.readFile(this.path(key), "utf8");
    } catch {
      return null;
    }
  }
  async putBytes(key: string, bytes: Buffer) {
    const full = this.path(key);
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return key;
  }
  async getBytes(key: string) {
    try {
      return await fs.readFile(this.path(key));
    } catch {
      return null;
    }
  }
  async exists(key: string) {
    try {
      await fs.access(this.path(key));
      return true;
    } catch {
      return false;
    }
  }
  async remove(key: string) {
    try {
      await fs.rm(this.path(key), { force: true });
    } catch {
      /* ignore */
    }
  }
}

let _s: Storage | null = null;
export function getStorage(): Storage {
  if (_s) return _s;
  if (env.storageDriver === "s3") {
    if (!env.s3Bucket) {
      console.warn("STORAGE_DRIVER=s3 but S3_BUCKET is empty; using local filesystem storage.");
      _s = new LocalFsStorage();
    } else {
      _s = new S3Storage();
    }
  } else {
    _s = new LocalFsStorage();
  }
  return _s;
}

// Key helpers — keep the preview/live separation explicit.
export const storageKeys = {
  preview: (brandSlug: string, versionId: string) => `preview/${brandSlug}/${versionId}.html`,
  live: (brandSlug: string, path: string) => `live/${brandSlug}${path === "/" ? "/index" : path}.html`,
  sitemap: (brandSlug: string) => `live/${brandSlug}/sitemap.xml`,
  robots: (brandSlug: string) => `live/${brandSlug}/robots.txt`,
  asset: (brandSlug: string, assetId: string) => `assets/${brandSlug}/${assetId}`,
};
