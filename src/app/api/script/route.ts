import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadPersona } from "@/lib/persona/loadPersona";
import { buildScriptPrompt } from "@/lib/script/buildScriptPrompt";
import { OpenAIProvider } from "@/lib/llm/openaiProvider";
import { sanitizeScriptText } from "@/lib/script/sanitizeScriptText";

const RequestSchema = z.object({
  eventText: z.string().min(1, "事件内容不能为空"),
});

/**
 * POST /api/script
 * 根据事件内容生成口播稿
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 参数校验
    const body = await request.json();
    const { eventText } = RequestSchema.parse(body);

    // 2. 加载主播人设
    const { persona, personaMd } = await loadPersona();

    // 3. 构建 LLM prompt
    const prompt = await buildScriptPrompt(persona, personaMd, eventText);

    // 4. 调用 LLM 生成脚本，并清洗控制标记
    const llmProvider = new OpenAIProvider();
    const rawScriptText = await llmProvider.generateText(
      "你是一位专业的口播稿撰写专家。",
      prompt
    );
    const scriptText = sanitizeScriptText(rawScriptText);

    // 5. 返回生成的脚本
    return NextResponse.json({
      success: true,
      data: {
        scriptText,
        wordCount: scriptText.length,
        persona: {
          id: persona.id,
          name: persona.name,
        },
      },
    });
  } catch (error) {
    console.error("[API /script] 错误：", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "参数校验失败",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "生成脚本失败",
      },
      { status: 500 }
    );
  }
}
