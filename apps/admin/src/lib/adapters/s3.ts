import "server-only";
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../env";
import type { Storage } from "./storage";

// Real S3 storage — same key layout as the local driver (preview/ live/ assets/).
export class S3Storage implements Storage {
  private client: S3Client;
  private bucket = env.s3Bucket;
  constructor() {
    this.client = new S3Client({
      region: env.awsRegion,
      // Falls back to the default AWS credential chain (instance role / SSO) when unset.
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY } }
        : {}),
    });
  }

  private ctFor(key: string) {
    if (key.endsWith(".html")) return "text/html; charset=utf-8";
    if (key.endsWith(".xml")) return "application/xml";
    if (key.endsWith(".txt")) return "text/plain";
    return "application/octet-stream";
  }

  async put(key: string, content: string, contentType?: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentType: contentType ?? this.ctFor(key) }));
    return key;
  }
  async putBytes(key: string, bytes: Buffer, contentType?: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: contentType ?? this.ctFor(key) }));
    return key;
  }
  async get(key: string) {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return (await r.Body!.transformToString()) ?? null;
    } catch (e: any) {
      if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }
  async getBytes(key: string) {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return Buffer.from(await r.Body!.transformToByteArray());
    } catch (e: any) {
      if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }
  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
  async remove(key: string) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      /* ignore */
    }
  }
}
