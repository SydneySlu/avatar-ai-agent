import fs from "fs/promises";
import { jobDataDir, jobStatusPath } from "./paths";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobState {
  jobId: string;
  status: JobStatus;
  step: string;
  progress: number; // 0–100
  finalVideoUrl?: string;
  error?: string;
  subtitleMode?: "heygen_srt" | "faster_whisper" | "fallback_uniform";
  whisperError?: string;
  createdAt: string;
  updatedAt: string;
}

export async function createJob(jobId: string): Promise<JobState> {
  await fs.mkdir(jobDataDir(jobId), { recursive: true });

  const state: JobState = {
    jobId,
    status: "pending",
    step: "created",
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await writeJob(state);
  return state;
}

export async function writeJob(state: JobState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await fs.writeFile(
    jobStatusPath(state.jobId),
    JSON.stringify(state, null, 2),
    "utf-8"
  );
}

export async function readJob(jobId: string): Promise<JobState | null> {
  try {
    const content = await fs.readFile(jobStatusPath(jobId), "utf-8");
    return JSON.parse(content) as JobState;
  } catch {
    return null;
  }
}
