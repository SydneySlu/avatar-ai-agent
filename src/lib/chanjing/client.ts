import { getCJToken, refreshToken } from "./token";
import type { CJApiResponse } from "./chanjingSchema";
import { env } from "../config/env";

/** 蝉镜 API 错误代码 */
const CODE_TOKEN_EXPIRED = 10400;

/**
 * 蝉镜 HTTP 客户端
 * - 自动注入 access_token
 * - 10400 时自动刷新 token 并重试一次
 * - code != 0 时抛出含 trace_id 的错误
 */
export async function cjRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const baseUrl = env.chanjing.baseUrl();
  const url = `${baseUrl}${path}`;

  const doRequest = async (token: string): Promise<CJApiResponse<T>> => {
    const headers: Record<string, string> = {
      "access_token": token,
      ...(init.headers as Record<string, string> ?? {}),
    };
    if (!(init.body instanceof Uint8Array) && !headers["Content-Type"]) {
      if (init.body) headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, { ...init, headers, cache: "no-store" });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`蝉镜 HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  };

  let token = await getCJToken();
  let json = await doRequest(token);

  // 10400 = token 失效，刷新后重试一次
  if (json.code === CODE_TOKEN_EXPIRED) {
    console.warn("[chanjing] token 失效，刷新后重试");
    token = await refreshToken();
    json = await doRequest(token);
  }

  if (json.code !== 0) {
    throw new Error(
      `蝉镜 API 错误: code=${json.code} msg=${json.msg} trace_id=${json.trace_id ?? "-"}`
    );
  }

  return json.data;
}
