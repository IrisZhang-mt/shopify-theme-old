# moodytiger Theme（old / 生产环境）Agent 指南

## 一、仓库定位

这个目录是 moodytiger 当前**线上运行**的 Shopify Online Store 2.0 主题。

它不是从统一设计系统规划出来的，而是多年营销活动、多次促销上线逐步
堆叠出来的结果：section 命名不统一、模板按活动复制、配置项持续累积。
同级目录 `d:\work\new` 是针对这些问题的一次从零重建，目标架构以那边
为准，这个仓库应被当作"正在被替换的对象"来对待。

在这个仓库中工作的 agent，应优先遵循以下原则：

- 改动尽量小、易审查、易回滚
- 先搜索是否已有相近文件，再决定新建还是复用
- 尽量降低对现有 storefront 行为的风险
- 保护埋点、SEO、多语言、多市场配置和商家侧设置

## 二、项目结构模型

这不是 monorepo，是单一主题的标准 Shopify 目录结构，各目录职责如下：

- `layout/` —— 页面外壳（`theme.liquid`、`password.liquid`）
- `sections/`、`blocks/` —— 页面模块与主题 block
- `snippets/` —— 可复用的局部模板
- `templates/` —— 每种页面类型的 JSON/Liquid 模板
- `config/` —— 主题设置定义与商家配置数据
- `locales/` —— 多语言文案
- `assets/` —— CSS、JS、字体、图片等静态资源

当前状态（体量参考，判断风险时用）：

- 127 个 section、90 个 snippet、3 个 `ai_gen_block_*.liquid` block
- 163 个资源文件，约 130 个模板文件
- `locales/` 下 10 个语言文件：`en.default`、`zh-CN`、`zh-TW`、`de`、
  `es`、`fr`、`it`、`nl`、`tr`、`eo`
- `config/settings_schema.json`（约 28KB）、`settings_data.json`
  （约 48KB）、`markets.json`（多市场/国际化定价）

## 三、最核心的工作原则

在动手修改前，先判断这个改动应该落在哪一层：

- **改共享的通用 section/snippet**：适用于所有页面、所有语言都应该
  生效的能力
- **改某个具体页面的模板/section 变体**：适用于单一页面或单次营销
  活动的专属需求
- **新建 `*.活动名.json` 模板或 `cust_*` section**：只在确认没有可
  复用的现有文件、且任务明确要求做一次性活动页时才这么做

不要默认新建文件。这个仓库最大的结构性问题就是"新建"太容易、"复用"
太难——先搜索关键词，确认没有足够接近的候选，再考虑新建。

## 四、项目概览

- 平台：Shopify Theme（Online Store 2.0）
- 技术栈：Liquid、JSON templates、CSS、JavaScript
- 根目录没有 `package.json`、打包工具，也没有 Shopify CLI 配置文件
  ——这是一个直接编辑的纯主题文件目录
- 假定通过 `shopify theme dev` / `shopify theme push` 针对线上店铺
  操作；任何一次推送都应视为**用户可见的生产环境影响**，推送/部署前
  必须先确认

## 五、目录说明

- `layout/theme.liquid`、`layout/password.liquid`
- `sections/`：标准 kebab-case 命名（如 `featured-collection.liquid`）
  与 `cust_`/`cust-` 前缀的一次性文件（如
  `cust_shop-the-look.liquid`）、以及临时拼凑的 camelCase 活动
  section（如 `blackFive_activityPage2.liquid`）混杂
- `blocks/`：目前只有 3 个 AI 生成的 block（`ai_gen_block_*.liquid`）
- `snippets/`：90 个，命名与用途一致性弱于 `new` 重建版
- `templates/`：按页面类型分类的 JSON 模板，其中很大一部分是按营销
  活动复制出来的变体（见第八节）；仍保留少数遗留 `.liquid` 模板
  （`gift_card.liquid`、`page.findourstoremap.liquid`、
  `page.judgeme_all_reviews.liquid`、`search.recently-viewed.liquid`、
  `cart.discountyard.liquid`）
- `config/settings_schema.json`、`settings_data.json`、`markets.json`
- `locales/`：10 种语言，见第二节
- `assets/`：163 个文件；section 与资源文件之间不保证一一对应，应
  查看 `theme.liquid` 或 section 内的 `{% stylesheet %}` /
  `{% javascript %}` 标签来确认实际引用关系，不要凭文件名猜测

## 六、高风险区域

以下文件或范围属于高风险区域，只有在确有必要时才修改：

- `layout/theme.liquid`
- `sections/header.liquid`、`sections/header-group.json`
- `sections/footer.liquid`、`sections/footer-group.json`
- `sections/main-product.liquid`、`sections/main-collection-*.liquid`、
  `sections/main-cart.liquid`
- `config/settings_schema.json`、`config/settings_data.json`、
  `config/markets.json`
