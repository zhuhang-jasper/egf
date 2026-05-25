#!/usr/bin/env python3
"""Build release-notes.md for GitHub Releases (see main_push_create-tag-release workflow)."""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from typing import Any

MARKER_DEFAULT = "changelog:"
BOT_LOGINS = frozenset({"dependabot[bot]", "github-actions[bot]"})

MENTION_RE = re.compile(r"^\s*@([A-Za-z0-9-]+)\s*-\s*(.+)$")
MERGE_PR_RE = re.compile(r"Merge pull request #(\d+)")
# hotfix/sprint-*: always omitted at top (transport merge to master), like release/sprint-*.
HOTFIX_SPRINT_BRANCH_SKIP_RE = re.compile(r"^hotfix/sprint-", re.I)
LOG_PREFIX = "[build-release-changelog]"


def run_gh_json(args: list[str]) -> Any:
    env = {**os.environ, "GH_TOKEN": os.environ.get("GITHUB_TOKEN", "")}
    out = subprocess.check_output(["gh", *args], text=True, env=env)
    return json.loads(out) if out.strip() else None


def run_gh_text(args: list[str]) -> str:
    env = {**os.environ, "GH_TOKEN": os.environ.get("GITHUB_TOKEN", "")}
    return subprocess.check_output(["gh", *args], text=True, env=env)


def is_bot(login: str) -> bool:
    if not login:
        return True
    if login in BOT_LOGINS:
        return True
    if login.endswith("[bot]"):
        return True
    return False


def prefix_from_head(head: str) -> str:
    seg = (head or "").split("/")[0].lower()
    if seg in ("feature", "bugfix", "refix", "next"):
        return "feat"
    if seg in ("hotfix", "chore", "release"):
        return seg
    return seg or "feat"


def marker_regex(marker: str) -> re.Pattern[str]:
    esc = re.escape(marker.strip())
    return re.compile(rf"^\s*{esc}\s*", re.I)


def first_body_line(body: str | None) -> str | None:
    if not body:
        return None
    for ln in body.splitlines():
        t = ln.strip()
        if t:
            return t
    return None


LIST_MARKER_PREFIX = re.compile(r"^[-*+]\s+")


def strip_leading_list_marker(line: str) -> str:
    """Strip a single leading GFM-style bullet (-, *, +) so PR/comment bodies can use markdown lists."""
    t = line.strip()
    return LIST_MARKER_PREFIX.sub("", t, count=1).strip()


def strip_line_changelog_marker(text: str, marker_re: re.Pattern[str]) -> str:
    """Remove optional ``changelog:`` prefix from the start of one line (after trim)."""
    t = text.strip()
    m = marker_re.match(t)
    if m:
        return t[m.end() :].strip()
    return t


def segment_lines_for_cl(block: str | None, marker_re: re.Pattern[str]) -> list[str]:
    """Split block into changelog lines: strip GFM list markers, then optional per-line ``changelog:``."""
    if not block or not block.strip():
        return []
    out: list[str] = []
    for ln in block.splitlines():
        t = strip_leading_list_marker(ln)
        t = strip_line_changelog_marker(t, marker_re)
        if t:
            out.append(t)
    return out


def pr_body_changelog_segments(body: str | None, marker_re: re.Pattern[str]) -> list[str]:
    """PR description lines as changelog entries.

    Optional leading ``changelog:`` on the whole body (same as issue comments); not required.
    Each line may also start with ``changelog:`` (e.g. two entries in one description).
    """
    if not body or not body.strip():
        return []
    text = body.strip()
    m = marker_re.match(text)
    if m:
        text = text[m.end() :].strip()
    return segment_lines_for_cl(text, marker_re)


def issue_comments(repo: str, pr_number: int) -> list[dict[str, Any]]:
    owner, name = repo.split("/", 1)
    raw = run_gh_text(
        [
            "api",
            f"/repos/{owner}/{name}/issues/{pr_number}/comments",
            "--paginate",
        ]
    )
    s = raw.strip()
    try:
        data = json.loads(s)
        if isinstance(data, list):
            return data
        return []
    except json.JSONDecodeError:
        out: list[dict[str, Any]] = []
        dec = json.JSONDecoder()
        idx = 0
        while idx < len(s):
            while idx < len(s) and s[idx].isspace():
                idx += 1
            if idx >= len(s):
                break
            try:
                obj, end = dec.raw_decode(s, idx)
            except json.JSONDecodeError:
                break
            idx = end
            if isinstance(obj, list):
                out.extend(obj)
        return out


