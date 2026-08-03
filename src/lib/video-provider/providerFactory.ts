import { env } from "../config/env";
import type { VideoProvider } from "./types";

/**
 * 获取当前激活的视频生成 Provider
 * 通过 VIDEO_PROVIDER 环境变量切换：relay（默认）| heygen | chanjing
 */
export function getVideoProvider(): VideoProvider {
  const provider = env.videoProvider();

  if (provider === "relay") {
    const { RelayProvider } = require("../relay/relayProvider");
    return new RelayProvider() as VideoProvider;
  }

  if (provider === "heygen") {
    const { HeyGenClient } = require("../heygen/client");
    const client = new HeyGenClient();
    return {
      createVideo: async (opts) => client.createVideo(opts.scriptText),
      getVideoStatus: async (videoId) => client.getVideoStatus(videoId),
    } satisfies VideoProvider;
  }

  if (provider === "chanjing") {
    const { ChanjingProvider } = require("../chanjing/chanjingProvider");
    return new ChanjingProvider() as VideoProvider;
  }

  throw new Error(
    `不支持的 VIDEO_PROVIDER: ${provider}。可选值: relay, heygen, chanjing`
  );
}
