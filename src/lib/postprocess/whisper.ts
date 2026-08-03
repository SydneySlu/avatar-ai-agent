import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "../config/env";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = path.join(
  process.cwd(),
  "scripts",
  "generate_subtitles_faster_whisper.py"
);

/** OOM 关键词 */
const OOM_PATTERNS = [
  "mkl_malloc",
  "failed to allocate memory",
  "bad allocation",
  "out of memory",
  "MemoryError",
  "Cannot allocate memory",
];

function isOomError(text: string): boolean {
  const lower = text.toLowerCase();
  return OOM_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function buildUserFriendlySummary(rawErr: string): string {
  if (isOomError(rawErr)) {
    return (
      "faster-whisper 模型加载失败：内存不足。" +
      "请将 WHISPER_MODEL 改为 small，或关闭其他程序后再试。"
    );
  }
  // 只取首行，避免完整 traceback 暴露给前端
  const firstLine = rawErr.split("\n").find((l) => l.trim().length > 0) ?? rawErr;
  return `faster-whisper 失败：${firstLine.trim().slice(0, 200)}`;
}

export interface WhisperSubtitleResult {
  mode: "faster_whisper" | "fallback_uniform";
  transcriptJsonPath?: string;
}

/**
 * 调用 Python faster-whisper 脚本生成 ASS 字幕
 * 失败时抛出带用户友好摘要的 Error，由 runPostprocess 负责 fallback
 */
export async function generateWhisperSubtitles(
  inputVideoPath: string,
  scriptText: string,
  outputAssPath: string,
  jobDir: string
): Promise<WhisperSubtitleResult> {
  const scriptTxtPath = path.join(jobDir, "script.txt");
  const transcriptJsonPath = path.join(jobDir, "transcript.json");
  const whisperErrorLogPath = path.join(jobDir, "whisper-error.log");

  await fs.writeFile(scriptTxtPath, scriptText, "utf-8");

  const python = env.python.path();
  const wCfg = env.whisper;
  const threads = wCfg.cpuThreads();

  const args = [
    SCRIPT_PATH,
    "--video", inputVideoPath,
    "--script", scriptTxtPath,
    "--output-ass", outputAssPath,
    "--output-json", transcriptJsonPath,
    "--model", wCfg.model(),
    "--device", wCfg.device(),
    "--compute-type", wCfg.computeType(),
    "--language", wCfg.language(),
    "--cpu-threads", String(threads),
    "--num-workers", String(wCfg.numWorkers()),
    "--ffmpeg-path", env.ffmpeg.path(),
    "--ffprobe-path", env.ffmpeg.probePath(),
  ];

  // 子进程环境变量：编码 + 线程限制
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    OMP_NUM_THREADS: String(threads),
    MKL_NUM_THREADS: String(threads),
    OPENBLAS_NUM_THREADS: String(threads),
    NUMEXPR_NUM_THREADS: String(threads),
  };
  const proxyUrl = wCfg.proxyUrl();
  if (proxyUrl) {
    childEnv["HTTP_PROXY"] = proxyUrl;
    childEnv["HTTPS_PROXY"] = proxyUrl;
  }

  try {
    const { stdout, stderr } = await execFileAsync(python, args, {
      env: childEnv,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10 * 60 * 1000,
    });

    if (stderr) {
      console.log("[whisper] stderr:", stderr.slice(0, 1200));
    }
    if (stdout) {
      console.log("[whisper] stdout:", stdout.slice(0, 400));
    }

    return { mode: "faster_whisper", transcriptJsonPath };
  } catch (err) {
    // 完整错误写入日志文件，前端只收到摘要
    const rawMsg =
      err instanceof Error
        ? (err.message + "\n" + ((err as NodeJS.ErrnoException & { stderr?: string }).stderr ?? ""))
        : String(err);

    try {
      await fs.writeFile(
        whisperErrorLogPath,
        `[${new Date().toISOString()}]\n${rawMsg}\n`,
        "utf-8"
      );
    } catch {
      // 写日志失败不影响主流程
    }

    const summary = buildUserFriendlySummary(rawMsg);
    console.error("[whisper] 失败:", summary, "| 详情:", whisperErrorLogPath);
    throw new Error(summary);
  }
}
