import OpenAI from "openai";
import type { LLMProvider } from "./provider";
import { env } from "../config/env";

/**
 * OpenAI-compatible LLM Provider 实现
 * 通过 baseURL 支持任意 OpenAI 兼容接口（如 DeepSeek、通义千问等）
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      apiKey: env.llm.apiKey(),
      baseURL: env.llm.baseURL(),
    });
    this.model = env.llm.model();
  }

  async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error("LLM 返回内容为空");
      }

      return content.trim();
    } catch (error) {
      throw new Error(
        `LLM 调用失败：${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
