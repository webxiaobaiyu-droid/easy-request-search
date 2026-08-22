# EasyRequestSearch

EasyRequestSearch 是一个 Chrome DevTools 扩展，用于按请求方法、资源类型、状态码、URL、Query 参数和请求体参数筛选网络请求。

Chrome 原生 Network 面板擅长查看请求详情，但很难直接表达“只看请求体里 `tenantId` 等于 `3107` 的 POST 接口”这类条件。EasyRequestSearch 提供了独立的 DevTools 面板，专门解决接口联调中的组合筛选问题。

这里的“过滤”指对已经捕获的请求列表进行观察和检索，不会阻断、修改或重放网络请求；拦截和重写属于另一类需要站点权限的扩展能力。

## 功能

- 按 `GET`、`POST`、`PUT`、`PATCH`、`DELETE` 请求方法筛选。
- 按 `fetch`、`xhr`、`document`、`script`、`image` 等资源类型筛选。
- 按 `2xx`、`3xx`、`4xx`、`5xx` 状态码分组筛选。
- 搜索 URL、请求参数、MIME 类型和请求头。
- 搜索框支持 `method:POST`、`type:fetch`、`status:4`、`key:tenantId`、`value:3107` 等快捷语法。
- 精确筛选 Query 参数、请求体参数名、嵌套路径和参数值。
- 多个高级条件支持 `AND`（全部条件）或 `OR`（任一条件）。
- 支持包含、等于、不等于、存在、正则和数字比较。
- 解析 JSON、URL Encoded、Multipart Form Data 和纯文本请求体。
- 查看参数、Payload、Headers 和响应正文。
- 一键复制 URL 或 cURL。
- 导出当前筛选结果，授权头、Cookie 和 API Key 默认脱敏。
- 暂停捕获、清空请求、刷新后保留日志。
- 跟随系统浅色/深色主题，适配窄尺寸 DevTools。

## 安装

### 使用构建产物

1. 打开 `chrome://extensions/`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本项目的 `dist` 目录。
5. 重新打开目标页面的开发者工具。
6. 在 DevTools 顶部选择 `EasyRequestSearch`。

扩展更新后，在 `chrome://extensions/` 中点击 EasyRequestSearch 的刷新按钮，然后重新打开 DevTools。

### 使用 ZIP

`easy-request-search-v0.1.0.zip` 是发布包。Chrome 的“加载已解压的扩展程序”不能直接选择 ZIP，需要先解压，再选择解压后的目录。

## 使用示例

### 快捷搜索语法

不打开高级筛选时，可以直接在搜索框输入空格分隔的条件：

```text
method:POST key:tenantId value:3107
```

支持的字段有 `url`、`method`、`type`、`status`、`mime`、`param`、`key`、`value`、`query`、`body` 和 `header`。带字段的条件之间按“全部满足”处理，普通文本仍会在 URL、参数和请求头中搜索。带空格的值可以用双引号包裹。

### 查找带指定参数的接口

1. 点击“高级筛选”。
2. 字段选择“参数名 / 路径”。
3. 匹配方式选择“等于”。
4. 输入 `tenantId`。

Query 和请求体里的同名参数都会匹配。

### 查找嵌套 JSON 字段

以下请求体：

```json
{
  "user": {
    "profile": {
      "id": 42
    }
  }
}
```

会展开为路径 `user.profile.id`，因此可以使用：

```text
参数名 / 路径  等于  user.profile.id
```

数组使用下标路径，例如 `items[0].sku`。

### 组合过滤

要查找“请求体里 `tenantId` 为 `3107` 的 POST 请求”：

1. 顶部启用 `POST`。
2. 添加条件“参数名 / 路径”等于 `tenantId`。
3. 添加条件“参数值”等于 `3107`。
4. 条件关系选择“全部条件”。

### 正则过滤 URL

```text
URL  正则匹配  /v[12]/orders/\d+$
```

正则表达式默认忽略大小写。无效正则不会导致面板崩溃，只会返回不匹配。

## 支持的请求体

| Content-Type | 处理方式 |
| --- | --- |
| `application/json`、`*+json` | 展开对象、数组和嵌套路径 |
| `application/x-www-form-urlencoded` | 解析键值和重复参数 |
| `multipart/form-data` | 解析字段名，文件显示文件名 |
| `text/*` 和其他格式 | 作为 `$` 根参数全文搜索 |

单个请求最多展开 1000 个参数，嵌套深度最多 12 层，避免异常载荷拖慢 DevTools。

## 隐私和性能

- 请求数据只保留在当前 DevTools 上下文，不发送到任何服务器。
- 扩展不申请站点访问权限，也不注入页面脚本。
- 最多保留 1200 条请求，超出后自动移除最早记录。
- 响应正文只有在打开“响应”页签时才读取，避免无条件保存大响应。
- JSON 导出会脱敏 `Authorization`、`Cookie`、`Set-Cookie`、`X-API-Key` 和代理授权头。
- 复制 cURL 会保留原始请求头，粘贴或分享前请自行检查敏感信息。

## 开发

环境要求：Node.js 18+、pnpm 9+。

```bash
pnpm install
pnpm dev
```

开发服务器默认监听 `127.0.0.1:5173`，被占用时自动递增使用 5174、5175……（见 `vite.config.ts` 的 `server` 配置）。

浏览器预览示例数据：

```text
http://127.0.0.1:5173/panel.html?demo=1
```

生产构建和测试：

```bash
pnpm test
pnpm build
pnpm package
```

构建输出位于 `dist/`，可直接作为 Chrome 的“已解压扩展”目录。

## 架构

```text
src/
├── core/       请求解析、过滤、事件批处理和 cURL 生成，保持为可单测纯函数
├── devtools/   Chrome DevTools 网络监听和面板桥接
├── panel/      Vue 3 调试界面：外壳 + 组件 + 组合式函数 + 设计令牌
└── types/      网络模型和最小 Chrome API 类型声明
```

DevTools 页面从开发者工具打开时就开始捕获请求，面板打开后通过内存桥接取得快照并订阅后续变化。这样晚一点切换到 EasyRequestSearch 面板也不会漏掉此前完成的请求。

## 已知边界

- Chrome 扩展不能向原生 Network 面板添加自定义过滤器，因此 EasyRequestSearch 使用独立 DevTools 面板。
- `chrome.devtools.network.onRequestFinished` 在请求完成后提供记录，正在进行中的请求不会提前显示。
- 页面在 DevTools 打开前产生的请求无法捕获；打开 DevTools 后刷新页面即可。
- 已被 Chrome 丢弃、重定向或来自缓存的部分响应正文可能无法读取，但请求元数据仍可筛选。

## License

[MIT](./LICENSE)
