#!/usr/bin/env node
// coldframe CLI: render Remotion videos on free cloud machines.
// Needs the GitHub CLI (`gh`). Zero npm dependencies.
//
//   coldframe setup [--public|--private] one-time setup in your Remotion project (start here)
//   coldframe render <Comp> [options]   render in the cloud, wait, download the MP4
//   coldframe download [run-id]         download the MP4 of a finished render (default: the latest)
//   coldframe runs                      list recent cloud renders
//   coldframe init                      only add the GitHub workflow file
//
// render options:
//   --chunks <n>      parallel machines (default 8, max 20)
//   --props <json>    input props
//   --ref <branch>    git branch to render (default: current branch)
//   --out <dir>       where to save the MP4 (default out/cloud)
//   --name <file>     output file name
//   --no-wait         start the render and exit (fetch it later with `coldframe download`)
//   --repo <o/r>      GitHub repo (default: the repo in this folder)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const WORKFLOW = "coldframe.yml";
const SELF = fileURLToPath(import.meta.url);
const PKG = path.join(path.dirname(SELF), "..");
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
  }[name] || [];
  return candidates.find((c) => fs.existsSync(c)) || null;
}
const tools = {};
const tool = (name) => (name in tools ? tools[name] : (tools[name] = locate(name)));

const run = (cmd, args, opts = {}) =>
  spawnSync(tool(cmd) || cmd, args, { encoding: "utf8", stdio: opts.inherit ? "inherit" : "pipe", input: opts.input, shell: false });
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

