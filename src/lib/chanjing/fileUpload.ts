import fs from "fs/promises";
import path from "path";
import { cjRequest } from "./client";
import type { CJUploadService, CJUploadUrlData } from "./chanjingSchema";
import { env } from "../config/env";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 步骤 1: 获取预签名上传 URL
 */
async function createUploadUrl(
  service: CJUploadService,
  filename: string
): Promise<CJUploadUrlData> {
  const params = new URLSearchParams({ service, name: filename });
  return cjRequest<CJUploadUrlData>(
    `/open/v1/common/create_upload_url?${params}`,
    { method: "GET" }
  );
}

/**
 * 步骤 2: PUT 文件到 sign_url
 */
async function putFileToSignUrl(
  signUrl: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<void> {
  const res = await fetch(signUrl, {
    method: "PUT",
    body: new Uint8Array(fileBuffer),
    headers: { "Content-Type": mimeType },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`文件 PUT 上传失败 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
}

export interface UploadResult {
  fileId: string;
  fullPath: string;
  mimeType: string;
}

/**
 * 上传本地文件到蝉镜
 */
export async function uploadFileToCJ(
  localPath: string,
  service: CJUploadService
): Promise<UploadResult> {
  const filename = path.basename(localPath);
  const fileBuffer = await fs.readFile(localPath);

  console.log("[chanjing upload] 获取上传 URL", { service, filename });
  const uploadInfo = await createUploadUrl(service, filename);

  console.log("[chanjing upload] PUT 上传文件", { service, filename });
  await putFileToSignUrl(uploadInfo.sign_url, fileBuffer, uploadInfo.mime_type);

  const delayMs = env.chanjing.uploadSyncDelayMs();
  if (delayMs > 0) {
    console.log("[chanjing upload] 等待文件同步", { delayMs });
    await sleep(delayMs);
  }

  console.log("[chanjing upload] 上传完成", { service, fileId: uploadInfo.file_id });

  return {
    fileId: uploadInfo.file_id,
    fullPath: uploadInfo.full_path,
    mimeType: uploadInfo.mime_type,
  };
}

/**
 * 直接上传 Buffer（来自 FormData 接收的文件）
 */
export async function uploadBufferToCJ(
  buffer: Buffer,
  filename: string,
  service: CJUploadService
): Promise<UploadResult> {
  console.log("[chanjing upload] 获取上传 URL (buffer)", { service, filename });
  const uploadInfo = await createUploadUrl(service, filename);

  await putFileToSignUrl(uploadInfo.sign_url, buffer, uploadInfo.mime_type);

  const delayMs = env.chanjing.uploadSyncDelayMs();
  if (delayMs > 0) {
    console.log("[chanjing upload] 等待文件同步", { delayMs });
    await sleep(delayMs);
  }

  console.log("[chanjing upload] 上传完成 (buffer)", { service, fileId: uploadInfo.file_id });

  return {
    fileId: uploadInfo.file_id,
    fullPath: uploadInfo.full_path,
    mimeType: uploadInfo.mime_type,
  };
}
