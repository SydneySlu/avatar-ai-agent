import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

export interface ImageToVideoOpts {
  /** 图片本地路径（与 imageBuffer 二选一）*/
  imagePath?: string;
  /** 图片 Buffer（与 imagePath 二选一）*/
  imageBuffer?: Buffer;
  /** 图片文件扩展名，Buffer 模式时必填，例如 ".jpg" */
  imageExt?: string;
  /** 输出视频路径 */
  outputPath: string;
  /** 视频时长（秒）*/
  durationSeconds: number;
  /** 视频宽度，默认来自 env.chanjing.screenWidth() */
  width?: number;
  /** 视频高度，默认来自 env.chanjing.screenHeight() */
  height?: number;
}

/**
 * 用 ffmpeg 将静态图片生成竖屏 MP4
 *
 * 效果：
 * - 背景层：原图放大铺满 + 高斯模糊
 * - 前景层：原图等比缩放居中叠加
 * - 输出：h264 yuv420p，25fps
 */
export async function imageToVideo(opts: ImageToVideoOpts): Promise<void> {
  const {
    outputPath,
    durationSeconds,
    imageExt = ".jpg",
  } = opts;

  const width  = opts.width  ?? env.chanjing.screenWidth();
  const height = opts.height ?? env.chanjing.screenHeight();
  const ffmpeg = env.ffmpeg.path();

  // 如果传入 buffer，先写临时文件
  let resolvedInputPath: string;
  let tempPath: string | null = null;

  if (opts.imagePath) {
    resolvedInputPath = opts.imagePath;
  } else if (opts.imageBuffer) {
    tempPath = outputPath.replace(/\.[^.]+$/, `_input${imageExt}`);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.writeFile(tempPath, opts.imageBuffer);
    resolvedInputPath = tempPath;
  } else {
    throw new Error("imageToVideo: 必须提供 imagePath 或 imageBuffer");
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  /**
   * filter_complex 说明：
   * [0:v] 复制两份：
   *   bg  = 放大到 W:H（保持比例裁切） + 高斯模糊作背景
   *   fg  = 缩放到适合 W x H 的最大尺寸（保留完整画面）+ 居中叠加
   */
  const filterComplex = [
    // 背景：缩放并裁切铺满，然后模糊
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},boxblur=20:5[bg]`,
    // 前景：等比缩放，使画面完整显示
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg]`,
    // 叠加：前景居中覆盖到背景
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`,
  ].join(";");

  const args = [
    "-y",
    "-loop", "1",
    "-t", String(durationSeconds),
    "-i", resolvedInputPath,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-r", "25",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "fast",
    "-crf", "23",
    "-movflags", "+faststart",
    outputPath,
  ];

  try {
    await execFileAsync(ffmpeg, args, { maxBuffer: 50 * 1024 * 1024 });
    console.log("[imageToVideo] 生成完成", {
      outputPath,
      durationSeconds,
      width,
      height,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`imageToVideo ffmpeg 失败：${msg}`);
  } finally {
    // 清理临时输入文件
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}
