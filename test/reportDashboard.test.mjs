import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { flowReport } from "./fixtures/businessFlows.mjs";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL("../web", import.meta.url)),
  resolve: { alias: { "~": fileURLToPath(new URL("../web/app", import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false },
  logLevel: "silent",
});
let model;
let ReportContent;
try {
  model = await server.ssrLoadModule("/app/pages/Project/tabs/Business/ReportDashboard/model.ts");
  ({ ReportContent } = await server.ssrLoadModule(
    "/app/pages/Project/tabs/Business/ReportDashboard/ReportDashboard.tsx",
  ));
} finally {
  await server.close();
}

function nativeTraffic(range) {
  const days = (Date.parse(range.end) - Date.parse(range.start)) / 86400000 + 1;
  return {
    meta: {
      pid: "JFfioEKRd0Sy", ...model.nativeBounds(range), timezone: "Asia/Shanghai",
      timeBucket: "day", mode: "periodical", metrics: ["pageviews"], appliedFilters: [],
    },
    data: Array.from({length: days}, (_, i) => ({
      timestamp: new Date(Date.parse(range.start) + i * 86400000).toISOString().slice(0, 10) + "T00:00:00+08:00",
      pageviews: String(i + 1),
    })),
  };
}

test("report presets and custom dates use Shanghai days and the actual collection start", () => {
  const range = model.reportRange(new Date("2026-11-13T15:59:59Z"));
  assert.equal(range.start, "2026-11-09");
  assert.equal(range.end, "2026-11-13");
  assert.equal(range.startInclusive, "2026-11-09T10:35:12.000Z");
  assert.equal(range.endExclusive, "2026-11-13T16:00:00.000Z");
  assert.equal(model.reportRange(new Date("2026-11-13T16:00:00Z")).end, "2026-11-14");
  const now = new Date("2026-12-15T08:00:00Z");
  for (const [period, start] of [["7d", "2026-12-09"], ["14d", "2026-12-02"], ["30d", "2026-11-16"]]) {
    const result = model.reportRange(now, new URLSearchParams({report_period: period}));
    assert.equal(result.start, start);
    assert.equal(result.end, "2026-12-15");
    assert.equal(result.startInclusive, new Date(`${start}T00:00:00+08:00`).toISOString());
  }
  const custom = model.reportRange(now, new URLSearchParams("report_period=custom&report_from=2026-11-10&report_to=2026-11-11"));
  assert.equal(custom.startInclusive, "2026-11-09T16:00:00.000Z");
  assert.equal(custom.endExclusive, "2026-11-11T16:00:00.000Z");
  const link = new URL(model.reportSourceLink(range, "traffic"), "https://analytics.novix.science");
  assert.equal(link.searchParams.get("novix_live"), "1");
  assert.equal(link.searchParams.get("from"), "2026-11-09T18:35:12+08:00");
  assert.equal(link.searchParams.get("to"), "2026-11-13T23:59:59+08:00");
  for (const dates of [
    "report_from=2026-11-11&report_to=2026-11-10",
    "report_from=2026-11-08&report_to=2026-11-11",
    "report_from=2026-11-10&report_to=2027-01-01",
    "report_from=2026-11-31&report_to=2026-12-02",
  ]) {
    const invalid = model.reportRange(now, new URLSearchParams("report_period=custom&" + dates));
    assert.equal(invalid.invalidSelection, true);
    assert.equal(invalid.period, "30d");
  }
  const future = new Date("2027-03-01T08:00:00Z");
  assert.equal(model.reportRange(future, new URLSearchParams("report_period=custom&report_from=2026-11-09&report_to=2027-02-09")).invalidSelection, false);
  assert.equal(model.reportRange(future, new URLSearchParams("report_period=custom&report_from=2026-11-09&report_to=2027-02-10")).invalidSelection, true);
});

test("the rendered report shows backend counts, calculation definitions and source links", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { MemoryRouter } = require("react-router");
  const range = model.reportRange(new Date("2026-11-13T08:00:00Z"));
  const path = flowReport("auto_pilot").flowFunnels.paths.find((path) =>
    path.id.endsWith(".auto_task"),
  );
  const counts = [1000, 500, 200, 150, 150, 100, 75];
  path.steps.forEach((step, index) => {
    step.count = counts[index];
  });
  const data = {
    fetchedAt: "2026-11-13T08:05:17Z",
    traffic: model.validateTraffic(nativeTraffic(range), range),
    journeys: {
      snapshotAt: "2026-11-13T08:05:07Z",
      totalSessions: 100,
      totalUsers: 70,
      totalPaths: 20,
      coverage: { ambiguousOrderVisits: 2, uncertainEnd: 4 },
      paths: [{ path: ["/search-v1/:sessionId"], sessions: 38, users: 22, continued: 0 }],
    },
    product: {
      snapshotAt: "2026-11-13T08:05:08Z",
      flowFunnels: { paths: [path] },
      usage: { operations: 10 },
      coverage: { unknownFeatureUses: 2 },
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ReportContent, { data, range, refreshing: false, onRefresh() {} }),
    ),
  );
  assert.match(html, /正式环境/);
  assert.match(html, /2026-11-09/);
  assert.match(html, /75%/);
  assert.match(html, /有 Task 请求被受理/);
  assert.match(html, /100/);
  assert.match(html, /75/);
  assert.match(html, /观测身份/);
  assert.match(html, /15<small class="nv-metric-unit">\(PV\)<\/small>/);
  assert.match(html, /100<small class="nv-metric-unit">\(会话数\)<\/small>/);
  assert.match(html, /70<small class="nv-metric-unit">\(UV\)<\/small>/);
  assert.match(html, /20<small class="nv-metric-unit">\(路径数\)<\/small>/);
  assert.match(html, /75<small class="nv-metric-unit">\(会话数\)<\/small>/);
  assert.match(html, /2026-11-09 — 2026-11-13/);
  assert.match(html, /Swetrix 原生页面浏览次数/);
  assert.doesNotMatch(html, /Cloudflare|GA4|历史与新增流量合并/);
  assert.match(html, /UV 按登录或匿名浏览器观测身份去重/);
  assert.match(html, /traffic\/timeseries/);
  assert.match(html, /novix_live=1/);
  assert.match(html, /tab=funnels/);
  assert.doesNotMatch(html, /100%等待|85%.*会等待/);
  const pastRange = model.reportRange(new Date(data.fetchedAt), new URLSearchParams("report_period=custom&report_from=2026-11-10&report_to=2026-11-11"));
  const pastHtml = renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(ReportContent, {data: {...data, traffic: model.validateTraffic(nativeTraffic(pastRange), pastRange)}, range: pastRange, refreshing: false, onRefresh() {}})));
  assert.doesNotMatch(pastHtml, /今日截至本次取数|今日数据仍会增加/);
  data.product.flowFunnels.paths.push(...flowReport("auto_discovery").flowFunnels.paths);
  const proposalHtml = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/?report_feature=auto_discovery&report_path=proposal_skip"] },
      React.createElement(ReportContent, { data, range, refreshing: false, onRefresh() {} }),
    ),
  );
  assert.match(proposalHtml, /0<small class="nv-metric-unit">\(提案数\)<\/small>/);
});

