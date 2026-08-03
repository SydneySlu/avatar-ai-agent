import path from "path";

const DATA_ROOT = path.join(process.cwd(), "data", "postprocess", "jobs");
const PUBLIC_EXPORTS = path.join(process.cwd(), "public", "exports");

export function jobDataDir(jobId: string): string {
  return path.join(DATA_ROOT, jobId);
}

export function jobStatusPath(jobId: string): string {
  return path.join(jobDataDir(jobId), "status.json");
}

export function inputVideoPath(jobId: string): string {
  return path.join(jobDataDir(jobId), "input.mp4");
}

export function bgmFilePath(jobId: string, ext: string): string {
  return path.join(jobDataDir(jobId), `bgm.${ext}`);
}

export function subtitlesFilePath(jobId: string): string {
  return path.join(jobDataDir(jobId), "subtitles.ass");
}

export function mixedVideoPath(jobId: string): string {
  return path.join(jobDataDir(jobId), "mixed.mp4");
}

export function finalVideoFsPath(jobId: string): string {
  return path.join(PUBLIC_EXPORTS, jobId, "final.mp4");
}

/** 前端可访问的相对 URL */
export function finalVideoUrl(jobId: string): string {
  return `/exports/${jobId}/final.mp4`;
}