def pick_changelog_payload(
    comments: list[dict[str, Any]], marker_re: re.Pattern[str]
) -> list[tuple[str, str | None]]:
    """All issue comments whose body starts with the marker (oldest first).

    Supports: one multiline comment after ``changelog:``, and/or multiple separate
    ``changelog: ...`` comments (each line uses that comment's author when no @handle).
    """
    rows = sorted(comments, key=lambda c: c.get("created_at") or "")
    out: list[tuple[str, str | None]] = []
    for c in rows:
        login = ((c.get("user") or {}).get("login")) or ""
        if is_bot(login):
            continue
        body = (c.get("body") or "").strip()
        if not body:
            continue
        m = marker_re.match(body)
        if not m:
            continue
        rest = body[m.end() :].strip()
        for seg in segment_lines_for_cl(rest, marker_re):
            out.append((seg, login or None))
    return out


def parse_handle_and_desc(
    payload: str,
    source: str,
    comment_author: str | None,
    pr_author: str | None,
    placeholder: str,
) -> tuple[str, str]:
    """Resolve ``(handle, desc)`` for one changelog segment.

    Attribution priority (same segment text):

    - **Explicit mention** — line matches ``@login - …`` (``MENTION_RE``): handle from
      the mention; ``desc`` is everything after the first `` - `` (may include a
      duplicate type token if the author wrote e.g. ``chore:`` there; the release
      line still adds ``{branch_prefix}:`` from ``headRefName``).
    - **Comment-sourced** — else if ``source == "comment"``: ``comment_author`` if
      set, otherwise **PR author** as fallback, else ``placeholder``.
    - **Body-sourced** — else if ``source == "body"`` and ``pr_author``: PR author.
    - Otherwise ``placeholder``.
    """
    m = MENTION_RE.match(payload.strip())
    if m:
        handle = "@" + m.group(1).lower()
        desc = m.group(2).strip()
        return handle, desc
    if source == "comment" and comment_author:
        return "@" + comment_author.lower(), payload.strip()
    if source == "comment" and pr_author:
        return "@" + pr_author.lower(), payload.strip()
    if source == "body" and pr_author:
        return "@" + pr_author.lower(), payload.strip()
    return placeholder, payload.strip()


def merge_pr_numbers(
    prev_tag: str,
) -> tuple[list[int], str, int, list[str], int]:
    """Return unique PR numbers, rev range, log char sum, merge titles (one per PR match), commit count."""
    head = (os.environ.get("CHANGELOG_HEAD_REF") or "HEAD").strip() or "HEAD"
    if prev_tag:
        r = f"{prev_tag}..{head}"
    else:
        root = (
            subprocess.check_output(
                ["git", "rev-list", "--max-parents=0", head],
                text=True,
            )
            .strip()
            .splitlines()[-1]
        )
        r = f"{root}..{head}"
    commit_count = int(
        subprocess.check_output(
            ["git", "rev-list", "--count", r],
            text=True,
        ).strip()
    )
    # One record per commit (null-separated); first non-empty line is the commit title / subject.
    blob = subprocess.check_output(
        ["git", "log", r, "--reverse", "-z", "--pretty=format:%B"],
        text=True,
    )
    commits = [c for c in blob.split("\0") if c.strip()]
    log_chars = sum(len(c) for c in commits)
    raw_hits: list[str] = []
    seen: set[int] = set()
    ordered: list[int] = []
    for msg in commits:
        title = first_body_line(msg)
        if not title or not MERGE_PR_RE.search(msg):
            continue
        for m in MERGE_PR_RE.finditer(msg):
            raw_hits.append(title)
            n = int(m.group(1))
            if n not in seen:
                seen.add(n)
                ordered.append(n)
    return ordered, r, log_chars, raw_hits, commit_count


