# 衣迹（ClosetTrace）— 衣物管理 PWA 设计文档

- 日期：2026-11-04
- 状态：待审阅（未开始编码）
- 交付形态：iOS PWA（个人自用，优先适配 iPhone 15 Pro）
- 工作名：衣迹 / ClosetTrace（可改，不影响架构）
- 技术基准：参考《体迹（BodyTrace）技术栈》，沿用其本地优先理念、分层与工程质量标准
- 关联文档：[体迹技术栈](file:///C:/Users/Lin/Documents/Qoder/2026-10-27/963bee2e/docs/tech-stack.md)

---

## 0. 结论先行

衣迹是一款**单人、本地优先、零联网**的衣物管理 PWA。它解决五件事：

1. **把衣橱录清楚**：拍照、选类型、填属性、放到具体位置，支持批量整理和删除。
2. **知道东西在哪**：位置树 + 衣物状态，按位置浏览，换季收纳。
3. **穿得出来**：手动搭一套，或让规则引擎按场景和温度推荐一套。
4. **买得明白**：记录不同渠道的报价，看到手价、历史价格、单品穿着成本（CPW）和总花费。
5. **越穿越值**：记录每天穿了什么，找出闲置单品，让推荐主动轮换。

与体迹一样，**没有账号、没有后端、没有云同步、没有第三方脚本**。衣物照片、搭配、价格和穿着记录全部保存在 iPhone 的 IndexedDB，通过手动 ZIP 备份保底。推荐算法是**离线、确定性、可解释的规则引擎**，不是在线 AI；这是为了守住隐私与零成本，也是本设计最重要的取舍之一。

---

## 1. 功能需求与设计映射

| 你提出的需求 | 本设计的落点 | 对应章节 |
|---|---|---|
| 衣物整理、录入、删除 | 快速录入、照片压缩、批量选择、软删除/彻底删除 | 5、7.3、9.2、9.8 |
| 穿放位置 | 位置树 + 物品状态 + 按位置浏览 + 批量移动 | 5.4、7.3、9.3 |
| 自主搭配 | 槽位式搭配编辑器、保存、复制、收藏 | 5.5、7.4、9.4 |
| 推荐搭配 | 场景 + 温度 + 颜色/正式度/保暖/新鲜度评分 | 4.7、6.3、7.5 |
| 采购价格对比 | 待购清单、多渠道报价、到手价、历史价格、已购花费 | 5.7、6.4、7.6 |
| 类型选择 | 9 大类 / 约 60 子类 + 自定义类型 | 4.1、5.3 |
| 各场景适配推荐 | 9 个内置场景 + 自定义场景 + 场景筛选 | 4.3、4.7、7.4 |

---

## 2. 背景与目标

### 2.1 产品定位

衣迹不是电商，也不是社交穿搭社区。它更像一本**私人衣物档案**：

- 买之前：知道同类单品已经有多少、缺什么、目标价是多少。
- 买之后：知道花了多少、放在哪里、穿过几次、每次成本多少。
- 每天：在 10 秒内决定穿什么，并留下穿着记录。
- 换季：批量把不适季的衣服收起来，把当季的放回可用状态。

### 2.2 目标用户与使用假设

| 项目 | 假设（待你确认） |
|---|---|
| 使用者 | 单人，本人使用，不做家庭共享 |
| 设备 | iPhone 15 Pro，Safari 添加到主屏幕 |
| 衣橱规模 | 100-500 件，首版按 ≤ 2000 件设计 |
| 录入习惯 | 愿意拍照和填少量属性；不愿做复杂库存管理 |
| 价格来源 | 手动记录淘宝/京东/线下/二手等渠道报价；不自动抓取 |
| 网络 | 可完全离线使用；不要求天气、账号、云同步 |
| 预算 | 零服务器成本，Cloudflare 静态托管 |

### 2.3 成功标准

1. 添加一件带照片的衣物 ≤ 30 秒；连续录入 5 件 ≤ 3 分钟。
2. 任意一件衣物，从衣橱首页到看到“在哪个柜子哪一层” ≤ 2 次点击。
3. 衣橱至少有 1 件上装、1 件下装、1 双鞋时，能针对选定场景和温度给出可解释的搭配；每个必要槽位至少有 3 件备选时，能给出 3 套。
4. 推荐结果自动排除待洗、维修、收纳和已移出的衣物。
5. 手动搭一套并保存 ≤ 60 秒；从今日页记录“今天穿这套” ≤ 2 次点击。
6. 为一件待购商品记录 3 个渠道报价后，能立即看出最低到手价和与目标价的差额。
7. 导出含照片的 ZIP → 清空 → 导入，单品、搭配、穿着记录、价格记录条数一致，照片可正常显示。
8. 飞行模式下可完成录入、搭配、推荐、穿着记录和比价；除首屏静态资源外无网络请求。
9. 连续真实使用 7 天无阻断问题。

### 2.4 非目标

- 不做账号、付费、社交、排行榜、穿搭社区。
- 不做云同步、多设备实时同步、家庭共享。
- 不做电商价格自动抓取、比价 API、优惠券聚合；这些需要后端，且涉及平台条款。
- 不做在线 AI 穿搭、AI 识图打标、虚拟试穿、身材扫描。
- 不做天气 API；温度由用户输入（后续可用快捷指令把天气写进 URL 参数，App 仍不联网）。
- 不做洗衣提醒推送、后台通知；iOS PWA 不可靠。
- 不做旅行打包清单、二手转卖、租赁、干洗店对接（放入后续版本评估）。
- 不支持 Android、平板或横屏主界面；首版只针对 iPhone 竖屏。
- 不做医疗、体型或尺码建议；尺码字段只做记录和筛选。

---

## 3. 约束与前提

- 开发环境为 Windows；沿用 PWA 方案，不引入需要 macOS/Xcode 的构建步骤。
- 静态托管使用 Cloudflare Workers 静态资源；托管方只接触网页代码，不接触用户数据。
- 安装必须通过 Safari「添加到主屏幕」。
- 数据只在 IndexedDB；iOS 在存储紧张或手动清理站点数据时可能清除，ZIP 备份是唯一可靠保底。
- 衣物照片会显著增大存储和备份体积；必须做客户端压缩、缩略图和存储用量提示。
- 界面语言为简体中文；货币固定人民币（¥），温度固定摄氏度，尺寸为自由文本。
- 日期使用本地 `YYYY-MM-DD`，周一为一周开始；不做 UTC 跨时区换算。
- **新装默认空白**：不预置任何衣物、穿着记录、价格或个人数据；只预置类型、场景、颜色、风格标签这类“字典内容”。
- 首版只有 schema v1；后续改表结构必须设计迁移，并用旧备份 fixture 验证。

---

## 4. 核心概念与规则

### 4.1 衣物类型体系

类型采用“两级树 + 槽位”模型。槽位（slot）决定它在搭配中的位置，类型决定它的名称和默认属性。

| 一级类型 | 二级类型（首版内置） | 默认槽位 |
|---|---|---|
| 上装 | T 恤、衬衫、Polo、针织衫/毛衣、卫衣、背心、吊带、打底衫 | top |
| 下装 | 牛仔裤、休闲裤、西裤、运动裤、短裤、半身裙、打底裤 | bottom |
| 连衣裙/连体 | 连衣裙、连体裤、套装 | dress |
| 外套 | 夹克、风衣、大衣、羽绒服、西装外套、开衫、马甲、冲锋衣 | outer |
| 鞋履 | 运动鞋、板鞋、皮鞋、乐福鞋、靴子、凉鞋、拖鞋、高跟鞋 | shoes |
| 包袋 | 双肩包、单肩包、手提包、斜挎包 | bag |
| 配饰 | 帽子、围巾、腰带、手套、袜子、首饰、眼镜、领带 | accessory |
| 内衣/家居 | 内衣、内裤、家居服、睡衣、泳装 | top / bottom（按具体类型） |
| 运动 | 运动上衣、运动裤、运动内衣、运动外套 | top / bottom / outer |

规则：

- 内置类型只读；用户可以新增自定义二级类型，必须选择一级类型和槽位。
- 一个类型可以映射多个槽位（如“运动内衣”可作为 top；连衣裙作为 dress，替代 top+bottom）。
- 自定义类型只有在没有衣物引用时才能删除；否则先迁移衣物。
- 选择类型后自动带出默认正式度、保暖值和季节，用户可覆盖。默认值放在 `content/categories.json`。
- 类型名称允许重名，但同一父级下不建议；UI 用“一级 / 二级”路径区分。

### 4.2 衣物状态与生命周期

| 状态 | 含义 | 是否参与推荐 | 是否计入衣橱件数 |
|---|---|---|---|
| `available` | 在衣橱，可穿 | 是 | 是 |
| `laundry` | 待洗/洗护中 | 否 | 是（单独统计待洗） |
| `repair` | 维修/改衣中 | 否 | 是 |
| `stored` | 换季收纳/装箱 | 否 | 是（可筛选） |
| `retired` | 已移出衣橱 | 否 | 否（默认列表隐藏） |

删除语义：

- **移出衣橱（默认删除）**：状态改为 `retired`，写 `archivedAt`。不删除照片和购买记录，历史穿着、CPW、统计仍保留。默认列表和推荐中隐藏，可在“已移出”里找回。
- **彻底删除**：仅对已移出或明确确认的单品开放。删除衣物、照片、购买记录、搭配关联；穿着记录保留**快照**（名称、类型、颜色、槽位），统计不被破坏。
- 删除前统一二次确认；彻底删除需输入或勾选确认，并提示“穿着历史会保留快照，但照片和购买记录不可恢复”。

### 4.3 场景模型

场景是推荐的输入，也是搭配的标签。内置 9 个场景，可自定义。

| 场景 | 正式度范围（1-5） | 必要槽位 | 说明 |
|---|---|---|---|
| 通勤 | 3 | top + bottom + shoes | 包可选；默认场景 |
| 商务/正式 | 4-5 | top + bottom + shoes | 建议西装外套；鞋偏正式 |
| 休闲 | 2 | top + bottom + shoes | 日常、周末 |
| 约会 | 3 | top + bottom + shoes | 配饰加分 |
| 聚会 | 3-4 | top + bottom + shoes | 可更亮色 |
| 运动 | 1 | top + bottom + shoes | 优先运动类型和透气材质 |
| 居家 | 1 | top + bottom | 鞋可选 |
| 户外 | 2 | top + bottom + shoes | 温度 ≤18°C 时必须加外套 |
| 旅行 | 2-3 | top + bottom + shoes | 首版只做单套推荐，打包清单后续 |

规则：

- 场景有 `formalityMin`、`formalityMax`、`requiredSlots`、`optionalSlots`、`styleTags`。
- 用户可新增自定义场景（如“看展”“见家长”），可归档，不硬删除被引用的场景。
- 搭配可以打多个场景标签；推荐时按当前场景筛选和评分。
- 场景不是“着装规定”，只是软约束；推荐会解释“为什么适合这个场景”。

### 4.4 温度、季节与保暖值

首版不接天气 API。今日页让用户输入温度（默认上次值），推荐按温度带计算目标保暖值。

| 温度 | 目标保暖值 | 外套 |
|---|---|---|
| ≥ 30°C | 1.0 | 不需要 |
| 25-29°C | 1.5 | 不需要 |
| 19-24°C | 2.0 | 可选薄外套 |
| 13-18°C | 3.0 | 可选 |
| 6-12°C | 4.0 | 建议 |
| ≤ 5°C | 5.0 | 必须 |

- 每件衣物有 1-5 的保暖值：1 很薄（背心/短袖）、2 薄（长袖 T/衬衫）、3 中等（针织/薄外套）、4 厚（毛衣/夹克）、5 很厚（羽绒/大衣）。
- 用户可设置体感偏好“怕冷 / 正常 / 怕热”，把目标保暖值调整 ±0.5。
- 季节标签（春/夏/秋/冬/四季）用于筛选和换季，不直接替代温度。
- 上装有效保暖 = 上装保暖值 + 外套保暖值 × 0.6；下装和鞋单独检查，偏差过大时扣分。
- 没有温度时，推荐可以按当前季节的中间温度带运行，但会提示“设置温度更准确”。

### 4.5 颜色与图案

颜色不做自由文本，使用内置色板 + 自定义色。每个颜色有名称、十六进制、色相角、色系（中性/暖/冷）和是否中性色。

| 色系 | 内置颜色 |
|---|---|
| 中性 | 黑、白、米白、浅灰、深灰、藏青、牛仔蓝、棕、卡其、银 |
| 暖 | 红、酒红、橙、焦糖、黄、粉、紫、金 |
| 冷 | 蓝、天蓝、青、绿、橄榄、薄荷 |

- 每件衣物记录主色，可选辅色；图案包括纯色、条纹、格纹、印花、牛仔、其他。
- 自定义颜色需填名称、HEX 和色系；色相由 HEX 自动计算。
- 颜色评分只使用主色；辅色用于展示和人工判断，首版不参与算法，避免过度复杂。
- 照片光线会影响颜色判断，因此色板只做“近似色系”，不追求精确取色。自动从照片取色放入 v1.1。

### 4.6 价格与成本口径

- 货币固定人民币，金额以**分**为整数存储，避免浮点误差；展示时格式化为 `¥199.00` 或 `¥199`。
- 到手价 = 商品价 + 运费 − 优惠。
- 单品总花费 = 该单品所有购买记录的到手价之和（允许补购、换配件、二次购买同款）。
- 穿着次数 = **有穿着记录的不同日期数**，同一天穿两次只算一次。
- 单次穿着成本（CPW）= 单品总花费 ÷ 穿着次数；穿着次数为 0 时显示“—（未穿）”，不参与 CPW 排名。
- 搭配成本 = 该搭配所有单品总花费之和；搭配 CPW = 搭配成本 ÷ 该搭配的穿着日期数。
- 待购报价不计入花费，只有“标记已购”后才生成购买记录。
- 礼物、赠品、二手 0 元也允许记录，价格显示为“礼物/¥0”。

### 4.7 推荐规则总览

推荐是**规则引擎**，输入是“场景 + 温度 + 当前衣橱 + 历史反馈”，输出是 3-5 套搭配及解释。

**硬过滤（不满足直接排除）**

1. 状态必须是 `available`；待洗、维修、收纳、已移出全部排除。
2. 类型槽位必须匹配搭配模板。
3. 正式度必须在场景范围内，或衣物显式打了该场景标签；允许 ±1 的缓冲，但会扣分。
4. 季节标签包含当前季节或“四季”；保暖值与目标差值 ≤ 2。
5. 用户标记“不再推荐”的单品排除；被点“不喜欢”的搭配签名排除。
6. 必须凑齐场景的必要槽位；连衣裙可以替代上装+下装。

**候选不足时的放宽顺序**

衣物少的时候不能直接说“没有推荐”。按以下顺序放宽，并在界面上明确提示：

1. 保暖容差 +1；
2. 忽略季节标签；
3. 正式度范围 ±1；
4. 允许最近穿过的单品重新出现（新鲜度只扣分，不排除）。

永远不放宽状态过滤：待洗的衣服不能被推荐。

**评分（0-100）**

| 维度 | 权重 | 说明 |
|---|---|---|
| 颜色和谐 | 30 | 中性色优先；同色系/邻近色次之；冲突色扣分；图案不超过 1 件 |
| 场景正式度 | 20 | 单品正式度与场景目标正式度的平均偏差 |
| 保暖匹配 | 20 | 上装+外套有效保暖值与目标值的偏差；下装/鞋偏差单独扣分 |
| 风格偏好 | 10 | 与用户风格标签的重合度；未设置时给中性分 |
| 新鲜度 | 10 | 越久没穿越高；1-2 天内穿过明显扣分，鼓励轮换 |
| 反馈 | 5 | 点过“喜欢”或保存过的搭配加分；未反馈给中性分 |
| 新颖度 | 5 | 最近 14 天没穿过这个组合给满分 |

评分是**相对分**，不是“满意度概率”。界面上展示分数时配一句解释，不展示复杂的权重表。

**生成方式**

- 模板：默认 `上装 + 下装 + 鞋`；≤12°C 增加外套，户外场景 ≤18°C 增加外套；连衣裙替代上装+下装；运动场景优先运动类型。
- 每个槽位先按基础分取前 8 个候选，再用带种子的随机采样组合，最多评估 512 套，去重后取前 5。
- “换一套”只改变随机种子，保证可复现，不会每次刷新都面目全非。
- 已保存的搭配也进入候选池；收藏搭配有额外加成，避免推荐结果和用户真实喜好脱节。
- 每个结果给 1-2 句解释，例如“中性色组合”“通勤正式度匹配”“12°C 下保暖接近目标”“这条裤子 18 天没穿了”。
- 冷启动：缺少必要槽位时，不硬凑，直接显示“还缺一双鞋”并给添加入口。

---

## 5. 数据模型

### 5.1 总体约定

- 主键为字符串；内置内容 ID 用 `builtin:` 前缀，用户数据用 `crypto.randomUUID()`。
- 日期为本地 `YYYY-MM-DD`；时间戳为 ISO 8601。
- 所有读写封装在 `src/db/repositories/*`，页面不直接操作表。
- 跨表写入使用 Dexie 事务；派生统计字段由仓储维护，页面只读。
- 历史记录保存快照：删除衣物、搭配、场景后，穿着记录仍能显示当时穿了什么。
- 照片以 Blob 存在独立表，衣物行只保存照片 ID 和缩略图 ID，避免列表查询拖入大对象。

### 5.2 表清单（v1，14 张）

| 分组 | 表 |
|---|---|
| 衣橱 | `items`、`itemPhotos`、`categories`、`locations` |
| 搭配与穿着 | `outfits`、`outfitItems`、`wearLogs`、`scenes`、`outfitFeedback` |
| 采购 | `purchases`、`wishlistItems`、`priceQuotes` |
| 系统 | `settings`、`diagnostics` |

### 5.3 类型定义

```ts
export type ISODate = string;        // YYYY-MM-DD
export type ISODateTime = string;    // ISO 8601
export type Cents = number;          // 人民币分

export type Slot =
  | 'top' | 'bottom' | 'dress' | 'outer' | 'shoes' | 'bag' | 'accessory';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all';

export type ItemStatus =
  | 'available' | 'laundry' | 'repair' | 'stored' | 'retired';

export type Pattern =
  | 'solid' | 'stripe' | 'check' | 'floral' | 'print' | 'denim' | 'other';

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  slot: Slot;                  // 一个类型一个主槽位；特殊类型用 slots 覆盖
  slots?: Slot[];              // 例如运动内衣 ['top']，连衣裙 ['dress']
  defaultFormality: number;    // 1-5
  defaultWarmth: number;       // 1-5
  defaultSeasons: Season[];
  isBuiltIn: boolean;
  archived: boolean;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Location {
  id: string;
  name: string;                // 主衣柜、鞋柜、换季箱 A
  parentId?: string;
  detail?: string;             // 挂杆左侧、第三层
  order: number;
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  brand?: string;
  size?: string;               // S/M/L/38/42/均码
  colorPrimaryId: string;
  colorSecondaryId?: string;
  pattern: Pattern;
  material?: string;
  warmth: number;              // 1-5
  formality: number;           // 1-5
  seasons: Season[];
  sceneTags: string[];         // sceneId；为空时按正式度推断
  styleTags: string[];         // 简约/休闲/商务/运动/复古...
  locationId?: string;
  locationDetail?: string;
  status: ItemStatus;
  coverPhotoId?: string;
  thumbPhotoId?: string;
  avoidRecommend: boolean;
  isFavorite: boolean;
  note?: string;
  // 缓存字段，由仓储维护
  wearCount: number;           // 不同穿着日期数
  lastWornAt?: ISODate;
  totalCostCents: number;      // 所有购买记录到手价之和
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  archivedAt?: ISODateTime;
}

export interface ItemPhoto {
  id: string;
  itemId: string;
  blob: Blob;                  // 压缩后的原图，最长边 1600px，JPEG
  thumbBlob: Blob;             // 缩略图，最长边 320px，JPEG
  width: number;
  height: number;
  bytes: number;
  order: number;
  createdAt: ISODateTime;
}

export interface Outfit {
  id: string;
  name: string;
  sceneIds: string[];
  isFavorite: boolean;
  source: 'manual' | 'recommended';
  note?: string;
  coverPhotoId?: string;       // 可选，用某件单品的照片做封面
  // 缓存字段
  wearCount: number;
  lastWornAt?: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface OutfitItem {
  id: string;
  outfitId: string;
  itemId: string;
  slot: Slot;
  order: number;
}

export interface WearItemSnapshot {
  itemId: string;
  name: string;
  categoryId: string;
  slot: Slot;
  colorPrimaryId: string;
  photoId?: string;            // 删除衣物后照片可能不存在，UI 用占位
}

export interface WearLog {
  id: string;
  date: ISODate;
  outfitId?: string;
  outfitName?: string;          // 快照，搭配删除后仍可显示
  sceneId?: string;
  tempC?: number;
  itemIds: string[];            // 便于索引查询
  items: WearItemSnapshot[];    // 快照
  note?: string;
  createdAt: ISODateTime;
}

export interface Scene {
  id: string;
  name: string;
  formalityMin: number;        // 1-5
  formalityMax: number;
  requiredSlots: Slot[];
  optionalSlots: Slot[];
  styleTags: string[];
  isBuiltIn: boolean;
  archived: boolean;
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Purchase {
  id: string;
  itemId: string;
  channel: string;              // 淘宝/京东/线下/二手/礼物/其他
  priceCents: Cents;
  shippingCents: Cents;
  discountCents: Cents;
  purchasedAt: ISODate;
  orderRef?: string;
  note?: string;
  createdAt: ISODateTime;
}

export interface WishlistItem {
  id: string;
  name: string;
  brand?: string;
  categoryId: string;
  size?: string;
  colorPreference?: string;
  targetPriceCents?: Cents;
  priority: 1 | 2 | 3;         // 1 高
  status: 'watching' | 'bought' | 'dropped';
  note?: string;
  convertedItemId?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PriceQuote {
  id: string;
  wishlistId: string;
  channel: string;
  priceCents: Cents;
  shippingCents: Cents;
  discountCents: Cents;
  observedAt: ISODate;
  url?: string;                 // 仅作参考链接，App 不请求
  note?: string;
  createdAt: ISODateTime;
}

export interface OutfitFeedback {
  id: string;
  signature: string;            // 排序后的 itemId 用 | 连接，用于识别同一组合
  sceneId?: string;
  rating: 'like' | 'dislike';
  reason?: string;
  createdAt: ISODateTime;
}

export interface Setting {
  key: string;
  value: unknown;
  updatedAt: ISODateTime;
}

export interface Diagnostic {
  id: string;
  at: ISODateTime;
  level: 'warn' | 'error';
  message: string;
  context?: string;
}
```

内置内容类型（`src/content/*.json`）：

```ts
export interface ColorSwatch {
  id: string;
  name: string;
  hex: string;
  hue: number;                  // 0-360
  family: 'neutral' | 'warm' | 'cool';
  isNeutral: boolean;
  order: number;
}

export interface StyleTag {
  id: string;
  name: string;
  order: number;
}
```

### 5.4 索引设计

```ts
this.version(1).stores({
  items:
    'id, name, categoryId, status, locationId, isFavorite, lastWornAt, updatedAt, archivedAt, *sceneTags, *seasons, *styleTags',
  itemPhotos: 'id, itemId, [itemId+order]',
  categories: 'id, parentId, slot, archived, order',
  locations: 'id, parentId, order',
  outfits: 'id, isFavorite, lastWornAt, updatedAt, *sceneIds',
  outfitItems: 'id, outfitId, itemId, [outfitId+order]',
  wearLogs: 'id, date, outfitId, sceneId, [date+sceneId], *itemIds',
  scenes: 'id, archived, order',
  purchases: 'id, itemId, purchasedAt, channel',
  wishlistItems: 'id, status, categoryId, priority, updatedAt',
  priceQuotes: 'id, wishlistId, observedAt, [wishlistId+observedAt]',
  outfitFeedback: 'id, signature, sceneId',
  settings: 'key',
  diagnostics: 'id, at',
});
```

说明：

- `items` 的 `*sceneTags`、`*seasons`、`*styleTags` 是 Dexie 多值索引，支持“按场景/季节/风格筛选”。
- `wearLogs` 同时保存 `itemIds` 数组和快照；`*itemIds` 支持“这件衣服穿过哪些天”。
- 名称搜索不使用 Dexie 前缀索引，改为取出后内存过滤；中文子串搜索更符合直觉，衣橱规模 ≤ 2000 时性能足够。
- 列表默认按 `updatedAt` 或 `lastWornAt` 排序；Dexie 查询后用内存排序，避免复合索引过多。

### 5.5 内置内容与播种

内容文件：

| 文件 | 内容 |
|---|---|
| `src/content/categories.json` | 9 大类、约 60 个子类、默认正式度/保暖值/季节 |
| `src/content/scenes.json` | 9 个内置场景 |
| `src/content/colors.json` | 24 个内置颜色 |
| `src/content/style-tags.json` | 10 个风格标签 |
| `src/content/onboarding-copy.json` | 引导文案与空状态提示 |

播种规则：

- `seedVersion` 递增；启动时如低于当前版本，按稳定 ID 增量 upsert 内置内容。
- 只 upsert 内置内容，不删除、不覆盖用户自定义内容。
- 内置类型/场景只读；用户可新增自定义项。内置项如需下线，用 `archived` 标记，不物理删除，避免历史引用失效。
- **不播种任何衣物、搭配、穿着记录、价格记录**。首次打开衣橱是空的，显示引导而不是假数据。
- 位置是个人数据，也不预置；只提供“一键创建推荐结构”的可选按钮（主卧衣柜/玄关鞋柜/换季收纳），由用户点击确认后才创建。

### 5.6 迁移策略

- 首版只有 v1。新增表/索引可直接加 `version(2)`。
- 字段重命名或类型变更必须写 `upgrade` 迁移函数，并在 `test/fixtures` 保留旧版本备份样本。
- 发布前跑“旧备份 → 新 schema → 数据完整”测试。
- schema 变更版本发布时，在今日页提示“建议先导出备份”；迁移失败保留旧库，进入恢复页。
- 内置内容更新与 schema 迁移分离，避免内容更新触发数据库升级。

### 5.7 备份格式

```
closettrace-backup-YYYYMMDD-HHmm.zip
├── manifest.json
├── data.json
├── photos/{photoId}.jpg
└── thumbs/{photoId}.jpg
```

- `manifest.json`：`app`、`appVersion`、`schemaVersion`、`seedVersion`、`exportedAt`、各表条数、`includesPhotos`、总字节数。
- `data.json`：除 `diagnostics` 外的所有表；`itemPhotos` 只存元数据和文件名，Blob 单独放 `photos/`。
- 导出提供两种模式：**完整（含照片）** 和 **仅数据**。照片多时完整包可能 100MB+，必须显示预估大小和进度。
- 导入用 Zod 校验结构和版本；新版本拒绝并提示升级 App；旧版本先迁移。
- 导入预览：单品数、搭配数、穿着记录日期范围、照片数量与总大小、是否含已移出衣物。
- 合并策略：
  - 主数据（`items`、`categories`、`locations`、`outfits`、`scenes`、`wishlistItems`、`settings`）按 ID 去重，`updatedAt` 较新者胜出；内置内容以当前种子为准，不用旧备份覆盖。
  - 聚合子表（`outfitItems`、`itemPhotos`）随父记录整体替换：如果导入的搭配更新，先删旧关联，再写新关联。
  - 日志类（`wearLogs`、`purchases`、`priceQuotes`、`outfitFeedback`）按 ID 去重，不同 ID 全部追加；相同 ID 保留已有记录。
- 替换全部：清空所有表后写入，必须二次确认并建议先导出当前数据。
- 仅数据导入时，照片引用保留但显示占位；提示“照片未包含在此备份中，可重新添加”。
- 备份文件包含衣物照片和价格信息，属于隐私数据；只在本机或用户主动选择的位置保存。

---

## 6. 领域逻辑

### 6.1 颜色和谐

只使用主色。把搭配中可见单品的颜色收集起来，两两打分：

| 组合 | 分数 |
|---|---|
| 中性 + 中性 | 100 |
| 中性 + 彩色 | 92 |
| 同色系且色相差 ≤ 30° | 82 |
| 同色系且色相差 ≤ 8°（同色调） | 88 |
| 互补色（色相差 150-210°） | 72 |
| 其他 | 45 |

- 搭配颜色分 = `0.6 × 最低配对分 + 0.4 × 平均配对分`，再映射到 0-30。
- 图案超过 1 件，颜色分扣 10；非中性色超过 3 种，再扣 8。
- 中性色包括黑、白、米白、灰、藏青、牛仔蓝、棕、卡其、银。
- 解释只用自然语言：“中性色组合”“同色系层次”“颜色对比偏强”，不展示公式。

### 6.2 推荐评分伪代码

```ts
function recommend(input: {
  scene: Scene;
  tempC: number;
  items: Item[];
  categories: Category[];
  outfits: OutfitWithItems[];
  feedback: OutfitFeedback[];
  styleProfile: StyleProfile;
  seed: number;
}): Recommendation[] {
  const band = tempBand(input.tempC, input.styleProfile.tempSensitivity);
  const candidates = input.items.filter((item) => {
    if (item.status !== 'available') return false;
    if (item.avoidRecommend) return false;
    if (!sceneCompatible(item, input.scene)) return false;
    if (!weatherCompatible(item, band)) return false;
    return true;
  });

  const templates = buildTemplates(input.scene, input.tempC);
  const combos = sampleCombos(candidates, templates, input.seed, {
    perSlot: 8,
    maxEvaluate: 512,
  });

  const saved = input.outfits
    .filter((outfit) => outfitFitsScene(outfit, input.scene, input.items))
    .map(toCombo);

  const all = dedupeBySignature([...combos, ...saved]);
  const scored = all
    .map((combo) => scoreCombo(combo, input))
    .filter((combo) => combo.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5);
}
```

评分细节：

| 维度 | 计算 |
|---|---|
| 颜色 | `colorHarmony(items) / 100 * 30`，图案/色数扣分 |
| 正式度 | `max(0, 20 - averageAbsDiff * 8)`；超出场景范围再扣 4 |
| 保暖 | `max(0, 20 - abs(effectiveUpperWarmth - target) * 8)`；下装/鞋偏差 >1 各扣 2 |
| 风格 | 有风格画像：重合度 × 10；没有：6 |
| 新鲜度 | 1-2 天内 0；3-7 天 7；8-30 天 10；>30 天或从未穿 10 |
| 反馈 | 未反馈 2；点过喜欢/保存过 5；点过不喜欢直接排除 |
| 新颖度 | 最近 14 天没穿过该组合 5，否则 0 |

确定性：

- 用 `mulberry32(seed)` 做槽位采样和同分排序；`seed = hash(date + sceneId + nonce)`。
- “换一套”递增 `nonce`；同一 `nonce` 重算结果一致，便于测试和解释。
- 不使用 `Math.random()` 直接决定结果。

### 6.3 推荐解释生成

每个结果取贡献最高的 2 个维度生成短句：

- 颜色：“黑、白、棕都是中性色，搭配稳定。”
- 正式度：“衬衫 + 西裤的正式度与通勤场景匹配。”
- 保暖：“12°C 下上装 + 外套的保暖值 3.8，接近目标 4.0。”
- 新鲜度：“这条裤子已经 18 天没穿了。”
- 风格：“与你偏好的简约风格重合。”
- 放宽条件：“可选的当季单品较少，已放宽季节限制。”

解释是推荐可信度的核心。没有解释的推荐等于随机。

### 6.4 采购价格对比

到手价与排序：

```ts
const landedCents = (q: PriceQuote) =>
  q.priceCents + q.shippingCents - q.discountCents;

const sortedQuotes = quotes
  .slice()
  .sort((a, b) => landedCents(a) - landedCents(b) || b.observedAt.localeCompare(a.observedAt));
```

- 最低到手价标记“最低”；同价时并列，按最近记录排序。
- 与目标价比较：低于目标显示“低于目标 ¥X”，高于显示“高于目标 ¥Y”，无目标价则不比较。
- 价格历史用最近 12 次报价画迷你折线；少于 2 次不画线，只显示最近一次。
- 已购花费按购买日期的月份汇总；按类型、渠道汇总。
- CPW 排名只包含穿着次数 > 0 的单品；0 次单列“买来还没穿”。
- 利用率 = 最近 90 天有穿着记录的可用单品数 ÷ 当前可用单品数。
- 闲置 = 加入超过 30 天、且最近 90 天没有穿着记录的可用单品。

### 6.5 快照与删除一致性

- 穿着记录保存 `items` 快照；删除衣物后，历史仍显示“白衬衫 / 上装 / 白色”，照片缺失时显示色块占位。
- 穿着记录保存 `outfitName` 快照；删除搭配后，历史仍显示当时穿的搭配名。
- 删除穿着记录时，需要重算受影响单品的 `wearCount` 和 `lastWornAt`：按 `*itemIds` 查该单品所有记录，取不同日期数和最大日期；搭配的统计同理。
- 删除购买记录时，重算单品 `totalCostCents`。
- 删除搭配时，删除 `outfitItems`；穿着记录不受影响。
- 删除位置前必须为空；否则要求先把衣物和子位置移走。
- 删除自定义类型前必须无衣物引用；否则先迁移。
- 删除自定义场景前，若被搭配或穿着记录引用，改为归档；不硬删除。

---

## 7. 页面与交互

### 7.1 信息架构

底部 5 个标签：

| 标签 | 图标 | 内容 |
|---|---|---|
| 今日 | Sun | 温度、场景、推荐搭配、今天已穿、待洗、闲置提示、备份提醒 |
| 衣橱 | Shirt | 单品网格、搜索筛选、批量整理、位置视图、衣橱分析、添加 |
| 搭配 | Layers | 我的搭配、推荐搭配、搭配详情、编辑器 |
| 采购 | Wallet | 待购比价、已购花费、穿着成本、待购详情 |
| 我的 | User | 风格画像、尺码、场景管理、类型管理、位置管理、备份、诊断、安装指南 |

路由草案：

```
/onboarding
/                         今日
/wardrobe                 衣橱（单品）
/wardrobe/item/new
/wardrobe/item/:id
/wardrobe/locations        位置树
/wardrobe/locations/:id    某位置下的衣物
/wardrobe/insights         衣橱分析
/outfits                   搭配（我的 / 推荐）
/outfits/new
/outfits/:id
/outfits/:id/edit
/purchase                  采购（比价 / 花费 / 成本）
/purchase/wishlist/:id     待购详情与报价
/purchase/spending         花费明细
/purchase/cpw              穿着成本
/me
/me/style
/me/scenes
/me/categories
/me/locations
/backup
/install
/diagnostics
```

### 7.2 设计语言

**气质**：像一本衣物档案，而不是电商货架。大图、留白、暖纸色、克制的强调色。

| 令牌 | 浅色 | 深色 |
|---|---|---|
| 背景 | `#F6F2EA` 暖纸 | `#11100E` |
| 卡片 | `#FFFFFF` | `#1B1916` |
| 主文字 | `#1D1A16` | `#F0EAE1` |
| 次要文字 | `#6F675E` | `#A39A8E` |
| 分隔线 | `#E5DDD1` | `#2E2A25` |
| 强调色 | `#A9502F` 赤陶 | `#D98A68` |
| 强调文字 | `#8A3F25` | `#E3A084` |
| 强调色上的文字 | `#FFF8F3` | `#241009` |
| 危险 | `#B3261E` | `#F2B8B5` |
| 成功/在衣橱 | `#3F7A55` | `#7FB08A` |
| 警告 | `#B7791F` | `#E0B15A` |

- 字体：正文沿用系统无衬线栈；页面大标题和搭配名称可使用 `"Songti SC", "Noto Serif SC", serif`，缺失时回退系统字体。不加载外部字体。
- 圆角：12（小控件）、16（卡片）、24（Sheet）；照片卡片 16。
- 间距：4/8/12/16/24/32；触控目标 ≥ 44pt。
- 边框优先，阴影克制；照片卡片用 1px 分隔线 + 轻微阴影。
- 数字（价格、次数、温度）使用 `tabular-nums`。
- 状态不只靠颜色表达：待洗有文字标签，已移出有“已移出”徽标。
- 尊重 `prefers-reduced-motion`；Sheet 动画可关闭。

**复用体迹的自研 UI 原子**：Button、Card、Sheet、SegmentedControl、TextField、NumberField、EmptyState、PageHeader；新增 PhotoPicker、ColorSwatchPicker、Stepper、MoneyField、ItemCard、OutfitCard、SlotPicker。不引入组件库。

### 7.3 今日

```
11月4日 周二                        12°C  [改]
今天去哪？  [通勤] [休闲] [约会] [运动] [更多]

┌ 今日推荐 ─────────────────────────────┐
│ [三件单品拼图/封面]                    │
│ 米白衬衫 + 黑西裤 + 棕色乐福鞋         │
│ 12°C · 通勤 · 正式度 3/5              │
│ 为什么：中性色稳定；上装+外套保暖 3.8  │
│ [就穿这套]  [换一套]  [查看 3 套]      │
└───────────────────────────────────────┘

今天已穿：通勤搭配 · 3 件        [记录穿着]
待洗 2 件：白衬衫、牛仔裤          [查看]
很久没穿：藏青风衣（46 天）        [看看]
[备份提醒：30 天未导出]
```

交互：

- 温度用步进器，范围 -30 到 45°C，步长 1；长按加速。默认上次值。
- 场景 chips 默认“休闲”；最近使用的 4 个排在前面。
- “就穿这套”：写穿着记录；如果推荐结果不是已保存搭配，弹出“顺便保存为搭配”开关，默认开。
- “换一套”：保留场景和温度，换种子重新生成；不重新请求任何网络。
- “查看 3 套”：进入推荐列表，可逐套喜欢/不喜欢/保存。
- 记录穿着也可不走推荐：选择搭配或直接选单品，保存为当日穿着。
- 待洗卡片只显示数量和前两件名称；点击进入衣橱的待洗筛选。
- 闲置提示每周最多出现一次，避免唠叨。

### 7.4 衣橱

**单品视图**

```
衣橱  128 件                     [选择] [+]
[搜索名称 / 品牌 / 标签]
[全部类型▾] [全部状态▾] [全部季节▾] [筛选]

┌─────────┐  ┌─────────┐
│  照片   │  │  照片   │
│ 白衬衫  │  │ 黑西裤  │
│ 上装·卧室衣柜 │ 下装·卧室衣柜 │
└─────────┘  └─────────┘
```

- 两列网格，4:5 照片，缩略图；无照片时显示主色色块 + 类型图标。
- 卡片信息：名称、类型、位置短路径；右上角状态徽标（待洗/收纳/维修/已移出）。
- 点击进入详情；长按或“选择”进入批量模式。
- 筛选：类型（一级/二级）、状态、季节、颜色、位置、场景、风格。多条件可叠加；“筛选”Sheet 里清空。
- 排序：最近添加、最近穿着、最久未穿、价格从高到低、CPW 从高到低。
- 搜索：名称、品牌、备注、标签、类型名；使用 `useDeferredValue` 防抖。
- 批量操作：移动到位置、标记待洗、标记已洗、换季收纳、取出、移出衣橱。批量移出仍需确认。
- 添加入口固定在右下角，位于 TabBar 之上；同时保留页头“+”。

**位置视图**

```
位置
家
  卧室
    主衣柜  42 件
      挂杆 18 · 上层 12 · 抽屉 12
  玄关
    鞋柜  16 件
  储物间
    换季箱 A  23 件（收纳）
未指定  7 件  [去整理]
```

- 树形层级不限，建议不超过 4 层。
- 每个节点显示该节点及子节点的衣物总数。
- 点击节点进入该位置下的单品列表；支持批量移动。
- “未指定”是虚拟节点，不存表；点击后筛选 `locationId` 为空的衣物。
- 新增/编辑位置：名称、父位置、备注；删除前检查空。
- 位置路径在单品详情显示为“卧室 / 主衣柜 / 挂杆”。

**衣橱分析**

- 总件数、总花费、平均 CPW、90 天利用率。
- 类型分布（横条）、颜色分布（色块 + 数量）。
- 最久未穿 Top 10；最常穿 Top 10。
- 待洗、维修、收纳、已移出的数量入口。
- 不画无数据图表；空状态给“先记录几次穿着”。

### 7.5 单品详情与录入

**详情**

```
[照片轮播 1/3]
白衬衫                         ¥199
优衣库 · M · 棉 · 2025-03
状态 在衣橱   位置 卧室/主衣柜/挂杆  [移动]

正式度 3/5   保暖 2/5   季节 春/秋
场景 通勤/约会   风格 简约
[穿一次]  [加入待洗]  [编辑]

穿着 12 天 · 最近 3 天前
单次成本 ¥16.6（购买 ¥199）
购买记录：淘宝 ¥199 + 运费 ¥0
使用此单品的搭配 4 套

[移出衣橱]  [彻底删除]
```

- 照片支持左右滑动、点击全屏；删除照片后自动重排封面。
- 位置点击弹出移动 Sheet；显示位置树和“新建位置”。
- “穿一次”默认今天，可改日期；写入穿着记录并更新统计。
- “加入待洗”把状态改为 `laundry`；再次点击变为“标记已洗”。
- 购买记录可追加多条；编辑/删除后重算总花费和 CPW。
- 底部“使用此单品的搭配”列出关联搭配，点击进入。
- 移出/彻底删除放在危险区，不与常用操作混在一起。

**录入/编辑表单**

分四组，默认展开前两组，后两组可折叠：

1. 基本信息：照片（最多 5 张）、名称、类型、品牌、尺码。
2. 外观：主色、辅色、图案、材质。
3. 属性：保暖值、正式度、季节、场景标签、风格标签。
4. 位置与购买：位置、位置细节、状态、购买价格/渠道/日期、备注。

交互细节：

- 选类型后自动填默认名称（如“白色 T 恤”）、正式度、保暖值、季节；用户可改。
- 名称为空时用“主色 + 类型”生成；仍为空则不允许保存。
- 照片用 `<input type="file" accept="image/*" capture="environment">`，不调用 `getUserMedia`，不主动申请相机权限。
- 照片上传后立即压缩并生成缩略图，显示进度；失败可重试或跳过照片保存。
- 价格输入用 MoneyField，支持小数两位，内部转分；允许 0。
- 表单草稿存 `sessionStorage`，保存/取消后清除；返回页面可恢复。
- 编辑时若改类型，槽位和默认属性提示是否同步更新；不强制。
- 保存按钮固定在底部，避开安全区；保存中禁用重复提交。

### 7.6 搭配

**列表**

```
搭配
[我的搭配] [为我推荐]

[全部场景▾] [收藏]

┌──────────────────────┐
│ [封面拼图]            │
│ 通勤 · 米白衬衫 + 黑西裤│
│ 穿过 8 次 · 最近 2 天  │
│ ♥                     │
└──────────────────────┘
```

- 我的搭配：按最近更新/最近穿着排序；封面用第一件有照片的单品，或用户指定。
- 推荐：场景 + 温度 + “生成”；卡片显示解释、分数、喜欢/不喜欢、保存、穿这套。
- 筛选：场景、收藏、完整度（缺鞋/缺下装）。
- 空状态：没有搭配时，给“手动搭一套”和“让衣迹推荐”两个入口；推荐要求至少 3 个必要槽位。

**编辑器**

```
新建搭配
场景 [通勤] [约会] [+]
[上装]  白衬衫        [更换] [移除]
[下装]  黑西裤        [更换]
[外套]  未选择        [选择]
[鞋]    棕色乐福鞋    [更换]
[包]    未选择        [选择]
[配饰]  未选择        [选择]
完整度：可穿（上装+下装+鞋）
[保存]
```

- 槽位式选择：点击槽位打开单品选择 Sheet，支持搜索、类型/颜色/季节筛选。
- 允许保存不完整搭配，但标记“缺鞋/缺下装”，推荐时不使用。
- 连衣裙槽位会隐藏上装/下装，或提示“连衣裙已替代上装+下装”。
- 自动命名：“主色上装 + 主色下装 + 鞋”，可改。
- 可复制已有搭配再改；保存时写 `outfits` + `outfitItems` 事务。
- 删除搭配不影响穿着历史；历史保留搭配名快照。

**详情**

- 封面、名称、场景、单品列表（按槽位）、总成本、穿着次数、最近穿着、搭配 CPW。
- 操作：穿这套、编辑、复制、收藏、删除。
- 含待洗/已移出单品的搭配显示提示，并从推荐候选排除。

### 7.7 推荐 Panel

```
为我推荐
场景  [通勤] [休闲] [约会] [运动] [更多]
温度  [−] 12°C [+]
体感  [怕冷] [正常] [怕热]
[生成搭配]

1. 米白衬衫 + 黑西裤 + 乐福鞋        92
   中性色稳定；通勤正式度匹配；保暖 3.8/4.0
   [喜欢] [不喜欢] [保存] [穿这套]

2. 浅蓝衬衫 + 深灰西裤 + 黑皮鞋      87
   同色系层次；鞋偏正式；裤子 9 天未穿
   ...

3. 可推荐的当季单品较少，已放宽季节限制。
```

- 生成后最多展示 3 套，可展开到 5 套；候选不足时显示实际数量，不凑数。
- “不喜欢”会记录签名，后续不再推荐；可写原因（太正式/颜色不喜欢/不合身）。
- “保存”后进入我的搭配；来源标记 `recommended`。
- “穿这套”写穿着记录，并可选“同时保存”。
- 缺少槽位时显示明确缺口，不生成半套搭配；点击缺口直接去添加对应类型。
- 推荐面板是 Sheet，不离开今日页；关闭后保留上次结果。

### 7.8 采购

**比价视图**

```
采购
[待购比价] [已购花费] [穿着成本]

待购 3 件
┌ 白衬衫（优衣库 480123）────────────┐
│ 目标 ¥149   最低 ¥159（京东）      │
│ 京东   ¥159  11-03   [最低]        │
│ 淘宝   ¥169  11-02                 │
│ 线下   ¥199  10-28                 │
│ [记一笔报价]  [标记已购]            │
└────────────────────────────────────┘
```

- 待购列表按优先级、最近更新排序；显示目标价、最低到手价、差额。
- 详情页：报价表、最低价徽标、价格历史迷你折线、备注、参考链接。
- 记报价：渠道、商品价、运费、优惠、日期、链接（可选）、备注；保存后立即重排。
- 标记已购：打开预填的单品表单（名称、品牌、类型、颜色偏好），同时把选中的报价转为购买记录；待购状态改为 `bought`，写 `convertedItemId`。
- 放弃：状态 `dropped`，不删除报价历史。
- 参考链接只在用户点击时用系统浏览器打开；App 不预取、不抓取。

**已购花费**

- 本月/上月/全年总花费；按类型、渠道的横条图。
- 最近购买记录列表；点击进入单品详情。
- 支持补录历史购买；不要求每件都填价格，未填的显示“未记录”。

**穿着成本**

- 平均 CPW、CPW 最高 Top 10、买来还没穿列表、90 天利用率。
- 点击单品进入详情；可看到“再穿 X 次，CPW 降到 ¥Y”的提示（纯计算，不诱导消费）。
- CPW 排名排除 0 次穿着；0 次单列，避免除以零。

### 7.9 我的

- 风格画像：风格标签（多选）、偏好色、回避色、体感（怕冷/正常/怕热）。
- 尺码：上装、下装、鞋、连衣裙；仅记录，用于待购参考。
- 场景管理：内置只读 + 自定义增删改/归档。
- 类型管理：内置只读 + 自定义二级类型。
- 位置管理：位置树、排序、删除保护。
- 备份：导出完整/仅数据、导入合并/替换、上次备份时间、备份提醒周期。
- 存储：`navigator.storage.estimate()` 显示用量；照片数量与总大小；超过 80% 警告。
- 诊断：最近 50 条警告/错误，可复制文本；不含照片内容。
- 安装指南、版本、schema 版本、seed 版本、开源依赖列表。
- 主题：跟随系统/浅色/深色。

### 7.10 空状态与无障碍

空状态：

- 衣橱为空：“先添加第一件衣服”，给拍照/从相册选择两个入口；不显示假数据。
- 没有照片：色块 + 类型图标 + 名称，不显示破图。
- 搭配为空：“手动搭一套”/“让衣迹推荐”；推荐缺件时列出缺口。
- 采购为空：“记录想买的东西”或“补录一件已购”。
- 分析无数据：“穿几次后这里会出现利用率和 CPW”。

无障碍：

- 所有图标按钮有 `aria-label`；照片有 `alt`（衣物名称 + 序号）。
- 颜色选择同时显示名称，不只靠色块。
- 状态不只靠颜色；待洗/收纳/已移出都有文字。
- 触控目标 ≥ 44×44pt；数字键盘不遮挡输入。
- Sheet 打开时锁定背景滚动、Escape 关闭最上层、关闭后焦点回到触发按钮；嵌套 Sheet 只关最上层。
- 对比度 ≥ 4.5:1；支持系统大字体；不使用固定高度截断文字。
- 尊重 `prefers-reduced-motion`。

---

## 8. 技术架构

### 8.1 技术栈

沿用体迹的版本与选型，去掉当前未使用的 zustand，避免多一个空依赖。

| 层 | 选型 | 用途 |
|---|---|---|
| UI | React 19.3 + TypeScript 6.0（strict） | 组件与类型 |
| 构建 | Vite 8.3 + @vitejs/plugin-react 6.1 | 开发与生产构建 |
| 路由 | React Router DOM 7.18 | 客户端路由 |
| 样式 | Tailwind CSS 3.4 + CSS 变量 | 原子化与主题 |
| 图标 | lucide-react 1.62 | 导航与操作图标 |
| 数据 | Dexie 4.4 + dexie-react-hooks 4.4 | IndexedDB、事务、响应式查询 |
| 校验 | Zod 4.6 | 备份结构、表单边界 |
| 压缩 | fflate 0.8 | 备份 ZIP |
| 日期 | date-fns 4.4 | 本地日期与格式化 |
| PWA | vite-plugin-pwa 2.0 + Workbox | 离线与更新提示 |
| 图标生成 | @vite-pwa/assets-generator 2.0 | PWA 图标 |
| 测试 | Vitest 5.0 + RTL 16.3 + fake-indexeddb 6.2 + Playwright 1.64 | 单元、组件、E2E |
| 质量 | ESLint 10.13 + Prettier 3.9 + `tsc --noEmit` | 静态检查与格式 |
| 托管 | Cloudflare Workers 静态资源 + Wrangler 4.155 | 零成本部署 |

不引入：组件库、图表库、图片处理库、状态管理库、云服务 SDK、天气 SDK、AI SDK。

### 8.2 分层与目录

```
src/
  app/                 # 路由、AppShell、TabBar、主题、DB 门禁、PWA 更新、错误边界
  components/
    ui/                # Button、Card、Sheet、TextField、NumberField、Stepper、EmptyState...
    item/              # ItemCard、PhotoPicker、ColorSwatchPicker、LocationPicker
    outfit/            # OutfitCard、SlotPicker、RecommendationCard
    charts/            # 手写 SVG 条形图、迷你折线
  features/
    onboarding/
    today/
    wardrobe/
    outfits/
    purchase/
    settings/
    backup/
  domain/              # 纯函数：recommend、color、weather、price、stats、backup、date、format
  db/                  # schema、types、seed
    repositories/      # items、photos、categories、locations、outfits、wearLogs、
                       # scenes、purchases、wishlist、quotes、feedback、settings、backup
  content/             # categories.json、scenes.json、colors.json、style-tags.json
  lib/                 # cn、image（压缩）、money、random（mulberry32）、files
  styles/              # global.css、设计令牌
  test/                # setup、fixtures、测试工具
public/
  logo.svg
  _headers
```

依赖方向：

```
features → domain + db/repositories + components
db/repositories → db/schema + domain 类型
domain → 无 React、无 Dexie、无浏览器 API
components → 无业务查询，只接收 props
```

推荐算法放在 `domain/recommend.ts`，不依赖 Dexie，方便单测和未来复用。

### 8.3 状态与数据流

- 读取：页面用 `useLiveQuery` 订阅 Dexie 查询，数据变更自动刷新。
- 写入：表单/操作调用 repository；跨表写入用 Dexie 事务。
- 推荐：纯函数 + `useMemo`；输入是场景、温度、单品、搭配、反馈、风格画像；同一输入同一结果。
- 今日页：场景和温度存在 `settings`（`todaySceneId`、`todayTempC`），跨启动保留；推荐结果只存在组件状态。
- 表单草稿：`sessionStorage`；不写数据库，避免半成品进入统计。
- 缓存字段：`items.wearCount`、`items.lastWornAt`、`items.totalCostCents`、`outfits.wearCount` 由仓储在事务内维护；页面不手写。
- 派生数据：CPW、利用率、闲置、月度花费、颜色分布按需计算，不落库。
- 离线：Service Worker 预缓存全部构建产物；无运行时网络请求。
- 更新：`registerType: 'prompt'`；导入备份或上传照片时不打断，结束后再提示。

### 8.4 照片处理管线

1. 用户选择/拍摄图片，限制输入 ≤ 20MB；超过则提示。
2. 优先用 `createImageBitmap(file, { imageOrientation: 'from-image' })` 解码，自动纠正 EXIF 方向；失败时回退 `<img>` + `URL.createObjectURL`。
3. 画到 canvas：
   - 原图：最长边 1600px，JPEG 质量 0.82；若结果 > 600KB，降到 0.72，再不行 0.65。
   - 缩略图：最长边 320px，JPEG 质量 0.70。
   - 透明背景铺 `#FFFFFF`，避免黑底。
4. `canvas.toBlob` 得到 Blob；记录宽高和字节数。
5. 在同一个 Dexie 事务中写 `items` + `itemPhotos`；第一张照片设为封面。
6. 失败时允许“无照片保存”，不影响录入；在诊断表记录原因。
7. 列表只加载缩略图；`URL.createObjectURL` 按需创建并在卸载时 revoke；`loading="lazy"` + `decoding="async"`。
8. 删除照片后重排 `order` 并更新封面；删除最后一张时清空 `coverPhotoId`/`thumbPhotoId`。

估算：每张压缩图 150-350KB，缩略图 15-30KB；300 件 × 2 张 ≈ 100-200MB。设置页显示实际用量，超过配额 80% 警告，并建议只数据备份或清理照片。

### 8.5 PWA、离线与安全

- Manifest：`name=衣迹`、`short_name=衣迹`、`display=standalone`、`orientation=portrait`、`lang=zh-CN`、`start_url=/`、`scope=/`、主题色 `#A9502F`、背景色 `#F6F2EA`、192/512/maskable 图标。
- `index.html`：`apple-mobile-web-app-capable`、`apple-mobile-web-app-status-bar-style=black-translucent`、`apple-touch-icon`、`viewport-fit=cover`。
- Service Worker：Workbox 预缓存构建产物；`navigateFallback=/index.html`；清理旧缓存。
- 更新：应用内提示“稍后/立即更新”；导入/上传中延迟；`skipWaiting` 后刷新，IndexedDB 不变。
- 安装检测：iOS 用 `navigator.standalone`；未安装时在“我的”显示 Safari 添加主屏幕步骤。
- 持久化：引导时尝试 `navigator.storage.persist()`；设置页显示 `estimate()`。
- 安全头（`public/_headers`）：

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=()
  Content-Security-Policy: default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; manifest-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

- 不使用 `getUserMedia`；照片通过文件选择器的 `capture` 调用系统相机，不主动请求相机 API 权限。
- 无遥测、无第三方脚本、无外部字体、无 CDN；图标与颜色全部本地打包。
- 价格参考链接只在用户点击时打开系统浏览器；不预取、不抓取、不写入页面内嵌浏览器。
- 备份 ZIP 包含衣物照片与价格信息，属于隐私数据；导出时提示保管。

### 8.6 性能边界

- 衣橱列表：两列缩略图，`content-visibility: auto`；首屏先渲染 40 件，滚动加载更多（每批 40）。
- 搜索：全量取出后在内存过滤；≤ 2000 件时目标 < 50ms。超过 2000 件的体验不在首版承诺内。
- 推荐：每槽位最多 8 个候选，最多评估 512 套；目标 < 80ms（iPhone 15 Pro）。
- 图片：列表永远不加载原图；详情页才加载原图。
- 备份：导出/导入显示进度和当前表；照片多时用 `fflate` 异步压缩，避免界面卡死。
- 数据库：不把 Blob 放进 `items`，避免列表查询拖入大对象；照片独立表按需查询。
- 不使用虚拟列表；先用分页 + `content-visibility`，真机测试后再决定。

---

## 9. 关键流程

### 9.1 首次引导

1. 欢迎与隐私说明：本地存储、无账号、无云同步、照片不离开手机、备份责任。
2. 风格画像（可跳过）：选 2-3 个风格标签、偏好色、回避色、体感偏好。
3. 尺码（可跳过）：上装、下装、鞋、连衣裙；只用于待购参考。
4. 位置：默认没有任何位置；提供“一键创建推荐结构”按钮（主卧衣柜/玄关鞋柜/换季收纳），用户确认后创建，也可以手动新建或跳过。
5. 添加第一件衣物：拍照/相册 → 类型 → 颜色 → 位置 → 保存；可跳过。
6. 备份提醒设置：默认 30 天；完成。
7. 进入今日页，显示空状态清单：添加至少 1 件上装、1 件下装、1 双鞋后即可推荐。

引导全程可跳过；跳过不阻塞任何功能。**不预置任何衣物或穿着记录。**

### 9.2 添加衣物

1. 今日/衣橱点“+”，进入录入表单。
2. 拍照或从相册选择；后台压缩并生成缩略图。
3. 选类型（二级选择器，支持搜索和最近使用）；自动填名称、正式度、保暖值、季节。
4. 选主色（色板 + 自定义）；可选辅色、图案、材质、品牌、尺码。
5. 选位置（树形选择器）；可新建位置或暂不指定。
6. 可选填购买价格/渠道/日期；保存后生成购买记录。
7. 保存：事务写 `items` + `itemPhotos` + `purchases`；返回衣橱并高亮新卡片。

### 9.3 整理与换季

1. 衣橱点“选择”，多选衣物。
2. 选择“移动到位置”→ 树形选择目标位置 → 确认；事务批量更新。
3. 选择“换季收纳”→ 状态改 `stored`，可同时指定收纳位置。
4. 选择“移出衣橱”→ 状态改 `retired`，二次确认；历史与购买记录保留。
5. 位置视图查看每个柜子/箱子的件数；删除位置前必须先清空。
6. 换季取出：筛选 `stored`，批量改回 `available`，可同时移动位置。

### 9.4 手动搭配

1. 搭配页点“新建”。
2. 选场景；依次点槽位选择单品；支持搜索和筛选。
3. 系统实时显示完整度和缺失槽位；允许保存不完整搭配，但标记。
4. 自动命名，可改；可选收藏、备注。
5. 保存：事务写 `outfits` + `outfitItems`。
6. 进入详情，可“穿这套”或继续编辑。

### 9.5 推荐与穿着

1. 今日页选场景、填温度（默认上次）。
2. 点“换一套”或进入推荐面板生成 3-5 套。
3. 查看解释；可喜欢/不喜欢/保存。
4. 点“就穿这套”：
   - 写 `wearLogs`（日期、场景、温度、itemIds、items 快照、outfitName）；
   - 更新单品 `wearCount`/`lastWornAt`；
   - 更新搭配统计；
   - 如果是未保存的推荐结果，询问是否保存为搭配。
5. 记录后提示“加入待洗？”可对本次穿着的单品快速标记；也可稍后在今日页处理。
6. 删除穿着记录：确认后重算受影响单品和搭配的统计。

### 9.6 采购比价

1. 采购页“记一件想买”→ 填名称、类型、目标价、优先级、尺码/颜色偏好。
2. 进入待购详情，逐条“记一笔报价”：渠道、商品价、运费、优惠、日期、链接（可选）。
3. 报价按到手价自动排序，最低价标记；显示与目标价差额和价格历史。
4. 决定购买 → “标记已购”→ 预填单品表单 → 保存；报价转购买记录，待购状态 `bought`。
5. 放弃 → 状态 `dropped`，保留报价历史供以后参考。

### 9.7 已购花费与 CPW

1. 单品详情填/补购买记录；总花费实时更新。
2. 每次穿着记录自动累加穿着日期数；CPW 实时更新。
3. 采购页“已购花费”看月度/类型/渠道汇总。
4. “穿着成本”看平均 CPW、最高 CPW、买来没穿的清单。
5. 删除购买/穿着记录后，相关缓存字段重算，统计保持一致。

### 9.8 删除与恢复

- 单品：移出衣橱（软删除）→ 可在“已移出”筛选找回；彻底删除需二次确认。
- 搭配：删除关联；穿着历史保留快照。
- 位置：空位置才可删除；否则要求迁移。
- 类型：自定义且无引用才可删除；内置只读。
- 场景：被引用时只能归档。
- 待购：删除会删除报价；已转换的单品不受影响；需提示。
- 备份：导入失败不改动原数据；替换全部需二次确认。

### 9.9 备份与恢复

**导出**

1. 选择“完整（含照片）”或“仅数据”。
2. 收集除 `diagnostics` 外的所有表；生成 `manifest.json` 和 `data.json`。
3. 完整模式把 `itemPhotos` 的 Blob 写入 `photos/`，缩略图写入 `thumbs/`。
4. 用 fflate 打包，文件名带日期；显示进度和总大小。
5. 优先 Web Share API 分享到“文件”/iCloud Drive；不支持时触发下载。
6. 成功后更新 `lastBackupAt`，清除提醒。

**导入**

1. 选择 ZIP → 解压 → Zod 校验 manifest 和 data。
2. 检查 schemaVersion：旧版本迁移，新版本拒绝。
3. 显示预览：单品、搭配、穿着、价格、照片数量与大小。
4. 选择“合并”或“替换全部”；替换需二次确认并建议先导出。
5. 在一个 Dexie 事务中写入；失败回滚，原数据不变。
6. 恢复照片 Blob；仅数据导入时保留照片引用并显示占位。
7. 重新播种内置内容，重算缓存字段，刷新界面，记录诊断。

---

## 10. 错误处理与恢复

| 场景 | 处理 |
|---|---|
| 全局异常 | 路由级 + 应用级错误边界；显示“重新加载/回到今日”；写诊断表 |
| IndexedDB 打开失败 | 恢复页：导入备份 / 清除本地数据并重试；清除前尽量导出 |
| 写入失败 | Dexie 事务回滚；提示“未保存”；不显示成功状态 |
| 照片解码失败 | 提示格式不支持；允许无照片保存或换一张；记录诊断 |
| 照片过大 | 输入 > 20MB 拒绝；压缩后仍过大则降质量；提示 |
| 存储配额不足 | 写入前检查 `estimate()`；超过 80% 警告；失败时提示备份/删照片 |
| 推荐无结果 | 显示缺失槽位/已放宽条件；给添加衣物的直达入口；不生成半套 |
| 导入校验失败 | 不改动原数据；显示具体原因（版本/结构/照片） |
| 导入中断 | 事务回滚；提示重试；保留原库 |
| 位置删除受阻 | 说明还有多少件衣物/子位置；提供迁移入口 |
| 类型/场景删除受阻 | 说明引用数量；提供迁移或归档 |
| 备份文件过大 | 提示改用“仅数据”或清理照片；显示预估大小 |
| 更新提示 | 导入/上传中不打断；结束后再提示 |
| 无效输入 | 名称 1-40 字；价格 0-9,999,999 分；温度 -30-45；备注 ≤500 字；超范围拒绝并提示 |

诊断表最多 50 条，先进先出；只记录错误信息，不记录照片内容或完整备份数据。

---

## 11. 测试策略

### 11.1 领域层（Vitest）

- `domain/recommend`
  - 必要槽位；≤12°C 自动加外套；连衣裙替代上装+下装。
  - 排除 laundry/repair/stored/retired。
  - 场景正式度硬过滤与扣分。
  - 温度带与保暖评分；怕冷/怕热偏移。
  - 颜色：中性色、同色系、冲突色、多图案扣分。
  - 新鲜度：1-2 天内避免重复；无替代时才允许。
  - 不喜欢签名排除；喜欢/保存加分。
  - 确定性：同 seed 同结果；“换一套”结果不同但可复现。
  - 候选不足的放宽顺序；永远不放宽状态。
  - 推荐解释非空且与主要得分维度一致。
- `domain/color`：配对分、最低/平均组合、图案惩罚。
- `domain/weather`：温度带边界（5/6、12/13、18/19、24/25、29/30）。
- `domain/price`：到手价、折扣/运费、CPW、0 次穿着、不同日期去重、月度/类型/渠道汇总、最低价并列。
- `domain/stats`：利用率、闲置判定、最久未穿。
- `domain/backup`：Zod 校验、合并最新、替换、仅数据、照片缺失。
- `domain/date`：本地日期、周一起始、跨月/跨年。

目标：领域层行覆盖率 ≥ 90%。

### 11.2 仓储层（fake-indexeddb）

- 单品 CRUD；软删除/恢复；彻底删除级联照片/购买/搭配关联；穿着快照保留。
- 位置树；移动；删除保护；未指定桶。
- 类型删除保护与迁移。
- 搭配 + 关联事务；删除搭配不影响穿着记录。
- 穿着记录写入后统计缓存正确；删除后重算正确；同日多次只算一次。
- 购买记录增删改后 `totalCostCents` 正确。
- 待购报价排序、转已购、放弃。
- 备份导出/导入往返一致；照片 Blob 可读。

### 11.3 组件（RTL）

- ItemForm：类型默认值、名称自动生成、MoneyField、照片上传失败、草稿恢复。
- PhotoPicker：压缩 mock、最多 5 张、删除/重排封面。
- LocationPicker：树选择、新建位置、未指定。
- OutfitEditor：槽位选择、连衣裙替代、完整度提示、保存校验。
- RecommendationPanel：生成、换一套、喜欢/不喜欢、保存、穿这套、缺件提示。
- PriceCompare：报价排序、最低价、目标差额、标记已购。
- 批量整理：多选、移动、换季、移出确认。
- 空状态、错误状态、无障碍标签。

### 11.4 E2E（Playwright）

1. 首次引导（可跳过）→ 衣橱空状态 → 添加带照片的单品 → 刷新后仍在。
2. 添加上装/下装/鞋 → 今日选场景和温度 → 生成推荐 → 穿这套 → 单品穿着次数 +1。
3. 新建手动搭配 → 保存 → 收藏 → 删除 → 穿着历史仍在。
4. 批量移动位置 → 位置视图件数正确 → 删除空位置；删除非空位置被阻止。
5. 待购 → 记 3 个渠道报价 → 最低价正确 → 标记已购 → 生成单品和购买记录 → CPW 显示。
6. 导出完整备份 → 清空数据库 → 导入 → 单品/搭配/穿着/照片一致。
7. 导入仅数据备份 → 照片占位提示。
8. 飞行模式重载 → 仍可录入、推荐、记录穿着。
9. 图片压缩后尺寸/大小在限制内（通过页面注入的测试钩子或直接调用领域函数）。

E2E 使用 `npm run preview` 启动 `dist/`，因此必须先 `npm run build`；CI 跑 Chromium，WebKit 在本地/真机手动跑。

### 11.5 真机手动测试（iPhone 15 Pro）

- Safari 添加到主屏幕、独立窗口、安全区、状态栏。
- 拍照和从相册选择；HEIC/JPEG；横拍照片方向正确。
- 连续添加 50 件、每件 2 张照片；滚动流畅、内存不崩。
- 断网启动、录入、推荐、记录穿着、重启后数据仍在。
- 导出含照片 ZIP（目标 100MB+）到“文件”App；再导入。
- 导入时切换后台/锁屏，失败可回滚。
- 深色/浅色、系统大字体、低电量模式。
- 长按/多选/批量移动的触控体验。
- 删除位置、类型、场景的保护提示。
- 推荐结果在真实衣橱下的可接受度；记录“换一套”次数和最终是否穿。

### 11.6 CI

GitHub Actions（Node 22）：`npm ci` → `tsc --noEmit` → `eslint` → `vitest run` → `npm run build`。

E2E 不在每次 CI 强制跑；发布前本地跑 Chromium + 真机手动。

---

## 12. 部署、运行与运维

### 12.1 部署

1. 创建私有 GitHub 仓库 `closettrace`。
2. Cloudflare Workers & Pages → Connect to Git。
3. 构建命令 `npm ci && npm run build`；部署命令 `npx wrangler deploy`；Node 22。
4. `wrangler.jsonc` 指向 `dist/`，`not_found_handling: single-page-application`。
5. `public/_headers` 随构建进入 `dist/`，安全头生效；不要放 `_redirects`（Workers 会循环）。
6. 推送 `main` 自动构建并部署；CI 只校验，不部署。
7. 首次部署得到 `https://closettrace.<子域>.workers.dev`；可选自定义域名。

### 12.2 安装到 iPhone

1. Safari 打开部署地址。
2. 分享 → 添加到主屏幕 → 名称“衣迹”。
3. 从主屏幕打开，确认独立窗口、无地址栏。
4. 飞行模式启动，添加一件衣物、生成一次推荐、记录穿着。
5. 导出一次完整备份到“文件”App；再导入验证。
6. 在“我的”确认版本、存储用量、上次备份时间。

### 12.3 更新与回滚

- 更新：推送 `main` → Cloudflare 自动构建 → App 内提示 → 用户确认后刷新；IndexedDB 不变。
- 导入/上传照片期间不强制更新；结束后再提示。
- 回滚：Cloudflare Deployments → 选择上一版本 → Rollback；或 revert 提交。
- schema 变更：先发布兼容读取版本，再迁移；发布前用旧备份 fixture 跑迁移测试。
- 保留每个版本的 `dist` 备份。

### 12.4 备份运维

- 默认每 30 天导出一次完整备份；大批量录入后额外导出一次。
- 每月把一份备份复制到电脑或外部存储。
- 每次应用更新前导出一次。
- 每季度在空数据库做一次导入演练。
- 备份含衣物照片与价格，注意保管，不公开分享。

### 12.5 成本

- Cloudflare 静态托管：¥0。
- GitHub 私有仓库：免费。
- 域名：可选，约 ¥60-100/年；不买则用 `workers.dev`。
- 无服务器、数据库、天气、AI、云同步费用。

---

## 13. 里程碑与验收

### 13.1 里程碑

| 阶段 | 内容 | 产出 |
|---|---|---|
| M1 基础与衣橱 | 脚手架、设计系统、Dexie schema、内置类型/场景/颜色、引导、单品 CRUD、照片、位置、批量整理 | 可安装的空壳 + 完整衣橱 |
| M2 搭配与穿着 | 搭配编辑器、搭配详情、穿着记录、待洗、今日页 | 手动搭配与记录闭环 |
| M3 推荐 | 规则引擎、温度/场景、解释、反馈、冷启动、今日推荐 | 场景化推荐闭环 |
| M4 采购与洞察 | 待购、报价、已购花费、CPW、利用率、衣橱分析 | 价格对比与成本闭环 |
| M5 备份与上线 | ZIP 含照片、导入合并/替换、PWA、E2E、真机测试、部署 | 日常可用版本 |

按每周 10-15 小时投入估算约 5-6 周；实际以实施计划为准。

### 13.2 验收清单

- [ ] `npm run typecheck`、`npm run lint`、`npm test`、`npm run build` 全部通过。
- [ ] iPhone 安装为独立 PWA，安全区正确，无横向滚动。
- [ ] 添加 5 件带照片的衣物 ≤ 3 分钟；照片方向正确、缩略图清晰。
- [ ] 位置树可创建、移动、批量整理；删除非空位置被阻止。
- [ ] 衣橱至少 1 上装 + 1 下装 + 1 鞋时，任意 3 个场景 × 3 个温度带都能给出至少 1 套可解释推荐；每个必要槽位 ≥3 件备选时能给出 3 套。
- [ ] 推荐排除待洗/收纳/已移出衣物；解释与结果一致。
- [ ] “不喜欢”后同组合不再出现；“换一套”结果有变化。
- [ ] 手动搭配可保存、编辑、收藏、删除；穿着历史保留快照。
- [ ] 今日记录穿着 ≤ 2 次点击；单品穿着次数和 CPW 立即更新。
- [ ] 待购 3 个渠道报价正确排序，最低到手价和差额正确；标记已购生成单品与购买记录。
- [ ] 备份导出/导入含照片，条数与照片一致；仅数据导入显示占位。
- [ ] 飞行模式可完成录入、推荐、穿着、比价。
- [ ] 连续 7 天真实使用无阻断；备份提醒按设置出现。
- [ ] 无控制台错误；无网络请求（除静态资源）。

### 13.3 7 天试点

1. 第 1 天：安装、建立位置、录入 10 件常穿衣物。
2. 第 2 天：录完剩余衣物，批量标换季收纳，测试按位置找。
3. 第 3 天：手动搭 2 套，生成 3 个场景推荐，记录穿着。
4. 第 4 天：为 2 件想买的衣服记录多渠道报价。
5. 第 5 天：查看 CPW、利用率、闲置清单，调整衣橱。
6. 第 6 天：导出完整备份到“文件”，清空后导入验证。
7. 第 7 天：复盘推荐质量和录入负担，修复阻断项；通过后作为日常工具。

---

## 14. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| 衣橱数据少，推荐显得笨 | 用户不信任推荐 | 冷启动引导补齐槽位；放宽条件并解释；不生成半套；手动搭配兜底 |
| 照片占用大、备份慢 | 存储不足/备份失败 | 客户端压缩、缩略图、仅数据备份、存储用量提示 |
| 手动录入负担重 | 录一半放弃 | 类型默认值、自动名称、少字段优先、草稿、批量整理 |
| 价格靠手填、容易过期 | 比价参考价值下降 | 每笔报价带日期；显示最近记录；明确“手动记录，不自动抓取”；后续粘贴解析 |
| 颜色/属性主观 | 推荐颜色不和谐 | 只用色系和色相做粗判；用户可覆盖；照片仅作参考 |
| 推荐偏向新衣服 | 旧衣服更闲置 | 新鲜度加分 + 闲置提示 + 轮换推荐 |
| 分类/位置越建越乱 | 找不到、统计失真 | 内置类型、两级树、删除保护、未指定桶、批量迁移 |
| iOS 清理站点数据 | 数据丢失 | 安装到主屏幕；30 天备份；季度导入演练 |
| 备份含隐私照片 | 泄露风险 | 本地保存、导出提示、不公开分享、无云同步 |
| 范围膨胀 | 延期 | v1 功能锁定；天气/打包/CSV/AI 放后续 |
| Windows 无法真机调试 | Safari 差异 | Playwright WebKit + iPhone 真机 + 预览部署 |
| 单静态托管依赖 | 无法更新 | 已安装可离线；保留 dist；备用托管 |

---

## 15. 后续版本

### v1.1

- 快捷指令把天气写入 URL 参数（`/?temp=18`），App 仍不联网。
- 粘贴商品文本/链接后本地解析价格（正则，不联网）。
- 从照片自动提取主色（本地 canvas，可手动修正）。
- 锁定单品后只换其余槽位。
- 搭配日历与“明天穿什么”预告。
- 旅行打包清单：按天数/场景/温度生成清单。
- CSV 导出单品、穿着、花费；CSV 导入历史单品。
- 换季提醒：按月份和季节标签提示整理。

### v1.2

- 搭配封面生成与分享图（本地 canvas 合成，不依赖后端）。
- 二手转卖记录与回血成本。
- 多衣橱（家/宿舍/度假屋）。
- 更细的洗护与维修记录。
- 可选 Capacitor 原生壳（需要 Mac），复用领域层与界面。

### 明确不做

- 在线 AI 穿搭/识图（需要网络与费用，违背本地优先）。
- 电商自动比价/爬虫（需要后端，涉及平台条款）。
- 社交、排行、租赁、支付。
- 多用户实时同步。

---

## 16. 待你确认的产品决策

以下是我建议的默认方案。你审阅时只需回复“同意”或指出要改的项。

| # | 决策 | 建议方案 | 可选方案 | 影响 |
|---|---|---|---|---|
| 1 | 推荐引擎 | **离线规则引擎**，可解释、零成本、隐私最好 | 在线 AI 推荐（需后端/API/费用，违背本地优先） | 核心架构；改 AI 会推翻第 8 节 |
| 2 | 天气来源 | **手动输入温度**；后续用快捷指令写 URL 参数 | 接天气 API（需联网，CSP 要放开） | 推荐输入与隐私边界 |
| 3 | 删除语义 | **默认移出衣橱（软删除）+ 彻底删除** | 直接硬删除 | 历史统计与找回能力 |
| 4 | 价格对比范围 | **待购多渠道报价 + 已购花费 + CPW** | 只记录购买价；或接自动比价 | 第 5.7、6.4、7.8 节范围 |
| 5 | 照片数量 | **每件最多 5 张，第一张封面** | 只允许 1 张 | 存储与录入时间 |
| 6 | 内置场景 | **9 个场景 + 自定义** | 减少到 5 个 | 今日页复杂度 |
| 7 | 货币 | **仅人民币** | 多币种（需汇率，无法离线准确） | 数据模型与展示 |
| 8 | 目标衣橱规模 | **100-500 件，设计上限 2000** | 更大家橱（需要虚拟列表/分页重构） | 性能边界 |
| 9 | 是否要搭配日历 | **v1.1** | v1.0 就做 | 首版工期 |
| 10 | 是否要旅行打包 | **v1.1** | v1.0 就做 | 首版工期 |

### 最需要你拍板的三件事

1. **推荐是否接受“规则引擎”而不是在线 AI？** 这是隐私、成本和可解释性的分水岭。
2. **价格对比是否接受手动记录报价？** 自动抓取需要后端，和“本地优先、零成本”冲突。
3. **删除默认是“移出衣橱”还是“彻底删除”？** 我建议默认软删除，避免 CPW 和穿着历史断裂。

---

## 17. 附录

### 17.1 推荐走查示例

衣橱：

- 米白衬衫：top，正式度 3，保暖 2，中性色，风格简约，8 天未穿。
- 黑西裤：bottom，正式度 3，保暖 3，中性色，3 天未穿。
- 棕色乐福鞋：shoes，正式度 3，保暖 2，中性色，20 天未穿。
- 藏青西装外套：outer，正式度 4，保暖 3，中性色，30 天未穿。

输入：通勤，12°C，正常体感。

计算：

- 目标保暖 4.0；上装 2 + 外套 3 × 0.6 = 3.8，偏差 0.2。
- 颜色：白/黑/棕全是中性色，配对分 100，颜色分 30。
- 正式度：衬衫 3、西裤 3、鞋 3、外套 4，平均偏差约 0.25，正式度分约 18。
- 新鲜度：8/3/20/30 天，分数约 9。
- 风格：与简约画像重合，约 8。
- 反馈：未反馈，2。
- 新颖度：14 天没穿这个组合，5。
- 总分约 91。

解释：“中性色组合稳定；通勤正式度匹配；12°C 下保暖 3.8，接近目标 4.0。”

### 17.2 术语

- **CPW**：Cost Per Wear，单次穿着成本 = 总花费 ÷ 穿着日期数。
- **槽位（slot）**：搭配中的位置，如上装、下装、外套、鞋、包、配饰。
- **正式度**：1 居家/运动，2 休闲，3 通勤，4 商务，5 正式。
- **保暖值**：1 很薄到 5 很厚，用于温度匹配。
- **到手价**：商品价 + 运费 − 优惠。
- **软删除**：移出衣橱但保留数据和历史，可恢复。
- **快照**：写入时保存当时的名称/类型/颜色，后续修改或删除不影响历史。

### 17.3 设计原则

1. **先能穿，再好看**：推荐先保证槽位、场景、温度，再谈颜色和风格。
2. **解释优先**：每个推荐都要能说清“为什么”，否则用户不会信。
3. **不制造焦虑**：CPW 和闲置提示是参考，不用红色催促、不做消费主义推送。
4. **默认空白**：不塞示例衣物、不伪造数据；只给字典和引导。
5. **本地优先**：任何需要联网才能成立的功能，都不放进首版核心路径。
6. **整理比录入更重要**：批量移动、换季、按位置找，是衣橱长期可用的关键。
7. **删除可恢复**：衣物是资产也是记忆，默认软删除，彻底删除要明确确认。

---

## 18. 审阅回执

请重点看：

- 第 4.7 节推荐规则是否符合你对“推荐搭配”的预期。
- 第 5.3 / 6.4 / 7.8 节的采购比价范围是否够用。
- 第 7.1 节的 5 个标签是否符合你的日常使用习惯。
- 第 16 节的三项拍板。

确认后我再输出实施计划（按里程碑拆任务、文件清单、测试清单），然后开始编码。
