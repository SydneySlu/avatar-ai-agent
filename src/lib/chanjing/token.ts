import { env } from "../config/env";
import type { CJApiResponse, CJTokenData } from "./chanjingSchema";

/** 缓存 token，避免每次请求都重新获取 */
interface TokenCache {
  token: string;
  expiresAt: number; // Unix timestamp ms
}

let tokenCache: TokenCache | null = null;

/** token 快过期阈值：提前 5 分钟刷新 */
const REFRESH_AHEAD_MS = 5 * 60 * 1000;

function isCacheValid(): boolean {
  if (!tokenCache) return false;
  return Date.now() < tokenCache.expiresAt - REFRESH_AHEAD_MS;
}

/**
 * 获取蝉镜 access_token（带缓存）
 */
export async function getCJToken(): Promise<string> {
  if (isCacheValid()) {
    return tokenCache!.token;
  }
  return refreshToken();
}

/**
 * 强制刷新 token（10400 错误时调用）
 */
export async function refreshToken(): Promise<string> {
  const baseUrl = env.chanjing.baseUrl();
  const appId = env.chanjing.appId();
  const secretKey = env.chanjing.secretKey();

  const res = await fetch(`${baseUrl}/open/v1/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, secret_key: secretKey }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`蝉镜 token 请求失败 (HTTP ${res.status})`);
  }

  const json: CJApiResponse<CJTokenData> = await res.json();

  if (json.code !== 0) {
    throw new Error(
      `蝉镜 token 获取失败: code=${json.code} msg=${json.msg} trace_id=${json.trace_id ?? "-"}`
    );
  }

  const expiresAt = json.data.expire_in * 1000; // expire_in 是 Unix 时间戳（秒）
  tokenCache = { token: json.data.access_token, expiresAt };

  console.log("[chanjing token] token 刷新成功", {
    hasToken: true,
    expiresAt: new Date(expiresAt).toISOString(),
  });

  return tokenCache.token;
}

/** 主动清除缓存（测试用途）*/
export function clearTokenCache(): void {
  tokenCache = null;
}
