import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidSnapshotFileId, isValidReportFileId } from '../dist/util/snapshot-ids.js'

test('snapshot file ids reject traversal and accept ISO-style names', () => {
  assert.equal(isValidSnapshotFileId('2026-04-01T12-30-45Z'), true)
  assert.equal(isValidSnapshotFileId('../../../etc/passwd'), false)
  assert.equal(isValidSnapshotFileId('2026-04-01T12-30-45Z-audit'), false)
})

test('report file ids allow optional -audit suffix', () => {
  assert.equal(isValidReportFileId('2026-04-01T12-30-45Z'), true)
  assert.equal(isValidReportFileId('2026-04-01T12-30-45Z-audit'), true)
  assert.equal(isValidReportFileId('evil'), false)
})
