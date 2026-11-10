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
2. 邮箱查询增加 profile_traits 五列只读权限，授权文件位于 BFF 的 journeys-reader-grant.sql，尚未执行；路径及数字 ID 查找复用现有 events SELECT。
3. 最后发布本 Swetrix 前端。NOVIX_ANALYTICS_PROJECT_IDS 与 BFF 项目绑定需一致，沿用现有域名和私有登录会话。
4. 升级检查 ViewProject 的入口适配、原生 period/timeBucket/timezone/from/to、events 的 sid/profileId/created/metadata，以及原生组件行为。运行 BFF 实际 SQL fixture 和本仓库测试。

开发验收：`node --test test/*.test.mjs` 共 24 项通过，新模块 lint、完整 typecheck、客户端/SSR 构建及样式清单通过。本地浏览器使用合成数据验证路径列表、图、逐步转化、邮箱/ID、账号切换、详情展开、空范围和刷新；真实只读账号已完成 SQL 及两项目查询预检。尚未部署本模块，发布后仍需真实登录、权限及数据验收。
