#!/usr/bin/env node
import { main } from "../dist/index.js";

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nRobot CLI 执行失败: ${message}\n`);
  process.exitCode = 1;
});
