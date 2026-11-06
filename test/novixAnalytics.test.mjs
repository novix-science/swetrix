import assert from "node:assert/strict";
import { test } from "node:test";
import { getNovixAnalyticsHref } from "../web/app/utils/novixAnalytics.ts";

const options = {
  projectId: "ABCDEFGHIJKL",
  enabledProjectIds: "123456789012, ABCDEFGHIJKL",
  selfhosted: true,
  searchParams: new URLSearchParams(
    "period=7d&timezone=Asia%2FShanghai&tab=errors&profileId=private&compare=previous",
  ),
  language: "zh-CN",
  theme: "dark",
};

test("links only enabled selfhosted project views and forwards supported date context", () => {
  const result = getNovixAnalyticsHref(options);
  assert.ok(result);
  const url = new URL(result, "https://analytics.example");
  assert.equal(url.origin, "https://analytics.example");
  assert.equal(url.pathname, "/novix/projects/ABCDEFGHIJKL/business");
  assert.equal(url.searchParams.get("lang"), "zh");
  assert.equal(url.searchParams.get("theme"), "dark");
  assert.equal(url.searchParams.get("period"), "7d");
  assert.equal(url.searchParams.get("timezone"), "Asia/Shanghai");
  assert.equal(url.searchParams.get("compare"), "previous");
  assert.equal(url.searchParams.has("tab"), false);
  assert.equal(url.searchParams.has("profileId"), false);
});

test("keeps unconfigured, embedded, hosted and invalid project routes hidden", () => {
  for (const change of [
    { enabledProjectIds: undefined },
    { enabledProjectIds: "otherproject" },
    { embedded: true },
    { selfhosted: false },
    { projectId: "../admin" },
  ])
    assert.equal(getNovixAnalyticsHref({ ...options, ...change }), undefined);
});

test("uses the English fallback and retains an absolute date range", () => {
  const result = getNovixAnalyticsHref({
    ...options,
    language: "ja",
    theme: "system",
    searchParams: new URLSearchParams(
      "startInclusive=2026-11-01T00%3A00%3A00Z&endExclusive=2026-11-02T00%3A00%3A00Z",
    ),
  });
  assert.ok(result);
  const query = new URL(result, "https://analytics.example").searchParams;
  assert.equal(query.get("lang"), "en");
  assert.equal(query.has("theme"), false);
  assert.equal(query.get("startInclusive"), "2026-11-01T00:00:00Z");
});

test("uses the native dashboard timezone when the URL omits it or contains another zone", () => {
  for (const query of ["period=7d", "period=7d&timezone=UTC"]) {
    const result = getNovixAnalyticsHref({
      ...options,
      timezone: "America/New_York",
      searchParams: new URLSearchParams(query),
    });
    assert.ok(result);
    assert.equal(
      new URL(result, "https://analytics.example").searchParams.get("timezone"),
      "America/New_York",
    );
  }
});

for (const [name, query, timeBucket] of [
  ["an empty URL", "", "hour"],
  ["a period without a bucket", "period=7d", "hour"],
  ["an explicit compatible bucket", "period=7d&timeBucket=day", "day"],
  [
    "conflicting raw values",
    "period=invalid&timeBucket=month&tb=year&timezone=UTC",
    "hour",
  ],
]) {
  test(`preserves resolved native period, bucket and timezone from ${name}`, () => {
    const result = getNovixAnalyticsHref({
      ...options,
      searchParams: new URLSearchParams(query),
      period: "7d",
      timeBucket,
      timezone: "Asia/Shanghai",
    });
    assert.ok(result);
    const params = new URL(result, "https://analytics.example").searchParams;
    assert.equal(params.get("period"), "7d");
    assert.equal(params.get("timeBucket"), timeBucket);
    assert.equal(params.get("timezone"), "Asia/Shanghai");
  });
}