test("native traffic rejects incomplete dates, incompatible scope and timezone shifts", () => {
  const range = model.reportRange(new Date("2026-11-13T08:00:00Z"));
  const traffic = nativeTraffic(range);
  assert.equal(
    model.validateTraffic(traffic, range).rows.reduce((n, row) => n + row.pageviews, 0),
    15,
  );
  for (const mutate of [
    (value) => value.data.push(value.data[0]),
    (value) => value.data.pop(),
    (value) => {
      value.meta.from = "2026-11-09T11:35:12+08:00";
    },
    (value) => {
      value.meta.pid = "3YB7MtPN7WXv";
    },
    (value) => {
      value.data[0].pageviews = -1;
    },
    (value) => {
      value.data[0].pageviews = null;
    },
    (value) => {
      value.data[0].timestamp = "2026-11-08T00:00:00+08:00";
    },
    (value) => { value.meta.appliedFilters = [{dimension: "host", operator: "is", value: "example.com"}]; },
    (value) => { value.data[1].timestamp = value.data[0].timestamp; },
  ]) {
    const invalid = structuredClone(traffic);
    mutate(invalid);
    assert.throws(() => model.validateTraffic(invalid, range));
  }
  const legacy = structuredClone(traffic);
  legacy.meta.from = "2026-11-09T10:35:12+08:00";
  legacy.meta.to = "2026-11-13T15:59:59+08:00";
  legacy.data.unshift({timestamp:"2026-11-08T00:00:00+08:00",pageviews:0});
  assert.equal(model.validateTraffic(legacy, range).rows.length, 5);
  legacy.data[0].pageviews = 1;
  assert.throws(() => model.validateTraffic(legacy, range));
});

