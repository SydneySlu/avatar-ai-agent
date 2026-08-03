# 交付清单

交付前按以下项目逐一确认。

## 一、relay 端（运营方准备）

- [ ] `data/customers.json` 已创建，包含客户的 appKey → avatarId/voiceId
- [ ] relay 的 `.env` 已配置 `HEYGEN_API_KEY`
- [ ] relay 的 `.env` 已配置 `HEYGEN_AVATAR_ID` / `HEYGEN_VOICE_ID`（可被 customers.json 覆盖）
- [ ] relay 健康检查通过：`GET /health` 返回 `configLoaded:true`
- [ ] relay 已部署到云端或本地代理服务器可访问
- [ ] HEYGEN 余额充足（登录 app.heygen.com 查看）

## 二、avatar 本地端（用户配置）

- [ ] `.env.local` 基于 `.env.customer.example` 创建
- [ ] `LLM_API_KEY` 已填入
- [ ] `RELAY_BASE_URL` 指向正确的 relay 地址
- [ ] `RELAY_APP_KEY` 已填入（与 customers.json 中的 key 一致）
- [ ] `FFMPEG_PATH` 已配置且 ffmpeg 可用
- [ ] `data/persona/persona_pack.json` 已放入客户专属人设
- [ ] `data/persona/persona_pack.md` 已放入（可选，作为主要画像文本）
- [ ] 不包含运营方的真实 HeyGen API Key

## 三、完整链路测试

- [ ] 打开 http://localhost:3000，顶部"系统状态"显示正常
- [ ] Step 1：输入事件，生成口播稿成功
- [ ] Step 2：编辑稿件，AI 优化功能正常
- [ ] Step 3：生成视频，POST /api/videos → relay → HeyGen 成功返回 videoId
- [ ] Step 3：轮询状态，最终 status=completed 且有 video_url
- [ ] Step 4：后处理，上传配乐，生成成片，final.mp4 可下载
- [ ] 字幕来源：检查是 HeyGen 原生 / faster-whisper / fallback_uniform

## 四、HeyGen 余额和配置检查

- [ ] relay `/health` 返回 `hasApiKey: true`
- [ ] relay `/health` 返回 `hasAvatarId: true`
- [ ] relay `/health` 返回 `hasProxy: true/false`（按部署环境）
- [ ] HeyGen API 余额充足（Avatar IV 单次成本高，请确认使用 avatar_iii）

## 五、字幕来源

- [ ] 如果使用 HeyGen native caption：PostProcessPanel 显示"HeyGen 原生时间轴"
- [ ] 如果使用 faster-whisper：Python/模型已配置，WHISPER_FALLBACK_ENABLED 按需设置
- [ ] 如果使用 fallback_uniform：字幕精度较低，已与客户确认

## 六、交付文件清单

客户收到的内容应包含：
```
avatar/
├── .env.customer.example    ← 复制为 .env.local 并填写
├── start-avatar.bat         ← 双击启动
├── data/persona/            ← 已包含客户专属人设
├── docs/deployment-local.md ← 启动指南
└── （项目其他代码）
```

客户不应收到：
- `.env.local`（含运营方 API key）
- `avatar-relay/` 目录（含 HeyGen API key）
