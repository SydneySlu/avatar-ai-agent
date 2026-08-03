import type { VideoProvider, CreateVideoOpts, NormalizedVideoStatus } from "../video-provider/types";
import { env } from "../config/env";

/**
 * Relay 中转服务客户端
 * 封装对云端 relay backend 的 HTTP 调用
 */
export class RelayClient {
  private baseUrl: string;
  private appKey: string;

  constructor() {
    this.baseUrl = env.relay.baseUrl();
    this.appKey  = env.relay.appKey();
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.appKey}`,
    };
  }

  async createVideo(scriptText: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/videos`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ scriptText, aspectRatio: "9:16" }),
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Relay createVideo 失败 (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const videoId = json?.data?.videoId ?? json?.data?.video_id ?? json?.videoId;
    if (!videoId) {
      throw new Error("Relay createVideo 返回了未知格式，缺少 videoId");
    }

    console.log("[relay] 视频创建成功", { videoId });
    return String(videoId);
  }

  async getVideoStatus(videoId: string): Promise<NormalizedVideoStatus> {
    const res = await fetch(
      `${this.baseUrl}/v1/videos/${encodeURIComponent(videoId)}`,
      { method: "GET", headers: this.headers(), cache: "no-store" }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Relay getVideoStatus 失败 (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const d = json?.data ?? json;

    const status = String(d.status ?? "unknown");
    const normalizedStatus =
      status === "completed" || status === "succeeded"
        ? "completed"
        : status === "failed" || status === "error"
        ? "failed"
        : status === "processing" || status === "running"
        ? "processing"
        : "pending";

    return {
      video_id:        String(d.videoId ?? d.video_id ?? videoId),
      status:          normalizedStatus,
      video_url:       d.videoUrl     ?? d.video_url     ?? undefined,
      thumbnail_url:   d.thumbnailUrl ?? d.thumbnail_url ?? undefined,
      duration:        typeof d.duration === "number" ? d.duration : undefined,
      subtitle_url:    d.subtitleUrl  ?? d.subtitle_url  ?? undefined,
      failure_code:    d.failureCode  ?? d.failure_code  ?? undefined,
      failure_message: d.failureMessage ?? d.failure_message ?? undefined,
      error:           d.error ?? null,
    };
  }
}
