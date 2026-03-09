"""Step / Flow execution engine — replaces Invoke-Step, Invoke-Flow, Start-LoggedProcess."""

from __future__ import annotations

import os
import re
import subprocess
import time
from collections import OrderedDict
from typing import Any

from devops.core.logger import add_signature, log, show_tail
from devops.core.state import get_state

# ── helpers ──────────────────────────────────────────────────


def _scan_signatures(line: str) -> None:
    """Detect known patterns in process output."""
    if re.search(r"Ignored build scripts", line):
        add_signature("pnpm:ignored-build-scripts")
    if re.search(r"Components directory not found", line):
        add_signature("nuxt:components-directory-not-found")
    if re.search(r"DATABASE_URL", line):
        add_signature("env:database-url-mentioned")
    if re.search(r"address already in use|EADDRINUSE", line):
        add_signature("port:in-use")


# ── Confirm-StepAction equivalent ───────────────────────────


def confirm_step(
    label: str,
    command: str,
    cwd: str,
    reason: str,
    expected: str,
) -> dict[str, Any]:
    """Prompt the user to Run / Skip / Edit / Abort a step."""
    state = get_state()

    print()
    print(f"\033[96m==[{label}]==\033[0m")
    print(f"Command: {command}")
    print(f"Working directory: {cwd}")
    print(f"Reason: {reason}")
    print(f"Expected: {expected}")

    if state.auto_approve:
        log("AutoApprove enabled. Running step automatically.", label=label)
        return {"action": "run", "command": command}

    while True:
        choice = input("[R]un  [S]kip  [E]dit  [A]bort: ").strip().lower()
        if choice == "r":
            return {"action": "run", "command": command}
        if choice == "s":
            return {"action": "skip", "command": command}
        if choice == "a":
            return {"action": "abort", "command": command}
        if choice == "e":
            edited = input("Enter edited command: ").strip()
            if edited:
                return {"action": "run", "command": edited, "edited": True, "original": command}
        else:
            print("\033[93mPlease choose R, S, E, or A.\033[0m")


# ── Start-LoggedProcess equivalent ──────────────────────────


def run_logged(label: str, command: str, cwd: str) -> dict[str, Any]:
    """Execute *command* via the system shell, stream output, return result dict."""
    start = time.time()
    first_error: str | None = None
    exit_code = 0

    try:
        proc = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        assert proc.stdout is not None
        for raw_line in proc.stdout:
            line = raw_line.rstrip("\n\r")
            if not line:
                continue
            _scan_signatures(line)
            log(line, label=label)
        proc.wait()
        exit_code = proc.returncode or 0
    except Exception as exc:
        exit_code = 1
        first_error = str(exc)
        log(str(exc), level="ERROR", label=label)

    duration = round(time.time() - start, 2)
    return {
        "exitCode": exit_code,
        "durationSeconds": duration,
        "firstErrorLine": first_error,
    }


# ── Invoke-Step equivalent ──────────────────────────────────


