# Novix 访问旅程扩展

Novix 私有项目在原访问旅程菜单内显示路径列表、流向图及单路径转化，并支持按用户查看各次访问。模块位于 `web/app/pages/Project/tabs/Journeys/novix/`，主视图仅增加 lazy import 和基于现有 businessEnabled 的入口适配；未启用项目继续使用官方 JourneysView。

界面复用 DashboardHeader、Select、Input、Button、ThemeProvider、Nivo 及原生日期解析结果。用户/视图/规范路径通过 URL 状态保存，TanStack Query 按项目、日期、用户及完整路径隔离缓存。列表默认深度五页、每页二十条，流向图最多一百条，始终显示已展示访问占全部访问的比例。

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
