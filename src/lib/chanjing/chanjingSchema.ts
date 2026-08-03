/**
 * 蝉镜 API 通用响应结构和类型定义
 */

/** 所有蝉镜 API 响应的包装结构 */
export interface CJApiResponse<T> {
  code: number;      // 0 = 成功
  msg: string;
  trace_id?: string;
  data: T;
}

// ─── AccessToken ──────────────────────────────────────────────────────────────

export interface CJTokenData {
  access_token: string;
  expire_in: number; // 过期时间（秒，相对于当前时刻）
}

// ─── 文件上传 ──────────────────────────────────────────────────────────────────

export type CJUploadService =
  | "prompt_audio"
  | "lip_sync_video"
  | "lip_sync_audio"
  | "ai_creation";

export interface CJUploadUrlData {
  sign_url: string;  // PUT 目标地址
  full_path: string; // 上传后的文件路径（传给后续接口）
  file_id: string;
  mime_type: string;
}

// ─── 声音克隆 ──────────────────────────────────────────────────────────────────

export interface CJVoiceCloneCreateBody {
  name: string;
  url: string;       // full_path from upload
  model_type?: string; // 默认 "cicada1.0"
  language?: string;   // 默认 "cn"
  text?: string;       // 预览文本
  callback?: string;
}

export interface CJVoiceCloneDetail {
  id: string;
  name: string;
  status: 0 | 1 | 2 | 3 | 4 | 99; // 0等待 1制作中 2完成 3过期 4失败 99删除
  model_type: string;
  language: string;
}

// ─── 口型驱动 ──────────────────────────────────────────────────────────────────

export interface CJLipSyncTtsConfig {
  text: string | string[];
  audio_man_id: string;
  speed?: number;
  pitch?: number;
}

export interface CJLipSyncCreateBody {
  video_file_id: string;
  screen_width?: number;
  screen_height?: number;
  model?: number;
  audio_type: "tts";
  tts_config: CJLipSyncTtsConfig;
}

export interface CJLipSyncDetail {
  id: string;
  status: 0 | 10 | 20 | 30; // 0排队 10生成中 20成功 30失败
  video_url?: string;
  preview_url?: string;
  duration?: number;
  error_msg?: string;
}

// ─── 错误 code 说明 ────────────────────────────────────────────────────────────
// 10400 = token 失效，需要刷新
// 40000 = 参数错误
// 40001 = 未授权 / 权限不足
