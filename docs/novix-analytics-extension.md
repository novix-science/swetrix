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

## 2026-11-09 正式项目接入

正式业务统计已按用户选择的独立服务令牌模式接通。`NOVIX_ANALYTICS_PROJECT_IDS` 现在同时包含 Novix Staging 与 Novix Production，数据源和凭证按环境分离。前端继续使用 `5.5.3-novix-analytics.4` 和相同源码归档，只更新运行配置，没有增加新的页面实现。

独立 BFF 更新为 `novix/business-analytics:20261109.4`，源码 `3e3c9a899873a0973acb3992bf5bcc3097f22ff9`。历史首用改为每批 100 个账号，保留同一快照、任务 fence、SQL 时限和整个报表预算，91 项回归通过。部署前通过只在服务器回环地址开放的临时实例验证正式与测试项目，以及两份不同范围报告并发。新服务健康、零重启；切换过程中没有重建 ClickHouse、Redis、API 或网关。

正式菜单在“产品分析”分组显示“业务分析”，页面明确标注“正式数据”，继续复用原生日期和筛选控件。当前使用独立只读业务接口与本机 ClickHouse 聚合，不启用新增 KMS 服务鉴权或自动轮换。历史字段缺失、待成熟留存和覆盖不足继续如实显示，未补写历史业务数据。详细部署和验收证据由 Novix monorepo 的 `docs/validation/2026-11-09-analytics-consolidation.md` 维护。

真实浏览器验收包括正式七日报告、切换今天、选择 Auto Pilot 并查询，以及整页刷新保留日期和功能。最终正式七日总览正常显示；1280×720 视口下已留存截图，修复后验收期间控制台新增 error/warn 均为 0。正式资源概览的任务数与额度消耗另与业务库只读查询核对一致。

## 2026-11-09 地域名称与性能优化

共用 `web/app/utils/isoCountries.ts` 将 CN 的中文、英文名称设为“中国大陆”“Mainland China”，使地图、列表和过滤项一致。两种语言的实际地图提示已验收，并恢复中文；本地正反向查找、typecheck、build、样式清单与修改文件 lint 通过。

前端镜像 `novix/swetrix-fe:5.5.3-novix-analytics.5`，源码 `053bb76adcca435fb13f18ea758cde3d2d9eb88a`，image ID `sha256:bf4793fb1ad546d78fe224a92227be9e8e48f77c3c2f45e84f451beff3d543be`。[完整源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.5-source.tar.gz)为 33,761,105 bytes，SHA256 `84a014dcb9f9c791c1a86f2d7b0ef443843d7a0b69e531e2c69d46f1d99c3a7c`。菜单项目配置保持现有两环境绑定。

独立 BFF 更新为 `novix/business-analytics:20261109.6`，源码 `e4a8269f597c93981eee632fe3849145bd32b1ca`。历史首用每批 400 个账号、两个连续工作单元，业务读取共用最多两个名额；96 项回归通过，原时限与完整历史保留。当前同批生产数据对比，七天/四周/自定义完整报表从约 11.1–11.4 秒降至 5.1–5.7 秒，结果一致。详细验证见 Novix monorepo 的 `docs/validation/2026-11-09-analytics-performance-geography.md`。

随后按用户要求补齐“中国香港 / Hong Kong, China”“中国澳门 / Macao, China”；中文台湾保留原有“中国台湾省”，英文补齐为 Taiwan, China。旧名称仍作为别名支持反向查找，地图、列表和过滤项共用优先名称。

当前前端为 `novix/swetrix-fe:5.5.3-novix-analytics.6`，源码 `200beb9b178059ba26cb6fe58e9ccde5748ac2f0`，image ID `sha256:15e893a6c5a0e9d641ec2fd9174c73d48125cb9ea6f05488c01a98d83e186113`。[完整源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.6-source.tar.gz)为 33,760,749 bytes，SHA256 `158b31b5481edca8240c50d66d8711cfb247a04e509e28bf6dc061db65a4e5ba`。名称与旧别名、typecheck、build、样式清单及修改文件 lint 通过；当前容器 healthy、零重启，其他容器 ID 保持不变。

公开完整源码实际下载及校验通过。真实浏览器确认了四地八个中英文名称，随后恢复中文、清除地区筛选并回到正常显示的正式业务报告。首屏 SSR 只输出壳时，不以 HTML 是否包含地区名称判断该客户端功能是否生效。

## 2026-11-09 漏斗权限与空状态修复

社区版现有后端支持漏斗的新建、编辑、删除和转化查询。此次“免费开始”跳转 `/zh/signup` 后出现 404，源于已登录的项目 viewer 被前端误导到云端注册入口；本机注册原本关闭。按用户明确确认，仅将既有看板账号在 Novix Production、Novix Staging 两个私有项目中的角色改为 admin，并通过项目 API 读回验证。项目保持私有，未修改 Novix 业务数据库或全局云权限。[官方权限说明](https://swetrix.com/docs/analytics-dashboard/funnels)同样要求项目 owner/admin 才能管理漏斗，viewer 只能查看。

`FunnelEmptyStateAction` 按实际身份显示操作：管理员新建漏斗、已登录 viewer 显示中英文只读说明、自托管匿名访问进入本机登录、云端匿名访问保留原注册入口。后端管理权限检查保持生效，自托管注册仍关闭。升级官方版本时需保留此空状态组件、父页接入及两项语言文案。

前端镜像为 `novix/swetrix-fe:5.5.3-novix-analytics.7`，源码 `056151d08ff385796a1c19ac0e0a76b3f853260f`，实际 image ID 为 `sha256:c846d34eec049ccb889225b11e3116cc84befffa6a2e9891533d8e0b1ac21eaf`。[完整源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.7-source.tar.gz)为 33,763,476 bytes，SHA256 `63835d0c93cca2830413dbe4bed63745f546b07c52aecc0c42b88d5aaf8fae12`，公开下载和 `/source` 元数据已核对。前端 healthy、零重启，其他服务容器 ID 保持不变。独立 BFF 和社区版 API 沿用现有版本。

本地 14 项测试、typecheck、build、样式一致性检查通过，涵盖实际中英文权限文案及本机登录链接；修改源码的 oxlint 退出码为 0，FunnelsView 未改动区域仍有 hooks 警告。真实浏览器在 Staging 新建临时两步漏斗 `/` → `/chat`，随后编辑名称并整页刷新读回；实际转化查询为 200，图表正常。临时漏斗按精确 ID 和名称校验后清理，保留其他漏斗。Production 的“新建漏斗”和创建表单也已验证，没有在正式项目保存测试漏斗。

单个前端容器切换期间，验收表单曾收到一次 502；新版本健康后重新编辑、刷新与查询全部通过。最终浏览器验收区间新增 error/warn 均为 0，页面停留在 Production 的正常漏斗入口。
