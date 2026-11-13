import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false },
  logLevel: 'silent',
});
let sections;
try {
  sections = await server.ssrLoadModule('/app/pages/Project/tabs/Business/BusinessSections.tsx');
} finally {
  await server.close();
}
const { ProductSections, ResourceSections, FunnelSection } = sections;
const metric = (html, label, value) => assert.equal(html.match(new RegExp(`aria-label="${label}"[^]*?<span[^>]*>([^<]*)</span>`))?.[1], value);
const labels = JSON.parse(
  await readFile(
    new URL("../web/app/pages/Project/tabs/Business/en.json", import.meta.url),
    "utf8",
  ),
);
const rate = {
  value: null,
  numerator: 0,
  denominator: 0,
  availability: "partial",
  maturity: "pending",
};
const range = {
  startInclusive: "2026-11-01T00:00:00Z",
  endExclusive: "2026-11-02T00:00:00Z",
  timezone: "UTC",
};
const fixture = () => ({
  schemaVersion: 1,
  environment: "staging",
  snapshotAt: range.endExclusive,
  resolvedRange: range,
  traffic: {
    availability: "unavailable",
    pv: 0,
    uv: 0,
    users: 0,
    engagedSeconds: null,
    averageEngagedSeconds: null,
  },
  usage: { operations: 0, users: 0, newUsers: 0, returningUsers: 0 },
  features: Array.from({ length: 13 }, (_, i) => ({
    id: `feature_${i}`,
    label: `Feature ${i}`,
    availability: i > 7 ? "coming_soon" : "available",
    exposures: 0,
    exposedActors: 0,
    clicks: 0,
    clickedActors: 0,
    uses: 0,
    users: 0,
    averageUses: null,
  })),
  auxiliary: [],
  frequency: [
    {
      days: 7,
      users: 0,
      uses: 0,
      averageUses: null,
      averageActiveDays: null,
      medianIntervalSeconds: null,
      distribution: {},
    },
  ],
  retention: {
    points: [{ day: 7, exact: rate, cumulative: rate, pendingUsers: 2, unknownFirstUsers: 1 }],
    daily: [{ date: "2026-11-01", day: 7, exact: rate, cumulative: rate }],
    weekly: [{ week: "2026-10-26", day: 7, exact: rate, cumulative: rate }],
  },
  delivery: {
    statuses: { success: 0, failure: 0, cancelled: 0, in_flight: 0 },
    eventsInRange: { success: 1, failure: 0 },
    successWithin7Days: rate,
    pendingOperations: 2,
    duration: { p50Seconds: null, p90Seconds: null, reported: 0, missing: 1 },
    inFlight: { count: 0, ageP90Seconds: null },
  },
  funnel: {
    availability: "unavailable",
    pendingUsers: 2,
    steps: [{ id: "workspace", users: 0, fromPrevious: rate, fromFirst: rate }],
  },
  channels: [
    {
      source: "<script>alert(1)</script>",
      medium: "link",
      campaign: "A&B",
      pv: 0,
      visitors: 0,
      uses: 0,
      users: 0,
    },
  ],
  registrations: { total: 0 },
  coverage: {
    missingCompletionTimes: 1,
    excludedOrigins: 0,
    unknownFeatureUses: 1,
    identity: { legacyAnonymousEvents: 2 },
    filterGaps: { device: 2 },
  },
});

test('feature table warns about incompatible historical coverage and distinguishes functional activity', () => {
  const report = fixture();
  report.coverage.unknownFeatureUses = 1724;
  report.coverage.featureAttribution = { total: 2471, recorded: 245, recovered: 0, legacy: 502, unknown: 1724 };
  report.features[0] = { ...report.features[0], label: 'Auto-Discovery', viewedActors: 4, interactedActors: 2, featureSources: { recorded: 2, recovered: 0, legacy: 0, unknown: 0 } };
  const html = renderToStaticMarkup(React.createElement(ProductSections, { report, labels, language: 'en' }));
  assert.ok(html.includes('245 / 0 / 502 / 1724'));
  assert.ok(html.includes(labels.featureCoverageWarning));
  assert.ok(html.includes(labels.viewedActors));
  assert.ok(html.includes(labels.interactedActors));
  assert.ok(html.includes(labels.featureUsageDefinition));
});

