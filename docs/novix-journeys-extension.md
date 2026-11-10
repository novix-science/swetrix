# Novix 访问旅程扩展

Novix 私有项目在原访问旅程菜单内显示路径列表、流向图及单路径转化，并支持按用户查看各次访问。模块位于 `web/app/pages/Project/tabs/Journeys/novix/`，主视图仅增加 lazy import 和基于现有 businessEnabled 的入口适配；未启用项目继续使用官方 JourneysView。

界面复用 DashboardHeader、Select、Input、Button、ThemeProvider、Nivo 及原生日期解析结果。用户/视图/规范路径通过 URL 状态保存，TanStack Query 按项目、日期、用户及完整路径隔离缓存。列表默认深度五页、每页二十条，流向图最多一百条，始终显示已展示访问占全部访问的比例。

“原版视图”直接复用官方 JourneysView，保留原有桑基图/路径表格、页面筛选、节点交互与会话抽屉，不复制官方实现。原版按原始页面地址和多页面会话统计；新版归并动态详情页并包含单页访问，两者口径在页面上明确区分。原版不应用新版指定用户过滤；切回新版保留原先用户选择。旧 `view=chart|table` 链接进入原版，显式 `journeyView` 优先；未指定视图仍默认新版路径列表。原版只挂载官方查询，新版只挂载 BFF 查询。

本轮修正同时限定页面深度 Select 最小宽度和选项不换行，不改通用 Select 的其他调用。验证：25 项回归、完整 typecheck、客户端/SSR 构建与样式清单、新模块 lint 和格式检查通过；ViewProject lint 的两处既有 effect 警告不在本轮修改范围。线上菜单选项修正前宽 44px，数字 10 标签高 40px（两行）；修正后选项宽 83px、数字标签高 20px，white-space 为 nowrap，勾选图标正常显示。

维护要点：官方已有图表/表格并不等于新版已保留全部交互，也不等于二者统计口径一致。后续升级先看本文件的入口和口径约定，再检查真实页面的切换、原版图表/表格、指定用户返回状态及最宽数字选项；这属于本扩展的组件适配与布局验收，不新增通用 skill 或修改其他模块的发布流程。

数据来自 Novix monorepo 的 Node BFF 同源 `/novix/api/v1/projects/{pid}/journeys/`，不直接读取业务库，不改官方 Swetrix analytics API：

- paths：规范路径排名、访问/用户总量与覆盖。
- visits：完整所选前缀的逐次访问及原始页面时间线；指定用户时也可查看该用户全部访问。
- conversion：同次访问内的连续前缀到达、后续页、观察结束与未知结尾。
- users：邮箱或 Novix 用户 ID 查找，最终使用稳定档案 ID 过滤。

动态详情路径已在查询时归并，界面提供可读名称和规范路径提示；原始 UUID 地址只在具体访问明细里出现。单页、重复访问及不同账号分别统计；没有身份关联证据的匿名历史不归给某用户。同秒记录无法确认顺序时显示排除覆盖，不能伪造路径或转化。

## 升级与发布

1. 先发布 main 派生的 Novix 后端分支 codex/analytics-task-context 和前端/BFF 分支 codex/analytics-journeys。
2. 邮箱查询增加 profile_traits 五列只读权限，授权文件位于 BFF 的 journeys-reader-grant.sql；路径及数字 ID 查找复用现有 events SELECT。
3. 最后发布本 Swetrix 前端。NOVIX_ANALYTICS_PROJECT_IDS 与 BFF 项目绑定需一致，沿用现有域名和私有登录会话。
4. 升级检查 ViewProject 的入口适配、原生 period/timeBucket/timezone/from/to、events 的 sid/profileId/created/metadata，以及原生组件行为。运行 BFF 实际 SQL fixture 和本仓库测试。

开发验收：`node --test test/*.test.mjs` 共 24 项通过，新模块 lint、完整 typecheck、客户端/SSR 构建及样式清单通过。本地浏览器使用合成数据验证路径列表、图、逐步转化、邮箱/ID、账号切换、详情展开、空范围和刷新；真实只读账号完成 SQL 及两项目查询预检。

## 2026-11-10 已发布

