# 数字人口播生成工具 — 本地 MVP 技术规范

## 项目定位

这是一个**本地运行的定制化工具**，专注于以下核心功能：

1. 用户输入新闻/事件文本
2. 系统读取本地 persona 文件
3. LLM 根据 persona 生成 60 秒中文口播稿
4. 用户在页面上编辑脚本
5. 用户点击生成视频
6. 后端调用 HeyGen API，使用环境变量中的 avatar_id 和 voice_id 创建数字人视频
7. 前端轮询视频状态并展示最终 video_url

**不包含的功能**:
- ❌ SaaS 服务
- ❌ 用户登录
- ❌ 微信爬取
- ❌ 自动生成用户画像
- ❌ 数据库
- ❌ 云部署

---

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **LLM**: OpenAI (可通过 provider 接口替换)
- **视频生成**: HeyGen API
- **校验**: Zod
- **样式**: 内联样式（简单工具，无需复杂设计系统）

---

## 目录结构

```
avatar/
├── data/
│   └── persona/
│       ├── persona_pack.json      # 主播人设数据
│       └── persona_pack.md        # 人设补充说明
├── prompts/
│   ├── generate-script.md         # 脚本生成 prompt 模板
│   └── review-script.md           # 脚本审核 prompt（未使用）
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── script/
│   │   │   │   └── route.ts       # POST /api/script
│   │   │   └── videos/
│   │   │       ├── route.ts       # POST /api/videos
│   │   │       └── [videoId]/
│   │   │           └── route.ts   # GET /api/videos/:videoId
│   │   ├── layout.tsx
│   │   └── page.tsx               # 主页
│   ├── components/
│   │   ├── EventInput.tsx         # 事件输入框
│   │   ├── ScriptEditor.tsx       # 脚本编辑器
│   │   └── VideoJobStatus.tsx     # 视频状态跟踪
│   └── lib/
│       ├── config/
│       │   └── env.ts             # 环境变量统一读取
│       ├── persona/
│       │   ├── personaSchema.ts   # Persona 类型定义
│       │   └── loadPersona.ts     # Persona 加载器
│       ├── script/
│       │   ├── scriptSchema.ts    # Script 类型定义
│       │   └── buildScriptPrompt.ts # Prompt 构建器
│       ├── llm/
│       │   ├── provider.ts        # LLM Provider 接口
│       │   └── openaiProvider.ts  # OpenAI 实现
│       └── heygen/
│           ├── heygenSchema.ts    # HeyGen API 类型定义
│           └── client.ts          # HeyGen API 客户端
├── docs/
│   ├── api-contract.md            # API 接口文档
│   └── local-mvp-spec.md          # 本文档
├── .env.example                    # 环境变量示例
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## 核心流程

### 1. 脚本生成流程

```
用户输入事件
  ↓
前端 POST /api/script { eventText }
  ↓
后端：
  1. 加载 persona_pack.json + persona_pack.md
  2. 读取 prompts/generate-script.md 模板
  3. 替换占位符生成完整 prompt
  4. 调用 OpenAI API 生成脚本
  ↓
返回 { scriptText, wordCount, persona }
  ↓
前端展示可编辑脚本
```

### 2. 视频生成流程

```
用户编辑完脚本后点击"生成视频"
  ↓
前端 POST /api/videos { scriptText }
  ↓
后端：
  1. 从环境变量读取 avatar_id、voice_id
  2. 调用 HeyGen POST /v2/video/generate
  3. 返回 video_id
  ↓
返回 { videoId, status: "pending" }
  ↓
前端自动开始轮询 GET /api/videos/:videoId
  ↓
后端调用 HeyGen GET /v1/video_status.get
  ↓
返回 { status, video_url }
  ↓
前端展示视频状态和链接
```

---

## 环境变量

所有敏感配置通过环境变量注入，不允许硬编码。

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `OPENAI_API_KEY` | ✓ | OpenAI API Key |
| `OPENAI_MODEL` | - | OpenAI 模型名（默认 `gpt-4o`）|
| `HEYGEN_API_KEY` | ✓ | HeyGen API Key |
| `HEYGEN_AVATAR_ID` | ✓ | HeyGen 数字人 Avatar ID |
| `HEYGEN_VOICE_ID` | ✓ | HeyGen 声音 Voice ID |
| `HEYGEN_API_BASE_URL` | - | HeyGen API Base URL（默认 `https://api.heygen.com`）|

---

## HeyGen API 说明

### 创建视频

```
POST https://api.heygen.com/v2/video/generate
Headers:
  X-Api-Key: {HEYGEN_API_KEY}
  Content-Type: application/json

Body:
{
  "video_inputs": [
    {
      "character": {
        "type": "avatar",
        "avatar_id": "{HEYGEN_AVATAR_ID}",
        "avatar_style": "normal"
      },
      "voice": {
        "type": "text",
        "input_text": "{scriptText}",
        "voice_id": "{HEYGEN_VOICE_ID}"
      }
    }
  ],
  "dimension": {
    "width": 1080,
    "height": 1920
  }
}

Response:
{
  "data": {
    "video_id": "..."
  }
}
```

### 查询状态

```
GET https://api.heygen.com/v1/video_status.get?video_id={videoId}
Headers:
  X-Api-Key: {HEYGEN_API_KEY}

Response:
{
  "data": {
    "video_id": "...",
    "status": "pending|processing|completed|failed",
    "video_url": "...",  // 仅在 completed 时存在
    "error": "..."       // 仅在 failed 时存在
  }
}
```

---

## TODO 标记说明

代码中使用 `TODO` 标记了以下不确定的 API 字段：

1. **HeyGen 创建视频 API**:
   - `test`、`title` 等可选字段未确认，需根据实际文档补充

2. **HeyGen 视频状态 API**:
   - `duration`、`thumbnail_url` 等字段未确认

在实际部署前，请参考 [HeyGen 官方文档](https://docs.heygen.com/) 确认这些字段。

---

## 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入真实 API Key 和 ID

# 3. 启动开发服务器
npm run dev

# 4. 打开浏览器
# http://localhost:3000
```

---

## 测试说明

- **脚本生成**: 需要真实 `OPENAI_API_KEY` 才能测试
- **视频生成**: 需要真实 `HEYGEN_API_KEY`、`HEYGEN_AVATAR_ID`、`HEYGEN_VOICE_ID` 才能测试
- **前端交互**: 可以在不配置环境变量的情况下测试 UI 交互，但 API 调用会失败

---

## 扩展方向

如果未来需要扩展功能，可以考虑：

1. **多 LLM Provider**: 在 `src/lib/llm/` 下添加 `claudeProvider.ts`、`qianwenProvider.ts` 等
2. **脚本审核**: 使用 `prompts/review-script.md` 实现二次审核流程
3. **批量生成**: 支持上传 CSV 批量生成视频
4. **视频管理**: 添加本地 SQLite 存储历史视频记录
5. **自定义 Persona**: 允许用户在页面上切换或编辑 persona

但在 MVP 阶段，保持简单是首要原则。