def invoke_step(
    *,
    index: int,
    total: int,
    flow_label: str,
    name: str,
    command: str,
    cwd: str,
    reason: str,
    expected: str,
    required: bool = True,
    skip_in_auto_approve: bool = False,
) -> dict[str, Any]:
    """Execute one step with confirmation, logging, retry-on-failure."""
    state = get_state()
    step_label = f"STEP {index}/{total}][{flow_label}"

    print()
    print(f"\033[96m==[STEP {index}/{total}][{flow_label}] {name} ({command}) @ {cwd}==\033[0m")

    # Auto-skip interactive steps in AutoApprove
    if state.auto_approve and skip_in_auto_approve:
        log(f"AutoApprove: skipping interactive step '{name}'.", level="WARN", label=step_label)
        state.step_results.append(OrderedDict(
            label=step_label, name=name, command=command, cwd=cwd,
            status="skipped", durationSeconds=0, exitCode=None,
            note="Skipped interactive step in AutoApprove mode",
        ))
        return {"ok": True, "skipped": True, "autoSkippedInteractive": True}

    decision = confirm_step(step_label, command, cwd, reason, expected)
    actual_cmd = decision["command"]

    # ABORT
    if decision["action"] == "abort":
        state.step_results.append(OrderedDict(
            label=step_label, name=name, command=command, cwd=cwd,
            status="aborted", durationSeconds=0, exitCode=None,
        ))
        raise SystemExit(f"User aborted at {name}")

    # SKIP
    if decision["action"] == "skip":
        log("Skipped by user.", level="WARN", label=step_label)
        state.step_results.append(OrderedDict(
            label=step_label, name=name, command=command, cwd=cwd,
            status="skipped", durationSeconds=0, exitCode=None,
        ))
        if required:
            log("Required step skipped.", level="WARN", label=step_label)
        return {"ok": not required, "skipped": True}

    # Log edited command
    if decision.get("edited"):
        log("Command edited by user.", level="WARN", label=step_label)
        log(f"Original: {decision['original']}", level="WARN", label=step_label)
        log(f"Edited:   {actual_cmd}", level="WARN", label=step_label)

    # RUN
    result = run_logged(step_label, actual_cmd, cwd)

    status = "passed" if result["exitCode"] == 0 else "failed"
    icon = "✅" if status == "passed" else "❌"
    lvl = "SUCCESS" if status == "passed" else "ERROR"
    log(f"{icon} {name} finished with exit code {result['exitCode']}", level=lvl, label=step_label)

    state.step_results.append(OrderedDict(
        label=step_label, name=name, command=actual_cmd, cwd=cwd,
        status=status, durationSeconds=result["durationSeconds"],
        exitCode=result["exitCode"], firstErrorLine=result["firstErrorLine"],
    ))

    # FAILURE HANDLING
    if status == "failed":
        print()
        print("\033[91m❌ FAILURE SUMMARY\033[0m")
        print(f"Step: {name}")
        print(f"Command: {actual_cmd}")
        print(f"Exit code: {result['exitCode']}")
        if result["firstErrorLine"]:
            print(f"First error: {result['firstErrorLine']}")
        show_tail(200)

        while True:
            if state.auto_approve:
                if required:
                    return {"ok": False, "failed": True, "action": "abort"}
                log("Optional step failed under AutoApprove; continuing.", level="WARN", label=step_label)
                return {"ok": True, "failed": True, "action": "skip-optional"}

            choice = input("[R]etry step  [E]dit command  [S]kip  [A]bort: ").strip().lower()
            if choice == "r":
                return invoke_step(
                    index=index, total=total, flow_label=flow_label,
                    name=name, command=command, cwd=cwd,
                    reason=reason, expected=expected, required=required,
                )
            if choice == "e":
                new_cmd = input("New command: ").strip()
                if new_cmd:
                    return invoke_step(
                        index=index, total=total, flow_label=flow_label,
                        name=name, command=new_cmd, cwd=cwd,
                        reason=reason, expected=expected, required=required,
                    )
            elif choice == "s":
                return {"ok": not required, "skipped": True, "failed": True, "action": "skip"}
            elif choice == "a":
                return {"ok": False, "failed": True, "action": "abort"}
            else:
                print("\033[93mPlease choose R, E, S, or A.\033[0m")

    return {"ok": True, "skipped": False}


# ── Invoke-Flow equivalent ──────────────────────────────────

StepDef = dict[str, Any]


def invoke_flow(flow_label: str, steps: list[StepDef]) -> None:
    """Run a sequence of steps. Raises on unrecoverable failure."""
    for i, step in enumerate(steps, 1):
        result = invoke_step(
            index=i,
            total=len(steps),
            flow_label=flow_label,
            name=step["name"],
            command=step["command"],
            cwd=step["cwd"],
            reason=step["reason"],
            expected=step["expected"],
            required=step.get("required", True),
            skip_in_auto_approve=step.get("skipInAutoApprove", False),
        )
        if not result["ok"]:
            raise RuntimeError(f"Flow {flow_label} stopped at step {step['name']}.")

    log(f"✅ Flow completed successfully.", level="SUCCESS", label=flow_label)
