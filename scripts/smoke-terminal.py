#!/usr/bin/env python3
"""Exercise the built CLI through a real PTY, without network or project writes.

Run after ``bun run build``. Python 3's standard library is sufficient on macOS
and Linux. Optional ``--log-dir /tmp/robot-terminal-qa`` saves raw ANSI output.
Tool version probes use isolated fixtures; a network request or other tool
command is a test failure. The application under test is always node bin/robot.js.
"""

import argparse
import codecs
import errno
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time


ROOT = Path(__file__).resolve().parents[1]
ANSI = re.compile(r"\x1b\][^\x07]*(?:\x07|\x1b\\)|\x1b\[[0-?]*[ -/]*[@-~]")
DOWN = b"\x1b[B"
ENTER = b"\r"
CANCEL = b"\x03"


class Terminal:
    def __init__(self, node, arguments, cwd, env, columns):
        master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 32, columns, 0, 0))
        self.master = master
        self.raw = bytearray()
        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self.decoded = ""
        self.cursor = 0
        self.process = subprocess.Popen(
            [node, str(ROOT / "bin/robot.js"), *arguments],
            cwd=cwd,
            env={**env, "COLUMNS": str(columns), "LINES": "32"},
            stdin=slave,
            stdout=slave,
            stderr=slave,
            start_new_session=True,
        )
        os.close(slave)

    @property
    def text(self):
        return ANSI.sub("", self.decoded).replace("\r", "")

    def read(self, seconds=0.1):
        ready, _, _ = select.select([self.master], [], [], seconds)
        if not ready:
            return False
        try:
            data = os.read(self.master, 65536)
        except OSError as error:
            if error.errno == errno.EIO:
                return False
            raise
        if not data:
            return False
        self.raw.extend(data)
        self.decoded += self.decoder.decode(data)
        return True

    def expect(self, text, timeout=8):
        deadline = time.monotonic() + timeout
        while True:
            index = self.text.find(text, self.cursor)
            if index >= 0:
                self.cursor = index + len(text)
                return
            if self.process.poll() is not None:
                while self.read(0):
                    pass
                index = self.text.find(text, self.cursor)
                if index >= 0:
                    self.cursor = index + len(text)
                    return
                raise AssertionError(f"CLI exited before prompt: {text!r}")
            if time.monotonic() >= deadline:
                raise AssertionError(f"Timed out waiting for prompt: {text!r}")
            self.read()

    def send(self, keys):
        # Let a rendered prompt finish attaching its input listeners.
        time.sleep(0.04)
        os.write(self.master, keys)

    def finish(self, expected=0, timeout=8):
        deadline = time.monotonic() + timeout
        while self.process.poll() is None and time.monotonic() < deadline:
            self.read()
        if self.process.poll() is None:
            raise AssertionError("CLI did not exit after the final interaction")
        while self.read(0):
            pass
        if self.process.returncode != expected:
            raise AssertionError(f"CLI exit code {self.process.returncode}; expected {expected}")

    def close(self):
        if self.process.poll() is None:
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                os.killpg(self.process.pid, signal.SIGKILL)
                self.process.wait(timeout=2)
        os.close(self.master)


def isolated_environment(root):
    tools = root / "tools"
    tools.mkdir()
    marker = root / "unexpected-action"
    # Use an absolute shell interpreter. Only read-only version/name probes are
    # accepted; git clone, package installs and all other invocations fail closed.
    for name, version in {"bun": "1.4.2", "pnpm": "11.8.0", "yarn": "1.22.22", "npm": "11.0.0", "git": "git version 2.50.0"}.items():
        script = tools / name
        script.write_text(
            "#!/bin/sh\n"
            f"if [ \"$1\" = '--version' ]; then printf '%s\\n' '{version}'; exit 0; fi\n"
            "if [ \"$1\" = 'config' ] && [ \"$2\" = 'user.name' ]; then printf '%s\\n' 'Terminal Smoke'; exit 0; fi\n"
            f"printf '%s\\n' '{name}: unexpected command' >> '{marker}'\n"
            "exit 97\n",
            encoding="utf-8",
        )
        script.chmod(0o755)
    guard = root / "network-guard.cjs"
    guard.write_text(
        "const fs = require('node:fs');\n"
        f"const marker = {json.dumps(str(marker))};\n"
        "function blocked() { fs.appendFileSync(marker, 'Unexpected network request\\n'); throw new Error('Network is disabled in terminal smoke'); }\n"
        "globalThis.fetch = async () => blocked();\n"
        "require('node:os').homedir = () => process.env.ROBOT_TERMINAL_HOME;\n"
        "require('node:module').syncBuiltinESMExports();\n"
        "for (const name of ['node:http', 'node:https']) { const mod = require(name); mod.request = blocked; mod.get = blocked; }\n",
        encoding="utf-8",
    )
    work, fixture_home, downloads = (root / name for name in ("work", "home", "downloads"))
    for directory in (work, fixture_home, downloads):
        directory.mkdir()
    env = {
        **os.environ,
        "PATH": f"{tools}{os.pathsep}{os.environ.get('PATH', '')}",
        "ROBOT_TERMINAL_HOME": str(fixture_home),
        "TMPDIR": str(downloads),
        "TMP": str(downloads),
        "TEMP": str(downloads),
        "TERM": "xterm-256color",
        "NODE_OPTIONS": f"--require={guard}",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
        "NO_COLOR": "1",
    }
    env.pop("CI", None)
    env.pop("FORCE_COLOR", None)
    return env, work, (work, fixture_home, downloads), marker


