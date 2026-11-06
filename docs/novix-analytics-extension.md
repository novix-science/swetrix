# Novix 独立统计入口

自托管前端可设置 `NOVIX_ANALYTICS_PROJECT_IDS`，用逗号分隔启用业务统计入口的项目 ID。默认空值，配置应与独立 BFF 的项目绑定一致。

入口在项目侧栏展示“Novix 业务统计”，使用普通同域导航进入 `/novix/projects/{id}/business`。日期、时区、比较标记、当前语言与主题会随链接传递。period、timeBucket 和 timezone 使用原生看板实际解析后的值，并覆盖 URL 中缺失或冲突的参数；默认 `7d/hour` 也会明确传递。时区使用原生生效的账号时区或默认值。桌面、移动及加载态的五处入口共用该规则，memo 比较包含这三个值。原生 Swetrix 的用户画像等筛选由独立页面自己的筛选字段管理。嵌入模式隐藏入口。

BFF 独立验证真实用户会话与私有项目权限。这里的菜单配置只控制可见性，实际鉴权仍由 BFF 执行。服务器需先部署扩展并配置 `/novix/*` 同域路由，再启用菜单配置。

业务查询、数据源适配和看板逻辑保留在 Novix 独立扩展。Swetrix 升级时维护 root loader 的公开项目列表字段、侧栏链接与小型 URL 适配器，并重跑链接回归、typecheck 和构建。当前入口适配基于中文分支 `5156f15f66e1a4fde8eac7e84fbcfe3565433aeb`。

验证先观察到两个链接生成的失败断言，再实现启用条件和参数传递。审查发现原生时区通常没有写入 URL，新增用例先复现缺失和冲突的参数，再让链接继承原生账号时区。最终补充空 URL、仅 `period=7d`、显式兼容 bucket、冲突原始参数的实际链接回归：修改前 8 项中 3 项失败，修复后全部通过。固定时钟 `2026-11-06T04:34:56Z`、Asia/Shanghai 的真实 adapter → BFF range 组合检查确认默认 `7d/hour` 起于 `2026-10-30T04:00:00Z`；独立访问 BFF 仍按近 7 个自然日处理。组合脚本只作为仓库外验证，不引入跨仓依赖。

覆盖检查命令为 `node --test test/novixAnalytics.test.mjs`、`npm run typecheck --prefix web`、`npm run build --prefix web` 和修改源码的 oxlint。这里只验证源码与构建，真实部署和菜单跳转验收在扩展服务与同域路由就绪后进行。

本次 8 个 Node 测试、typecheck、build 均通过。三份修改源码的 oxlint 无错误，保留 ProjectSidebar 与 ViewProject 的三处原有 set-state-in-effect 警告；构建保留体积超过 500 kB 的 chunk 提示。
