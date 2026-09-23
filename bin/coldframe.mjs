#!/usr/bin/env node
// coldframe CLI: start a cloud render from your terminal and get the MP4 back.
// Needs the GitHub CLI (`gh`) signed in. Zero npm dependencies.
//
//   coldframe init                      add the render workflow to this Remotion repo
//   coldframe render <Comp> [options]   render in the cloud, wait, download
//   coldframe runs                      list recent cloud renders
//
// render options:
//   --chunks <n>      parallel machines (default 8)
//   --props <json>    input props
//   --ref <branch>    git ref to render (default: current branch)
//   --out <dir>       where to save the MP4 (default out/cloud)
//   --name <file>     output file name
//   --no-wait         start the render and exit
//   --repo <o/r>      GitHub repo (default: the repo in this folder)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKFLOW = "coldframe.yml";
const here = path.dirname(fileURLToPath(import.meta.url));

const gh = (args, opts = {}) => {
  const r = spawnSync("gh", args, { encoding: "utf8", stdio: opts.inherit ? "inherit" : "pipe", shell: false });
  if (r.error) die("GitHub CLI (gh) not found. Install it from https://cli.github.com and run `gh auth login`.");
  if (r.status !== 0 && !opts.allowFail) die((r.stderr || r.stdout || "").trim() || `gh ${args.join(" ")} failed`);
  return (r.stdout || "").trim();
};
const git = (args) => spawnSync("git", args, { encoding: "utf8" }).stdout?.trim() ?? "";
const die = (msg) => {
  console.error(`coldframe: ${msg}`);
  process.exit(1);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function render(opts) {
  const comp = opts._[1];
  if (!comp) die("usage: coldframe render <CompositionId> [--chunks 8]");
  const repo = opts.repo || gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
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

  let run;
  for (let i = 0; i < 30 && !run; i++) {
    await sleep(2000);
    const runs = JSON.parse(
      gh(["run", "list", "--repo", repo, "--workflow", WORKFLOW, "--event", "workflow_dispatch", "--limit", "5",
        "--json", "databaseId,createdAt,url"]),
    );
    run = runs.find((r) => r.createdAt >= since);
  }
  if (!run) die("render started, but the run did not show up yet. Check `coldframe runs`.");
  console.log(run.url);
  if (opts.wait === false) return;

  const t0 = Date.now();
  gh(["run", "watch", String(run.databaseId), "--repo", repo, "--exit-status", "--interval", "10"], { inherit: true, allowFail: true });
  const info = JSON.parse(gh(["run", "view", String(run.databaseId), "--repo", repo, "--json", "conclusion"]));
  if (info.conclusion !== "success") die(`render ${info.conclusion}. Logs: ${run.url}`);

  const dir = path.resolve(opts.out || "out/cloud");
  fs.mkdirSync(dir, { recursive: true });
  const artifacts = JSON.parse(gh(["api", `repos/${repo}/actions/runs/${run.databaseId}/artifacts`, "--paginate"])).artifacts
    .map((a) => a.name)
    .filter((n) => !n.startsWith("coldframe-"));
  // gh refuses to overwrite, so download next to the target and move files in.
  const tmp = path.join(dir, `.coldframe-${run.databaseId}`);
  const saved = [];
  for (const name of artifacts) {
    gh(["run", "download", String(run.databaseId), "--repo", repo, "-n", name, "-D", tmp]);
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
  const dest = path.resolve(".github/workflows", WORKFLOW);
  if (fs.existsSync(dest)) die(`${path.relative(".", dest)} already exists.`);
  if (!fs.existsSync("package.json")) console.warn("! No package.json here. Run this in your Remotion project root.");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(here, "..", "templates", WORKFLOW), dest);
  console.log(`Added ${path.relative(".", dest)}. Commit and push it, then: coldframe render <CompositionId>`);
}

function runs(opts) {
  const repo = opts.repo || gh(["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  gh(["run", "list", "--repo", repo, "--workflow", WORKFLOW, "--limit", "10"], { inherit: true });
}

const opts = parse(process.argv.slice(2));
const cmd = opts._[0];
if (cmd === "render") await render(opts);
else if (cmd === "init") init();
else if (cmd === "runs") runs(opts);
else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(1, 18).map((l) => l.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(cmd ? 1 : 0);
}
