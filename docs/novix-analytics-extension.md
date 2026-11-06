# Novix 独立统计入口

自托管前端可设置 `NOVIX_ANALYTICS_PROJECT_IDS`，用逗号分隔启用业务统计入口的项目 ID。默认空值，配置应与独立 BFF 的项目绑定一致。

入口在项目侧栏展示“Novix 业务统计”，使用普通同域导航进入 `/novix/projects/{id}/business`。日期、时区、比较标记、当前语言与主题会随链接传递。原生 Swetrix 的用户画像等筛选由独立页面自己的筛选字段管理。嵌入模式隐藏入口。

BFF 独立验证真实用户会话与私有项目权限。这里的菜单配置只控制可见性，实际鉴权仍由 BFF 执行。服务器需先部署扩展并配置 `/novix/*` 同域路由，再启用菜单配置。

业务查询、数据源适配和看板逻辑保留在 Novix 独立扩展。Swetrix 升级时维护 root loader 的公开项目列表字段、侧栏链接与小型 URL 适配器，并重跑链接回归、typecheck 和构建。当前入口适配基于中文分支 `5156f15f66e1a4fde8eac7e84fbcfe3565433aeb`。

验证先观察到两个链接生成的失败断言，再实现启用条件和参数传递。三个 Node 回归覆盖项目配置、自托管/嵌入边界、同域目标、日期参数白名单、语言与主题。

`node --test test/novixAnalytics.test.mjs` 的三个测试通过，`npm run typecheck --prefix web` 与 `npm run build --prefix web` 成功。相关 oxlint 无错误，保留 ProjectSidebar 原有 set-state-in-effect 警告。这里只验证源码与构建，真实部署和菜单跳转验收在扩展服务与同域路由就绪后进行。
