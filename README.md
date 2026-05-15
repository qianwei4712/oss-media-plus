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

## CORS 注意事项

浏览器直连 OSS 时，Bucket 需要提前配置跨域规则，至少建议：

- 允许当前访问域名
- 允许 `GET`、`HEAD`
- 允许常见请求头
- 暴露 `ETag`

## 后续可扩展方向

- 目录导航
- 文件上传与删除
- 封面缩略图缓存
- 音频播放列表
- 视频倍速与全屏
- 懒加载和分片加载优化
