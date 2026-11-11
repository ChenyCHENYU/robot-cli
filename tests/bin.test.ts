import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

describe("runtime bootstrap", () => {
  it.each(["18.20.0", "20.11.1", "21.7.0"])("explains unsupported Node %s before importing terminal dependencies", (version) => {
    const entry = new URL("../bin/robot.js", import.meta.url);
    const script = `Object.defineProperty(process.versions, 'node', { value: ${JSON.stringify(version)} }); await import(${JSON.stringify(entry.href)});`;
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Robot CLI 需要 Node.js");
    expect(result.stderr).toContain(version);
    expect(result.stderr).not.toContain("SyntaxError");
  });
});
