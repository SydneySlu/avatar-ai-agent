import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createJob } from "@/lib/postprocess/jobStore";
import { runPostprocess } from "@/lib/postprocess/runPostprocess";

export const dynamic = "force-dynamic";

const ALLOWED_AUDIO_EXTS = ["mp3", "wav", "m4a"];

/**
 * POST /api/postprocess
 * multipart/form-data: videoUrl, scriptText, bgmFile, bgmVolume
 * 立即返回 jobId，后台异步执行
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const videoUrl = formData.get("videoUrl");
    const scriptText = formData.get("scriptText");
    const bgmFile = formData.get("bgmFile");
    const bgmVolumeRaw = formData.get("bgmVolume");

    // 参数校验
    if (!videoUrl || typeof videoUrl !== "string" || !videoUrl.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "videoUrl 无效" },
        { status: 400 }
      );
    }
    if (!scriptText || typeof scriptText !== "string" || !scriptText.trim()) {
      return NextResponse.json(
        { success: false, error: "scriptText 不能为空" },
        { status: 400 }
      );
    }
    if (!bgmFile || !(bgmFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "bgmFile 缺失或格式错误" },
        { status: 400 }
      );
    }

    // 检查音频格式
    const originalName = bgmFile.name ?? "";
    const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_AUDIO_EXTS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `不支持的音频格式：${ext}，支持 mp3/wav/m4a` },
        { status: 400 }
      );
    }

    const subtitleUrlRaw = formData.get("subtitleUrl");
    const subtitleUrl =
      typeof subtitleUrlRaw === "string" && subtitleUrlRaw.startsWith("http")
        ? subtitleUrlRaw
        : undefined;

    const bgmVolume = Math.min(
      1,
      Math.max(0, parseFloat(String(bgmVolumeRaw ?? "0.12")) || 0.12)
    );

    // 读取 BGM 二进制
    const bgmBuffer = Buffer.from(await bgmFile.arrayBuffer());

    // 创建 job
    const jobId = crypto.randomUUID();
    await createJob(jobId);

    // 后台异步执行（不 await）
    void runPostprocess({
      jobId,
      videoUrl,
      scriptText: scriptText.trim(),
      bgmBuffer,
      bgmExt: ext,
      bgmVolume,
      subtitleUrl,
    });

    return NextResponse.json({
      success: true,
      data: { jobId, status: "pending" },
    });
  } catch (error) {
    console.error("[API /postprocess] 错误：", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "创建后处理任务失败",
      },
      { status: 500 }
    );
  }
}
