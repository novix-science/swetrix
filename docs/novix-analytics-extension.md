# Novix 原生业务分析

自托管前端可设置 `NOVIX_ANALYTICS_PROJECT_IDS`，用逗号分隔启用业务统计入口的项目 ID。默认空值，配置应与独立 BFF 的项目绑定一致。

入口位于现有项目侧栏的产品分析分组，名称为“业务分析”，与用户画像、会话、错误等菜单使用相同内部 Link、选中态和移动抽屉。页面在 `/projects/{id}?tab=novixBusiness` 渲染，中文路径加 `/zh`。页面留在 ViewProject 布局内，不使用 iframe，不打开独立应用。

界面直接复用现有 DashboardHeader、日期选择器、刷新按钮、MetricCard、Select、Input、Button、Loader、Tailwind 主题和全局语言设置。Swetrix 使用 Headless UI + Tailwind CSS 及 `web/app/ui` 自有组件。原生表格样式、边框与间距沿用现有项目页；没有引入第二套组件库。业务模块包含中英文文案，其他语言暂回退英文。

日期取原生实际生效的 period、timeBucket、timezone 与原始 from/to；默认 `7d/hour` 明确传入 BFF。原生日期修改立即查询；业务筛选点“应用”提交，使用 `novix_` URL 参数，与原生流量筛选隔离。资源概览仅接收日期参数，产品筛选作用于使用、留存和任务结果等产品报表。日期支持最多 93 个自然日，不展示比较周期。切换其他菜单后可返回并保留日期与业务筛选。

BFF 独立验证真实用户会话与私有项目权限。这里的菜单配置只控制可见性，实际鉴权仍由 BFF 执行。服务器需先部署扩展并配置 `/novix/*` 同域路由，再启用菜单配置。

业务查询、数据源适配和统计计算保留在 Novix 独立 BFF；本仓的 `web/app/pages/Project/tabs/Business` 负责原生展示。旧 `/novix/projects/{id}/business` 由 BFF 验证权限后重定向原生页面，并保留等价日期和业务筛选。数据与会话仍访问同域 `/novix/api/v1/projects/{id}/...`，服务令牌不进入浏览器。

升级 Swetrix 时保留独立 Business 模块，并适配 PROJECT_TABS、ViewProject 的懒加载/刷新、ProjectSidebar 分组、路由标题、DashboardHeader 比较开关及两处菜单文案；root loader 的公开项目列表环境字段继续沿用。官方没有被此实现假定存在的插件加载 API。当前工作分支基于实际部署过的中文 commit `0ce3154b0c3a7d687afcec69200831aac3fff70d`，不从共享测试分支引入代码。

检查命令为 `node --test test/*.test.mjs`、`npm run typecheck --prefix web`、`npm run build --prefix web` 和修改源码的 oxlint。展示测试通过 Vite SSR 加载真实 MetricCard，覆盖未知与零、待成熟留存、日/周 cohort、接受区间状态与实际终态事件分离、渠道转义和 Token 覆盖。

前端按 `web/Dockerfile` 构建，使用 OCI revision 标签对应源码 commit。现有部署继续通过只读绑定的 HTTPS Express adapter 启动，完整源码也保留在 `deploy/novix/frontend-server.mjs`。重建时把该文件放到 `/app/novix-frontend-server.mjs` 并用 `node /app/novix-frontend-server.mjs` 启动，保持已有 API_ORIGIN、BASE_URL、项目开关及 Docker 子网设置。该适配器只信任现有专用 Docker 子网的代理头。公开源码归档需覆盖本仓和此适配器。

