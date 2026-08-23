# EasyRequestSearch 功能完善路线图

按「排障价值 × 实现成本」排序。完成一项就勾选并附实现说明。

## 第一梯队：价值高、成本低

- [x] 1. 搜索响应内容
  - 搜索框支持 `response:关键字` 与自由文本匹配已加载的响应正文（`FilterField` 增加 `response`，高级筛选字段同步增加「响应内容」）。
  - 约束：响应体按需加载，只有已加载过（或演示数据自带）的响应可被搜到。
- [x] 2. 筛选条件持久化 + 命名预设
  - 当前筛选自动存入 localStorage，重开面板自动恢复。
  - 高级筛选面板内可把当前筛选保存为命名预设，随时应用 / 删除。
- [x] 3. 失败 / 取消请求的完整状态
  - 状态分组增加「失败」（status ≤ 0：失败和取消都没有 HTTP 状态；原因取 HAR 的 `_error` 字段，如 net::ERR_FAILED、CORS 失败、取消）。
  - 列表状态列显示「失败」，详情头部展示失败原因（statusText 优先，缺省取 `_error`）。
- [x] 4. 复制为 fetch / axios
  - 详情头部「cURL」按钮升级为复制菜单：cURL / fetch / Node axios 三种格式。

## 第二梯队：价值高、成本中等

- [x] 5. HAR 导出
  - 导出按钮升级为菜单：HAR 1.2（通用格式，可被 Chrome / Charles / Fiddler 打开，敏感请求头同样脱敏）+ 原有 JSON。
- [x] 6. 列表虚拟滚动 + 缓冲上限
  - 请求列表虚拟化（千级请求不卡）；面板侧保留最近 N 条环形缓冲。
- [x] 7. 瀑布图列
  - 按开始时间对齐的耗时条形图，工具栏可开关。

## 第三梯队：锦上添花

- [x] 8. WebSocket / SSE 帧查看 —— **评估后保持暂缓**
  - 结论：`chrome.devtools.network` API 不暴露 WS/SSE 帧；采集帧必须改用 `chrome.debugger`（CDP 的 `Network.webSocketFrame*` 事件），这会给浏览器挂上"正在调试此浏览器"警告条并要求新增权限，属于产品级取舍而非纯代码工作。有真实需求时再立项。
- [x] 9. 键盘导航（↑↓ 切换请求、Esc 清空筛选）
- [x] 10. 主题切换（明暗两套调色板已就绪，默认跟随系统，手动切换后持久化）
- [x] 11. i18n（中英词典 + 顶栏一键切换，选择持久化）

## 明确不做

- 请求拦截 / 改写：扩展权限模型下体验别扭，官方 Network 面板自带。
- 请求重放：CORS 与凭证问题多，收益低。

## 现场新增需求

- [x] 12. 批量搜索（多关键词 OR 匹配 + 每关键词一色）
  - 顶栏「批量搜索」按钮弹出多行输入框，每行一个关键词，命中任意一个即显示；直接向搜索框粘贴多行文本也会自动转入批量模式。
  - 每个关键词分配 8 色循环色板：行首色条 + 名称后彩色关键词标签标识归属；列表顶部图例显示每个关键词的命中数，未命中置灰。
  - 与普通搜索、方法/类型/状态筛选叠加（AND 组合）；Esc / 重置会一并清空；批量状态随筛选持久化、预设可保存。

## 进度记录

- 2026-08-22　完成第 1–5 项（第一梯队全部 + HAR 导出）。测试 54 个全部通过，vue-tsc 无错误。
  - 1. 响应搜索：`core/filter.ts` 新增 `response` 字段（含 base64 解码），搜索别名 `response:` / `resp:`，自由文本匹配已加载响应体。
  - 2. 持久化 + 预设：新增 `panel/utils/persist.ts`（含不可信数据校验），App.vue 恢复/防抖保存，FilterBar 高级面板内置预设保存 / 应用 / 删除。
  - 3. 失败状态：`status < 0` 归入「失败」分组，列表显示「失败」、详情显示 net::ERR 原因；示例数据新增一条失败请求。
  - 4. 复制菜单：详情头「复制」菜单提供 cURL / fetch / Node axios（`core/curl.ts`）。
  - 5. HAR 导出：`panel/utils/export.ts` 新增 `buildHar`（HAR 1.2，敏感头脱敏），工具栏导出菜单提供 HAR / JSON 两种格式。
