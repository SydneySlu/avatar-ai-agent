import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

/** 验证 ffmpeg 可用，不可用时抛出可读错误 */
export async function checkFfmpeg(): Promise<void> {
  const ffmpeg = env.ffmpeg.path();
  try {
    await execFileAsync(ffmpeg, ["-version"]);
  } catch {
    throw new Error(
      `ffmpeg 未找到（路径：${ffmpeg}）。` +
        `请安装 ffmpeg 并在 .env.local 中设置 FFMPEG_PATH，或确保 ffmpeg 在系统 PATH 中。`
    );
  }
}

/** 用 ffprobe 获取视频时长（秒） */
export async function getVideoDuration(inputPath: string): Promise<number> {
  const ffprobe = env.ffmpeg.probePath();
  try {
    const { stdout } = await execFileAsync(ffprobe, [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      inputPath,
    ]);
    const info = JSON.parse(stdout) as { format?: { duration?: string } };
    const duration = parseFloat(info.format?.duration ?? "");
    if (isNaN(duration)) throw new Error("无法解析视频时长");
    return duration;
  } catch (err) {
    throw new Error(
      `ffprobe 获取视频时长失败：${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export interface MixOptions {
  inputVideo: string;
  bgmFile: string;
  subtitlesFile: string;
  outputFile: string;
  bgmVolume: number;
}

/**
 * 混音 + 烧录字幕
 *
 * Windows 路径转义策略：
 * 将 cwd 设为字幕文件所在目录，ass filter 只传文件名。
 * 这样完全避免 Windows 绝对路径在 filtergraph 字符串中的转义问题。
 */
export async function mixAndBurnSubtitles(opts: MixOptions): Promise<void> {
  const ffmpeg = env.ffmpeg.path();
  const { inputVideo, bgmFile, subtitlesFile, outputFile, bgmVolume } = opts;

  // 只取文件名，cwd 指向字幕目录
  const subsDir = path.dirname(subtitlesFile);
  const subsFilename = path.basename(subtitlesFile); // e.g. "subtitles.ass"

  const args = [
    "-y",
    "-i", inputVideo,
    "-stream_loop", "-1", "-i", bgmFile,
    "-filter_complex",
    [
      "[0:a]aformat=sample_rates=44100:channel_layouts=stereo[voice]",
      `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${bgmVolume}[bgm]`,
      "[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]",
      // 只传文件名，由 cwd 定位，避免 Windows 路径转义问题
      `[0:v]ass='${subsFilename}'[vout]`,
    ].join(";"),
    "-map", "[vout]",
    "-map", "[aout]",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    outputFile,
  ];

  try {
    await execFileAsync(ffmpeg, args, {
      cwd: subsDir,              // ← 关键：让 ffmpeg 在字幕所在目录运行
      maxBuffer: 100 * 1024 * 1024,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`ffmpeg 处理失败：${msg}`);
  }
}
