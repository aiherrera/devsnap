import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseScheduleInterval,
  parseScheduleTime,
  parseCalendarIntervalFromPlist,
  buildCalendarIntervalDictXml,
  SCHEDULE_INTERVAL_SECONDS,
} from '../dist/commands/schedule.js'

test('parseScheduleInterval accepts 1w and rejects 7d', () => {
  assert.equal(parseScheduleInterval('1w'), '1w')
  assert.equal(parseScheduleInterval('7d'), null)
  assert.equal(SCHEDULE_INTERVAL_SECONDS['1w'], 7 * 24 * 3600)
})

test('parseScheduleTime accepts HH:MM', () => {
  assert.deepEqual(parseScheduleTime('08:00'), { hour: 8, minute: 0 })
  assert.deepEqual(parseScheduleTime('9:30'), { hour: 9, minute: 30 })
  assert.deepEqual(parseScheduleTime('00:00'), { hour: 0, minute: 0 })
  assert.equal(parseScheduleTime('24:00'), null)
  assert.equal(parseScheduleTime('08:60'), null)
  assert.equal(parseScheduleTime('bad'), null)
})

test('parseCalendarIntervalFromPlist reads daily / weekly / monthly dicts', () => {
  const daily = `<?xml version="1.0"?><plist><dict>
<key>StartCalendarInterval</key>
<dict>
  <key>Hour</key><integer>8</integer>
  <key>Minute</key><integer>15</integer>
</dict></dict></plist>`
  assert.deepEqual(parseCalendarIntervalFromPlist(daily), { hour: 8, minute: 15 })

  const weekly = `<plist><key>StartCalendarInterval</key><dict>
  <key>Weekday</key><integer>1</integer>
  <key>Hour</key><integer>7</integer>
  <key>Minute</key><integer>0</integer>
</dict></plist>`
  assert.deepEqual(parseCalendarIntervalFromPlist(weekly), { hour: 7, minute: 0, weekday: 1 })

  const monthly = `<plist><key>StartCalendarInterval</key><dict>
  <key>Day</key><integer>1</integer>
  <key>Hour</key><integer>6</integer>
  <key>Minute</key><integer>30</integer>
</dict></plist>`
  assert.deepEqual(parseCalendarIntervalFromPlist(monthly), { hour: 6, minute: 30, day: 1 })
  assert.equal(parseCalendarIntervalFromPlist('<plist></plist>'), null)
})

test('buildCalendarIntervalDictXml matches launchd shape for presets', () => {
  const d = buildCalendarIntervalDictXml(8, 0)
  assert.match(d, /<key>Hour<\/key>/)
  assert.match(d, /<integer>8<\/integer>/)
  assert.match(d, /<key>Minute<\/key>/)
  assert.doesNotMatch(d, /Weekday/)

  const w = buildCalendarIntervalDictXml(8, 0, { weekday: 1 })
  assert.match(w, /<key>Weekday<\/key>/)

  const m = buildCalendarIntervalDictXml(8, 0, { day: 1 })
  assert.match(m, /<key>Day<\/key>/)
})
