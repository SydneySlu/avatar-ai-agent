import { cjRequest } from "./client";
import { env } from "../config/env";

/**
 * 蝉镜 AI 创作模块
 * 支持图生视频（Image to Video）
 */

// ─── 任务提交 ─────────────────────────────────────────────────────────────────

export interface I2VTaskParams {
  /** 起始帧图片 URL（蝉镜文件 full_path） */
  startFrameUrl: string;
  /** 动作/风格提示词 */
  prompt?: string;
  /** 视频时长（秒） */
  durationSeconds?: number;
  /** 输出分辨率（如 1080） */
  clarity?: number;
  /** 模型代码 */
  modelCode?: string;
}

export async function submitImageToVideoTask(
  params: I2VTaskParams
): Promise<string> {
  const {
    startFrameUrl,
    prompt,
    durationSeconds,
    clarity,
    modelCode,
  } = params;

  const body = {
    start_frame: startFrameUrl,
    ref_prompt: prompt ?? env.chanjing.i2vPrompt(),
    creation_type: 4,                             // 4 = 图生视频
    aspect_ratio: "9:16",
    clarity: clarity ?? env.chanjing.i2vClarity(),
    video_duration: durationSeconds ?? env.chanjing.i2vDurationSeconds(),
    model_code: modelCode ?? env.chanjing.i2vModelCode(),
  };

  const uniqueId = await cjRequest<string>(
    "/open/v1/ai_creation/task/submit",
    { method: "POST", body: JSON.stringify(body) }
  );

  console.log("[chanjing aiCreation] 任务已提交", { uniqueId });
  return uniqueId;
}

// ─── 任务查询 ─────────────────────────────────────────────────────────────────

export interface CJAiCreationTaskDetail {
  unique_id?: string;
  progress_desc?: string;
  err_msg?: string;
  output_url?: string[];
}

export async function getAiCreationTask(
  uniqueId: string
): Promise<CJAiCreationTaskDetail> {
  return cjRequest<CJAiCreationTaskDetail>(
    `/open/v1/ai_creation/task?unique_id=${encodeURIComponent(uniqueId)}`,
    { method: "GET" }
  );
}

// ─── 轮询直到完成 ─────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS  = 5_000;
const POLL_TIMEOUT_MS   = 10 * 60 * 1000; // 10 分钟

const SUCCESS_STATES = new Set(["Success"]);
const FAILURE_STATES = new Set(["Error", "Fail", "Cancelled"]);

export async function pollAiCreationTask(uniqueId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const detail = await getAiCreationTask(uniqueId);
    const desc = detail.progress_desc ?? "";
    const hasOutput = Array.isArray(detail.output_url) && detail.output_url.length > 0;

    console.log("[chanjing aiCreation] 轮询", {
      uniqueId,
      progressDesc: desc,
      hasOutputUrl: hasOutput,
    });

    if (SUCCESS_STATES.has(desc) && hasOutput) {
      return detail.output_url![0];
    }

    if (FAILURE_STATES.has(desc)) {
      throw new Error(
        `蝉镜 AI 创作任务失败: uniqueId=${uniqueId} progress_desc=${desc} err_msg=${detail.err_msg ?? "-"}`
      );
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    `蝉镜 AI 创作任务超时（${POLL_TIMEOUT_MS / 60000} 分钟）: uniqueId=${uniqueId}`
  );
}
