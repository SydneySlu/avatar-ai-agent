/**
 * 统一环境变量读取与校验
 * 在此处集中检查所有必需的环境变量，避免在业务代码中散落 process.env
 */

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `缺少环境变量 ${key}。请复制 .env.example 为 .env.local 并填入真实值。`
    );
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  /**
   * LLM 配置 — 支持任意 OpenAI-compatible 接口
   * 优先级：LLM_* > OPENAI_* > 默认值
   */
  llm: {
    apiKey: () => {
      const key = process.env["LLM_API_KEY"] || process.env["OPENAI_API_KEY"];
      if (!key) {
        throw new Error(
          "缺少 LLM API Key。请在 .env.local 中设置 LLM_API_KEY 或 OPENAI_API_KEY。"
        );
      }
      return key;
    },
    model: () =>
      optionalEnv("LLM_MODEL", optionalEnv("OPENAI_MODEL", "gpt-4o")),
    baseURL: () =>
      optionalEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
    maxTokens: (): number => {
      const v = parseInt(optionalEnv("LLM_MAX_TOKENS", "8192"), 10);
      return isNaN(v) || v <= 0 ? 8192 : v;
    },
    temperature: (): number => {
      const v = parseFloat(optionalEnv("LLM_TEMPERATURE", "0.7"));
      return isNaN(v) ? 0.7 : v;
    },
    thinkingMode: (): "auto" | "enabled" | "disabled" => {
      const v = optionalEnv("LLM_THINKING_MODE", "auto");
      if (v === "enabled" || v === "disabled") return v;
      return "auto";
    },
    reasoningEffort: () => optionalEnv("LLM_REASONING_EFFORT", "high"),
  },
  heygen: {
    apiKey: () => requireEnv("HEYGEN_API_KEY"),
    /**
     * HeyGen Create Video 使用的 avatar look id（不是 avatar group id）。
     * 可通过 GET /api/heygen/avatar-looks 查看当前账号的可用 look id。
     */
    avatarId: () => requireEnv("HEYGEN_AVATAR_ID"),
    voiceId: () => requireEnv("HEYGEN_VOICE_ID"),
    baseUrl: () =>
      optionalEnv("HEYGEN_API_BASE_URL", "https://api.heygen.com"),
    /** 代理地址，留空则不使用代理，例如 http://127.0.0.1:7897 */
    proxyUrl: (): string | undefined => process.env["HEYGEN_PROXY_URL"] || undefined,
    /** 请求超时毫秒数，默认 30000 */
    requestTimeoutMs: (): number => {
      const val = process.env["HEYGEN_REQUEST_TIMEOUT_MS"];
      const parsed = val ? parseInt(val, 10) : NaN;
      return isNaN(parsed) ? 30000 : parsed;
    },
    /**
     * 创建视频模式：
     * "v3_caption" = 使用 /v3/videos，可获取 subtitle_url（默认）
     * "v2_legacy"  = 直接使用 /v2/video/generate，便宜稳定，无原生字幕
     */
    createMode: () => optionalEnv("HEYGEN_CREATE_MODE", "v3_caption"),
    /**
     * Avatar 引擎版本（显式指定，避免 v3 默认升级到 Avatar IV 产生额外成本）
     * 可选值：avatar_iii、avatar_iv、avatar_v
     * 默认 avatar_iii（便宜稳定）
     */
    avatarEngine: () => optionalEnv("HEYGEN_AVATAR_ENGINE", "avatar_iii"),
    /** 是否请求 HeyGen 原生 caption SRT（默认 true，仅在 v3_caption 模式下生效） */
    enableNativeCaption: () =>
      process.env["HEYGEN_ENABLE_NATIVE_CAPTION"] !== "false",
  },
  /** 当前视频生成 Provider："relay"（默认）| "heygen" | "chanjing" */
  videoProvider: () => optionalEnv("VIDEO_PROVIDER", "relay"),
  relay: {
    /** Relay 中转服务地址 */
    baseUrl: () => optionalEnv("RELAY_BASE_URL", "http://localhost:8787"),
    /** Relay 服务 App Key */
    appKey: () => optionalEnv("RELAY_APP_KEY", "dev_key"),
  },
  chanjing: {
    baseUrl: () => optionalEnv("CHANJING_BASE_URL", "https://open-api.chanjing.cc"),
    appId: () => requireEnv("CHANJING_APP_ID"),
    secretKey: () => requireEnv("CHANJING_SECRET_KEY"),
    /** 已克隆的声音 ID（用于 TTS 口型驱动） */
    audioManId: () => requireEnv("CHANJING_AUDIO_MAN_ID"),
    /** 口型驱动模型，0=默认 */
    lipSyncModel: () => parseInt(optionalEnv("CHANJING_LIP_SYNC_MODEL", "0"), 10),
    screenWidth: () => parseInt(optionalEnv("CHANJING_SCREEN_WIDTH", "1080"), 10),
    screenHeight: () => parseInt(optionalEnv("CHANJING_SCREEN_HEIGHT", "1920"), 10),
    /** TTS text 参数格式："array"（默认）或 "string" */
    ttsTextMode: (): "array" | "string" =>
      optionalEnv("CHANJING_TTS_TEXT_MODE", "array") === "string" ? "string" : "array",
    /** 文件上传后同步等待时长（ms），默认 3000，设为 0 禁用 */
    uploadSyncDelayMs: () =>
      parseInt(optionalEnv("CHANJING_UPLOAD_SYNC_DELAY_MS", "3000"), 10),
    /** 生成视频最短时长（秒），默认 60 */
    minVideoDurationSeconds: () =>
      parseInt(optionalEnv("CHANJING_MIN_VIDEO_DURATION_SECONDS", "60"), 10),
    /** 生成视频最长时长（秒），默认 180 */
    maxVideoDurationSeconds: () =>
      parseInt(optionalEnv("CHANJING_MAX_VIDEO_DURATION_SECONDS", "180"), 10),
    /**
     * 底图视频生成模式：
     * "static"  = 照片静态转 MP4（快速）
     * "ai_i2v"  = 先图生视频(Kling)，再口型驱动（效果更好）
     */
    sourceVideoMode: () => optionalEnv("CHANJING_SOURCE_VIDEO_MODE", "ai_i2v"),
    /** 图生视频模型代码 */
    i2vModelCode: () =>
      optionalEnv("CHANJING_I2V_MODEL_CODE", "tx_kling-v3-0-image2video"),
    /** 图生视频时长（秒） */
    i2vDurationSeconds: () =>
      parseInt(optionalEnv("CHANJING_I2V_DURATION_SECONDS", "15"), 10),
    /** 图生视频分辨率 */
    i2vClarity: () =>
      parseInt(optionalEnv("CHANJING_I2V_CLARITY", "1080"), 10),
    /** 图生视频提示词（固定机位，无推拉变焦，人物轻微动作） */
    i2vPrompt: () =>
      optionalEnv(
        "CHANJING_I2V_PROMPT",
        "固定机位，焦距不变，不要推拉镜头，不要变焦，不要裁切人物。人物保持身份一致，自然看向镜头，头部轻微自然摆动，肩膀和上半身有轻微呼吸感，表情自然，嘴部自然闭合，不要说话，不要大幅度动作，不要变脸，不要多人，不要文字，不要水印。"
      ),
    /** 视频循环模式：pingpong（默认，无跳帧）| hard */
    loopMode: (): "pingpong" | "hard" =>
      optionalEnv("CHANJING_LOOP_MODE", "pingpong") === "hard" ? "hard" : "pingpong",
  },
  ffmpeg: {
    /** ffmpeg 可执行文件路径，默认从系统 PATH 查找 */
    path: () => optionalEnv("FFMPEG_PATH", "ffmpeg"),
    /** ffprobe 可执行文件路径，默认从系统 PATH 查找 */
    probePath: () => optionalEnv("FFPROBE_PATH", "ffprobe"),
  },
  python: {
    /** Python 可执行文件路径，建议指向 .venv/Scripts/python.exe */
    path: () => optionalEnv("PYTHON_PATH", "python"),
  },
  whisper: {
    /** faster-whisper 模型大小。small=推荐本地 MVP，medium=精度更高但内存占用大 */
    model: () => optionalEnv("WHISPER_MODEL", "small"),
    device: () => optionalEnv("WHISPER_DEVICE", "cpu"),
    computeType: () => optionalEnv("WHISPER_COMPUTE_TYPE", "int8"),
    language: () => optionalEnv("WHISPER_LANGUAGE", "zh"),
    mode: () => optionalEnv("WHISPER_MODE", "faster_whisper"),
    proxyUrl: (): string | undefined =>
      process.env["WHISPER_PROXY_URL"] ||
      process.env["HTTPS_PROXY"] ||
      process.env["HTTP_PROXY"] ||
      undefined,
    fallbackEnabled: (): boolean =>
      optionalEnv("WHISPER_FALLBACK_ENABLED", "true") !== "false",
    /** CPU 推理线程数，减少可降低内存占用 */
    cpuThreads: (): number =>
      parseInt(optionalEnv("WHISPER_CPU_THREADS", "2"), 10),
    /** 并发 worker 数，设为 1 可节省内存 */
    numWorkers: (): number =>
      parseInt(optionalEnv("WHISPER_NUM_WORKERS", "1"), 10),
  },
} as const;
