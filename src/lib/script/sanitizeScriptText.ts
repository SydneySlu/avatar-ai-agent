/**
 * 口播稿文本清洗器
 *
 * 清除 LLM 可能输出的控制标记、舞台指令和转义字符，
 * 返回适合 HeyGen 直接朗读的纯文本。
 */

/** 带内容的配对标记，保留内容：【强调】xxx【/强调】→ xxx */
const PAIR_MARKER_RE = /[【\[（(][\/]?(?:强调|重读|停顿|换气)[】\]）)]([\s\S]*?)[【\[（(]\/(?:强调|重读|停顿|换气)[】\]）)]/g;

/** 独立控制词（无内容） */
const STANDALONE_MARKER_RE =
  /[【\[（(][\/]?(?:强调|重读|停顿|换气|pause|break)[】\]）)]/gi;

/** XML/SSML 控制标签 */
const XML_TAG_RE = /<\/?(speak|break|pause|emphasis|prosody)\s*\/?>/gi;

/** 字面量转义换行 */
const ESCAPED_NEWLINE_RE = /\\n\\n|\\n/g;

/** Markdown 粗体 */
const BOLD_RE = /\*\*(.+?)\*\*/g;

/** 合并多余空行（超过2个换行→2个） */
const EXCESS_NEWLINE_RE = /\n{3,}/g;

/** 合并多余空格 */
const EXCESS_SPACE_RE = /[ \t]{2,}/g;

export function sanitizeScriptText(input: string): string {
  let t = input;

  // 1. 带内容配对标记 → 只保留内容
  t = t.replace(PAIR_MARKER_RE, (_match, content: string) => content);

  // 2. 独立控制词 → 删除
  t = t.replace(STANDALONE_MARKER_RE, "");

  // 3. XML/SSML 标签 → 删除
  t = t.replace(XML_TAG_RE, "");

  // 4. 字面量 \n\n / \n → 换行符
  t = t.replace(ESCAPED_NEWLINE_RE, "\n");

  // 5. Markdown 粗体 → 去掉星号，保留内容
  t = t.replace(BOLD_RE, "$1");

  // 6. 清理多余空白
  t = t.replace(EXCESS_NEWLINE_RE, "\n\n");
  t = t.replace(EXCESS_SPACE_RE, " ");
  t = t.trim();

  return t;
}
