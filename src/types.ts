// ─── Scanner Status ──────────────────────────────────────────────────────────

export type ScannerStatus = 'ok' | 'unavailable' | 'error'

export interface ScannerResult<T> {
  status: ScannerStatus
  data: T | null
  error?: string
}

// ─── System ───────────────────────────────────────────────────────────────────

export interface SystemInfo {
  macosVersion: string
  macosBuild: string
  productName: string
  chip: string
  arch: string
  ramGB: number
  diskTotal: string
  diskUsed: string
  diskFree: string
}

// ─── Homebrew ─────────────────────────────────────────────────────────────────

export interface BrewFormula {
  name: string
  version: string
  installedOn: string | null
  description: string
}

export interface BrewCask {
  name: string
  version: string
  description: string
}

export interface BrewInfo {
  version: string
  formulae: BrewFormula[]
  casks: BrewCask[]
}

// ─── Node Ecosystem ──────────────────────────────────────────────────────────

export interface GlobalNpmPackage {
  name: string
  version: string | null
}

export interface NodeInfo {
  nodeVersion: string
  npmVersion: string | null
  pnpmVersion: string | null
  bunVersion: string | null
  nvmVersion: string | null
  fnmVersion: string | null
  globalPackages: GlobalNpmPackage[]
}

// ─── Runtimes ────────────────────────────────────────────────────────────────

export interface RuntimeEntry {
  name: string
  version: string
  manager?: string
  managerVersion?: string | null
}

export interface RuntimesInfo {
  python: RuntimeEntry | null
  ruby: RuntimeEntry | null
  go: RuntimeEntry | null
  rust: RuntimeEntry | null
  java: RuntimeEntry | null
}

// ─── Docker ──────────────────────────────────────────────────────────────────

export interface DockerImage {
  repository: string
  tag: string
  id: string
  size: string
  created: string
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  ports: string
}

export interface DockerInfo {
  version: string
  runningContainers: DockerContainer[]
  images: DockerImage[]
}

// ─── Databases ───────────────────────────────────────────────────────────────

export interface DatabaseEntry {
  name: string
  installed: boolean
  version: string | null
  running: boolean
}

export interface DatabasesInfo {
  postgres: DatabaseEntry
  mysql: DatabaseEntry
  redis: DatabaseEntry
  mongodb: DatabaseEntry
  sqlite: DatabaseEntry
}

// ─── Browsers ────────────────────────────────────────────────────────────────

export interface BrowserEntry {
  name: string
  installed: boolean
  version: string | null
}

export interface BrowsersInfo {
  browsers: BrowserEntry[]
}

// ─── Terminals ───────────────────────────────────────────────────────────────

export interface TerminalEntry {
  name: string
  installed: boolean
  version: string | null
}

export interface TerminalsInfo {
  shell: string
  shellVersion: string | null
  tmux: string | null
  terminals: TerminalEntry[]
}

// ─── Editors ─────────────────────────────────────────────────────────────────

export interface EditorEntry {
  name: string
  installed: boolean
  version: string | null
  extensionCount?: number
}

export interface EditorsInfo {
  editors: EditorEntry[]
}

// ─── LLMs / AI Tools ─────────────────────────────────────────────────────────

export interface OllamaModel {
  name: string
  size: string
  modified: string
}

export interface LLMsInfo {
  ollama: { installed: boolean; version: string | null; models: OllamaModel[] }
  lmStudio: { installed: boolean }
  claudeDesktop: { installed: boolean }
  copilot: { installed: boolean }
}

// ─── CLI Tools ────────────────────────────────────────────────────────────────

export interface CliToolEntry {
  name: string
  installed: boolean
  version: string | null
  path: string | null
}

export interface CliToolsInfo {
  tools: CliToolEntry[]
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/** Increment when the snapshot JSON shape changes (cloud + local compatibility). */
export const SNAPSHOT_SCHEMA_VERSION = 1 as const

export interface Snapshot {
  /** Schema version for API and dashboard consumers (omitted on older local files). */
  schemaVersion?: typeof SNAPSHOT_SCHEMA_VERSION
  id: string
  timestamp: string
  system: ScannerResult<SystemInfo>
  brew: ScannerResult<BrewInfo>
  node: ScannerResult<NodeInfo>
  runtimes: ScannerResult<RuntimesInfo>
  docker: ScannerResult<DockerInfo>
  databases: ScannerResult<DatabasesInfo>
  browsers: ScannerResult<BrowsersInfo>
  terminals: ScannerResult<TerminalsInfo>
  editors: ScannerResult<EditorsInfo>
  llms: ScannerResult<LLMsInfo>
  cliTools: ScannerResult<CliToolsInfo>
}

// ─── Annotations ─────────────────────────────────────────────────────────────

export interface AnnotationEntry {
  note: string
  updatedAt: string
}

export interface AnnotationsStore {
  [toolKey: string]: AnnotationEntry
}

// ─── Security ────────────────────────────────────────────────────────────────

export type SecurityStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface SecurityCheck {
  name: string
  status: SecurityStatus
  detail: string
}

export interface OpenPortEntry {
  process: string
  pid: string
  port: string
  protocol: string
}

export interface BrewOutdatedEntry {
  name: string
  installedVersion: string
  currentVersion: string
}

export interface SecurityInfo {
  filevault: SecurityCheck
  firewall: SecurityCheck
  sip: SecurityCheck
  gatekeeper: SecurityCheck
  automaticUpdates: SecurityCheck
  remoteLogin: SecurityCheck
  screenLock: SecurityCheck
  openPorts: OpenPortEntry[]
  brewOutdated: BrewOutdatedEntry[]
}

// ─── Diff ────────────────────────────────────────────────────────────────────

export interface DiffEntry {
  key: string
  type: 'added' | 'removed' | 'changed'
  before?: string
  after?: string
}

export interface SnapshotDiff {
  from: string
  to: string
  categories: Record<string, DiffEntry[]>
}
