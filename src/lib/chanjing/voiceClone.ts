import { cjRequest } from "./client";
import type { CJVoiceCloneCreateBody, CJVoiceCloneDetail } from "./chanjingSchema";

/**
 * 创建声音克隆任务
 * @returns audioId（声音 ID，用于后续 TTS）
 */
export async function createVoiceClone(
  body: CJVoiceCloneCreateBody
): Promise<string> {
  const audioId = await cjRequest<string>(
    "/open/v1/create_customised_audio",
    {
      method: "POST",
      body: JSON.stringify({
        model_type: "cicada1.0",
        language: "cn",
        ...body,
      }),
    }
  );
  console.log("[chanjing voice] 克隆任务已创建", { audioId });
  return audioId;
}

/**
 * 查询声音克隆状态
 */
export async function getVoiceCloneDetail(
  audioId: string
): Promise<CJVoiceCloneDetail> {
  return cjRequest<CJVoiceCloneDetail>(
    `/open/v1/customised_audio?id=${encodeURIComponent(audioId)}`,
    { method: "GET" }
  );
}

/** 声音克隆状态映射（人类可读） */
export const VOICE_STATUS_LABELS: Record<number, string> = {
  0: "等待制作",
  1: "制作中",
  2: "已完成",
  3: "已过期",
  4: "制作失败",
  99: "已删除",
};
