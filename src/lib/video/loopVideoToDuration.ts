import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

async function runFfmpeg(
  ffmpeg: string,
  args: string[],
  desc: string
): Promise<void> {
  try {
    await execFileAsync(ffmpeg, args, { maxBuffer: 200 * 1024 * 1024 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`${desc} ffmpeg 失败：${msg}`);
  }
}

/**
 * Pingpong 循环：正放 + 倒放拼成一个 cycle，再 stream_loop 到目标时长
 * 这样循环点是连续的，避免硬切跳帧
 */
async function loopPingpong(
  ffmpeg: string,
  inputPath: string,
  outputPath: string,
  durationSeconds: number
): Promise<void> {
  const dir = path.dirname(outputPath);
  const reversedPath = path.join(dir, "_reversed.mp4");
  const cyclePath    = path.join(dir, "_cycle.mp4");
  const concatList   = path.join(dir, "_concat.txt");

  try {
    // 1. 生成倒放
    await runFfmpeg(ffmpeg, [
      "-y", "-i", inputPath,
      "-vf", "reverse",
      "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-preset", "fast", "-crf", "23",
      reversedPath,
    ], "pingpong 倒放");

    // 2. concat 正放 + 倒放 为一个 cycle
    await fs.writeFile(
      concatList,
      `file '${inputPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'\nfile '${reversedPath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`
    );
    await runFfmpeg(ffmpeg, [
      "-y", "-f", "concat", "-safe", "0", "-i", concatList,
      "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-preset", "fast", "-crf", "23",
      cyclePath,
    ], "pingpong concat");

    // 3. stream_loop cycle 到目标时长
    await runFfmpeg(ffmpeg, [
      "-y", "-stream_loop", "-1", "-i", cyclePath,
      "-t", String(durationSeconds),
      "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-preset", "fast", "-crf", "23", "-movflags", "+faststart",
      outputPath,
    ], "pingpong loop");

    console.log("[loopVideo] pingpong 循环完成", { outputPath, durationSeconds });
  } finally {
    // 清理中间文件
    await Promise.all([
      fs.unlink(reversedPath).catch(() => {}),
      fs.unlink(cyclePath).catch(() => {}),
      fs.unlink(concatList).catch(() => {}),
    ]);
  }
}

/**
 * Hard loop：直接 stream_loop，循环点可能跳帧
 */
async function loopHard(
  ffmpeg: string,
  inputPath: string,
  outputPath: string,
  durationSeconds: number
): Promise<void> {
  await runFfmpeg(ffmpeg, [
    "-y", "-stream_loop", "-1", "-i", inputPath,
    "-t", String(durationSeconds),
    "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-preset", "fast", "-crf", "23", "-movflags", "+faststart",
    outputPath,
  ], "hard loop");

  console.log("[loopVideo] hard 循环完成", { outputPath, durationSeconds });
}

/**
 * 将短视频循环到目标时长
 * CHANJING_LOOP_MODE=pingpong（默认）| hard
 */
export async function loopVideoToDuration(
  inputPath: string,
  outputPath: string,
  durationSeconds: number
): Promise<void> {
  const ffmpeg   = env.ffmpeg.path();
  const loopMode = env.chanjing.loopMode();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (loopMode === "pingpong") {
    await loopPingpong(ffmpeg, inputPath, outputPath, durationSeconds);
  } else {
    await loopHard(ffmpeg, inputPath, outputPath, durationSeconds);
  }
}
