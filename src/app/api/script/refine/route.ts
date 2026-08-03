import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadPersona } from "@/lib/persona/loadPersona";
import { buildRefineScriptPrompt } from "@/lib/script/buildRefineScriptPrompt";
import { OpenAIProvider } from "@/lib/llm/openaiProvider";
import { sanitizeScriptText } from "@/lib/script/sanitizeScriptText";

const RequestSchema = z.object({
  currentScript: z.string().min(1, "当前口播稿不能为空").max(3000),
  refineInstruction: z.string().min(1, "优化要求不能为空").max(500),
  eventText: z.string().optional(),
});

/**
 * POST /api/script/refine
 * 基于现有口播稿 + 优化要求，让 LLM 二次改写
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentScript, refineInstruction, eventText } = RequestSchema.parse(body);

    const { persona, personaMd } = await loadPersona();

    const prompt = await buildRefineScriptPrompt({
      persona,
      personaMd,
      currentScript,
      refineInstruction,
      eventText,
    });

    const llmProvider = new OpenAIProvider();
    const raw = await llmProvider.generateText(
      "你是一位专业的短视频口播稿编辑，擅长根据用户反馈对口播稿进行精准改写。",
      prompt
    );

    const scriptText = sanitizeScriptText(raw);

    return NextResponse.json({
      success: true,
      data: {
        scriptText,
        wordCount: scriptText.length,
      },
    });
  } catch (error) {
    console.error("[API /script/refine] 错误：", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "参数校验失败", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "口播稿优化失败",
      },
      { status: 500 }
    );
  }
}
