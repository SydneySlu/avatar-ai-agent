import fs from "fs/promises";
import path from "path";
import { ProxyAgent } from "undici";
import { writeJob, readJob, type JobState } from "./jobStore";
import {
  inputVideoPath,
  bgmFilePath,
  subtitlesFilePath,
  finalVideoFsPath,
  finalVideoUrl,
  jobDataDir,
} from "./paths";
import { generateAss } from "./subtitle";
import { checkFfmpeg, getVideoDuration, mixAndBurnSubtitles } from "./ffmpeg";
import { generateWhisperSubtitles } from "./whisper";
import { convertSrtToAss } from "./srt";
import { env } from "../config/env";

/** 下载文件到本地，支持 HEYGEN_PROXY_URL */
async function downloadToFile(url: string, destPath: string): Promise<void> {
  await fs.mkdir(path.dirname(destPath), { recursive: true });

  const proxyUrl = env.heygen.proxyUrl();
  const fetchOptions: RequestInit & { dispatcher?: ProxyAgent } = {
    cache: "no-store",
  };
  if (proxyUrl) {
    fetchOptions.dispatcher = new ProxyAgent(proxyUrl);
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`下载失败，HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

async function updateStep(
  state: JobState,
  step: string,
  progress: number
): Promise<void> {
  state.step = step;
  state.progress = progress;
  state.status = "running";
  await writeJob(state);
}

/**
 * 后台异步执行后处理管线
 *
 * 字幕优先级：
 *   1. HeyGen subtitle_url（heygen_srt）
 *   2. faster-whisper 本地 ASR（faster_whisper）
 *   3. 均匀字幕兜底（fallback_uniform）
 */
export async function runPostprocess(opts: {
  jobId: string;
  videoUrl: string;
  scriptText: string;
  bgmBuffer: Buffer;
  bgmExt: string;
  bgmVolume: number;
  subtitleUrl?: string;  // HeyGen 返回的 SRT 字幕 URL（可选）
}): Promise<void> {
  const { jobId, videoUrl, scriptText, bgmBuffer, bgmExt, bgmVolume, subtitleUrl } = opts;

  const state = (await readJob(jobId))!;

  try {
    // ── 步骤 0：验证 ffmpeg ───────────────────────────────────────────
    await updateStep(state, "checking_ffmpeg", 5);
    await checkFfmpeg();

    // ── 步骤 1：下载 HeyGen 视频 ─────────────────────────────────────
    await updateStep(state, "downloading_video", 10);
    console.log("[postprocess] 开始下载视频", { jobId, hasVideoUrl: !!videoUrl });
    const inputPath = inputVideoPath(jobId);
    await downloadToFile(videoUrl, inputPath);

    // ── 步骤 2：保存 BGM ─────────────────────────────────────────────
    await updateStep(state, "saving_bgm", 25);
    const bgmPath = bgmFilePath(jobId, bgmExt);
    await fs.mkdir(path.dirname(bgmPath), { recursive: true });
    await fs.writeFile(bgmPath, bgmBuffer);

    // ── 步骤 3：生成字幕（三级优先） ─────────────────────────────────
    const subPath = subtitlesFilePath(jobId);
    const jDir = jobDataDir(jobId);

    if (subtitleUrl) {
      // ── 优先1：HeyGen 原生 SRT ───────────────────────────────────
      await updateStep(state, "downloading_subtitles", 35);
      console.log("[postprocess] 下载 HeyGen 字幕", { jobId, hasSubtitleUrl: !!subtitleUrl });
      const srtPath = path.join(jDir, "heygen.srt");
      await downloadToFile(subtitleUrl, srtPath);
      await convertSrtToAss(srtPath, subPath, { stripPunctuation: true });
      state.subtitleMode = "heygen_srt";
      console.log("[postprocess] 字幕模式: heygen_srt", { jobId });
      await writeJob(state);
    } else {
      // ── 优先2：faster-whisper ASR ────────────────────────────────
      await updateStep(state, "transcribing_audio", 35);

      try {
        await generateWhisperSubtitles(inputPath, scriptText, subPath, jDir);
        state.subtitleMode = "faster_whisper";
        console.log("[postprocess] 字幕模式: faster_whisper", { jobId });
      } catch (whisperErr) {
        const errMsg = whisperErr instanceof Error ? whisperErr.message : String(whisperErr);
        state.whisperError = errMsg.slice(0, 400);

        if (!env.whisper.fallbackEnabled()) {
          throw new Error(`faster-whisper 失败（WHISPER_FALLBACK_ENABLED=false）：${errMsg}`);
        }

        console.warn("[postprocess] faster-whisper 失败，fallback 均匀字幕", {
          jobId,
          error: errMsg.slice(0, 200),
        });

        // ── 兜底3：均匀字幕 ─────────────────────────────────────────
        const duration = await getVideoDuration(inputPath);
        const assContent = generateAss(scriptText, duration);
        await fs.writeFile(subPath, assContent, "utf-8");
        state.subtitleMode = "fallback_uniform";
      }
      await writeJob(state);
    }

    // ── 步骤 4：ffmpeg 混音 + 字幕烧录 ──────────────────────────────
    await updateStep(state, "processing_video", 60);
    const finalPath = finalVideoFsPath(jobId);
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    try {
      await fs.access(finalPath);
      console.log("[postprocess] 输出文件已存在，跳过", { jobId });
    } catch {
      await mixAndBurnSubtitles({
        inputVideo: inputPath,
        bgmFile: bgmPath,
        subtitlesFile: subPath,
        outputFile: finalPath,
        bgmVolume,
      });
    }

    // ── 完成 ─────────────────────────────────────────────────────────
    state.status = "completed";
    state.step = "done";
    state.progress = 100;
    state.finalVideoUrl = finalVideoUrl(jobId);
    await writeJob(state);

    console.log("[postprocess] 完成", { jobId });
  } catch (err) {
    console.error("[postprocess] 失败", { jobId, error: String(err) });
    state.status = "failed";
    state.step = "error";
    state.error = err instanceof Error ? err.message : String(err);
    await writeJob(state);
  }
}
