/** Default timeout for subprocess calls that may block (brew, docker, npm, etc.). */
export const CMD_TIMEOUT_MS = 120_000

export function withCmdTimeout<const T extends object>(opts?: T): T & { timeout: number } {
  return { ...(opts ?? ({} as T)), timeout: CMD_TIMEOUT_MS } as T & { timeout: number }
}
