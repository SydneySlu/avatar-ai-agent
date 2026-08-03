import type { VideoProvider, CreateVideoOpts, NormalizedVideoStatus } from "../video-provider/types";
import { uploadFileToCJ } from "./fileUpload";
import { createLipSync, getLipSyncDetail, normalizeLipSyncStatus } from "./lipSync";
import { env } from "../config/env";

/**
 * 蝉镜视频 Provider 实现
 * 第一阶段：通过口型驱动（video + TTS）生成视频
 */
export class ChanjingProvider implements VideoProvider {
  async createVideo(opts: CreateVideoOpts): Promise<string> {
    const { scriptText, localVideoPath } = opts;
    const audioManId = env.chanjing.audioManId();

    if (!localVideoPath) {
      throw new Error(
        "蝉镜 Provider 第一阶段需要提供 localVideoPath（本地数字人视频文件）。"
      );
    }

    // 1. 上传视频文件
    console.log("[chanjing provider] 上传视频文件", { localVideoPath });
    const { fileId } = await uploadFileToCJ(localVideoPath, "lip_sync_video");

    // 2. 创建口型驱动任务
    const videoId = await createLipSync(fileId, scriptText, audioManId);
    return videoId;
  }

  async getVideoStatus(videoId: string): Promise<NormalizedVideoStatus> {
    const detail = await getLipSyncDetail(videoId);
    return normalizeLipSyncStatus(detail);
  }
}