def line_for_pr(
    repo: str,
    pr_number: int,
    source_mode: str,
    marker_re: re.Pattern[str],
    placeholder: str,
) -> tuple[list[str], str | None]:
    """Return (changelog lines without leading '* '), skip_reason if PR produces no lines."""
    pr = run_gh_json(
        ["pr", "view", str(pr_number), "--repo", repo, "--json", "headRefName,author,body"]
    )
    if not pr:
        return [], "gh_pr_view_empty"
    head = pr.get("headRefName") or ""
    if re.match(r"^release/sprint-", head, re.I):
        return [], f"sprint_branch_skipped:{head}"
    if HOTFIX_SPRINT_BRANCH_SKIP_RE.match(head):
        return [], f"hotfix_sprint_branch_skipped:{head}"

    pfx = prefix_from_head(head)
    pr_author = ((pr.get("author") or {}).get("login")) or ""

    comment_entries: list[tuple[str, str | None]] = []
    if source_mode != "branch":
        comments = issue_comments(repo, pr_number)
        comment_entries = pick_changelog_payload(comments, marker_re)

    if comment_entries:
        out: list[str] = []
        for payload, comment_author in comment_entries:
            handle, desc = parse_handle_and_desc(
                payload, "comment", comment_author, pr_author, placeholder
            )
            out.append(f"{handle} - {pfx}: {desc}")
        return out, None

    body_segments: list[str] = []
    if source_mode != "branch":
        body_segments = pr_body_changelog_segments(pr.get("body"), marker_re)

    if body_segments:
        out = []
        for payload in body_segments:
            handle, desc = parse_handle_and_desc(
                payload, "body", None, pr_author, placeholder
            )
            out.append(f"{handle} - {pfx}: {desc}")
        return out, None

    # No changelog in PR body or issue comments — omit for any head (no placeholder line).
    return [], f"no_changelog_skipped:{head}"


def main() -> int:
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip()
    new_tag = os.environ.get("NEW_TAG", "").strip()
    prev_tag = os.environ.get("PREV_TAG", "").strip()
    out_path = os.environ.get("RELEASE_NOTES_PATH", "release-notes.md").strip()

    if not repo or not new_tag:
        print("GITHUB_REPOSITORY and NEW_TAG are required", file=sys.stderr)
        return 1

    placeholder = os.environ.get("CONTRIBUTOR_PLACEHOLDER", "@contributor").strip()
    if not placeholder.startswith("@"):
        placeholder = "@" + placeholder

    source_mode = os.environ.get("CHANGELOG_DESCRIPTION_SOURCE", "auto").strip().lower()
    if source_mode not in ("auto", "branch"):
        source_mode = "auto"

    marker = os.environ.get("CHANGELOG_COMMENT_MARKER", MARKER_DEFAULT)
    marker_re = marker_regex(marker)

    head_ref = (os.environ.get("CHANGELOG_HEAD_REF") or "").strip() or "HEAD"
    prs, git_log_range, _, raw_merge_hits, commit_count = merge_pr_numbers(prev_tag)
    print(f"{LOG_PREFIX} PREV_TAG: {prev_tag or '<empty>'}", file=sys.stderr)
    print(f"{LOG_PREFIX} NEW_TAG: {new_tag}", file=sys.stderr)
    print(
        f"{LOG_PREFIX} CHANGELOG_HEAD_REF: {head_ref} git_log_range: {git_log_range}",
        file=sys.stderr,
    )
    for hit in raw_merge_hits:
        print(f"{LOG_PREFIX} merge_hit: {hit}", file=sys.stderr)
    print(
        f"{LOG_PREFIX} summary: total {commit_count} commits across {len(prs)} PRs",
        file=sys.stderr,
    )

    lines: list[str] = []
    for n in prs:
        try:
            pr_lines, skip = line_for_pr(repo, n, source_mode, marker_re, placeholder)
            for ln in pr_lines:
                lines.append(f"* {ln}")
            if not pr_lines and skip:
                print(f"{LOG_PREFIX} skipped_pr: #{n} reason={skip}", file=sys.stderr)
        except subprocess.CalledProcessError as e:
            print(f"::warning::PR #{n}: {e}", file=sys.stderr)

    for ln in lines:
        print(f"{LOG_PREFIX} changelog_line: {ln}", file=sys.stderr)

    parts = ["## What's Changed", ""]
    parts.extend(lines)
    parts.append("")

    if prev_tag:
        parts.append(
            f"**Full Changelog**: https://github.com/{repo}/compare/{prev_tag}...{new_tag}"
        )
    else:
        parts.append(
            f"**Full Changelog**: https://github.com/{repo}/releases/tag/{new_tag}"
        )

    body = "\n".join(parts) + "\n"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(body)
    print(f"Wrote {out_path} ({len(lines)} changelog bullets)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
