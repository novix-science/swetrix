import test from 'node:test'
import assert from 'node:assert/strict'
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