/** --flag value, --flag=value, --no-flag; a flag with no value is `true`. */
function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--no-")) out[a.slice(5)] = false;
    else if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) out[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else if (a === "-h") out.help = true;
    else if (a === "-v") out.version = true;
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

/** The repo to act on: --repo, or this folder's; signs in to GitHub if needed. */
function targetRepo(opts) {
  if (!opts.repo) requireProject();
  const repo = opts.repo || repoOrDie();
  ensureGitHub();
  return repo;
}

/* ---------------- setup ---------------- */

const GITIGNORE = `node_modules/
out/
build/
.env
.DS_Store
`;

async function setup(opts) {
  requireProject();
  console.log("coldframe setup: a few checks, then you're ready to render in the cloud.");

  step(1, "GitHub CLI");
  ensureGitHub();
  ok(`signed in as ${gh(["api", "user", "--jq", ".login"])}`);

  step(2, "Remotion project");
  if (!fs.existsSync("package.json")) die("no package.json here. Run this in your Remotion project folder.");
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps.remotion) console.log("  ! remotion isn't in package.json. Is this the right folder?");
  if (!fs.existsSync("package-lock.json")) die("no package-lock.json. Run `npm install` once, then run this again.");
  ok("package.json and package-lock.json found");

  step(3, "GitHub repository");
  let repo = currentRepo();
  if (!repo) {
    const name = path.basename(process.cwd()).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    console.log(`  This folder isn't on GitHub yet. coldframe needs it there to render.
  Public repos render for free with no limit. Private repos get 2,000 free minutes a month.`);
    const vis = opts.public ? "public" : opts.private ? "private" : await ask(`Create it as "${name}"? [public/private/no]`, "no");
    if (!vis.startsWith("pub") && !vis.startsWith("pri")) {
      die(`stopped: this project isn't on GitHub yet. Run setup again and answer public or private,
  or pass --public / --private (e.g. \`coldframe setup --private\`).`);
    }
    // Only after the user said yes. A subfolder of an existing repo is not re-initialised.
    if (run("git", ["rev-parse", "--is-inside-work-tree"]).status !== 0) {
      run("git", ["init", "-b", "main"]);
      ok("created a git repository");
    }
    // Never upload node_modules or renders: they are huge and the cloud installs its own.
    if (!fs.existsSync(".gitignore")) {
      fs.writeFileSync(".gitignore", GITIGNORE);
      ok("added .gitignore (node_modules, out, build)");
    } else if (fs.existsSync("node_modules") && run("git", ["check-ignore", "-q", "node_modules"]).status !== 0) {
      fs.appendFileSync(".gitignore", "\nnode_modules/\n");
      ok("added node_modules/ to .gitignore");
    }
    run("git", ["add", "-A"]);
    const c = run("git", ["commit", "-qm", "Initial commit"]);
    if (c.status !== 0 && !git(["rev-parse", "--verify", "-q", "HEAD"])) {
      die(`git couldn't make the first commit:\n  ${(c.stderr || c.stdout).trim()}
  If git asks who you are, run:
    git config --global user.name "Your Name"
    git config --global user.email "you@example.com"
  then run setup again.`);
    }
    gh(["repo", "create", name, vis.startsWith("pub") ? "--public" : "--private", "--source", ".", "--push"], { inherit: true });
    repo = currentRepo();
  }
  ok(`repository: ${repo}`);

  step(4, "Cloud render workflow and Claude Code files");
  addFile(path.join("templates", WORKFLOW), path.join(".github", "workflows", WORKFLOW));
  for (const skill of ["coldframe", "video-rules", "motion-direction", "sound-design"]) addFile(path.join(".claude", "skills", skill, "SKILL.md"));
  // Sound-effect library (CC0) + Remotion helpers (<Sfx>, <MusicBed>), used by the sound-design skill.
  for (const f of fs.readdirSync(path.join(PKG, "sfx"))) addFile(path.join("sfx", f), path.join("public", "sfx", f));
  const soundFile = path.join("src", "coldframe-sound.tsx");
  if (fs.existsSync("src")) {
    addFile(path.join("templates", "sound.tsx"), soundFile);
    if (!deps["@remotion/media"]) console.log("  ! the sound helpers need @remotion/media: run `npx remotion add @remotion/media` before using them.");
  }

  step(5, "Push");
  run("git", ["add", ".github", ".claude", path.join("public", "sfx"), ...(fs.existsSync(soundFile) ? [soundFile] : [])]);
  if (run("git", ["diff", "--cached", "--quiet"]).status !== 0) {
    run("git", ["commit", "-qm", "Add coldframe"]);
    const p = run("git", ["push", "-u", "origin", "HEAD"], { inherit: true });
    if (p.status !== 0) die("push failed. Run `git push`, then render.");
    ok("pushed");
  } else ok("nothing new to push");

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

/* ---------------- render ---------------- */

/** The cloud renders what's on GitHub: stop if the branch isn't there, offer to push local commits. */
async function checkPushed(ref) {
  if (run("git", ["rev-parse", "--verify", "-q", `origin/${ref}`]).status !== 0) {
    die(`branch "${ref}" isn't on GitHub yet, so the cloud can't render it. Push it first:
    git push -u origin ${ref}`);
  }
  const ahead = Number(git(["rev-list", "--count", `origin/${ref}..HEAD`])) || 0;
  if (ahead) {
    const yes = process.stdin.isTTY && !(await ask(`${ahead} local commit(s) aren't on GitHub yet. Push them now? [Y/n]`, "y")).startsWith("n");
    if (yes) {
      if (run("git", ["push", "origin", `HEAD:${ref}`], { inherit: true }).status !== 0) die("push failed. Run `git push`, then render again.");
    } else console.warn(`! ${ahead} local commit(s) not pushed; the cloud renders origin/${ref}.`);
  }
  if (git(["status", "--porcelain", "--untracked-files=no"])) console.warn("! Uncommitted changes are not included in the cloud render.");
}

async function render(opts) {
  const comp = opts._[1];
  if (!comp) die("usage: coldframe render <CompositionId> [--chunks 8]");
  const chunks = opts.chunks === undefined ? 8 : Number(opts.chunks);
  if (!Number.isInteger(chunks) || chunks < 1 || chunks > 20) die("--chunks must be a whole number from 1 to 20.");
  if (opts.props !== undefined) {
    try {
      JSON.parse(opts.props);
    } catch {
      die(`--props must be JSON, for example: --props '{"title":"Hello"}'`);
    }
  }
  const repo = targetRepo(opts);

  let ref = typeof opts.ref === "string" ? opts.ref : git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (ref === "HEAD") die("this checkout isn't on a branch. Switch to one, or pass --ref <branch>.");
  ref ||= "main";
  if (!opts.repo && !opts.ref) await checkPushed(ref);

  const fields = ["-f", `composition=${comp}`, "-f", `chunks=${chunks}`];
  if (opts.props) fields.push("-f", `props=${opts.props}`);
  if (opts.name) fields.push("-f", `output-name=${opts.name}`);

  // Remember the runs that already exist, so the new one is found without trusting clocks.
  const listRuns = () =>
    JSON.parse(gh(["run", "list", "--repo", repo, "--workflow", WORKFLOW, "--event", "workflow_dispatch", "--limit", "10", "--json", "databaseId,headBranch,url"]));
  const before = new Set(listRuns().map((r) => r.databaseId));
  const t0 = Date.now();
  gh(["workflow", "run", WORKFLOW, "--repo", repo, "--ref", ref, ...fields]);
  console.log(`Started ${comp} on ${repo}@${ref} across up to ${chunks} machines.`);

  let found;
  for (let i = 0; i < 30 && !found; i++) {
    await sleep(2000);
    found = listRuns().find((r) => !before.has(r.databaseId) && r.headBranch === ref);
  }
  if (!found) die("render started, but the run did not show up yet. Check `coldframe runs`.");
  const id = String(found.databaseId);
  console.log(found.url);
  if (opts.wait === false) return console.log(`When it's done: coldframe download ${id}`);

  // Ctrl+C stops waiting, not the render.
  process.on("SIGINT", () => {});
  gh(["run", "watch", id, "--repo", repo, "--exit-status", "--interval", "10"], { inherit: true, allowFail: true });
  const info = JSON.parse(gh(["run", "view", id, "--repo", repo, "--json", "status,conclusion"]));
  if (info.status !== "completed") {
    console.log(`\nStopped waiting. The render keeps going in the cloud. Get the MP4 later with:
    coldframe download ${id}`);
    process.exit(0);
  }
  if (info.conclusion !== "success") die(`render ${info.conclusion}. See what went wrong with:
    gh run view ${id} --repo ${repo} --log-failed
  or open ${found.url}`);

  const saved = saveRender(repo, id, opts.out);
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`Done in ${mins} min. Saved ${saved.join(", ")}`);
}

