# Novix 独立统计入口

自托管前端可设置 `NOVIX_ANALYTICS_PROJECT_IDS`，用逗号分隔启用业务统计入口的项目 ID。默认空值，配置应与独立 BFF 的项目绑定一致。

入口在项目侧栏展示“Novix 业务统计”，使用普通同域导航进入 `/novix/projects/{id}/business`。日期、时区、比较标记、当前语言与主题会随链接传递。period、timeBucket 和 timezone 使用原生看板实际解析后的值，并覆盖 URL 中缺失或冲突的参数；默认 `7d/hour` 也会明确传递。时区使用原生生效的账号时区或默认值。桌面、移动及加载态的五处入口共用该规则，memo 比较包含这三个值。原生 Swetrix 的用户画像等筛选由独立页面自己的筛选字段管理。嵌入模式隐藏入口。

BFF 独立验证真实用户会话与私有项目权限。这里的菜单配置只控制可见性，实际鉴权仍由 BFF 执行。服务器需先部署扩展并配置 `/novix/*` 同域路由，再启用菜单配置。

业务查询、数据源适配和看板逻辑保留在 Novix 独立扩展。Swetrix 升级时维护 root loader 的公开项目列表字段、侧栏链接与小型 URL 适配器，并重跑链接回归、typecheck 和构建。当前入口适配基于中文分支 `5156f15f66e1a4fde8eac7e84fbcfe3565433aeb`。

验证先观察到两个链接生成的失败断言，再实现启用条件和参数传递。审查发现原生时区通常没有写入 URL，新增用例先复现缺失和冲突的参数，再让链接继承原生账号时区。最终补充空 URL、仅 `period=7d`、显式兼容 bucket、冲突原始参数的实际链接回归：修改前 8 项中 3 项失败，修复后全部通过。固定时钟 `2026-11-06T04:34:56Z`、Asia/Shanghai 的真实 adapter → BFF range 组合检查确认默认 `7d/hour` 起于 `2026-10-30T04:00:00Z`；独立访问 BFF 仍按近 7 个自然日处理。组合脚本只作为仓库外验证，不引入跨仓依赖。

覆盖检查命令为 `node --test test/novixAnalytics.test.mjs`、`npm run typecheck --prefix web`、`npm run build --prefix web` 和修改源码的 oxlint。这里只验证源码与构建，真实部署和菜单跳转验收在扩展服务与同域路由就绪后进行。

本次 8 个 Node 测试、typecheck、build 均通过。三份修改源码的 oxlint 无错误，保留 ProjectSidebar 与 ViewProject 的三处原有 set-state-in-effect 警告；构建保留体积超过 500 kB 的 chunk 提示。

## 2026-11-09 实际部署

本次部署分支从当时实际运行的中文 commit `0ce3154b0c3a7d687afcec69200831aac3fff70d` 出发，仅带入入口适配提交，编译源码为 `a302a9545a9d176fb9f9946743d7f88699661e66`。重新执行的 8 项菜单测试、typecheck 和 build 通过。镜像 `novix/swetrix-fe:5.5.3-novix-analytics.2` 的实际 image ID 为 `sha256:74e65bf95337dbb19719a0d1efc355918a21bec9a15e0b7ef5532059e2a09cb3`，健康且零重启。保留原 HTTPS Express adapter，其他 API、ClickHouse、Redis、网关和独立 BFF 容器未被这次前端更新重建。

`NOVIX_ANALYTICS_PROJECT_IDS` 仅设置测试项目 `3YB7MtPN7WXv`。真实 Chrome 私有项目会话刷新后出现“Novix 业务统计”，点击进入中文扩展页，继承 `period=7d`、`timeBucket=hour`、Asia/Shanghai、中文与浅色主题。页面显示真实产品使用、日/周留存、任务结果、资源账本及覆盖提示；近 30 天筛选也已通过实际 API 与页面验收。

独立 BFF 的当前镜像为 `novix/business-analytics:20261109.2`，源码为 Novix monorepo `b7022c68197248b9df5f15997f506ca40f2e6d55`，完整 73 项测试通过。该版本将 task 容量扩到 50,000，并串行调度历史首次使用，保留两份报表并发和原时限。真实两份月度报告均为 200，约 8–11 秒，容器观测峰值约 139 MiB、限制 768 MiB、无 OOM。业务侧的 GCP 测试库与接口使用独立只读凭证；测试 API 不新增 DNS，通过内部 CA 校验现有 IP 的 HTTPS。正式 Novix 业务发布与正式数据库 SQL 未操作。

对应源码包含本次菜单改动、现有 HTTPS adapter 与镜像构建说明：[下载源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.2-source.tar.gz)。归档 SHA256 为 `f38b80805f1e3e49272d4f5ef4e4f1ec4fee182ea2999a5cf986bd14e66eb6c3`，公开 `/source` 的前端元数据与运行镜像一致。升级时仍只需适配菜单、root loader 和 URL 桥接；业务取数和统计继续保留在独立扩展。

浏览器验收已通过近 30 天控件查询和“刷新当前范围”读回：日期/筛选保留，快照更新，真实月度使用汇总一致。DevTools Console 为 0 条消息；Issues 区有 `frame.js:2` 的 Fenced Frame API 弃用提示，未改动该来源脚本。页面截图已记录在当前会话。旧数据缺少功能/身份/时间信息时按覆盖提示呈现，不伪造历史指标。
