import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function containsLocalPath(text: string): boolean {
  return (
    /\b[A-Za-z]:(?:[\\/]|%2f|%5c)/i.test(text) ||
    /\/(?:Users|home)\/[^\r\n/"'<>]+(?:\/|$)/.test(text) ||
    /\/root\/[^\s"'<>]+/.test(text) ||
    /\bfile:\/\//i.test(text) ||
    /(?:^|[\s"'])\\\\[^\s\\]+\\[^\s\\]+/.test(text)
  );
}

export function isAbsoluteLink(target: string): boolean {
  return path.win32.isAbsolute(target) || path.posix.isAbsolute(target);
}

function git(root: string, args: string[]): Buffer {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: 32 * 1024 * 1024 });
}

interface PathProblem {
  file: string;
  line: number;
}

export function checkLocalPaths({
  root,
  staged = false,
}: {
  root: string;
  staged?: boolean;
}): PathProblem[] {
  const files = git(root, ["ls-files", "--cached", ...(!staged ? ["--others", "--exclude-standard"] : []), "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const problems: PathProblem[] = [];

  for (const file of new Set(files)) {
    let content: Buffer;
    if (staged) {
      const entry = git(root, ["ls-files", "--stage", "--", file]).toString("utf8");
      content = git(root, ["show", `:${file}`]);
      if (entry.startsWith("120000 ") && isAbsoluteLink(content.toString("utf8"))) {
        problems.push({ file, line: 1 });
        continue;
      }
    } else {
      const absolute = path.join(root, file);
      let stat;
      try {
        stat = lstatSync(absolute);
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
        throw error;
      }
      if (stat.isSymbolicLink()) {
        if (isAbsoluteLink(readlinkSync(absolute))) problems.push({ file, line: 1 });
        continue;
      }
      if (!stat.isFile()) continue;
      content = readFileSync(absolute);
    }

    // バイナリはテキスト検査から除外し、検出した値自体はログに出さない。
    if (content.includes(0)) continue;
    for (const [index, line] of content.toString("utf8").split(/\r?\n/).entries()) {
      if (containsLocalPath(line)) problems.push({ file, line: index + 1 });
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(import.meta.dirname, "..");
  const problems = checkLocalPaths({ root, staged: process.argv.includes("--staged") });
  for (const problem of problems) {
    console.error(`${problem.file}:${problem.line}: ローカルの絶対パスを検出しました。`);
  }
  console.log(problems.length ? `${problems.length} 件の混入を検出しました。` : "ローカルの絶対パスは検出されませんでした。");
  process.exitCode = problems.length ? 1 : 0;
}