test("rates preserve unknown, partial and zero-denominator meanings", () => {
  const step = (count, availability = "available") => ({ count, availability });
  assert.equal(model.stageRate(step(263), step(304)), 263 / 304);
  assert.equal(model.stageRate(step(0), step(304)), 0);
  assert.equal(model.stageRate(step(null), step(304)), null);
  assert.equal(model.stageRate(step(2, "partial"), step(10)), null);
  assert.equal(model.stageRate(step(2), step(10, "partial")), null);
  assert.equal(model.stageRate(step(0), step(0)), null);
});

test("only duplicated acceptance steps merge and all raw stages remain intact", () => {
  const path = flowReport().flowFunnels.paths[0];
  path.id = "auto_pilot.auto_task";
  path.featureId = "auto_pilot";
  const route = path.steps.find((step) => step.id === "route");
  const execution = path.steps.find((step) => step.id === "execution");
  Object.assign(execution, { count: route.count, availability: route.availability });
  assert.equal(model.reportSteps(path).length, path.steps.length - 1);
  assert.ok(path.steps.some((step) => step.id === "execution"));
  assert.equal(
    model.reportSteps({ ...path, id: "auto_pilot.auto_loop" }).length,
    path.steps.length,
  );
  execution.count = route.count - 1;
  assert.equal(model.reportSteps(path).length, path.steps.length);
});

test("Not Now is explained as skipping the task card and result viewing allows return visits", () => {
  const path = { id: "auto_discovery.proposal_skip", featureId: "auto_discovery" };
  assert.match(model.stageDefinition(path, "not_now").description, /跳过.*卡片/);
  const result = model.stageDefinition(
    { id: "auto_pilot.auto_task", featureId: "auto_pilot" },
    "result",
  );
  assert.match(result.description, /回访/);
  assert.match(result.event, /feature_result_viewed/);
});

test("the dashboard reads the production APIs with identical date ranges and validates all 48 paths", async (t) => {
  const range = model.reportRange(new Date("2026-11-13T08:00:00Z"));
  const resolvedRange = {
    startInclusive: range.startInclusive,
    endExclusive: range.endExclusive,
    timezone: "Asia/Shanghai",
  };
  const traffic = nativeTraffic(range);
  const features = [
    "auto_discovery",
    "auto_pilot",
    "deep_survey",
    "idea_spark",
    "method_design",
    "auto_experiment",
    "data_analysis",
    "reproduce_paper",
  ];
  const product = {
    ...flowReport(),
    resolvedRange,
    environment: "production",
    filters: { feature: "all", computeType: "all", internalTraffic: "external" },
    features: [],
    usage: { operations: 10 },
    coverage: { unknownFeatureUses: 2 },
    flowFunnels: {
      version: 1,
      paths: features.flatMap((feature) => flowReport(feature).flowFunnels.paths),
    },
  };
  const journeys = {
    schemaVersion: 1,
    resolvedRange,
    snapshotAt: product.snapshotAt,
    identityScope: "observed_profile_only",
    totalSessions: 5,
    totalUsers: 3,
    totalPaths: 2,
    paths: [],
  };
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(new URL(url, "https://analytics.novix.science"));
    return Response.json(
      url.includes("/traffic/") ? traffic : url.includes("/journeys/") ? journeys : product,
    );
  });
  const result = await model.readDashboard(range, new AbortController().signal);
  assert.equal(result.product.flowFunnels.paths.length, 48);
  assert.equal(
    result.traffic.rows.reduce((n, row) => n + row.pageviews, 0),
    15,
  );
  for (const url of calls) {
    assert.match(url.pathname, /\/projects\/JFfioEKRd0Sy\//);
    assert.doesNotMatch(url.pathname, /history/);
    if (url.pathname.includes("/traffic/")) {
      assert.equal(url.searchParams.get("from"), model.nativeBounds(range).from);
      assert.equal(url.searchParams.get("to"), model.nativeBounds(range).to);
    } else {
      assert.equal(url.searchParams.get("startInclusive"), range.startInclusive);
      assert.equal(url.searchParams.get("endExclusive"), range.endExclusive);
      assert.equal(url.searchParams.get("timezone"), "Asia/Shanghai");
    }
  }
  product.environment = "staging";
  await assert.rejects(model.readDashboard(range, new AbortController().signal));
  product.environment = "production";
  product.flowFunnels.version = 0;
  await assert.rejects(model.readDashboard(range, new AbortController().signal));
  product.flowFunnels.version = 1;
  product.coverage.unknownFeatureUses = 11;
  await assert.rejects(model.readDashboard(range, new AbortController().signal));
});
