# 鸣潮声骸评分

纯前端的声骸截图识别与逐条评分工具。选择角色，粘贴单只声骸面板裁剪图，校对识别结果后查看每条词条及声骸总分。截图仅在浏览器内处理，不上传到服务器。

在线地址：<https://hitazuki.github.io/wuwa-echo-score/>

## 使用

1. 在带缩略头像的角色列表中选择评分模板；可输入名称搜索。
2. 粘贴截图（`Ctrl+V`），或点击 / 拖入图片。
3. 核对 COST、强化等级、主副词条及数值。识别有误时可直接修改或增删词条。
4. 每张截图单独评分，新截图显示在最前。未强化到 +25 时，只计算已有词条和当前主词条数值。

首次访问会下载约 80 MB 的本地 OCR 与运行资源。页面显示资源下载百分比、容量和速度；截图卡片分别提示等待资源、初始化模型或正在识别。显示“已备好离线使用”后可断网使用；清除浏览器站点数据后需重新下载。

右上角先检查并下载 OCR 资源，再由浏览器缓存网页和角色头像。OCR 下载显示百分比与速度；网页缓存阶段只显示活动指示，因为 Service Worker 不提供可靠的字节进度。安装超时后页面会显示错误和重试入口。

## 本地开发

需要 Node.js 24 及 npm。

```sh
npm ci
npm run dev
```

`npm run build` 会将 ONNX Runtime Web 的 WASM 资源复制到 `public/ort` 并生成 `dist`。浏览器 OCR 使用官方 PaddleOCR.js、PP-OCRv6 small 与单线程 WASM。当前 Vite 开发服务器不支持从 `public` 目录动态导入 ONNX Runtime 的 `.mjs` 文件；**验证真实 OCR 请使用**：

```sh
npm run build
npm run preview
```

## 评分模板

`src/data/templates.json` 包含从 XutheringWavesUID 资源整理的 58 个不同角色评分模板。暗主、光主、雷主和风主各有两个来源角色 ID，但每对评分数据相同，因此合并显示；源目录中的通用默认模板也不作为角色显示。每次发布时可重新导入非敏感的 `calc.json`，然后核对模板变化和对照样本。导入脚本只读取远程目录下的 `calc.json`，不读取账号或配置数据。

角色缩略头像保存在 `public/avatars`，由 `python scripts/import_avatars.py` 按固定来源版本导入。网页不会为头像请求第三方服务，头像随离线页面一起缓存。图像来源和权利说明见第三方资源说明。

评分按每个模板的主词条权重、副词条权重、技能权重与对应 COST 的 `score_max` 计算：`词条分 = 数值 × 权重 / score_max × 50`。多条词条以未取整值求和，只在显示时保留两位小数。该分数是模板评分，不等于实际伤害。

## 部署与许可

推送到 `main` 后，GitHub Actions 构建并部署 GitHub Pages。项目采用 GPL-3.0；模型、推理运行时及模板来源见 [第三方资源说明](public/THIRD_PARTY_NOTICES.txt)。
