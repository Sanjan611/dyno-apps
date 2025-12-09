#!/usr/bin/env python3
"""
DANGEROUS: Deletes ALL repositories in the GitHub organization.

This script:
  1. Lists all repositories in the organization
  2. Displays them to the user
  3. Requires explicit confirmation before proceeding
  4. Deletes each repository one by one

Usage:
  python scripts/delete_all_repos.py

Environment variables (from .env.local or environment):
  - GITHUB_ORG_NAME
  - GITHUB_PAT

⚠️  WARNING: This operation is IRREVERSIBLE!
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Tuple, List, Dict


GITHUB_API_BASE = "https://api.github.com"


def load_env_from_file(env_path: Path) -> None:
  """
  Minimal .env loader for .env.local
  - Supports KEY=VALUE lines
  - Ignores blank lines and comments
  - Does not override already-set environment variables
  """
  if not env_path.exists():
    print(f"[delete-all-repos] .env file not found at {env_path}, relying on existing environment")
    return

  print(f"[delete-all-repos] Loading environment from {env_path}")

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
    "User-Agent": "dyno-apps-delete-all-repos-script",
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


def list_all_repos(org: str, token: str) -> List[Dict]:
  """
  Lists all repositories in the organization.
  Handles pagination automatically.
  """
  repos = []
  page = 1
  per_page = 100
  
  print(f"[delete-all-repos] Fetching repositories from {org}...")
  
  while True:
    url = f"{GITHUB_API_BASE}/orgs/{org}/repos?page={page}&per_page={per_page}&type=all"
    req = build_request("GET", url, token)
    status, body = call_github(req)
    
    if status != 200:
      raise SystemExit(f"Failed to list repositories: HTTP {status}\n{json.dumps(body, indent=2)}")
    
    if not body or not isinstance(body, list):
      raise SystemExit(f"Unexpected response format: {body}")
    
    if len(body) == 0:
      break
    
    repos.extend(body)
    print(f"  Fetched page {page}: {len(body)} repositories (total: {len(repos)})")
    
    if len(body) < per_page:
      break
    
    page += 1
  
  return repos


def delete_repo(org: str, token: str, repo_name: str) -> Tuple[bool, str]:
  """
  Deletes a repository. Returns (success, message).
  """
  url = f"{GITHUB_API_BASE}/repos/{org}/{repo_name}"
  req = build_request("DELETE", url, token)
  status, body = call_github(req)
  
  if status == 204:
    return True, f"✅ Successfully deleted {repo_name}"
  elif status == 404:
    return True, f"⚠️  {repo_name} not found (already deleted?)"
  else:
    error_msg = json.dumps(body, indent=2) if body else f"HTTP {status}"
    return False, f"❌ Failed to delete {repo_name}: {error_msg}"


def confirm_deletion(repo_count: int, org: str) -> bool:
  """
  Asks for explicit confirmation from the user.
  Returns True if confirmed, False otherwise.
  """
  print("\n" + "=" * 80)
  print("⚠️  DANGER: IRREVERSIBLE OPERATION ⚠️")
  print("=" * 80)
  print(f"You are about to DELETE {repo_count} repository/repositories from '{org}'.")
  print("This operation CANNOT be undone!")
  print("=" * 80)
  print("\nTo confirm, please type exactly: DELETE ALL")
  print("Any other input will cancel the operation.\n")
  
  confirmation = input("Confirmation: ").strip()
  
  if confirmation == "DELETE ALL":
    print("\n✅ Confirmation received. Proceeding with deletion...\n")
    return True
  else:
    print("\n❌ Confirmation not received. Operation cancelled.")
    return False


def main() -> None:
  # Load .env.local from project root (parent of scripts/)
  script_path = Path(__file__).resolve()
  project_root = script_path.parent.parent
  env_path = project_root / ".env.local"
  load_env_from_file(env_path)
  
  org = get_env_var("GITHUB_ORG_NAME")
  token = get_env_var("GITHUB_PAT")
  
  print(f"[delete-all-repos] Target organization: {org}\n")
  
  # List all repositories
  repos = list_all_repos(org, token)
  
  if len(repos) == 0:
    print(f"\n✅ No repositories found in {org}. Nothing to delete.")
    return
  
  # Display repositories
  print(f"\n{'=' * 80}")
  print(f"Found {len(repos)} repository/repositories:")
  print("=" * 80)
  for i, repo in enumerate(repos, 1):
    name = repo.get("name", "unknown")
    private = repo.get("private", False)
    visibility = "private" if private else "public"
    print(f"  {i}. {name} ({visibility})")
  print("=" * 80)
  
  # Require explicit confirmation
  if not confirm_deletion(len(repos), org):
    raise SystemExit(1)
  
  # Delete each repository
  print("\nDeleting repositories...\n")
  success_count = 0
  fail_count = 0
  
  for i, repo in enumerate(repos, 1):
    name = repo.get("name", "unknown")
    print(f"[{i}/{len(repos)}] Deleting {name}...", end=" ")
    
    success, message = delete_repo(org, token, name)
    print(message)
    
    if success:
      success_count += 1
    else:
      fail_count += 1
  
  # Summary
  print("\n" + "=" * 80)
  print("Deletion Summary:")
  print("=" * 80)
  print(f"  Total repositories: {len(repos)}")
  print(f"  Successfully deleted: {success_count}")
  print(f"  Failed: {fail_count}")
  print("=" * 80)


if __name__ == "__main__":
  try:
    main()
  except KeyboardInterrupt:
    print("\n\n⚠️  Operation interrupted by user.")
    raise SystemExit(1)
  except Exception as e:
    print(f"\n❌ Error: {e}")
    raise SystemExit(1)

