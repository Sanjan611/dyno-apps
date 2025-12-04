#!/usr/bin/env python3
"""
Simple helper script to test GitHub org repo creation/deletion
using the same env vars as the Next.js app:

  - GITHUB_ORG_NAME
  - GITHUB_PAT

Usage:
  python scripts/github_repo_test.py create <repo-name>
  python scripts/github_repo_test.py delete <repo-name>

Example:
  python scripts/github_repo_test.py create dyno-apps-test-123
  python scripts/github_repo_test.py delete dyno-apps-test-123
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Tuple


GITHUB_API_BASE = "https://api.github.com"


def load_env_from_file(env_path: Path) -> None:
  """
  Minimal .env loader for .env.local
  - Supports KEY=VALUE lines
  - Ignores blank lines and comments
  - Does not override already-set environment variables
  """
  if not env_path.exists():
    print(f"[github-test] .env file not found at {env_path}, relying on existing environment")
    return

  print(f"[github-test] Loading environment from {env_path}")

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


def build_request(
  method: str, url: str, token: str, body: dict | None = None
) -> urllib.request.Request:
  headers = {
    "Authorization": f"Bearer {token}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "dyno-apps-github-test-script",
  }
  data = None
  if body is not None:
    data = json.dumps(body).encode("utf-8")
    headers["Content-Type"] = "application/json"

  req = urllib.request.Request(url, data=data, headers=headers, method=method)
  return req


def call_github(req: urllib.request.Request) -> Tuple[int, dict | None]:
  try:
    with urllib.request.urlopen(req) as resp:
      status = resp.getcode()
      raw = resp.read().decode("utf-8") or ""
  except urllib.error.HTTPError as e:
    status = e.code
    raw = e.read().decode("utf-8") if e.fp else ""

  body: dict | None = None
  if raw:
    try:
      body = json.loads(raw)
    except json.JSONDecodeError:
      body = {"raw": raw}
  return status, body


def create_repo(org: str, token: str, repo_name: str) -> None:
  url = f"{GITHUB_API_BASE}/orgs/{org}/repos"
  print(f"[github-test] Creating repo {org}/{repo_name} via {url}")

  req = build_request(
    "POST",
    url,
    token,
    body={
      "name": repo_name,
      "private": True,
    },
  )

  status, body = call_github(req)

  print(f"[github-test] Status: {status}")
  print(f"[github-test] Response body: {json.dumps(body, indent=2)}")

  if 200 <= status < 300:
    print(f"[github-test] ✅ Successfully created {org}/{repo_name}")
  else:
    print(f"[github-test] ❌ Failed to create {org}/{repo_name}")


def delete_repo(org: str, token: str, repo_name: str) -> None:
  url = f"{GITHUB_API_BASE}/repos/{org}/{repo_name}"
  print(f"[github-test] Deleting repo {org}/{repo_name} via {url}")

  req = build_request("DELETE", url, token)
  status, body = call_github(req)

  print(f"[github-test] Status: {status}")
  if body:
    print(f"[github-test] Response body: {json.dumps(body, indent=2)}")

  if status == 204:
    print(f"[github-test] ✅ Successfully deleted {org}/{repo_name}")
  elif status == 404:
    print(f"[github-test] ⚠️ Repo {org}/{repo_name} not found (already deleted?)")
  else:
    print(f"[github-test] ❌ Failed to delete {org}/{repo_name}")


def main(argv: list[str]) -> None:
  if len(argv) != 3 or argv[1] not in {"create", "delete"}:
    print("Usage: python scripts/github_repo_test.py [create|delete] <repo-name>")
    raise SystemExit(1)

  action = argv[1]
  repo_name = argv[2]

  # Load .env.local from project root (parent of scripts/)
  script_path = Path(__file__).resolve()
  project_root = script_path.parent.parent
  env_path = project_root / ".env.local"
  load_env_from_file(env_path)

  org = get_env_var("GITHUB_ORG_NAME")
  token = get_env_var("GITHUB_PAT")

  if action == "create":
    create_repo(org, token, repo_name)
  else:
    delete_repo(org, token, repo_name)


if __name__ == "__main__":
  main(sys.argv)