def assert_no_writes(directories, marker):
    for directory in directories:
        if any(directory.iterdir()):
            raise AssertionError(f"Unexpected project/cache/download files: {list(directory.iterdir())}")
    if marker.exists():
        raise AssertionError(marker.read_text(encoding="utf-8"))


def pc_defaults(terminal):
    terminal.expect("你要创建哪类项目？")
    terminal.send(ENTER)
    terminal.expect("项目目录")
    terminal.send(ENTER)  # Blank input must accept the default directory.
    terminal.expect("如何开始这个 PC 项目？")
    terminal.send(ENTER)
    terminal.expect("产品名称")
    terminal.send(ENTER)  # Blank input must accept the default product title.
    terminal.expect("如何完成初始化？")
    terminal.send(DOWN)
    terminal.send(ENTER)  # Select "先生成项目文件" rather than the default.
    terminal.expect("预览完成")
    terminal.finish()
    for expected in ("my-admin-app", "产品名称  my-admin-app", "跳过依赖安装"):
        if expected not in terminal.text:
            raise AssertionError(f"PC default preview is missing {expected!r}")
    if "项目名称不能为空" in terminal.text:
        raise AssertionError("Blank directory input rejected the displayed default")


def h5_narrow(terminal):
    terminal.expect("你要创建哪类项目？")
    terminal.send(DOWN)
    terminal.send(ENTER)
    terminal.expect("项目目录")
    terminal.send(ENTER)
    terminal.expect("产品名称")
    terminal.send(ENTER)
    terminal.expect("如何完成初始化？")
    terminal.send(DOWN)
    terminal.send(ENTER)
    terminal.expect("预览完成")
    terminal.finish()
    for expected in ("my-mobile-app", "H5", "wl-mbase", "pnpm", "跳过依赖安装"):
        if expected not in terminal.text:
            raise AssertionError(f"44-column H5 preview is missing {expected!r}")


def custom_then_cancel(terminal):
    terminal.expect("如何开始这个 PC 项目？")
    terminal.send(DOWN)
    terminal.send(DOWN)
    terminal.send(ENTER)
    terminal.expect("保留哪些内容？")
    terminal.send(b" ")  # Keep the first item, initially unchecked.
    terminal.send(ENTER)
    terminal.expect("产品名称")  # Proves multiselect Enter advanced the wizard.
    terminal.send(CANCEL)
    terminal.finish()
    if "组件演示与预览, 系统管理" not in terminal.text:
        raise AssertionError("Space did not toggle the first optional content group")
    if "已取消创建" not in terminal.text:
        raise AssertionError("Cancellation after multiselect was not acknowledged")


def immediate_cancel(terminal):
    terminal.expect("你要创建哪类项目？")
    terminal.send(CANCEL)
    terminal.finish()
    if "已取消创建" not in terminal.text:
        raise AssertionError("Ctrl+C cancellation was not acknowledged")


def preset_cancel(terminal):
    terminal.expect("如何开始这个 PC 项目？")
    terminal.send(CANCEL)
    terminal.finish()
    if "已取消创建" not in terminal.text:
        raise AssertionError("Preset cancellation was not acknowledged")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log-dir", type=Path, help="Save raw PTY output for visual QA outside the repository")
    options = parser.parse_args()
    if os.name != "posix":
        parser.error("PTY smoke requires macOS or Linux")
    node = shutil.which("node")
    if not node or not (ROOT / "dist/index.js").is_file():
        parser.error("Install Node.js and run bun run build before terminal smoke")
    cases = [
        ("pc-defaults-80", 80, ["create", "--dry-run"], pc_defaults),
        ("h5-preview-44", 44, ["create", "--dry-run"], h5_narrow),
        ("custom-space-enter-cancel", 80, ["create", "custom-preview", "-t", "robot-admin", "--preset", "custom", "--dry-run"], custom_then_cancel),
        ("ctrl-c-no-writes", 80, ["create"], immediate_cancel),
        ("preset-cancel-no-writes", 80, ["create", "cancel-preview", "-t", "robot-admin", "--dry-run"], preset_cancel),
    ]
    if options.log_dir:
        options.log_dir.mkdir(parents=True, exist_ok=True)
    for name, columns, arguments, exercise in cases:
        with tempfile.TemporaryDirectory(prefix="robot-terminal-") as temporary:
            env, work, directories, marker = isolated_environment(Path(temporary))
            terminal = Terminal(node, arguments, work, env, columns)
            try:
                exercise(terminal)
                assert_no_writes(directories, marker)
            except Exception as error:
                print(f"FAIL {name}: {error}", file=sys.stderr)
                print(terminal.text[-5000:], file=sys.stderr)
                return 1
            finally:
                if options.log_dir:
                    (options.log_dir / f"{name}.ansi").write_bytes(terminal.raw)
                terminal.close()
        print(f"PASS {name}")
    print(f"Terminal smoke: {len(cases)} scenarios passed; no network or project writes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
