#!/usr/bin/env node
const [major, minor] = process.versions.node.split(".").map(Number);
if (!(major >= 22 || (major === 20 && minor >= 12))) {
  console.error(`Robot CLI 需要 Node.js 20.12+（20.x）或 22+，当前为 ${process.versions.node}。建议切换到 Node.js 24。`);
  process.exitCode = 1;
} else {
  try {
    const { main } = await import("../dist/index.js");
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nRobot CLI 执行失败: ${message}\n`);
    process.exitCode = 1;
  }
}