/** Download the final MP4(s) of a run into `out` (default out/cloud); returns the saved paths. */
function saveRender(repo, id, out = "out/cloud") {
  const r = run("gh", ["api", `repos/${repo}/actions/runs/${id}/artifacts?per_page=100`, "--jq", ".artifacts[] | select(.expired | not) | .name"]);
  if (r.status !== 0) die(`couldn't find render ${id} in ${repo}. See your renders with \`coldframe runs\`.`);
  const names = r.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    // Skip only the workflow's own temporary artifacts, never a render the user named "coldframe-…".
    .filter((n) => n !== "coldframe-bundle" && !n.startsWith("coldframe-part-"));
  if (!names.length) die(`run ${id} has no MP4 to download: it failed, is still running, or its files expired.`);
  const dir = path.resolve(out);
  fs.mkdirSync(dir, { recursive: true });
  // gh refuses to overwrite, so download next to the target and move files in.
  const tmp = path.join(dir, `.coldframe-${id}`);
  fs.rmSync(tmp, { recursive: true, force: true }); // left over from an interrupted download
  const saved = [];
  for (const name of names) {
    gh(["run", "download", id, "--repo", repo, "-n", name, "-D", tmp]);
    for (const f of fs.readdirSync(tmp)) {
      fs.renameSync(path.join(tmp, f), path.join(dir, f));
      saved.push(path.relative(".", path.join(dir, f)));
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return saved;
}

function download(opts) {
  const repo = targetRepo(opts);
  const id =
    opts._[1] ||
    gh(["run", "list", "--repo", repo, "--workflow", WORKFLOW, "--status", "success", "--limit", "1", "--json", "databaseId", "--jq", ".[0].databaseId"]) ||
    die("no finished renders yet. Start one with `coldframe render <CompositionId>`.");
  console.log(`Saved ${saveRender(repo, String(id), opts.out).join(", ")}`);
}

function init() {
  if (!fs.existsSync("package.json")) console.warn("! No package.json here. Run this in your Remotion project root.");
  addFile(path.join("templates", WORKFLOW), path.join(".github", "workflows", WORKFLOW));
  console.log("Commit and push it, then: coldframe render <CompositionId>");
}

function runs(opts) {
  gh(["run", "list", "--repo", targetRepo(opts), "--workflow", WORKFLOW, "--limit", "10"], { inherit: true });
}

function help() {
  const lines = fs.readFileSync(SELF, "utf8").split(/\r?\n/).slice(1);
  console.log(lines.slice(0, lines.findIndex((l) => !l.startsWith("//"))).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
}

const opts = parse(process.argv.slice(2));
const cmd = opts._[0];
for (const k of ["chunks", "props", "ref", "out", "name", "repo"]) if (opts[k] === true) die(`--${k} needs a value.`);
if (opts.version) console.log(JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8")).version);
else if (opts.help || cmd === "help") help();
else if (cmd === "setup") await setup(opts);
else if (cmd === "render") await render(opts);
else if (cmd === "download") download(opts);
else if (cmd === "init") init();
else if (cmd === "runs") runs(opts);
else {
  if (cmd) console.error(`coldframe: unknown command "${cmd}"\n`);
  help();
  process.exit(cmd ? 1 : 0);
}
