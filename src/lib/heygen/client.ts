import { ProxyAgent } from "undici";
import { env } from "../config/env";
import {
  CreateVideoResponseSchema,
  VideoStatusResponseSchema,
  type CreateVideoRequest,
  type NormalizedVideoStatus,
} from "./heygenSchema";

/**
 * HeyGen API 客户端
 * 封装视频创建和状态查询，支持 HTTP 代理和超时控制
 */
export class HeyGenClient {
  private baseUrl: string;
  private apiKey: string;
  private dispatcher: ProxyAgent | undefined;
  private timeoutMs: number;

  constructor() {
    this.baseUrl = env.heygen.baseUrl();
    this.apiKey = env.heygen.apiKey();
    this.timeoutMs = env.heygen.requestTimeoutMs();

    const proxyUrl = env.heygen.proxyUrl();
    this.dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
  }

  /**
   * 统一 HTTP 请求入口
   * 处理代理、超时、错误信息格式化（不暴露 API key）
   */
  private async request(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const fetchOptions: RequestInit & { dispatcher?: ProxyAgent } = {
        ...init,
        signal: controller.signal,
        cache: "no-store", // 禁止 Node fetch 层缓存，确保每次都拿最新状态
      };

      if (this.dispatcher) {
        fetchOptions.dispatcher = this.dispatcher;
      }

      return await fetch(url, fetchOptions);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || controller.signal.aborted)
      ) {
        throw new Error(
          `HeyGen 网络连接失败，请检查 HEYGEN_PROXY_URL 或网络/VPN` +
            `（超时 ${this.timeoutMs}ms，目标：${url}）`
        );
      }

      const cause = error as NodeJS.ErrnoException;
      const detail = cause.code
        ? `code=${cause.code}, message=${cause.message}`
        : (cause.message ?? String(error));

      throw new Error(
        `HeyGen 网络连接失败，请检查 HEYGEN_PROXY_URL 或网络/VPN（${detail}）`
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 创建视频
   * 根据 HEYGEN_CREATE_MODE 选择 v3 或 v2 API
   */
  async createVideo(scriptText: string): Promise<string> {
    const avatarLookId = env.heygen.avatarId();
    const voiceId = env.heygen.voiceId();
    const createMode = env.heygen.createMode();
    const avatarEngine = env.heygen.avatarEngine();
    const nativeCaption = env.heygen.enableNativeCaption();

    console.log("[HeyGen createVideo config]", { createMode, avatarEngine, nativeCaption });

    // ── v3_caption 模式 ───────────────────────────────────────────────
    if (createMode === "v3_caption") {
      const v3Body: Record<string, unknown> = {
        type: "avatar",
        avatar_id: avatarLookId,
        voice_id: voiceId,
        script: scriptText,
        aspect_ratio: "9:16",
        output_format: "mp4",
        engine: { type: avatarEngine }, // 显式锁定，防止默认升级到 Avatar IV
      };
      if (nativeCaption) {
        v3Body["caption"] = { file_format: "srt" };
      }

      const v3Response = await this.request(`${this.baseUrl}/v3/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": this.apiKey },
        body: JSON.stringify(v3Body),
      });

      if (v3Response.ok) {
        const data = await v3Response.json();
        console.log("[HeyGen createVideo v3 response]", JSON.stringify({
          hasData: !!data?.data,
          videoId: data?.data?.video_id ?? data?.data?.id,
          error: data?.error ?? null,
        }));
        const videoId = data?.data?.video_id ?? data?.data?.id;
        if (videoId) return String(videoId);
        console.warn("[HeyGen createVideo] v3 返回结构异常，fallback 到 v2");
      } else {
        const errorText = await v3Response.text();

        // avatar look not found → 专项提示
        if (errorText.toLowerCase().includes("avatar look not found")) {
          throw new Error(
            `当前 HEYGEN_AVATAR_ID 不是可用的 Avatar Look ID。` +
              `请调用 /api/heygen/avatar-looks 查看可用 look id。（原始错误：${errorText}）`
          );
        }

        // 余额/套餐/权限类错误 → 不 fallback，直接抛出
        const BILLING_KEYWORDS = ["credit", "payment", "billing", "upgrade", "insufficient", "quota"];
        const isCreditsError = BILLING_KEYWORDS.some((kw) =>
          errorText.toLowerCase().includes(kw)
        );
        if (isCreditsError) {
          throw new Error(
            `HeyGen API 余额或套餐不足（${v3Response.status}）：${errorText}` +
              `\n请充值 API credits 或将 HEYGEN_CREATE_MODE 改为 v2_legacy。`
          );
        }

        // 404/405 = v3 端点不支持，可安全 fallback
        if (v3Response.status === 404 || v3Response.status === 405) {
          console.log(`[HeyGen createVideo] v3 返回 ${v3Response.status}，fallback 到 v2`);
        } else {
          // 其他服务端错误也不静默 fallback
          throw new Error(`HeyGen v3 API 返回错误 (${v3Response.status}): ${errorText}`);
        }
      }
    }

    // ── v2_legacy 模式（或 v3 fallback） ────────────────────────────
    const requestBody: CreateVideoRequest = {
      video_inputs: [
        {
          character: { type: "avatar", avatar_id: avatarLookId, avatar_style: "normal" },
          voice: { type: "text", input_text: scriptText, voice_id: voiceId },
        },
      ],
      dimension: { width: 1080, height: 1920 },
    };

    const response = await this.request(`${this.baseUrl}/v2/video/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": this.apiKey },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404 && errorText.toLowerCase().includes("avatar look not found")) {
        throw new Error(
          `当前 HEYGEN_AVATAR_ID 不是可用的 Avatar Look ID。` +
            `请调用 /api/heygen/avatar-looks 查看可用 look id。（原始错误：${errorText}）`
        );
      }
      throw new Error(`HeyGen v2 API 返回错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log("[HeyGen createVideo v2 response]", JSON.stringify({
      hasData: !!data?.data,
      videoId: data?.data?.video_id,
      error: data?.error,
    }));

    const parsed = CreateVideoResponseSchema.parse(data);
    if (parsed.error) throw new Error(`HeyGen API 错误：${parsed.error.message}`);
    return parsed.data.video_id;
  }

  /**
   * 查询视频状态
   * 优先使用 v3 接口（返回更多字段），404 时 fallback 到 v1
   */
  async getVideoStatus(videoId: string): Promise<NormalizedVideoStatus> {
    // 1. 尝试 v3 接口
    const v3Response = await this.request(
      `${this.baseUrl}/v3/videos/${encodeURIComponent(videoId)}`,
      { method: "GET", headers: { "X-Api-Key": this.apiKey } }
    );

    if (v3Response.ok) {
      const raw = await v3Response.json();
      const d = (raw?.data ?? raw) as Record<string, unknown>;

      const subtitleUrl =
        d.subtitle_url != null ? String(d.subtitle_url) :
        d.caption_url  != null ? String(d.caption_url)  :
        (d.caption as Record<string, unknown>)?.url != null
          ? String((d.caption as Record<string, unknown>).url)
          : undefined;

      const failureCode    = d.failure_code    != null ? String(d.failure_code)    : undefined;
      const failureMessage = d.failure_message != null ? String(d.failure_message) :
                             d.error           != null ? String(d.error)           :
                             d.failure_reason  != null ? String(d.failure_reason)  : undefined;

      const normalized: NormalizedVideoStatus = {
        video_id:            String(d.id ?? d.video_id ?? videoId),
        status:              String(d.status ?? "unknown"),
        video_url:           d.video_url           != null ? String(d.video_url)           : undefined,
        thumbnail_url:       d.thumbnail_url       != null ? String(d.thumbnail_url)       : undefined,
        duration:            typeof d.duration === "number" ? d.duration                   : undefined,
        subtitle_url:        subtitleUrl,
        captioned_video_url: d.captioned_video_url != null ? String(d.captioned_video_url) : undefined,
        video_page_url:      d.video_page_url      != null ? String(d.video_page_url)      : undefined,
        failure_code:        failureCode,
        failure_message:     failureMessage,
        error:               failureMessage ?? null,
      };

      console.log("[HeyGen getVideoStatus v3]", JSON.stringify({
        videoId,
        status: normalized.status,
        hasVideoUrl: !!normalized.video_url,
        hasSubtitleUrl: !!normalized.subtitle_url,
        failureCode:    normalized.failure_code    ?? null,
        failureMessage: normalized.failure_message ? normalized.failure_message.slice(0, 80) : null,
      }));
      return normalized;
    }

    // v3 返回非 404 错误 → 直接抛出
    if (v3Response.status !== 404) {
      const errorText = await v3Response.text();
      throw new Error(`HeyGen API 返回错误 (${v3Response.status}): ${errorText}`);
    }

    // 2. Fallback：v1 status 接口
    const v1Response = await this.request(
      `${this.baseUrl}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
      { method: "GET", headers: { "X-Api-Key": this.apiKey } }
    );

    if (!v1Response.ok) {
      const errorText = await v1Response.text();
      throw new Error(`HeyGen API 返回错误 (${v1Response.status}): ${errorText}`);
    }

    const v1Data = await v1Response.json();
    const parsed = VideoStatusResponseSchema.parse(v1Data);
    const d = parsed.data;

    const normalized: NormalizedVideoStatus = {
      video_id: d.video_id,
      status: d.status,
      video_url: d.video_url ?? undefined,
      error: d.error != null ? String(d.error) : null,
    };
    console.log("[HeyGen getVideoStatus v1]", JSON.stringify({
      videoId,
      status: normalized.status,
      hasVideoUrl: !!normalized.video_url,
    }));
    return normalized;
  }

  /**
   * 健康检查 — 测试 HeyGen API 是否可达，不消耗配额
   */
  async healthCheck(): Promise<true> {
    // TODO: 如果 HeyGen 提供专用 ping 端点，替换为该端点
    const response = await this.request(
      `${this.baseUrl}/v2/video/list?page=1&limit=1`,
      { method: "GET", headers: { "X-Api-Key": this.apiKey } }
    );

    if (response.status >= 500) {
      throw new Error(`HeyGen 服务端错误 (${response.status})`);
    }

    return true;
  }

  /**
   * 查询当前账号的 private avatar looks
   * 用于确认 HEYGEN_AVATAR_ID 是否填写了正确的 look id（而非 group id）
   */
  async listAvatarLooks(): Promise<AvatarLook[]> {
    const response = await this.request(
      `${this.baseUrl}/v3/avatars/looks?ownership=private&limit=50`,
      { method: "GET", headers: { "X-Api-Key": this.apiKey } }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API 返回错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // TODO: 如果 HeyGen /v3/avatars/looks 的响应结构不同，请根据实际值调整
    const looks: unknown[] = data?.data?.avatar_looks ?? data?.data ?? [];

    return (Array.isArray(looks) ? looks : []).map((item) => {
      const l = item as Record<string, unknown>;
      return {
        id: String(l.id ?? ""),
        name: l.name != null ? String(l.name) : undefined,
        group_id: l.group_id != null ? String(l.group_id) : undefined,
        avatar_type: l.avatar_type != null ? String(l.avatar_type) : undefined,
        status: l.status != null ? String(l.status) : undefined,
        default_voice_id:
          l.default_voice_id != null ? String(l.default_voice_id) : undefined,
        supported_api_engines: Array.isArray(l.supported_api_engines)
          ? (l.supported_api_engines as string[])
          : undefined,
      };
    });
  }
}

export interface AvatarLook {
  id: string;
  name?: string;
  group_id?: string;
  avatar_type?: string;
  status?: string;
  default_voice_id?: string;
  supported_api_engines?: string[];
}
