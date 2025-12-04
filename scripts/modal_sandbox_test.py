#!/usr/bin/env python3
"""
Simple helper script to test Modal sandbox creation with a bare node:20-slim image.
This allows manually testing the startup.sh script which installs Bun, Expo CLI, etc.

Uses the same env vars as the Next.js app:
  - MODAL_TOKEN_ID
  - MODAL_TOKEN_SECRET

Usage:
  python scripts/modal_sandbox_test.py create              # Create sandbox and print ID
  python scripts/modal_sandbox_test.py shell <sandbox-id>  # Shell into existing sandbox
  python scripts/modal_sandbox_test.py delete <sandbox-id> # Terminate sandbox

Example:
  python scripts/modal_sandbox_test.py create
  python scripts/modal_sandbox_test.py shell sb-xxx-yyy
  python scripts/modal_sandbox_test.py delete sb-xxx-yyy

Note: Requires the 'modal' Python package: pip install modal
"""

import os
import sys
import subprocess
from pathlib import Path


def load_env_from_file(env_path: Path) -> None:
    """
    Minimal .env loader for .env.local
    - Supports KEY=VALUE lines
    - Ignores blank lines and comments
    - Does not override already-set environment variables
    """
    if not env_path.exists():
        print(f"[modal-test] .env file not found at {env_path}, relying on existing environment")
        return

    print(f"[modal-test] Loading environment from {env_path}")

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        # Don't override variables already present in the environment
        if key and key not in os.environ:
            os.environ[key] = value


