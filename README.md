# devsnap

<p align="center">
  <strong>Local-first macOS dev environment scanner: scan, annotate, diff—no account required.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@aiherrera/devsnap"><img src="https://img.shields.io/npm/v/@aiherrera%2Fdevsnap?style=flat-square&label=npm" alt="npm version" /></a>
  <a href="https://github.com/aiherrera/devsnap/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/node/v/@aiherrera%2Fdevsnap?style=flat-square" alt="Node version" />
</p>

---

**devsnap** is a **CLI-only** project for **macOS**: it captures a structured snapshot of your machine (OS and hardware, **Homebrew**, **Node**, **runtimes**, **Docker**, **databases**, **browsers**, **terminals**, **editors**, **LLM / AI CLIs**, **CLI tools**), saves everything under `~/.devsnap`, and diffs locally. Optional **`devsnap cloud`** commands can talk to **your own** HTTP API (for example a private dashboard backend you host separately)—this repository does not ship a server or web UI.

<p align="center">
  <sub>Built for developers who want one command instead of twenty screenshots.</sub>
</p>

---

## Why devsnap?

| You need… | devsnap gives you… |
|-----------|-------------------|
| A single inventory of “what’s on this Mac?” | `devsnap scan` → terminal, Markdown, HTML, or JSON |
| To see what changed after an upgrade | `devsnap diff` between two snapshots |
| Context for teammates or support | `devsnap share clipboard` or gist (Markdown/HTML) |
| To remember *why* a tool is installed | `devsnap annotate` on tool keys |
| A starting point to reproduce a machine | `devsnap export brewfile` or `bootstrap` |
| Low-friction drift awareness | `devsnap schedule install` — recurring **`launchd`** scans (presets + **`--time`** below; default **24h** at **08:00** local) |
| A lightweight security pass | `devsnap audit` (optional `--html`) |
| Optional upload to your own API | `devsnap cloud push` (after `cloud auth` or `cloud register`) |

---

## Installation

**Requirements:** macOS · **Node.js ≥ 22**

```bash
npm install -g @aiherrera/devsnap
```

The `devsnap` command name is unchanged (see `bin` in `package.json`). Scoped packages are private on npm by default; the first publish must use `npm publish --access public`.

From source:

```bash
git clone https://github.com/aiherrera/devsnap.git
cd devsnap
npm install
npm run build
npm link   # or: node dist/cli.js
```

---

## Quick start

```bash
# Full scan, print to terminal and save JSON snapshot under ~/.devsnap/snapshots/
devsnap scan

# Scan + write Markdown and HTML reports (HTML opens in browser by default)
devsnap scan --md --html

# Machine-readable output only (still can save with default behavior)
devsnap scan --json

# Compare the last two snapshots
devsnap diff

# Search the latest snapshot
devsnap search docker

# Optional (macOS): recurring scans via launchd
devsnap schedule install --interval 24h --time 08:00
devsnap schedule install --interval 1w
devsnap schedule status
```

---

## Commands

| Command | Description |
|---------|-------------|
| `devsnap scan` | Scan environment. Flags: `--html`, `--md`, `--json`, `--no-save` |
| `devsnap list` | List saved snapshots |
| `devsnap diff [id1] [id2]` | Diff two snapshots (defaults to latest pair) |
| `devsnap open` | Open the latest HTML report in your browser |
| `devsnap annotate` | Add or manage notes on tools (`--list`, `--show`, `--remove`) |
| `devsnap search <query>` | Search latest snapshot; `-s, --snapshot <id>` for a specific one |
| `devsnap export <format> [output]` | `brewfile` or `bootstrap` from latest snapshot |
| `devsnap clean` | Drop old snapshots; `-k, --keep <n>` (default **5**) |
| `devsnap schedule <action>` | `install` \| `uninstall` \| `status` — **launchd** job. **`-i, --interval`**: **`1h`**, **`8h`**, **`24h`** (default), **`1w`**, **`1m`**. **`-t, --time HH:MM`**: local time for **`24h`** (daily), **`1w`** (Mondays), **`1m`** (1st of each month); default **`08:00`**. Ignored for **`1h`** / **`8h`** (`StartInterval` only). |
| `devsnap share <target>` | `clipboard` \| `gist` — `--format md\|html` (gist needs `gh` CLI; see **Privacy** below) |
| `devsnap audit` | Security-oriented audit; `--html` for report |
| `devsnap config show` | Print config |
| `devsnap config set <key> <value>` | Update `~/.devsnap/config.json` (only documented keys are accepted) |
| `devsnap cloud register` | Create an account on **your** API; saves API key to `~/.devsnap/cloud.json` |
| `devsnap cloud auth` | Save API key, API base URL, optional dashboard URL (`--key`, `--url`, `--dashboard`) |
| `devsnap cloud logout` | Remove `~/.devsnap/cloud.json` |
| `devsnap cloud status` | Show whether cloud credentials are configured |
| `devsnap cloud push` | `POST` latest (or `--id`) snapshot JSON to your API; optional `--tag`, `--note`, `--redacted` |
| `devsnap cloud list` | List snapshots from your API |
| `devsnap cloud open` | Open the saved dashboard URL in a browser |

Run `devsnap --help` or `devsnap <command> --help` for details.

**Environment:** `DEVSNAP_CLOUD_API` overrides the API base URL when not passed via `cloud auth --url` (default for local development: `http://localhost:3001`).

---

## Optional cloud API (your own backend)

