import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

export interface PreparePortraitOpts {
  imagePath?: string;
  imageBuffer?: Buffer;
  imageExt?: string;
  outputPath: string;
  width?: number;
  height?: number;
}

/**
 * 将任意比例照片转换为 9:16 竖屏图（与 imageToVideo 同款背景处理）
 * 背景：放大铺满 + 高斯模糊；前景：等比缩放居中完整显示
 * 输出 jpg，供图生视频 start_frame 使用，保证 Kling 不拉伸人物
 */
export async function preparePortraitImage(
  opts: PreparePortraitOpts
): Promise<void> {
  const { outputPath, imageExt = ".jpg" } = opts;
  const width  = opts.width  ?? env.chanjing.screenWidth();
  const height = opts.height ?? env.chanjing.screenHeight();
  const ffmpeg = env.ffmpeg.path();

  let resolvedInputPath: string;
  let tempPath: string | null = null;

  if (opts.imagePath) {
    resolvedInputPath = opts.imagePath;
  } else if (opts.imageBuffer) {
    tempPath = outputPath.replace(/\.[^.]+$/, `_raw${imageExt}`);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, opts.imageBuffer);
    resolvedInputPath = tempPath;
  } else {
    throw new Error("preparePortraitImage: 必须提供 imagePath 或 imageBuffer");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  // 单帧输出为图片（-frames:v 1）
  const filterComplex = [
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},boxblur=20:5[bg]`,
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`,
  ].join(";");

  const args = [
    "-y",
    "-i", resolvedInputPath,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-frames:v", "1",
    "-q:v", "2",        // jpg 质量（2=高质量）
    outputPath,
  ];

  try {
    await execFileAsync(ffmpeg, args, { maxBuffer: 20 * 1024 * 1024 });
    console.log("[preparePortrait] 9:16 图片生成完成", {
      outputPath,
      width,
      height,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`preparePortraitImage ffmpeg 失败：${msg}`);
  } finally {
    if (tempPath) await fs.unlink(tempPath).catch(() => {});
  }
}
