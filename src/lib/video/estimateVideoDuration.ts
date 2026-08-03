import { env } from "../config/env";

// 蝉镜文档参考语速：约 234ms/字（即每秒约 4.27 字）
const MS_PER_CHAR = 0.234;
const BASE_BUFFER_SECONDS = 8; // 开场/收尾缓冲

/**
 * 根据口播稿文本估算视频时长（秒）
 * 公式：max(min, ceil(字符数 × 0.234 + 8))
 */
export function estimateVideoDuration(scriptText: string): number {
  // 去除控制标记和空白，只计中文+英文单词
  const cleaned = scriptText
    .replace(/[【\[（(][^】\]）)]*[】\]）)]/g, "") // 控制标记
    .replace(/\s+/g, "")
    .trim();

  const rawSeconds = Math.ceil(cleaned.length * MS_PER_CHAR + BASE_BUFFER_SECONDS);

  const minDur = env.chanjing.minVideoDurationSeconds();
  const maxDur = env.chanjing.maxVideoDurationSeconds();

  return Math.min(maxDur, Math.max(minDur, rawSeconds));
}
