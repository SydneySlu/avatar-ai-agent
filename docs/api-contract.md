# 数字人口播生成工具 — API 接口文档

## 概述

本文档定义了数字人口播生成工具的 API 接口规范。

---

## 1. 生成口播稿

**端点**: `POST /api/script`

**描述**: 根据用户输入的新闻/事件内容，结合主播人设，使用 LLM 生成 60 秒中文口播稿。

### 请求

```typescript
{
  eventText: string; // 新闻/事件描述，不能为空
}
```

### 响应

**成功 (200)**:

```typescript
{
  success: true;
  data: {
    scriptText: string;    // 生成的口播稿
    wordCount: number;     // 字数
    persona: {
      id: string;
      name: string;
    };
  };
}
```

**失败 (400/500)**:

```typescript
{
  success: false;
  error: string;         // 错误描述
  details?: any;         // Zod 校验错误时包含详细信息
}
```

---

## 2. 创建视频任务

**端点**: `POST /api/videos`

**描述**: 提交口播稿给 HeyGen，创建数字人视频生成任务。

### 请求

```typescript
{
  scriptText: string; // 口播稿内容，不能为空
}
```

### 响应

**成功 (200)**:

```typescript
{
  success: true;
  data: {
    videoId: string;     // HeyGen 返回的 video_id
    status: string;      // "pending"
    message: string;
  };
}
```

**失败 (400/500)**:

```typescript
{
  success: false;
  error: string;
  details?: any;
}
```

---

## 3. 查询视频状态

**端点**: `GET /api/videos/{videoId}`

**描述**: 根据 video_id 查询 HeyGen 视频生成状态。

### 路径参数

- `videoId` (string, required): HeyGen 返回的 video_id

### 响应

**成功 (200)**:

```typescript
{
  success: true;
  data: {
    video_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    video_url?: string;    // 仅在 status === "completed" 时存在
    error?: string;        // 仅在 status === "failed" 时存在
  };
}
```

**失败 (400/500)**:

```typescript
{
  success: false;
  error: string;
}
```

---

## 错误处理

所有 API 均采用统一错误格式：

- **400 Bad Request**: 参数校验失败
- **500 Internal Server Error**: 服务端错误（LLM 调用失败、HeyGen API 失败等）

前端应根据 `success` 字段判断请求是否成功，并展示 `error` 信息给用户。
