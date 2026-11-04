# 衣迹 / ClosetTrace

本地优先的衣物与搭配管理 PWA。衣物、照片、搭配、穿着记录和价格只保存在当前设备，没有账号、后端、云同步、遥测或运行时第三方请求。

## 功能

- 衣物录入：照片、类型、颜色、品牌、尺码、季节、场景/风格标签、存放位置、购买信息
- 衣橱整理：搜索筛选、批量移动/改状态、默认软删除（移出后可在“已移出”找回）
- 搭配：手动搭配、收藏、复制，以及完全离线的确定性规则推荐
- 今日推荐：按场景与手动输入的温度推荐，记录穿着后更新穿着次数与单次成本
- 采购：手动录入多渠道报价、最低到手价比较、已购花费与 CPW（每次穿着成本）
- 备份：导出 ZIP（可含照片），导入时先预览，再选择合并或替换
- PWA：可添加到 iPhone 主屏幕，首次加载后可离线使用

## 开始

要求 Node.js 22 或更高（已在 Node 24 验证）。

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址。首次进入是引导页；可全部跳过，新安装不会预置任何衣物、搭配、穿着记录、采购或位置。

## 脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发服务器 |
| `npm run build` | 类型检查并构建到 `dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 格式化 |
| `npm test` | Vitest 单元/组件测试 |
| `npm run e2e` | Playwright 端到端测试（需要先构建） |
| `npm run icons` | 从 `public/logo.svg` 重新生成 PWA 图标 |

端到端测试：

```bash
npm run build
npx playwright install chromium
npm run e2e -- --project=chromium
```

Playwright 会启动 `vite preview`（`127.0.0.1:4173`）。自动化覆盖 Chromium；Safari/WebKit 与 iPhone 真机按下方清单手动验证。

## 安装到 iPhone

1. 用 Safari 打开部署地址。
2. 点“分享” → “添加到主屏幕”。
3. 从主屏幕以独立窗口打开。

数据与访问地址绑定。清理 Safari 网站数据、卸载 PWA 或更换设备会丢失本机数据，请先导出备份。

## 备份习惯

入口：`我的 → 备份与恢复`。

- **导出完整备份**：包含衣橱数据与照片，文件较大。
- **仅导出数据**：体积小，恢复后照片需要重新添加。
- 备份为 ZIP，含 `manifest.json`、`data.json`、可选 `photos/` 与 `thumbs/`。
- 导入前会展示单品、搭配、穿着记录、照片与已移出衣物数量。
- **合并**：按 `updatedAt` 较新者优先；内置类型/场景与 `seedVersion` 不会被旧备份覆盖。
- **替换全部**：清空当前数据后恢复备份，需要勾选确认。
- 备份含照片与价格信息，请只保存在自己信任的位置。诊断日志不会进入备份。

建议：大量录入后、清理浏览器数据前、换机前各导出一次；按需要在引导页或设置里调整提醒间隔。

## 隐私与安全

- 所有业务数据存储在浏览器 IndexedDB（数据库名 `closettrace`）。
- 无登录、无云端、无分析埋点、无第三方脚本；价格只能手动录入，不做抓取。
- 图片在本地压缩后保存，不离开设备。
- 构建产物带 `public/_headers`：CSP、`nosniff`、`no-referrer`、受限 `Permissions-Policy`。
- 安全头需要由托管方生效；本地 `vite preview` 不会应用 `_headers`。

## 数据模型

16 张表：

`items`、`itemPhotos`、`categories`、`locations`、`outfits`、`outfitItems`、`wearLogs`、`scenes`、`outfitFeedback`、`purchases`、`wishlistItems`、`priceQuotes`、`colors`、`styleTags`、`settings`、`diagnostics`。

约定：

- 金额一律以整数“分”存储；日期使用本地 `YYYY-MM-DD`。
- 衣物删除默认软删除：状态改为 `retired`，可在“已移出”找回；彻底删除会级联清理照片与购买记录。
- 搭配删除会移除搭配及其单品关联，但穿着记录保存快照，历史仍可读。
- 仅类型、场景、颜色、风格标签等字典内容预置；用户业务数据从空开始。
- 备份排除 `diagnostics`。

## 部署

个人使用部署在 Cloudflare Workers 静态资源上，计划地址：

```text
https://closettrace.bodytrace.top
```

1. 推送 `main` 到 `git@github.com:Yio1/closettrace.git`。CI（`.github/workflows/ci.yml`）只做校验，不部署。
2. Cloudflare Dashboard → Workers & Pages → Create application → Connect to Git，选择 `closettrace` 仓库：
   - 项目名称：`closettrace`（与 `wrangler.jsonc` 的 `name` 一致）
   - 构建命令：`npm ci && npm run build`
   - 部署命令：`npx wrangler deploy`
   - 预览构建：关闭
3. Settings → Build → Variables and Secrets 添加 `NODE_VERSION=22` 和 `WRANGLER_SEND_METRICS=false`。
4. 首次部署会得到 `https://closettrace.<账户子域>.workers.dev`。
5. 项目 → Settings → Domains & Routes → Add → Custom domain，添加 `closettrace.bodytrace.top`。`bodytrace.top` 的 Zone 必须与 Worker 在同一 Cloudflare 账户；Cloudflare 会自动创建 DNS 记录并签发证书。
6. `wrangler.jsonc` 指向 `dist/` 并启用 `single-page-application` 回退，`public/_headers` 会随构建复制到 `dist/_headers`。不要添加 `_redirects`，避免 Workers 回退循环。

后续推送 `main` 自动部署；回滚在项目 → Deployments → 选择旧版本 → Rollback。换域名会切换 IndexedDB 数据源，切换前先在旧地址导出备份，再到新地址导入。

本地手动部署（需要先 `npx wrangler login`）：

```bash
npm run build
npx wrangler deploy
```

## 已知限制

- 报价完全手动，不抓取电商价格。
- 不接天气 API；今日推荐使用手动输入的温度。
- 推荐是确定性离线规则，不使用 AI 或云端模型。
- 单设备本地存储；合并备份遇到同一条记录时只按 `updatedAt` 取较新者，没有逐字段冲突界面。
- Safari/WebKit 与 iPhone 真机未纳入自动化 E2E，需手动回归。
- 首次打开需要网络加载应用；之后由 Service Worker 缓存提供离线访问。
