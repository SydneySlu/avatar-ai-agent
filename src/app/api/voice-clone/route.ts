import { NextRequest, NextResponse } from "next/server";
import { uploadBufferToCJ } from "@/lib/chanjing/fileUpload";
import { createVoiceClone } from "@/lib/chanjing/voiceClone";

export const dynamic = "force-dynamic";

/**
 * POST /api/voice-clone
 * multipart/form-data: audioFile (mp3/wav), name, previewText
 * 上传音频 → 创建声音克隆任务 → 返回 audioId
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audioFile");
    const name = formData.get("name");
    const previewText = formData.get("previewText");

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { success: false, error: "audioFile 缺失或格式错误" },
        { status: 400 }
      );
    }
    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { success: false, error: "name 不能为空" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const filename = audioFile.name || `voice_${Date.now()}.mp3`;

    // 1. 上传音频文件
    const { fullPath } = await uploadBufferToCJ(buffer, filename, "prompt_audio");

    // 2. 创建声音克隆任务
    const audioId = await createVoiceClone({
      name: name.trim(),
      url: fullPath,
      text: typeof previewText === "string" ? previewText.trim() : "你好，这是声音预览。",
    });

    return NextResponse.json({
      success: true,
      data: { audioId },
    });
  } catch (error) {
    console.error("[API /voice-clone] 错误：", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "声音克隆失败",
      },
      { status: 500 }
    );
  }
}