`npm run build` 最后执行样式一致性检查。web-only Docker 上下文没有仓库根 `.gitignore`，Tailwind 默认扫描会在 SSR 阶段再次扫描先前生成的客户端 bundle，造成两套样式哈希和 React hydration 错误。样式源用 `@source not` 明确排除 build、.react-router、public/build（[官方源扫描说明](https://tailwindcss.com/docs/detecting-classes-in-source-files#ignoring-specific-paths)）。同样的无 Git 构建上下文，修复前客户端为 C3pLiRmJ/BfunmWqH 两份、SSR 指向 BfunmWqH；修复后两端均只引用 C3pLiRmJ。线上 HTML/JS 的受限本地对照只统一 CSS 链接后也不再触发 hydration 报错，诊断服务已关闭。

## 2026-11-09 早期独立入口部署记录

以下为原生页改造前的验收，不能作为原生页已经部署的证明；新的部署记录追加在末尾。

本次部署分支从当时实际运行的中文 commit `0ce3154b0c3a7d687afcec69200831aac3fff70d` 出发，仅带入入口适配提交，编译源码为 `a302a9545a9d176fb9f9946743d7f88699661e66`。重新执行的 8 项菜单测试、typecheck 和 build 通过。镜像 `novix/swetrix-fe:5.5.3-novix-analytics.2` 的实际 image ID 为 `sha256:74e65bf95337dbb19719a0d1efc355918a21bec9a15e0b7ef5532059e2a09cb3`，健康且零重启。保留原 HTTPS Express adapter，其他 API、ClickHouse、Redis、网关和独立 BFF 容器未被这次前端更新重建。

`NOVIX_ANALYTICS_PROJECT_IDS` 仅设置测试项目 `3YB7MtPN7WXv`。真实 Chrome 私有项目会话刷新后出现“Novix 业务统计”，点击进入中文扩展页，继承 `period=7d`、`timeBucket=hour`、Asia/Shanghai、中文与浅色主题。页面显示真实产品使用、日/周留存、任务结果、资源账本及覆盖提示；近 30 天筛选也已通过实际 API 与页面验收。

独立 BFF 的当前镜像为 `novix/business-analytics:20261109.2`，源码为 Novix monorepo `b7022c68197248b9df5f15997f506ca40f2e6d55`，完整 73 项测试通过。该版本将 task 容量扩到 50,000，并串行调度历史首次使用，保留两份报表并发和原时限。真实两份月度报告均为 200，约 8–11 秒，容器观测峰值约 139 MiB、限制 768 MiB、无 OOM。业务侧的 GCP 测试库与接口使用独立只读凭证；测试 API 不新增 DNS，通过内部 CA 校验现有 IP 的 HTTPS。正式 Novix 业务发布与正式数据库 SQL 未操作。

对应源码包含本次菜单改动、现有 HTTPS adapter 与镜像构建说明：[下载源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.2-source.tar.gz)。归档 SHA256 为 `f38b80805f1e3e49272d4f5ef4e4f1ec4fee182ea2999a5cf986bd14e66eb6c3`，公开 `/source` 的前端元数据与运行镜像一致。升级时仍只需适配菜单、root loader 和 URL 桥接；业务取数和统计继续保留在独立扩展。

浏览器验收已通过近 30 天控件查询和“刷新当前范围”读回：日期/筛选保留，快照更新，真实月度使用汇总一致。DevTools Console 为 0 条消息；Issues 区有 `frame.js:2` 的 Fenced Frame API 弃用提示，未改动该来源脚本。页面截图已记录在当前会话。旧数据缺少功能/身份/时间信息时按覆盖提示呈现，不伪造历史指标。

## 2026-11-09 原生业务分析部署

Swetrix 按单一在线环境维护。本次从现有开发分支直接部署新建的 Swetrix 主机，不以 Novix 的共享测试分支作为发布来源。

当前前端为 `novix/swetrix-fe:5.5.3-novix-analytics.4`，源码 `d87df6d103e70201ccc0ddc84e07069d26766c57`，实际 image ID `sha256:102dacf52d4e96257a72907dc49d2d6624919a6762074207daa8640db6b6ae41`。对应[完整源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.4-source.tar.gz)为 33,761,833 bytes，SHA256 `ffae917354c0ee70bcd795ac96683c07915ca29c141c7c7fc17fb24d376ca25e`，公开下载为 200，`/source` 元数据与实际镜像相符。

独立 BFF 为 `novix/business-analytics:20261109.3`，源码来自 Novix monorepo `b497e3e6183bb71d5d4e5bef1f5abbae0cfd7629`，image ID `sha256:780d896d74b26aec9878e681d016a745636541985c1c1d2d57745afa129ba82a`。改动只将旧页面入口重定向原生标签页，业务统计与只读数据源保持原协议。

7 项前端测试、74 项 BFF 测试、typecheck、构建和修改源码 lint 均通过；现有 ViewProject/ProjectSidebar 的三处 effect 警告未扩大。真正 web-only Docker 构建也通过样式一致性检查，线上 SSR 和浏览器均只引用 `tailwind-C3pLiRmJ.css`。修复版初次加载和连续切换日期没有新增控制台错误。

实际 API 验证中，产品报告为 200（约 7.37 秒）、资源概览为 200（约 0.96 秒），全部 13 项功能字段保留；旧入口为 303，并保留原生自定义日期与业务筛选；匿名为 401、未绑定项目为 404。当前业务查询绑定仍只包含 Novix Staging 项目。前端、BFF、API、ClickHouse、Redis 健康且零重启，网关运行且零重启；本次最终前端更新未重建其他容器。未改动其他旧 ECS、Novix 正式环境发布或正式数据库。

真实线上浏览器已验证原生菜单进入、过去七天→今天→昨天连续切换、Data Analysis 选择并应用、错误菜单往返，以及手动刷新。返回后仍保持昨天与功能条件；刷新完成，快照从 16:38 更新到 16:39，条件不变。修复版本验收范围内控制台新增 error 为 0，head 中 Tailwind stylesheet 只有一份。展示仍如实保留未知、待成熟与字段关联缺口。