- 2026-08-22　完成第 6–7 项（第二梯队全部）。测试 59 个全部通过，vue-tsc 无错误。
  - 6. 虚拟滚动 + 缓冲上限：`applyEventBatch` 支持 `maxEntries` 裁剪（devtools 生产端保留最近 1200 条，面板侧 5000 条为兜底、仅演示数据能触发）；RequestList 改为固定行高（21px）窗口化渲染（上下 padding 占位 + overscan 12 行），4800 条请求只渲染约 48 行。
  - 7. 瀑布图列：底部状态栏「瀑布」开关（状态持久化到 localStorage），按可见请求的时间窗对齐渲染条形（`waterfallWindow` / `waterfallBar` 纯函数），620px 以下自动隐藏该列；demo 模式支持 `repeat` 参数复制样本数据用于大数据量测试。
- 2026-08-22　完成第 8–11 项（第三梯队：9/10/11 实现，8 评估后暂缓）。测试 62 个全部通过，vue-tsc 无错误。
  - 8. WS 帧查看：评估结论见上——需 `chrome.debugger`（CDP）与新增权限，属产品决策，暂缓。
  - 9. 键盘导航：非输入态下 ↑/↓ 在过滤结果中移动选中请求（列表自动滚动跟随），Esc 清空搜索框。
  - 10. 主题切换：明暗两套调色板由 `data-theme` 驱动，默认跟随系统并在未手动选择时持续跟随；手动切换持久化；顺带把类型 chips 的硬编码颜色换成 token（修复暗色下对比度）。
  - 11. i18n：新增 `panel/i18n.ts`（zh-CN / en 双词典 + `{n}` 插值），全部组件文案与 constants 标签接入 `t()`，顶栏「EN / 中文」一键切换，选择持久化；时间格式随语言。
- 2026-08-22　完成第 12 项（分享现场新增需求：批量搜索）。测试 68 个全部通过，vue-tsc 无错误。
  - 核心在 `core/filter.ts`：`parseBatchKeywords`（换行分词、去重、上限 100）+ OR 匹配 + `matchBatchKeywords`（返回命中索引供着色）；`FilterState` 新增 `batchSearch` 字段，随筛选持久化并可存入预设。
  - UI：顶栏批量按钮 + textarea 弹层（主搜索框多行粘贴自动转入批量，因单行 input 会剥掉换行符）；8 色循环色板（明暗两套 token）：行首色条 + 名称后关键词标签，顶部图例显示每关键词命中数、未命中置灰；Esc / 重置 / 清空按钮统一清理。
- 2026-08-23　评审修复。测试 91 个全部通过（新增 23 个），vue-tsc 无错误。
  - 失败识别：`normalizeHarEntry` 读取 HAR `_error`（根/响应两级）并入 statusText；status 0 归入「失败」——`onRequestFinished` 只对已结束请求触发，捕获到的 0 都是无响应的失败/取消而非进行中；UI 移除「进行中」分组，`status:running / pending / 进行中` 不再映射，落地页 demo 与语法表同步；持久化的 `pending` 分组自动迁移为 `failed`。
  - 批量搜索：`parseBatchKeywords` 增加 `requireNewline` 参数——专用批量框允许单行（此前单行关键词静默失效），主搜索框仍按「含换行才转批量」处理。
  - 导出脱敏：URL query、参数值（key 名命中 token/password/api_key/key 等）、JSON 请求/响应体、表单体、HAR 的 redirectURL 一并脱敏；保留「非 JSON 原文」兜底。
  - 高级筛选：param / query / body / header 复合字段改为逐条比较，equals / notEquals 不再退化为整块文本全等比较。
  - 搜索框字段别名：`字段:值` 同时命中同名 Query/请求体参数（`status:failed` 也能找到 `?status=failed`），避免 status / method / type 等常用参数名被别名劫持；冒号后的空格形式（`status: failed`）同样生效。
  - 性能：正则按 pattern 缓存编译结果；批量 haystack 按请求缓存（响应体懒加载后自动失效）；bridge 轮询限 5 秒（此前在非 DevTools 环境永久空转）。
  - i18n：默认语言跟随 `navigator.language`（此前写死 zh-CN）；补齐 FilterBar 预设、批量弹层、详情导航 aria 与 Headers 分区标题翻译；manifest 描述双语；`toLocaleLowerCase` 改 `toLowerCase`（土耳其语 I）。
  - 新增 `normalize.test.ts`（原来 normalize 是唯一零测试的 core 文件）、`export.test.ts`（脱敏行为）。