前端发布为 `novix/swetrix-fe:5.5.3-novix-analytics.10`，源码 `c35bd5e10aa607ecd64793e20fa31582ea0e62f2`，实际 image ID `sha256:0d5d60ed632839b0d942cfa8686d0c583d3660545d25fd1ba037534199d46448`。容器健康、零重启；数据库、API、Redis 和网关容器没有重建。

[完整对应源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.10-source.tar.gz)包含界面、HTTPS adapter 和构建配方，33788437 bytes，SHA256 `a4fa074fdd257ec239b8d140dbb0748e5a53a84835aee4672000c6c7601a0b6a`。公开 `/source` 元数据、归档下载摘要与实际镜像一致。

独立 BFF 已更新为 `20261110.2`，使用现有私有会话和服务令牌。邮箱查找的五列 SELECT 已配置并验证，未写入事件或业务表。正式与测试两个项目的四类旅程接口、未登录 401 和跨域 403 均通过；正式浏览器验证了三种视图、动态页面归并、指定账号、连续路径转化、原始时间线和四周日期范围。旅程 SQL 及完整 BFF 回归继续保留在独立扩展中。

原有完整产品报表同步采用 JSONCompact 传输，保留全部行及资源限制，两个项目的七天、四周和自定义完整报告恢复返回。升级时同时执行原生日期桥接、真实只读查询和完整报表回归，不能只验证静态界面构建。

## 2026-11-10 原版视图与深度选项修正已发布

前端更新为 `novix/swetrix-fe:5.5.3-novix-analytics.11`，源码 `a8c79062ce29be91d4f5a5400bb274e494eb6f44`，实际 image ID `sha256:7a2b88130202f2e66cff96a4a8f7c4af984466a924dff1e3fa22414a1d3b8708`。新容器健康、零重启；其余容器 ID 与发布前完全一致。只在已登记的新 ECS 43.106.89.75 上操作。

[完整对应源码](https://api-analytics.novix.science/source/swetrix-fe-5.5.3-novix-analytics.11-source.tar.gz) 33791784 bytes，SHA256 `0164d080b876f935fe6e3508a55f1fa97be6a90d5aa061bdf556e03d488f662c`。已从公开地址下载完整归档并核对摘要、版本、源码提交与 `/source` 元数据。

正式域名浏览器实测原版桑基图与路径表格均返回真实数据，切回新版保留用户范围；新版路径列表、按用户流向和单路径转化继续可用，深度 10 的选中项与菜单项均保持单行，控制台无错误。截图：`/tmp/novix-journeys-depth-fixed-20261110.jpg`、`/tmp/novix-journeys-original-retained-20261110.jpg`。未修改 Novix 前后端、BFF、业务库或采集数据。

## 长期范围与图表国际化

新版旅程日期菜单增加 12M、24M，沿用原生月初对齐、时区和精确自定义范围。BFF 的 762 自然日上限仅用于旅程，业务库报表仍保持 93 天；非法范围显示明确说明，不静默缩短时间范围。查询超时、内存、读行、返回大小和并发限制不变。

图表日期通过 `web/app/utils/chartDate.ts` 创建独立语言实例，覆盖流量、性能、错误、自定义事件、会话、验证码、目标、实验、SEO 和 AI 图表的悬浮日期及日期轴，不修改 D3 全局语言。月份、星期与上下午由 Intl 本地化，中文采用年月日顺序；图表钻取保持原时区/DST 查询边界，仅本地化标签。图表的语言参与缓存/重绘依赖。

界面字符串扫描补齐地图的访客、发生次数、平均加载时间、缩放/全屏提示，以及多选框默认占位和空状态、图表绘制提示、移除标签、设置导航和项目名示例。普通文案使用 common 翻译字段；原始事件、页面路径、品牌与配置示例仍按数据值显示。

浏览器及 JSX 表达式复验继续补齐版本展开/收起、日期选择占位和密码显隐按钮的无障碍标签；日期选择器的月份/星期此前已使用 Intl。只改显示文案，未修改密码值、筛选条件或版本展开行为。

开发验证：28 项前端回归、完整 typecheck、客户端/SSR 构建与样式清单通过；lint 零错误。BFF 97 项回归通过，新镜像先用 Staging 项目通过 7d/12M/24M、明细/转化/用户接口及业务报表长范围拒绝验收。实际 Production 页面已显示 24M 正确起止范围与完整路径列表。完整 UI 回归将验证地图和图表悬浮提示的中英文切换。
