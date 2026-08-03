# Relay 中转架构说明

本文档说明"本地软件 + 云端中转后端"的部署架构。

---

## 架构概览

```
用户本地
  └── 本地 Web App（Next.js）
        ├── 脚本生成（DeepSeek / 任意 LLM）
        ├── 脚本优化（AI Refine）
        ├── 视频生成 → POST /v1/videos → Relay Backend
        ├── 视频状态轮询 → GET /v1/videos/{id} → Relay Backend
        └── 后处理（ffmpeg 本地混音+字幕）

云端 Relay Backend（不含密钥的中转服务）
  └── 接收本地请求 → 调用 HeyGen API → 返回结果
```

---

## 职责划分

### 本地软件（Local App）

- 用户直接操作的 UI 界面
- 脚本生成、脚本优化（LLM 调用）
- 发起视频创建请求（通过 Relay）
- 轮询视频状态
- 本地后处理：ffmpeg 混音、字幕烧录、配乐合并
- 不直接持有 HeyGen API key

### 云端 Relay Backend

- 持有 HeyGen API key，部署在可访问 HeyGen 的服务器
- 接收本地 App 的请求（带 RELAY_APP_KEY 鉴权）
- 转发到 HeyGen，返回 video_id / 状态
- 对本地 App 屏蔽了 HeyGen API 的地理限制问题
- 可选：记录使用量、限速、多租户管理

---

## 为什么用户不需要代理

HeyGen API 在国内有访问限制。过去方案：

> 用户本地配置 HTTP_PROXY → 请求经代理出去 → 访问 HeyGen

新方案：

> 用户本地 App 请求 Relay（国内可访问的中转服务）
> Relay 部署在可直连 HeyGen 的节点（香港/新加坡等）
> 用户不需要自己管理代理或 VPN

---

## 为什么用户不直接管理 HeyGen API key

传统 SaaS 要求每个用户注册 HeyGen、充值、管理 API key，门槛高。

Relay 架构：

- 运营方统一持有 HeyGen 账户和 API key
- Relay Backend 根据 RELAY_APP_KEY 鉴权每个用户
- 用户只需要一个 RELAY_APP_KEY（简单，可随时吊销）
- 成本由运营方统一管控

---

## 本地环境变量配置

```env
# 视频生成 Provider
VIDEO_PROVIDER=relay

# Relay 服务地址（运营方提供）
RELAY_BASE_URL=https://relay.yourservice.com

# Relay App Key（运营方分配给用户）
RELAY_APP_KEY=your_relay_app_key
```

开发调试时可以在本地运行 Relay Backend：

```env
RELAY_BASE_URL=http://localhost:8787
RELAY_APP_KEY=dev_key
```

---

## Relay API 接口约定

### 创建视频

```
POST /v1/videos
Authorization: Bearer {RELAY_APP_KEY}
Content-Type: application/json

{
  "scriptText": "口播稿...",
  "aspectRatio": "9:16"
}

→ {
  "data": { "videoId": "..." }
}
```

### 查询状态

```
GET /v1/videos/{videoId}
Authorization: Bearer {RELAY_APP_KEY}

→ {
  "data": {
    "videoId": "...",
    "status": "pending|processing|completed|failed",
    "videoUrl": "...",
    "subtitleUrl": "...",
    "failureCode": "...",
    "failureMessage": "..."
  }
}
```

---

## 后续 Electron 封装路径

当前架构（Web App in Browser）已经支持：

```
浏览器 → Next.js Dev Server → Relay / LLM API
```

Electron 封装后（目标架构）：

```
Electron 主进程
  └── 内嵌 Next.js Server（或预编译静态 + API Routes）
        └── 与当前 Web App 完全一致
用户双击桌面图标即可使用
无需浏览器，无需安装 Node.js
```

关键优势：
- 本地文件系统访问（ffmpeg、字幕文件、导出目录）
- 无跨域限制
- 可通过自动更新推送新版本
- 不需要用户开终端 `npm run dev`
