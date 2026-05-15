# OSS Media Plus

`OSS Media Plus` 是一个基于 `React + Vite + TypeScript` 构建的阿里云 OSS 媒体工作台，聚焦图片预览、音视频在线播放和视频在线播放。

## 已实现能力

- 本地保存 OSS 配置
- 连接阿里云 OSS 并加载媒体文件
- 自动识别图片、音频、视频类型
- 图片卡片预览与大图查看
- 音频在线播放
- 视频在线播放
- 自定义时间轴，支持拖拽进度条
- 媒体类型筛选
- 目录浏览、创建文件夹
- 移动文件到指定目录
- 归档/冷归档/深度归档对象一键发起解冻（RestoreObject）

## 技术栈

- React 18
- Vite 5
- TypeScript
- Zustand
- ali-oss
- lucide-react

## 本地启动

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
```

## OSS 配置说明

需要填写以下信息：

1. `Region`
2. `Bucket`
3. `AccessKeyId`
4. `AccessKeySecret`
5. `媒体根目录`（可选）

配置会保存在浏览器 `localStorage` 中。由于本项目是“浏览器直连 OSS”，请务必使用最小权限的 RAM 账号，避免使用主账号 AccessKey。

## CORS 注意事项

浏览器直连 OSS 时，Bucket 需要提前配置跨域规则，至少建议：

- 允许当前访问域名
- 允许 `GET`、`HEAD`、`POST`
- 允许常见请求头
- 暴露 `ETag`、`x-oss-request-id`（以及你希望在前端读取的其他头）

## 存储类型与生命周期

当对象的存储类型为以下任意一种时，无法直接通过 `GET` 读取，需要先解冻（Restore）：

- `Archive`（归档）
- `ColdArchive`（冷归档）
- `DeepColdArchive`（深度归档）

如果你为音频/视频设置了生命周期规则（例如：上传后 1 天转为深度归档），那么在媒体库里点击播放时，可能会遇到 403，此时需要走“解冻流程”。

解冻耗时与存储类型相关，深度归档通常需要更长时间；解冻完成后会进入“可读状态”，在有效期内可直接访问，过期后会再次冻结。

相关文档：

- https://www.alibabacloud.com/help/zh/oss/developer-reference/restore-objects-11

## 解冻流程（系统内）

当你选中一个归档/冷归档/深度归档对象时，右侧预览区会提示“需要解冻后才能访问”，可执行：

1. 点击“发起解冻”向 OSS 提交 RestoreObject 请求
2. 解冻完成后，重试预览/播放
3. 如果提示链接过期或仍然 403，可点击“刷新链接”重新生成签名 URL

说明：

- 本项目默认将签名 URL 过期时间设置为 7 天，避免“解冻耗时超过 1 小时导致链接过期”的问题

## 上传默认打标签（用于生命周期策略）

由于生命周期规则不方便基于文件后缀/类型做过滤，如果你的文件在同一目录里混放，可以在上传时给对象打标签，然后在 OSS 生命周期规则里基于标签筛选。

本项目在上传时默认写入 2 个对象标签（Object Tagging）：

- `omp-media`: `image` / `audio` / `video`
- `omp-archive`: `deep`（音频/视频）或 `none`（图片）

你可以在 OSS 控制台创建生命周期规则：当 `omp-archive=deep` 时，1 天后转为深度归档（或你希望的存储类型）。

## 权限建议（最小权限）

根据功能使用情况，通常需要（RAM Policy）：

- `oss:ListObjects`
- `oss:GetObject`
- `oss:HeadObject`
- `oss:RestoreObject`
- `oss:PutObject`（上传/创建文件夹）
- `oss:PutObjectTagging`（上传时写入对象标签）
- `oss:CopyObject`、`oss:DeleteObject`（移动文件）

## 后续可扩展方向

- 目录导航
- 文件上传与删除
- 封面缩略图缓存
- 音频播放列表
- 视频倍速与全屏
- 懒加载和分片加载优化