This repo stays **CLI-only**. If you run a separate private service, implement endpoints compatible with the CLI:

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/api/auth/register` | Body: `{ "email": string \| null }`. Response: `{ "apiKey": string }` (plaintext key, show once). |
| `POST` | `/api/snapshots` | Header: `Authorization: Bearer <apiKey>`. Body: `{ "payload": <snapshot JSON>, "tag": string \| null, "note": string \| null }`. Response: `{ "id": string, "localId": string }`. |
| `GET` | `/api/snapshots?limit=50` | Same auth. Response: array of `{ id, localId, createdAt, tag, note }`. |
| `GET` | `/api/snapshots/:id` | Same auth. Full row including `payload`. |

`snapshot` objects are the same shape as `devsnap scan --json` (see **What gets scanned**). New scans include optional `schemaVersion` for forward compatibility.

---

## What gets scanned

Snapshots include (when available on your system):

- **System** — macOS version, architecture, chip, memory, disk
- **Homebrew** — formulae and casks
- **Node** — versions, package managers, global packages
- **Runtimes** — e.g. Python, Ruby, Go, Rust (as detected)
- **Docker** — version, images, running containers
- **Databases** — common DB CLI presence / versions
- **Browsers** — installed browsers
- **Terminals** — terminal apps
- **Editors** — VS Code, Cursor, JetBrains, etc.
- **LLMs** — AI/LLM-related CLIs and tooling
- **CLI tools** — curated list of developer utilities (configurable)

Exact coverage evolves with releases; use `devsnap scan --json` to inspect the schema.

**`--json` output** can include paths, tool names, and versions. Avoid piping it into shared logs or CI artifacts if that is sensitive for your environment.

---

## Privacy

- **`devsnap share gist`** uploads your Markdown report to **GitHub Gists** (public by default for anonymous gists, or per your `gh` account defaults). Treat it like publishing environment inventory.
- **Clipboard** copies the report into the system pasteboard; anyone with access to the machine or universal clipboard may see it.

---

## Configuration

Config lives at **`~/.devsnap/config.json`**. You can edit it or use the CLI:

```bash
devsnap config show
devsnap config set autoOpenHtml false
devsnap config set staleDays 365
```

| Key | Purpose |
|-----|---------|
| `disabledScanners` | Skip categories: `brew`, `node`, `runtimes`, `docker`, `databases`, `browsers`, `terminals`, `editors`, `llms`, `cliTools`, `system` (case-insensitive) |
| `extraCliTools` | Extra **binary names** to probe (letters, digits, `.`, `_`, `-` only; no paths). Duplicates of built-in tools are ignored. |
| `staleDays` | Days before a tool is treated as stale (default **180**) |
| `cleanKeep` | Default keep count for `devsnap clean` (default **5**) |
| `autoOpenHtml` | Open browser after `devsnap scan --html` (default **true**) |

---

## Data on disk

| Path | Contents |
|------|----------|
| `~/.devsnap/snapshots/` | Snapshot JSON files (timestamp-style ids; `devsnap list` shows valid ids for `diff`) |
| `~/.devsnap/reports/` | Generated `.html` and `.md` reports |
| `~/.devsnap/config.json` | User configuration |
| `~/.devsnap/annotations.json` | Tool annotations |
| `~/.devsnap/cloud.json` | Optional cloud API key + URLs (mode `600`; created by `devsnap cloud auth` / `register`) |
| `~/.devsnap/schedule.log` | Stdout from scheduled `devsnap scan` (when using `schedule install`) |
| `~/.devsnap/schedule.err` | Stderr from scheduled runs |

---

## Development

```bash
npm install
npm run dev -- --help    # tsx src/cli.ts
npm run build            # tsc → dist/
npm run typecheck
```

**CI** (`.github/workflows/ci.yml`) runs typecheck, tests, and a pack dry-run on pushes and PRs. It does **not** publish to npm.

### Automated versioning and releases ([Release Please](https://github.com/googleapis/release-please))

This repo uses **[Release Please](https://github.com/googleapis/release-please)** (`.github/workflows/release-please.yml`):

1. Use **[Conventional Commits](https://www.conventionalcommits.org/)** on `main`, for example:
   - `fix: …` → patch bump  
   - `feat: …` → minor bump  
   - `feat!: …` or `BREAKING CHANGE:` in the body → major bump  
   - `chore:`, `docs:`, etc. usually do not trigger a release by themselves (see Release Please rules).
2. On each push to **`main`**, the workflow opens or updates a **Release PR** that bumps **`package.json`**, updates **`CHANGELOG.md`**, and prepares the next version.
3. When you **merge that Release PR**, Release Please creates the **GitHub release and tag**, then **`npm publish --access public`** runs in the **same** job (so you do not depend on a second workflow).

**Setup**

- Add the **`NPM_TOKEN`** Actions secret (npm automation/publish token), same as below.
- Under **Settings → Actions → General**, allow **“Read and write permissions”** for the workflow token and (if prompted) allow workflows to **create pull requests**.

**Other tools people use:** [semantic-release](https://semantic-release.gitbook.io/) (fully automated from commits, no merge step), [Changesets](https://github.com/changesets/changesets) (human-written changeset files). Release Please fits GitHub-centric teams who like a visible **Release PR**.

### Manual npm publish (optional)

**Actions → Publish to npm (manual) → Run workflow** publishes whatever **`version`** is on **`main`** today. Use for hotfixes or if you skip Release Please. Still requires **`NPM_TOKEN`**.

### npm token

1. Create an **automation** (or **publish**) token at [npmjs.com](https://www.npmjs.com/) → **Access Tokens**.
2. Repo **Settings → Secrets and variables → Actions** → **`NPM_TOKEN`**.

Scoped packages need **`npm publish --access public`**; the workflows already pass that. Your npm user must be allowed to publish **`@aiherrera/*`**.

---

## License

MIT © [aiherrera](https://github.com/aiherrera)

---

<p align="center">
  If devsnap saves you time, a ⭐ on <a href="https://github.com/aiherrera/devsnap">GitHub</a> helps others find it.
</p>
