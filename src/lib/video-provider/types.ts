/**
 * 通用视频生成 Provider 接口
 * 支持 HeyGen、蝉镜等多个 backend，通过 VIDEO_PROVIDER 环境变量切换
 */

export interface CreateVideoOpts {
  scriptText: string;
  /** 蝉镜口型驱动时使用的本地视频文件路径 */
  localVideoPath?: string;
}

export interface NormalizedVideoStatus {
  video_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  video_url?: string;
  preview_url?: string;
  thumbnail_url?: string;
  duration?: number;
  subtitle_url?: string;
  failure_code?: string;
  failure_message?: string;
  error?: string | null;
}

export interface VideoProvider {
  createVideo(opts: CreateVideoOpts): Promise<string>;
  getVideoStatus(videoId: string): Promise<NormalizedVideoStatus>;
}
