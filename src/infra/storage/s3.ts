import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter, StorageUploadResult } from "./adapter";

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION ?? "us-east-1";

const client = new S3Client({ region });

export const s3StorageAdapter: StorageAdapter = {
  async upload(key: string, data: Buffer, contentType: string) {
    if (!bucket) throw new Error("S3_BUCKET not configured");
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await client.send(cmd);
    return { key } as StorageUploadResult;
  },

  async delete(key: string) {
    if (!bucket) throw new Error("S3_BUCKET not configured");
    const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await client.send(cmd);
  },

  async getUrl(key: string) {
    if (!bucket) throw new Error("S3_BUCKET not configured");
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    // default expiry 1 hour
    const url = await getSignedUrl(client, cmd, { expiresIn: 3600 });
    return url;
  },
};

export default s3StorageAdapter;
