import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { historyRange, withHistoryRange } from '../web/app/pages/Project/tabs/Traffic/unifiedRange.ts'

test('historical dates use Shanghai calendar days across the UTC boundary', () => {
  assert.deepEqual(historyRange(new URLSearchParams('period=7d'), new Date('2026-11-09T17:00:00Z')), { start: '2026-11-04', end: '2026-11-10' })
  assert.deepEqual(historyRange(new URLSearchParams('period=yesterday'), new Date('2026-11-09T17:00:00Z')), { start: '2026-11-09', end: '2026-11-09' })
})
test('whole-site history links remove source-incompatible segments and preserve exact day bounds', () => {
  const params = withHistoryRange(new URLSearchParams('tab=traffic&novix_live=1&filters=private-segment&compareFrom=2026-01-01'), '2025-08-14', '2026-11-10')
  assert.equal(params.has('filters'), false)
  assert.equal(params.has('compareFrom'), false)
  assert.equal(params.get('timezone'), 'Asia/Shanghai')
  assert.deepEqual(historyRange(params), { start:'2025-08-14', end:'2026-11-10' })
})

test('calendar selection preserves GMT+8 reporting dates in different browser timezones', () => {
  const moduleUrl = new URL('../web/app/pages/Project/tabs/Traffic/unifiedRange.ts', import.meta.url).href
  const script = `
    import { calendarDate, calendarDay, historyRange, withHistoryRange } from ${JSON.stringify(moduleUrl)};
    const start = calendarDay(calendarDate('2025-08-14'));
    const end = calendarDay(calendarDate('2026-11-10'));
    const params = withHistoryRange(new URLSearchParams('tab=traffic'), start, end);
    console.log(JSON.stringify({ range: historyRange(params), from: params.get('from'), to: params.get('to') }));
  `
  for (const zone of ['Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Kiritimati']) {
    const actual = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: zone }, encoding: 'utf8',
    }))
    assert.deepEqual(actual, {
      range: { start: '2025-08-14', end: '2026-11-10' },
      from: '2025-08-14T00:00:00+08:00', to: '2026-11-10T23:59:59+08:00',
    }, zone)
  }
})
