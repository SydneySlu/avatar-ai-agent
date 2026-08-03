import type { VideoProvider, CreateVideoOpts, NormalizedVideoStatus } from "../video-provider/types";
import { RelayClient } from "./client";

/**
 * Relay VideoProvider 实现
 * 委托给云端中转服务，用户无需持有 HeyGen API key
 */
export class RelayProvider implements VideoProvider {
  private client: RelayClient;

  constructor() {
    this.client = new RelayClient();
  }

  async createVideo(opts: CreateVideoOpts): Promise<string> {
    return this.client.createVideo(opts.scriptText);
  }

  async getVideoStatus(videoId: string): Promise<NormalizedVideoStatus> {
    return this.client.getVideoStatus(videoId);
  }
}
