#!/usr/bin/env node
// coldframe CLI: render Remotion videos on free cloud machines.
// Needs the GitHub CLI (`gh`). Zero npm dependencies.
//
//   coldframe setup                     one-time setup in your Remotion project (start here)
//   coldframe render <Comp> [options]   render in the cloud, wait, download the MP4
//   coldframe drive                     also save every render to Google Drive
//   coldframe runs                      list recent cloud renders
//   coldframe init                      only add the GitHub workflow file
//
// render options:
//   --chunks <n>      parallel machines (default 8, max 20)
//   --props <json>    input props
//   --ref <branch>    git ref to render (default: current branch)
//   --out <dir>       where to save the MP4 (default out/cloud)
//   --name <file>     output file name
//   --no-wait         start the render and exit
//   --repo <o/r>      GitHub repo (default: the repo in this folder)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const WORKFLOW = "coldframe.yml";
const PKG = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";

/**
 * Find a tool even when this terminal's PATH is stale (a terminal opened before
 * `winget install` doesn't see the new PATH). Falls back to the usual install folders.
 */
function locate(name) {
  if (!spawnSync(name, ["--version"], { stdio: "ignore" }).error) return name;
  if (!isWin) return null;
  const local = process.env.LOCALAPPDATA || "";
  const candidates = {
    gh: [path.join(process.env.ProgramFiles || "C:\\Program Files", "GitHub CLI", "gh.exe"), path.join(local, "Programs", "GitHub CLI", "gh.exe")],
    rclone: [path.join(local, "Microsoft", "WinGet", "Links", "rclone.exe")],
  }[name] || [];
  // winget unpacks rclone to Packages\Rclone.Rclone_*\rclone-vX-windows-amd64\rclone.exe
  const pkgs = path.join(local, "Microsoft", "WinGet", "Packages");
  if (name === "rclone" && fs.existsSync(pkgs)) {
    for (const d of fs.readdirSync(pkgs).filter((d) => d.startsWith("Rclone.Rclone"))) {
      for (const sub of fs.readdirSync(path.join(pkgs, d))) candidates.push(path.join(pkgs, d, sub, "rclone.exe"));
    }
  }
  return candidates.find((c) => fs.existsSync(c)) || null;
}
const tools = {};
const tool = (name) => (name in tools ? tools[name] : (tools[name] = locate(name)));

const run = (cmd, args, opts = {}) =>
  spawnSync(tool(cmd) || cmd, args, { encoding: "utf8", stdio: opts.inherit ? "inherit" : "pipe", input: opts.input, shell: false });