- `snippets/header-tracking.liquid`（见第十一节，单独重点说明）
- `locales/*.json`（10 个文件，改一处翻译 key 要联动检查是否需要
  同步其余 9 个）

## 七、按页面/活动范围做判断的编辑规则

- 任何需求都先判断真实影响范围：是所有页面通用的问题，还是某个具体
  活动页/模板的问题
- 如果是线上 storefront 问题，先确认它是：
  - 出在通用 section/snippet 里
  - 还是只出在某个 `*.活动名.json` 模板或 `cust_*` section 里
- 通用问题改通用文件；活动专属问题改对应的活动模板/section，不要
  为了图省事把通用文件也顺带改动
- 不要把通用修复复制粘贴进某个活动专属文件，除非该活动页确实需要
  长期保持独立分叉

## 八、模板与 Section 规则（重点：模板膨胀）

`templates/` 里存在大量**按营销活动复制出来的一次性 JSON 文件**，
而不是可复用的、由 metafield 驱动的模板，例如：
`product.black-friday-2024.json`、`collection.summer-sale-2025.json`、
`collection.summer-sale-2025-2.json`、`page.about-us-2025.json` 等。
其中不少彼此之间、或与基础模板之间几乎是重复的。这是 `new` 重建要
解决的主要问题——**除非任务明确要求做一次性活动页**，否则不要延续
这种模式。

- 在创建新的 `*.活动名.json` 模板或 `cust_*` section 之前，先搜索是否
  已有足够接近、可以复用或参数化的现有文件
- 优先做最小可行修改，落在具体的 section/snippet/asset 上，不做全局
  theme 级改动
- 修改 JSON 模板时，除非任务明确要求做结构调整，否则不要随意改动
  section id、block id、app block payload 或 section 排序结构

## 九、配置文件规则

- `config/settings_data.json` 视为商家维护的生产状态，除非任务明确
  要求修改配置状态，否则不要编辑
- 配置项的定义改 `config/settings_schema.json`；新增设置前先检查
  是否已存在同类设置，这个规模下（约 28KB）重复项很容易被忽略
- `config/markets.json` 涉及多市场定价，改动前确认不会影响其他市场

## 十、构建与校验流程

这个仓库没有构建脚本或校验脚本，改动即所见即所得。涉及 storefront 的
修改建议按以下顺序思考：

1. 先确认影响范围（全站通用 / 单一活动页 / 单一语言）
2. 修改对应的 section / snippet / template / asset
3. 用 `shopify theme dev` 本地预览
4. 需要时用 `shopify theme push` 推送到指定环境（明确是预览环境还是
   生产环境）

## 十一、第三方与埋点保护规则

以下内容要特别谨慎：

- `snippets/header-tracking.liquid`（渲染在 `<head>` 中，硬编码了
  Google Analytics（`gtag`）、Microsoft/Bing UET、Meta 与 Google 的
  域名验证 meta 标签、Hotjar、Ptengine，以及一个 `kiwiSizing` 的
  render）
- 其他 analytics/埋点 snippet、app embed、评论组件（如 judge.me 相关
  模板）、consent/GTM 逻辑、各类 pixel

除非任务明确要求，不要移除、重命名或重构以下内容：

- 埋点钩子与 analytics markup
- app 容器
- 评论组件容器

这些 ID/标记是正在运行的生产环境营销基础设施，不是普通字符串——一个
错误的 ID 会静默地破坏分析/归因数据，而不会报出明显的错误。请把这些
ID 当作仅限内部使用的信息，不要粘贴到外部工具或在本工作区之外分享。

## 十二、验证要求

至少验证你实际改动触达的部分：

- Liquid 和 JSON 仍然合法
- 目标页面/模板可以正常渲染
- 桌面端和移动端行为正常
- 若改动涉及多语言，确认其余语言文件没有被无意间破坏
- 若改动涉及通用文件，确认没有意外影响到其他活动页/模板

## 十三、交付说明要求

在汇报结果时，始终说明：

- 改了什么
- 改动是通用文件还是某个活动专属文件
- 会影响哪些页面/活动/语言
- 做了哪些验证
- 有哪些假设或未验证的风险

## 十四、拿不准时的默认策略

- 优先选择影响范围更小的方案
- 如果不确定是不是通用逻辑，优先当作活动专属处理，不要写进通用文件
- 涉及埋点、多语言、商家配置数据时，先明确提示风险，再动手
- 不要为了"顺手清理"而重构历史遗留的命名混乱，除非任务明确要求

## 十五、品牌语气（适用于任何面向客户的文案）

标语："Stay in the play."。温和从容而非生硬，强调"活动"而非"性能
炫耀"，鼓励而非施压，乐观而非煽情。说服顺序是情感 → 功能 → 证明——
绝不以面料化学成分或安全声明开头。对标品牌是
Patagonia / Veja / Lululemon，而不是 Nike 那种张扬风格。即使在较旧的
活动 section 里，这一标准依然适用——不要让历史遗留的文案风格成为新
文案的参照标准。