test("native panels preserve unknown metrics, zero values, pending cohorts and all feature rows", () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductSections, { report: fixture(), labels, language: "en" }),
  );
  metric(html, 'PV', '—');
  metric(html, 'Accepted uses', '0');
  assert.equal((html.match(/<td[^>]*>Feature \d+<\/td>/g) || []).length, 13);
  for (const text of [
    "Coming soon",
    "Observation window open",
    "Daily cohort",
    "Weekly cohort",
    "Missing field associations",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes(labels.filterPartial));
  assert.ok(!html.includes("<iframe"));
  assert.ok(!html.includes(labels.back));
});

test('overall retention has a direct anchor and preserves accepted-task cohort metrics', () => {
  const report = fixture();
  report.retention.points = [7, 14].map(day => ({
    day,
    exact: { value: .25, numerator: 1, denominator: 4, availability: 'available', maturity: 'mature' },
    cumulative: { value: .5, numerator: 2, denominator: 4, availability: 'available', maturity: 'mature' },
    pendingUsers: 2,
    unknownFirstUsers: 1,
  }));
  const html = renderToStaticMarkup(React.createElement(ProductSections, { report, labels, language: 'en' }));
  assert.match(html, /id="novix-product-retention"/);
  assert.match(html, /Overall first-use retention/);
  assert.match(html, /first backend-accepted task across all features/);
  assert.match(html, /D7\/D14/);
  assert.match(html, /D1–DN/);
  assert.match(html, /D7<\/td>/);
  assert.match(html, /D14<\/td>/);
  assert.match(html, /25% \(1\/4\)/);
  assert.match(html, /50% \(2\/4\)/);
});

test('feature-filtered retention keeps its feature scope visible', () => {
  const html = renderToStaticMarkup(React.createElement(ProductSections, { report: fixture(), labels, language: 'en', overallRetention: false }));
  assert.ok(html.includes(labels.retention));
  assert.ok(!html.includes('Overall first-use retention'));
});

test("accepted cohort status and terminal events remain separate, and attribution is escaped", () => {
  const html = renderToStaticMarkup(
    React.createElement(ProductSections, { report: fixture(), labels, language: "en" }),
  );
  const [accepted, terminal] = html.split(labels.eventsInRange);
  metric(accepted, 'Successful', '0');
  metric(terminal, 'Successful', '1');
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("A&amp;B"));
  assert.ok(!html.includes("<script>"));
});

test("resource panels identify their all-account scope and preserve partial token coverage", () => {
  const report = {
    schemaVersion: 1,
    environment: "staging",
    snapshotAt: range.endExclusive,
    resolvedRange: range,
    taskSummary: { total: 1, byStatus: { finish: 1 } },
    creditSummary: { creditsConsumed: 0, consumeCount: 1, averageCredits: 0 },
    taskTrend: [{ date: "2026-11-01", total: 1, byStatus: { finish: 1 } }],
    creditTrend: [{ date: '2026-11-02', creditsConsumed: 0, consumeCount: 1 }],
    tokenUsage: {
      availability: "partial",
      totalConsumeCount: 1,
      metrics: { inputTokens: { total: 0, reportedRecordCount: 1 }, outputTokens: null },
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ResourceSections, { report, labels, language: "en" }),
  );
  assert.ok(html.includes(labels.resourceScope));
  assert.ok(html.includes(labels.token_partial));
  assert.ok(html.includes('2026-11-02'), 'credit-only dates remain in the trend');
  metric(html, 'Input tokens', '0');
  metric(html, 'Output tokens', '—');
});

test('business funnel preserves unknown rates and pending conversion windows', () => {
  const report = { funnel: { availability: 'available', pendingUsers: 2, steps: [
    { id: 'workspace', users: 0, fromPrevious: rate, fromFirst: rate },
  ] } };
  const html = renderToStaticMarkup(React.createElement(FunnelSection, { report, labels, language: 'en' }));
  assert.match(html, /<td[^>]*>0<\/td>/);
  assert.ok(html.includes(labels.pending));
  assert.doesNotMatch(html, /100%/);
});

test('unsupported business funnel counts stay unknown instead of exposing computed zeros or stale values', () => {
  const report = { funnel: { availability: 'unavailable', pendingUsers: 0, steps: [
    { id: 'workspace', users: 987654, fromPrevious: rate, fromFirst: rate },
  ] } };
  const html = renderToStaticMarkup(React.createElement(FunnelSection, { report, labels, language: 'en' }));
  assert.doesNotMatch(html, /987[,.]?654/);
  assert.match(html, /<td[^>]*>—<\/td>/);
});
