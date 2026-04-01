/** Snapshot JSON filenames under ~/.devsnap/snapshots/ */
export const SNAPSHOT_FILE_ID_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/

/** Report files: snapshot reports or `*-audit` HTML from `devsnap audit --html` */
export const REPORT_FILE_ID_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z(-audit)?$/

export function isValidSnapshotFileId(id: string): boolean {
  return SNAPSHOT_FILE_ID_RE.test(id)
}

export function isValidReportFileId(id: string): boolean {
  return REPORT_FILE_ID_RE.test(id)
}

export function displayTimestampFromSnapshotId(id: string): string {
  const m = id.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z/)
  if (!m) return id
  return `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z`
}