def get_env_var(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Environment variable {name} is not set")
    return value


def create_sandbox() -> None:
    """Create a new sandbox with a bare node:20-slim image"""
    try:
        import modal
    except ImportError:
        raise SystemExit("Error: 'modal' package not installed. Run: pip install modal")

    # Set Modal credentials as environment variables (Modal SDK reads these automatically)
    token_id = get_env_var("MODAL_TOKEN_ID")
    token_secret = get_env_var("MODAL_TOKEN_SECRET")
    os.environ["MODAL_TOKEN_ID"] = token_id
    os.environ["MODAL_TOKEN_SECRET"] = token_secret

    print("[modal-test] Using base image: node:20-slim")
    image = modal.Image.from_registry("node:20-slim")

    print("[modal-test] Creating sandbox...")
    app = modal.App.lookup("dyno-apps", create_if_missing=True)
    
    sandbox = modal.Sandbox.create(
        app=app,
        image=image,
        unencrypted_ports=[19006],
    )

    sandbox_id = sandbox.object_id
    print(f"[modal-test] ✅ Sandbox created successfully!")
    print(f"[modal-test] Sandbox ID: {sandbox_id}")
    print()
    print("To shell into this sandbox, run:")
    print(f"  python scripts/modal_sandbox_test.py shell {sandbox_id}")
    print()
    print("To terminate this sandbox, run:")
    print(f"  python scripts/modal_sandbox_test.py delete {sandbox_id}")


def shell_into_sandbox(sandbox_id: str) -> None:
    """Shell into an existing sandbox using the Python SDK"""
    try:
        import modal
    except ImportError:
        raise SystemExit("Error: 'modal' package not installed. Run: pip install modal")

    # Set Modal credentials as environment variables
    token_id = get_env_var("MODAL_TOKEN_ID")
    token_secret = get_env_var("MODAL_TOKEN_SECRET")
    os.environ["MODAL_TOKEN_ID"] = token_id
    os.environ["MODAL_TOKEN_SECRET"] = token_secret
    
    print(f"[modal-test] Connecting to sandbox {sandbox_id}...")
    
    try:
        sandbox = modal.Sandbox.from_id(sandbox_id)
        # Start interactive bash session with pty
        process = sandbox.exec("bash", pty=True)
        process.attach()
    except Exception as e:
        raise SystemExit(f"Error: Failed to shell into sandbox: {e}")


def delete_sandbox(sandbox_id: str) -> None:
    """Terminate an existing sandbox"""
    try:
        import modal
    except ImportError:
        raise SystemExit("Error: 'modal' package not installed. Run: pip install modal")

    # Set Modal credentials as environment variables
    token_id = get_env_var("MODAL_TOKEN_ID")
    token_secret = get_env_var("MODAL_TOKEN_SECRET")
    os.environ["MODAL_TOKEN_ID"] = token_id
    os.environ["MODAL_TOKEN_SECRET"] = token_secret

    print(f"[modal-test] Terminating sandbox {sandbox_id}...")

    try:
        sandbox = modal.Sandbox.from_id(sandbox_id)
        sandbox.terminate()
        print(f"[modal-test] ✅ Sandbox {sandbox_id} terminated successfully!")
    except Exception as e:
        if "not found" in str(e).lower():
            print(f"[modal-test] ⚠️ Sandbox {sandbox_id} not found (already terminated?)")
        else:
            print(f"[modal-test] ❌ Failed to terminate sandbox: {e}")


def exec_in_sandbox(sandbox_id: str, command: list[str]) -> None:
    """Execute a command in an existing sandbox"""
    try:
        import modal
    except ImportError:
        raise SystemExit("Error: 'modal' package not installed. Run: pip install modal")

    # Set Modal credentials as environment variables
    token_id = get_env_var("MODAL_TOKEN_ID")
    token_secret = get_env_var("MODAL_TOKEN_SECRET")
    os.environ["MODAL_TOKEN_ID"] = token_id
    os.environ["MODAL_TOKEN_SECRET"] = token_secret

    print(f"[modal-test] Executing command in sandbox {sandbox_id}: {' '.join(command)}")

    try:
        sandbox = modal.Sandbox.from_id(sandbox_id)
        process = sandbox.exec(*command)
        
        # Stream output
        for line in process.stdout:
            print(line, end="")
        for line in process.stderr:
            print(line, end="", file=sys.stderr)
        
        exit_code = process.wait()
        print(f"\n[modal-test] Command exited with code: {exit_code}")
    except Exception as e:
        print(f"[modal-test] ❌ Failed to execute command: {e}")


def print_usage() -> None:
    print("Usage:")
    print("  python scripts/modal_sandbox_test.py create              # Create sandbox")
    print("  python scripts/modal_sandbox_test.py shell <sandbox-id>  # Shell into sandbox")
    print("  python scripts/modal_sandbox_test.py exec <sandbox-id> <command...>  # Run command")
    print("  python scripts/modal_sandbox_test.py delete <sandbox-id> # Terminate sandbox")
    print()
    print("Examples:")
    print("  python scripts/modal_sandbox_test.py create")
    print("  python scripts/modal_sandbox_test.py shell sb-xxx-yyy")
    print("  python scripts/modal_sandbox_test.py exec sb-xxx-yyy bun --version")
    print("  python scripts/modal_sandbox_test.py delete sb-xxx-yyy")


def main(argv: list[str]) -> None:
    if len(argv) < 2:
        print_usage()
        raise SystemExit(1)

    action = argv[1]

    # Load .env.local from project root (parent of scripts/)
    script_path = Path(__file__).resolve()
    project_root = script_path.parent.parent
    env_path = project_root / ".env.local"
    load_env_from_file(env_path)

    if action == "create":
        create_sandbox()
    elif action == "shell":
        if len(argv) < 3:
            print("Error: sandbox-id required for 'shell' command")
            print_usage()
            raise SystemExit(1)
        shell_into_sandbox(argv[2])
    elif action == "exec":
        if len(argv) < 4:
            print("Error: sandbox-id and command required for 'exec' command")
            print_usage()
            raise SystemExit(1)
        exec_in_sandbox(argv[2], argv[3:])
    elif action == "delete":
        if len(argv) < 3:
            print("Error: sandbox-id required for 'delete' command")
            print_usage()
            raise SystemExit(1)
        delete_sandbox(argv[2])
    else:
        print(f"Error: Unknown action '{action}'")
        print_usage()
        raise SystemExit(1)


if __name__ == "__main__":
    main(sys.argv)

