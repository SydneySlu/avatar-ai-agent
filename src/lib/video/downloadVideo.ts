import fs from "fs/promises";
import path from "path";

/**
 * 下载远程文件到本地（用于蝉镜 AI 创作返回的 output_url）
 */
export async function downloadRemoteFile(
  url: string,
  outputPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `下载远程文件失败 (HTTP ${res.status}): ${url.slice(0, 80)}`
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outputPath, buffer);
  console.log("[downloadVideo] 下载完成", { outputPath, bytes: buffer.length });
}
