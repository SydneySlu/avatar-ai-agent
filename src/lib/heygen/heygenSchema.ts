import { z } from "zod";

/**
 * HeyGen API 响应 Schema
 * 根据 HeyGen v2/v3 API 定义
 */

// 创建视频请求体
export const CreateVideoRequestSchema = z.object({
  video_inputs: z.array(
    z.object({
      character: z.object({
        type: z.literal("avatar"),
        avatar_id: z.string(),
        avatar_style: z.enum(["normal", "circle"]).default("normal"),
      }),
      voice: z.object({
        type: z.literal("text"),
        input_text: z.string(),
        voice_id: z.string(),
      }),
    })
  ),
  dimension: z.object({
    width: z.number(),
    height: z.number(),
  }),
  // TODO: 以下字段根据实际 HeyGen API 文档补充
  // test: z.boolean().optional(),
  // title: z.string().optional(),
});

export type CreateVideoRequest = z.infer<typeof CreateVideoRequestSchema>;

// 创建视频响应（HeyGen 成功时 error 为 null，失败时为 object）
export const CreateVideoResponseSchema = z.object({
  data: z.object({
    video_id: z.string(),
  }),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
    })
    .nullable()  // HeyGen 成功时返回 error: null
    .optional(),
});

export type CreateVideoResponse = z.infer<typeof CreateVideoResponseSchema>;

// 规范化视频状态（getVideoStatus 的统一返回结构，兼容 v1/v3 两个接口）
export interface NormalizedVideoStatus {
  video_id: string;
  status: string;
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  subtitle_url?: string;      // HeyGen 原生 SRT 字幕 URL（v3 caption）
  caption_url?: string;       // 同上，兼容不同字段名
  captioned_video_url?: string; // 已烧录字幕的视频 URL（如有）
  video_page_url?: string;    // HeyGen 视频页面链接
  failure_code?: string;      // 失败代码（如 insufficient_credit）
  failure_message?: string;   // 失败详细说明
  error?: string | null;
}

// v1 视频状态响应（用于 fallback）
export const VideoStatusResponseSchema = z.object({
  data: z.object({
    video_id: z.string(),
    status: z.string(), // 放宽为 string，避免未知状态导致 zod 验证失败
    video_url: z.string().optional(),
    error: z.any().optional(), // HeyGen 可能返回 null、string 或 object
    // TODO: 根据实际 API 补充其他字段
    // duration: z.number().optional(),
    // thumbnail_url: z.string().optional(),
  }),
});

export type VideoStatusResponse = z.infer<typeof VideoStatusResponseSchema>;
