import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

const OOM_PATTERNS = [
  "mkl_malloc",
  "failed to allocate memory",
  "bad allocation",
  "out of memory",
  "MemoryError",
];

function isOom(text: string): boolean {
  const lower = text.toLowerCase();
  return OOM_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

/**
 * GET /api/postprocess/whisper-health
 * 检查 faster-whisper 依赖是否就绪，不执行实际转录
 */
export async function GET() {
  const pythonPath = env.python.path();
  const model = env.whisper.model();
  const device = env.whisper.device();
  const computeType = env.whisper.computeType();
  const cpuThreads = env.whisper.cpuThreads();
  const numWorkers = env.whisper.numWorkers();

  const result: {
    pythonPath: string;
    importOk: boolean;
    model: string;
    modelLoadOk: boolean;
    cpuThreads: number;
    numWorkers: number;
    error: string | null;
    recommendation: string | null;
  } = {
    pythonPath,
    importOk: false,
    model,
    modelLoadOk: false,
    cpuThreads,
    numWorkers,
    error: null,
    recommendation: null,
  };

  // 1. 检查 faster_whisper 是否可 import
  try {
    await execFileAsync(pythonPath, ["-c", "import faster_whisper; print('ok')"], {
      timeout: 10_000,
    });
    result.importOk = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300);
    result.error = msg;
    return NextResponse.json({ success: false, data: result });
  }

  // 2. 尝试加载模型（检查内存是否足够）
  const checkScript = [
    "from faster_whisper import WhisperModel",
    `m = WhisperModel('${model}', device='${device}', compute_type='${computeType}', cpu_threads=${cpuThreads}, num_workers=${numWorkers})`,
    "print('model_ok')",
  ].join("; ");

  try {
    const { stdout } = await execFileAsync(pythonPath, ["-c", checkScript], {
      timeout: 60_000,
    });
    if (stdout.includes("model_ok")) result.modelLoadOk = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const shortMsg = msg.slice(0, 400);
    result.error = shortMsg;
    if (isOom(msg)) {
      result.recommendation =
        `当前模型 ${model} 内存不足（mkl_malloc）。` +
        `请将 WHISPER_MODEL 改为 small，或关闭其他程序后再试。`;
    }
  }

  return NextResponse.json({ success: true, data: result });
}
