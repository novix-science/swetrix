import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { flowReport } from './fixtures/businessFlows.mjs'

const require = createRequire(new URL('../web/package.json', import.meta.url))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../web', import.meta.url)),
  resolve: { alias: { '~': fileURLToPath(new URL('../web/app', import.meta.url)) } },
  server: { middlewareMode: true, watch: null, ws: false },
  logLevel: 'silent',
})
let readFlowReport
try {
  readFlowReport = (await server.ssrLoadModule('/app/pages/Project/tabs/Funnels/report.ts')).readFlowReport
} finally {
  await server.close()
}

const fixture = () => {
  const report = flowReport()
  for (const path of report.flowFunnels.paths) {
    path.availability = 'unavailable'
    path.coverage.missingEvents = ['feature_viewed']
    for (const step of path.steps) Object.assign(step, { count: null, availability: 'unavailable' })
  }
  return report
}
const read = () => readFlowReport('/novix/api/v1/projects/project12345/product/flows?feature=deep_survey', 'deep_survey', new AbortController().signal)

test('a thin flow report loads without unrelated legacy product metrics', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(fixture()))
  const result = await read()
  assert.equal(result.flowFunnels.paths.length, 6)
  assert.equal(result.flowFunnels.paths[0].steps[0].count, null)
})

test('flow report errors preserve HTTP status and backend error code', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'product_analytics_capacity_exceeded' }, { status: 422 }))
  await assert.rejects(read, { status: 422, code: 'product_analytics_capacity_exceeded' })
})

test('non-object HTTP error bodies retain the HTTP failure status', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(null, { status: 503 }))
  await assert.rejects(read, { status: 503, code: 'request_failed' })
})

test('wrong-feature, invalid-date, incomplete and non-JSON reports fail visibly', async t => {
  for (const mutate of [
    data => { data.filters.feature = 'idea_spark' },
    data => { data.snapshotAt = 'invalid' },
    data => { data.environment = 123 },
    data => { data.snapshotAt = 2026 },
    data => { data.resolvedRange.timezone = true },
    data => { data.resolvedRange.endExclusive = data.resolvedRange.startInclusive },
    data => { data.flowFunnels.paths.pop() },
  ]) {
    const data = fixture()
    mutate(data)
    const mock = t.mock.method(globalThis, 'fetch', async () => Response.json(data))
    await assert.rejects(read, { status: 502, code: 'invalid_report' })
    mock.mock.restore()
  }
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Bad gateway</html>'))
  await assert.rejects(read, { status: 502, code: 'invalid_report' })
})
