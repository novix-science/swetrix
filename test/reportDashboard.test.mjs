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

test("the report uses exactly 30 Shanghai calendar days including today", () => {
  const range = model.reportRange(new Date("2026-11-13T15:59:59Z"));
  assert.equal(range.start, "2026-10-15");
  assert.equal(range.end, "2026-11-13");
  assert.equal(range.startInclusive, "2026-10-14T16:00:00.000Z");
  assert.equal(range.endExclusive, "2026-11-13T16:00:00.000Z");
  assert.equal(model.reportRange(new Date("2026-11-13T16:00:00Z")).end, "2026-11-14");
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
    history: {
      rows: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.parse(range.start) + i * 86400000).toISOString().slice(0, 10),
        source: "cloudflare",
        pageviews: 1,
      })),
    },
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
  assert.match(html, /2026-10-15/);
  assert.match(html, /75%/);
  assert.match(html, /有 Task 请求被受理/);
  assert.match(html, /100/);
  assert.match(html, /75/);
  assert.match(html, /观测身份/);
  assert.match(html, /history\/unified/);
  assert.match(html, /tab=funnels/);
  assert.doesNotMatch(html, /100%等待|85%.*会等待/);
});

test("each historical day is counted once and invalid coverage fails visibly", () => {
  const range = model.reportRange(new Date("2026-11-13T08:00:00Z"));
  const history = {
    schemaVersion: 1,
    projectId: "JFfioEKRd0Sy",
    environment: "production",
    resolvedRange: { start: range.start, end: range.end, timezone: "Asia/Shanghai" },
    rows: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.parse(range.start) + i * 86400000).toISOString().slice(0, 10),
      source: i < 26 ? "cloudflare" : "swetrix",
      pageviews: String(i + 1),
    })),
  };
  assert.equal(
    model.validateHistory(history, range).rows.reduce((n, row) => n + row.pageviews, 0),
    465,
  );
  for (const mutate of [
    (value) => value.rows.push(value.rows[0]),
    (value) => value.rows.pop(),
    (value) => {
      value.environment = "staging";
    },
    (value) => {
      value.projectId = "3YB7MtPN7WXv";
    },
    (value) => {
      value.rows[0].pageviews = -1;
    },
    (value) => {
      value.rows[0].pageviews = null;
    },
    (value) => {
      value.rows[0].date = "2026-10-14";
    },
  ]) {
    const invalid = structuredClone(history);
    mutate(invalid);
    assert.throws(() => model.validateHistory(invalid, range));
  }
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
  const history = {
    schemaVersion: 1,
    projectId: "JFfioEKRd0Sy",
    environment: "production",
    resolvedRange: { start: range.start, end: range.end, timezone: "Asia/Shanghai" },
    rows: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.parse(range.start) + i * 86400000).toISOString().slice(0, 10),
      source: "cloudflare",
      pageviews: 1,
    })),
  };
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
      url.includes("/history/") ? history : url.includes("/journeys/") ? journeys : product,
    );
  });
  const result = await model.readDashboard(range, new AbortController().signal);
  assert.equal(result.product.flowFunnels.paths.length, 48);
  assert.equal(
    result.history.rows.reduce((n, row) => n + row.pageviews, 0),
    30,
  );
  for (const url of calls) {
    assert.match(url.pathname, /\/projects\/JFfioEKRd0Sy\//);
    if (!url.pathname.includes("/history/")) {
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
