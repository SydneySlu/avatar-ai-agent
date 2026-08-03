/**
 * LLM Provider 抽象接口
 * 方便未来切换到其他 LLM 服务（如 Claude、通义千问等）
 */

export interface LLMProvider {
  /**
   * 生成文本
   * @param systemPrompt 系统提示词
   * @param userPrompt 用户提示词
   * @returns 生成的文本内容
   */
  generateText(systemPrompt: string, userPrompt: string): Promise<string>;
}