const has = (cmd) => Boolean(tool(cmd));
const gh = (args, opts = {}) => {
  const r = run("gh", args, opts);
  if (r.error) die(`the GitHub CLI (gh) isn't installed. Install it with:
    ${isWin ? "winget install GitHub.cli" : process.platform === "darwin" ? "brew install gh" : "see https://cli.github.com"}
  then open a NEW terminal and run this again.`);
  if (r.status !== 0 && !opts.allowFail) die((r.stderr || r.stdout || "").trim() || `gh ${args.join(" ")} failed`);
  return (r.stdout || "").trim();
};
const git = (args) => run("git", args).stdout?.trim() ?? "";
const die = (msg) => {
  console.error(`\ncoldframe: ${msg}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (msg) => console.log(`  ✓ ${msg}`);
const step = (n, msg) => console.log(`\n${n}. ${msg}`);

async function ask(question, fallback = "n") {
  if (!process.stdin.isTTY) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question(`  ${question} `)).trim().toLowerCase();
  rl.close();
  return a || fallback;
}

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--no-")) out[a.slice(5)] = false;
    else if (a.startsWith("--")) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}

/** owner/name of this folder's GitHub repo, read from git (no GitHub sign-in needed). */
function currentRepo() {
  const url = git(["remote", "get-url", "origin"]);
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : "";
}

/** Make sure gh is installed and signed in; if not, walk the user through signing in. */
function ensureGitHub() {
  gh(["--version"]); // explains how to install it if it's missing
  if (run("gh", ["auth", "status"]).status === 0) return;
  console.log(`
  First, sign in to GitHub (one time on this computer):
  a code appears below; press Enter, then paste the code in the browser page that opens.
`);
  run("gh", ["auth", "login", "--web", "--git-protocol", "https", "--scopes", "workflow"], { inherit: true });
  if (run("gh", ["auth", "status"]).status !== 0) die("GitHub sign-in didn't finish. Run the command again.");
  console.log("");
}

/** Stop early, with a clear hint, when run outside a project (e.g. in C:\Windows\System32). */
function requireProject() {
  if (fs.existsSync("package.json") || git(["rev-parse", "--show-toplevel"])) return;
  const example = isWin ? 'cd "$HOME\\Desktop\\my-video"' : "cd ~/my-video";
  die(`run this inside your video project folder (the one with package.json).
  This terminal is in: ${process.cwd()}
  Go to your project first, for example:
    ${example}
  then run the command again.`);
}
const repoOrDie = () =>
  currentRepo() ||
  die(`this folder isn't connected to a GitHub repo (git has no "origin" pointing at github.com).
  Run \`npx github:Razee4315/coldframe setup\` first.`);

/* ---------------- setup ---------------- */

async function setup() {
  requireProject();
  console.log("coldframe setup: a few checks, then you're ready to render in the cloud.");

  step(1, "GitHub CLI");
  ensureGitHub();
  ok(`signed in as ${gh(["api", "user", "--jq", ".login"])}`);

  step(2, "Remotion project");
  if (!fs.existsSync("package.json")) die("no package.json here. Run this in your Remotion project folder.");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (!{ ...pkg.dependencies, ...pkg.devDependencies }.remotion) console.log("  ! remotion isn't in package.json. Is this the right folder?");
  if (!fs.existsSync("package-lock.json")) die("no package-lock.json. Run `npm install` once, then run this again.");
  ok("package.json and package-lock.json found");

  step(3, "GitHub repository");
  if (!fs.existsSync(".git")) {
    run("git", ["init", "-b", "main"]);
    ok("created a git repository");
  }
  let repo = currentRepo();
  if (!repo) {
    const name = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    console.log(`  This folder isn't on GitHub yet. coldframe needs it there to render.
  Public repos render for free with no limit. Private repos get 2,000 free minutes a month.`);
    const vis = await ask(`Create it as "${name}"? [public/private/no]`, "no");
    if (!vis.startsWith("pub") && !vis.startsWith("pri")) die("stopped. Push this project to GitHub, then run setup again.");
    run("git", ["add", "-A"]);
    run("git", ["commit", "-qm", "Initial commit"]);
    gh(["repo", "create", name, vis.startsWith("pub") ? "--public" : "--private", "--source", ".", "--push"], { inherit: true });
    repo = currentRepo();
  }
  ok(`repository: ${repo}`);

  step(4, "Cloud render workflow and Claude Code files");
  addFile(path.join("templates", WORKFLOW), path.join(".github", "workflows", WORKFLOW));
  addFile(path.join(".claude", "skills", "coldframe", "SKILL.md"));
  addFile(path.join(".claude", "skills", "video-rules", "SKILL.md"));
  addFile(".mcp.json");

  step(5, "Google Drive (optional)");
  if ((await ask("Also save every render to your Google Drive? [y/N]", "n")).startsWith("y")) await drive({ repo });
  else console.log("  Skipped. Run `coldframe drive` any time to add it.");

  step(6, "Push");
  run("git", ["add", ".github", ".claude", ".mcp.json"]);
  if (run("git", ["diff", "--cached", "--quiet"]).status !== 0) {
    run("git", ["commit", "-qm", "Add coldframe"]);
    const p = run("git", ["push"], { inherit: true });
    if (p.status !== 0) die("push failed. Run `git push`, then render.");
  }
  ok("pushed");

  console.log(`\nDone. Render a composition in the cloud with:
    npx github:Razee4315/coldframe render <CompositionId>
`);
}

/** Copy a file from the coldframe package into this project, unless it already exists. */
function addFile(from, to = from) {
  if (fs.existsSync(to)) return ok(`${to} (already there)`);
  fs.mkdirSync(path.dirname(to) || ".", { recursive: true });
  fs.copyFileSync(path.join(PKG, from), to);
  ok(`added ${to}`);
}

/* ---------------- drive ---------------- */

async function drive(opts = {}) {
  if (!opts.repo) requireProject();
  const repo = opts.repo || repoOrDie();
  ensureGitHub();
  if (!has("rclone")) {
    console.log(`  Google Drive uploads use rclone. Install it, open a new terminal, and run \`coldframe drive\`:
    ${isWin ? "winget install Rclone.Rclone" : process.platform === "darwin" ? "brew install rclone" : "see https://rclone.org/install/"}`);
    return;
  }
  const remote = "gdrive";
  const remotes = run("rclone", ["listremotes"]).stdout || "";
  if (!remotes.split(/\r?\n/).includes(`${remote}:`)) {
    console.log("  A Google sign-in page opens in your browser. Pick your account and click Allow.");
    console.log("  (coldframe only asks for access to files it creates itself, not your whole Drive.)");
    const r = run("rclone", ["config", "create", remote, "drive", "scope=drive.file"], { inherit: true });
    if (r.status !== 0) die("Google sign-in didn't finish. Run `coldframe drive` again.");
  }
  // Store only the gdrive section, never other rclone remotes you may have.
  const file = (run("rclone", ["config", "file"]).stdout || "").trim().split(/\r?\n/).pop();
  const conf = fs.readFileSync(file, "utf8");
  const section = conf.match(new RegExp(`\\[${remote}\\][\\s\\S]*?(?=\\n\\[|$)`))?.[0];
  if (!section) die(`couldn't find the ${remote} remote in ${file}.`);
  gh(["secret", "set", "RCLONE_CONF", "--repo", repo], { input: section.trim() + "\n" });
  ok(`Drive connected. Renders from ${repo} will also appear in My Drive/coldframe/`);
}

/* ---------------- render ---------------- */

async function render(opts) {
  const comp = opts._[1];
  if (!comp) die("usage: coldframe render <CompositionId> [--chunks 8]");
  if (!opts.repo) requireProject();
  const repo = opts.repo || repoOrDie();
  ensureGitHub();
  const ref = opts.ref || git(["rev-parse", "--abbrev-ref", "HEAD"]) || "main";

  const unpushed = git(["log", "--oneline", `origin/${ref}..HEAD`]);
  if (unpushed) console.warn(`! ${unpushed.split("\n").length} local commit(s) not pushed; the cloud renders origin/${ref}.`);
  if (git(["status", "--porcelain"])) console.warn("! Uncommitted changes are not included in the cloud render.");

  const fields = ["-f", `composition=${comp}`, "-f", `chunks=${opts.chunks ?? 8}`];
  if (opts.props) fields.push("-f", `props=${opts.props}`);
  if (opts.name) fields.push("-f", `output-name=${opts.name}`);

  const since = new Date(Date.now() - 5000).toISOString();
  gh(["workflow", "run", WORKFLOW, "--repo", repo, "--ref", ref, ...fields]);
  console.log(`Started ${comp} on ${repo}@${ref} across ${opts.chunks ?? 8} machines.`);

  let found;
  for (let i = 0; i < 30 && !found; i++) {
    await sleep(2000);
    const runs = JSON.parse(
      gh(["run", "list", "--repo", repo, "--workflow", WORKFLOW, "--event", "workflow_dispatch", "--limit", "5",
        "--json", "databaseId,createdAt,url"]),
    );
    found = runs.find((r) => r.createdAt >= since);
  }
  if (!found) die("render started, but the run did not show up yet. Check `coldframe runs`.");
  console.log(found.url);
  if (opts.wait === false) return;

  const t0 = Date.now();
  gh(["run", "watch", String(found.databaseId), "--repo", repo, "--exit-status", "--interval", "10"], { inherit: true, allowFail: true });
  const info = JSON.parse(gh(["run", "view", String(found.databaseId), "--repo", repo, "--json", "conclusion"]));
  if (info.conclusion !== "success") die(`render ${info.conclusion}. Logs: ${found.url}`);

  const dir = path.resolve(opts.out || "out/cloud");
  fs.mkdirSync(dir, { recursive: true });
  const artifacts = JSON.parse(gh(["api", `repos/${repo}/actions/runs/${found.databaseId}/artifacts`, "--paginate"])).artifacts
    .map((a) => a.name)
    .filter((n) => !n.startsWith("coldframe-"));
  // gh refuses to overwrite, so download next to the target and move files in.
  const tmp = path.join(dir, `.coldframe-${found.databaseId}`);
  const saved = [];
  for (const name of artifacts) {
    gh(["run", "download", String(found.databaseId), "--repo", repo, "-n", name, "-D", tmp]);
    for (const f of fs.readdirSync(tmp)) {
      fs.renameSync(path.join(tmp, f), path.join(dir, f));
      saved.push(path.join(dir, f));
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`Done in ${mins} min. Saved ${saved.map((f) => path.relative(".", f)).join(", ")}`);
}

function init() {
  if (!fs.existsSync("package.json")) console.warn("! No package.json here. Run this in your Remotion project root.");
  addFile(path.join("templates", WORKFLOW), path.join(".github", "workflows", WORKFLOW));
  console.log("Commit and push it, then: coldframe render <CompositionId>");
}

function runs(opts) {
  if (!opts.repo) requireProject();
  const repo = opts.repo || repoOrDie();
  ensureGitHub();
  gh(["run", "list", "--repo", repo, "--workflow", WORKFLOW, "--limit", "10"], { inherit: true });
}

const opts = parse(process.argv.slice(2));
const cmd = opts._[0];
if (cmd === "setup") await setup();
else if (cmd === "render") await render(opts);
else if (cmd === "drive") await drive(opts);
else if (cmd === "init") init();
else if (cmd === "runs") runs(opts);
else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 19).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(cmd ? 1 : 0);
}
