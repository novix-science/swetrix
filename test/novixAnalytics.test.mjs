import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUSINESS_FILTER_DEFAULTS,
  NOVIX_BUSINESS_TAB,
  businessQueryParams,
  isNovixAnalyticsEnabled,
  readBusinessFilters,
  updateBusinessFilters,
} from "../web/app/utils/novixAnalytics.ts";

const options = {
  projectId: "ABCDEFGHIJKL",
  enabledProjectIds: "123456789012, ABCDEFGHIJKL",
  selfhosted: true,
};

test("business is a native tab enabled only for configured selfhosted projects", () => {
  assert.equal(NOVIX_BUSINESS_TAB, "novixBusiness");
  assert.equal(isNovixAnalyticsEnabled(options), true);
  for (const change of [
    { enabledProjectIds: undefined },
    { enabledProjectIds: "otherproject" },
    { embedded: true },
    { selfhosted: false },
    { projectId: "../admin" },
  ]) {
    assert.equal(isNovixAnalyticsEnabled({ ...options, ...change }), false);
  }
});

test("native effective period, bucket and timezone override absent or conflicting URL values", () => {
  for (const input of ["", "period=7d", "period=12M&timeBucket=day&timezone=UTC"]) {
    const result = businessQueryParams({
      searchParams: new URLSearchParams(input),
      period: "7d",
      timeBucket: "hour",
      timezone: "Asia/Shanghai",
    });
    assert.equal(result.get("period"), "7d");
    assert.equal(result.get("timeBucket"), "hour");
    assert.equal(result.get("timezone"), "Asia/Shanghai");
  }
});

test("custom bounds are preserved exactly while unrelated native filters stay out of BFF queries", () => {
  const input = new URLSearchParams(
    "tab=novixBusiness&profileId=private&compare=previous&filters=secret",
  );
  input.set("from", "2026-11-01T00:00:00.000Z");
  input.set("to", "2026-11-02T23:59:59.999Z");
  input.set("novix_feature", "data_analysis");
  input.set("novix_internalTraffic", "external");
  const result = businessQueryParams({
    searchParams: input,
    period: "custom",
    timeBucket: "hour",
    timezone: "Asia/Shanghai",
  });
  assert.equal(result.get("from"), input.get("from"));
  assert.equal(result.get("to"), input.get("to"));
  assert.equal(result.get("feature"), "data_analysis");
  assert.equal(result.get("internalTraffic"), "external");
  for (const key of ["tab", "profileId", "filters", "compare", "novix_feature"])
    assert.equal(result.has(key), false);
});

test("business filters round trip without replacing dates or native tab state", () => {
  const input = new URLSearchParams(
    "tab=novixBusiness&period=7d&timeBucket=hour&filters=native&novix_feature=old",
  );
  const filters = {
    ...BUSINESS_FILTER_DEFAULTS,
    feature: "draw_plot",
    internalTraffic: "all",
    mode: "deep",
    computeType: "gpu",
    device: "desktop",
    userType: "new",
    version: "v2",
    attribution: "first",
    source: "A&B",
    medium: "link",
    campaign: "<launch>",
  };
  const result = updateBusinessFilters(input, filters);
  assert.deepEqual(readBusinessFilters(result), filters);
  assert.equal(result.get("filters"), "native");
  assert.equal(result.get("period"), "7d");
  assert.equal(result.get("tab"), NOVIX_BUSINESS_TAB);
  assert.equal(input.get("novix_feature"), "old");
  const reset = updateBusinessFilters(result, { ...BUSINESS_FILTER_DEFAULTS });
  assert.equal(
    [...reset.keys()].some((key) => key.startsWith("novix_")),
    false,
  );
  assert.deepEqual(readBusinessFilters(reset), BUSINESS_FILTER_DEFAULTS);
});
