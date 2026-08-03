import { cjRequest } from "./client";
import type { CJLipSyncCreateBody, CJLipSyncDetail } from "./chanjingSchema";
import { env } from "../config/env";
import type { NormalizedVideoStatus } from "../video-provider/types";

/**
 * 创建口型驱动视频任务
 * @param videoFileId   上传后的 file_id（service=lip_sync_video）
 * @param scriptText    口播稿文本
 * @param audioManId    克隆声音 ID
 * @returns 视频任务 ID
 */
export async function createLipSync(
  videoFileId: string,
  scriptText: string,
  audioManId: string
): Promise<string> {
  const ttsTextMode = env.chanjing.ttsTextMode();
  const body: CJLipSyncCreateBody = {
    video_file_id: videoFileId,
    screen_width: env.chanjing.screenWidth(),
    screen_height: env.chanjing.screenHeight(),
    model: env.chanjing.lipSyncModel(),
    audio_type: "tts",
    tts_config: {
      text: ttsTextMode === "string" ? scriptText : [scriptText],
      audio_man_id: audioManId,
      speed: 1,
      pitch: 1,
    },
  };

  const videoId = await cjRequest<string>("/open/v1/video_lip_sync/create", {
    method: "POST",
    body: JSON.stringify(body),
  });

  console.log("[chanjing lipSync] 任务已创建", { videoId });
  return videoId;
}

/**
 * 查询口型驱动视频状态
 */
export async function getLipSyncDetail(
  videoId: string
): Promise<CJLipSyncDetail> {
  return cjRequest<CJLipSyncDetail>(
    `/open/v1/video_lip_sync/detail?id=${encodeURIComponent(videoId)}`,
    { method: "GET" }
  );
}

/**
 * 将蝉镜视频状态标准化为通用格式
 */
export function normalizeLipSyncStatus(
  detail: CJLipSyncDetail
): NormalizedVideoStatus {
  const statusMap: Record<number, NormalizedVideoStatus["status"]> = {
    0: "pending",
    10: "processing",
    20: "completed",
    30: "failed",
  };

  const progressMap: Record<number, number> = {
    0: 5,
    10: 50,
    20: 100,
    30: 0,
  };

  return {
    video_id: detail.id,
    status: statusMap[detail.status] ?? "pending",
    progress: progressMap[detail.status] ?? 0,
    video_url: detail.video_url,
    preview_url: detail.preview_url,
    duration: detail.duration,
    error: detail.error_msg ?? null,
  };
}
