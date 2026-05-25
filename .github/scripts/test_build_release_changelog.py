#!/usr/bin/env python3
"""Unit tests for build-release-changelog.py (run: python3 .github/scripts/test_build_release_changelog.py)."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

# GitHub logins (display as @login in release notes)
JASPER = "jasper-loo-zus"
SARAH = "sarah-sidek-zus"
QIHAN = "qihan-chan-zus"


def _load_script():
    path = Path(__file__).resolve().parent / "build-release-changelog.py"
    spec = importlib.util.spec_from_file_location("build_release_changelog", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = _load_script()


def _normalize_placeholder(placeholder: str) -> str:
    p = placeholder.strip()
    if not p.startswith("@"):
        p = "@" + p
    return p


def format_release_bullets_body(
    body: str | None,
    head: str,
    pr_author: str,
    marker_re,
    placeholder: str = "@contributor",
) -> str:
    """Same bullet lines as ``line_for_pr`` when the PR description is the source (joined with newlines)."""
    placeholder = _normalize_placeholder(placeholder)
    segs = mod.pr_body_changelog_segments(body, marker_re)
    pfx = mod.prefix_from_head(head)
    lines: list[str] = []
    for payload in segs:
        handle, desc = mod.parse_handle_and_desc(
            payload, "body", None, pr_author, placeholder
        )
        lines.append(f"* {handle} - {pfx}: {desc}")
    return "\n".join(lines)


def format_release_bullets_comment(
    comment_entries: list[tuple[str, str | None]],
    head: str,
    pr_author: str,
    placeholder: str = "@contributor",
) -> str:
    """Same bullet lines as ``line_for_pr`` when issue comments are the source (joined with newlines)."""
    placeholder = _normalize_placeholder(placeholder)
    pfx = mod.prefix_from_head(head)
    lines: list[str] = []
    for payload, comment_author in comment_entries:
        handle, desc = mod.parse_handle_and_desc(
            payload, "comment", comment_author, pr_author, placeholder
        )
        lines.append(f"* {handle} - {pfx}: {desc}")
    return "\n".join(lines)


def changelog_comment_joined_from_block(
    lines_after_marker: str,
    *,
    comment_login: str = SARAH,
    pr_login: str = JASPER,
    head: str = "chore/cicd",
    marker_re=None,
) -> str:
    """Simulate one Sarah-style comment: body starts with ``changelog:`` then markdown lines."""
    mr = marker_re or mod.marker_regex(mod.MARKER_DEFAULT)
    full = f"changelog:\n{lines_after_marker}"
    comments = [
        {
            "created_at": "2024-01-01T12:00:00Z",
            "user": {"login": comment_login},
            "body": full,
        }
    ]
    entries = mod.pick_changelog_payload(comments, mr)
    return format_release_bullets_comment(entries, head, pr_login)


# Sarah comment + ``*`` list + ``@handle - …`` in text: branch prefix ``chore`` is still
# prepended, so a line that already contains ``chore:`` in the mention tail becomes
# ``… - chore: chore: …`` (documented; avoid duplicating type in the mention tail).
SARAH_STAR_BOTH_MENTION_WITH_TYPE_IN_TAIL = (
    f"* @{QIHAN} - chore: chore: Added CD workflow\n"
    f"* @{JASPER} - chore: chore: Fixed YAML formatting for the repo"
)
SARAH_STAR_FIRST_MENTION_SECOND_BARE_TYPE = (
    f"* @{QIHAN} - chore: chore: Added CD workflow\n"
    f"* @{SARAH} - chore: chore: Fixed YAML formatting for the repo"
)
SARAH_STAR_FIRST_MENTION_SHORT_SECOND_BARE_TYPE = (
    f"* @{QIHAN} - chore: Added CD workflow\n"
    f"* @{SARAH} - chore: chore: Fixed YAML formatting for the repo"
)


# Full joined output for two-segment chore PR / comment (see TestFullJoinedReleaseOutput)
FULL_TWO_SEGMENT_CHORE_JASPER = (
    f"* @{JASPER} - chore: Added CD workflow\n"
    f"* @{JASPER} - chore: Fixed YAML formatting for the repo"
)


class TestFullJoinedReleaseOutput(unittest.TestCase):
    """Joined release bullets (``* …`` per line) for multi-line PR body vs multi-line comment."""

    def setUp(self) -> None:
        self.marker_re = mod.marker_regex(mod.MARKER_DEFAULT)
        self.head = "chore/cicd"

    def test_pr_body_multiline_markdown_list_full_joined(self) -> None:
        body = """- Added CD workflow
- Fixed YAML formatting for the repo"""
        got = format_release_bullets_body(
            body, self.head, JASPER, self.marker_re
        )
        self.assertEqual(got, FULL_TWO_SEGMENT_CHORE_JASPER)

    def test_comment_multiline_after_marker_full_joined(self) -> None:
        comments = [
            {
                "created_at": "2024-01-01T12:00:00Z",
                "user": {"login": JASPER},
                "body": "changelog:\n- Added CD workflow\n- Fixed YAML formatting for the repo",
            }
        ]
        entries = mod.pick_changelog_payload(comments, self.marker_re)
        got = format_release_bullets_comment(entries, self.head, JASPER)
        self.assertEqual(got, FULL_TWO_SEGMENT_CHORE_JASPER)

    def test_comment_multiline_pr_author_differs_uses_comment_author(self) -> None:
        """PR opened by Sarah; changelog comment by Jasper → handles are @jasper-loo-zus (not Sarah)."""
        comments = [
            {
                "created_at": "2024-01-01T12:00:00Z",
                "user": {"login": JASPER},
                "body": "changelog:\n- Added CD workflow\n- Fixed YAML formatting for the repo",
            }
        ]
        entries = mod.pick_changelog_payload(comments, self.marker_re)
        got = format_release_bullets_comment(entries, self.head, SARAH)
        self.assertEqual(got, FULL_TWO_SEGMENT_CHORE_JASPER)

    def test_pr_body_uses_pr_author_not_comment(self) -> None:
        """Body-sourced lines always attribute to PR author (no separate comment author)."""
        body = "- Line one\n- Line two"
        got = format_release_bullets_body(body, self.head, SARAH, self.marker_re)
        want = (
            f"* @{SARAH} - chore: Line one\n"
            f"* @{SARAH} - chore: Line two"
        )
        self.assertEqual(got, want)


class TestPrAuthorVsCommentAuthor(unittest.TestCase):
    """``parse_handle_and_desc`` when PR author and comment author disagree."""

    def test_comment_plain_line_uses_comment_author(self) -> None:
        h, d = mod.parse_handle_and_desc(
            "Shipped the fix", "comment", JASPER, SARAH, "@contributor"
        )
        self.assertEqual(h, f"@{JASPER}")
        self.assertEqual(d, "Shipped the fix")

    def test_comment_mention_overrides_pr_and_comment_author(self) -> None:
        h, d = mod.parse_handle_and_desc(
            f"@{QIHAN} - QA sign-off and notes",
            "comment",
            JASPER,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{QIHAN}")
        self.assertEqual(d, "QA sign-off and notes")

    def test_body_ignores_comment_author_param(self) -> None:
        h, d = mod.parse_handle_and_desc(
            "From the description only",
            "body",
            JASPER,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{SARAH}")
        self.assertEqual(d, "From the description only")

    def test_comment_falls_back_to_pr_author_when_comment_author_missing(self) -> None:
        h, d = mod.parse_handle_and_desc(
            "Release notes from bot-less payload",
            "comment",
            None,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{SARAH}")
        self.assertEqual(d, "Release notes from bot-less payload")

    def test_comment_placeholder_when_no_authors(self) -> None:
        h, d = mod.parse_handle_and_desc(
            "Orphan line",
            "comment",
            None,
            None,
            "@contributor",
        )
        self.assertEqual(h, "@contributor")
        self.assertEqual(d, "Orphan line")

    def test_body_explicit_mention_beats_pr_author(self) -> None:
        h, d = mod.parse_handle_and_desc(
            f"@{QIHAN} - Wrote the copy in the template",
            "body",
            JASPER,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{QIHAN}")
        self.assertEqual(d, "Wrote the copy in the template")


class TestAttributionPriority(unittest.TestCase):
    """Documented order: explicit ``@login - …`` > comment author > PR author (comment path); same for body without comment author."""

    def test_priority_mention_over_comment_over_pr_on_comment_source(self) -> None:
        h, _ = mod.parse_handle_and_desc(
            f"@{QIHAN} - credited line",
            "comment",
            JASPER,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{QIHAN}")

    def test_priority_comment_author_over_pr_on_comment_source(self) -> None:
        h, _ = mod.parse_handle_and_desc(
            "Plain credited line",
            "comment",
            JASPER,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{JASPER}")

    def test_priority_pr_author_when_comment_author_missing(self) -> None:
        h, _ = mod.parse_handle_and_desc(
            "Plain line",
            "comment",
            None,
            SARAH,
            "@contributor",
        )
        self.assertEqual(h, f"@{SARAH}")


class TestSarahStyleStarListMentionComments(unittest.TestCase):
    """Sarah posts ``changelog:`` + markdown ``*`` lines; PR by Jasper (``head`` = ``chore/cicd``)."""

    def test_star_list_both_lines_explicit_mention_with_type_in_tail(self) -> None:
        block = f"""* @{QIHAN} - chore: Added CD workflow
* @{JASPER} - chore: Fixed YAML formatting for the repo"""
        got = changelog_comment_joined_from_block(block)
        self.assertEqual(got, SARAH_STAR_BOTH_MENTION_WITH_TYPE_IN_TAIL)

    def test_star_list_first_mention_second_line_type_only_uses_sarah(self) -> None:
        block = f"""* @{QIHAN} - chore: Added CD workflow
* chore: Fixed YAML formatting for the repo"""
        got = changelog_comment_joined_from_block(block)
        self.assertEqual(got, SARAH_STAR_FIRST_MENTION_SECOND_BARE_TYPE)

    def test_star_list_first_mention_short_second_type_only_uses_sarah(self) -> None:
        block = f"""* @{QIHAN} - Added CD workflow
* chore: Fixed YAML formatting for the repo"""
        got = changelog_comment_joined_from_block(block)
        self.assertEqual(got, SARAH_STAR_FIRST_MENTION_SHORT_SECOND_BARE_TYPE)


class TestPrBodyStarListExplicitMentions(unittest.TestCase):
    """PR description (no ``changelog:``) with the same ``* @user - …`` lines as Sarah's first comment."""

    def setUp(self) -> None:
        self.marker_re = mod.marker_regex(mod.MARKER_DEFAULT)
        self.head = "chore/cicd"
        self.body = f"""* @{QIHAN} - chore: Added CD workflow
* @{JASPER} - chore: Fixed YAML formatting for the repo"""

    def test_pr_body_resolves_star_list_mentions_like_comment(self) -> None:
        got = format_release_bullets_body(
            self.body, self.head, JASPER, self.marker_re
        )
        self.assertEqual(got, SARAH_STAR_BOTH_MENTION_WITH_TYPE_IN_TAIL)


class TestWritingStyles(unittest.TestCase):
    """PR body / comment text shapes from release changelog docs."""

    def setUp(self) -> None:
        self.marker_re = mod.marker_regex(mod.MARKER_DEFAULT)
        self.want = [
            "Added CD workflow",
            "Fixed YAML formatting for the repo",
        ]

    def test_1_pr_body_markdown_list(self) -> None:
        body = """- Added CD workflow
- Fixed YAML formatting for the repo"""
        self.assertEqual(mod.pr_body_changelog_segments(body, self.marker_re), self.want)

    def test_2_pr_body_plain_lines(self) -> None:
        body = """Added CD workflow
Fixed YAML formatting for the repo"""
        self.assertEqual(mod.pr_body_changelog_segments(body, self.marker_re), self.want)

    def test_3_pr_body_changelog_then_list(self) -> None:
        body = """changelog:
- Added CD workflow
- Fixed YAML formatting for the repo"""
        self.assertEqual(mod.pr_body_changelog_segments(body, self.marker_re), self.want)

    def test_4_pr_body_changelog_space_then_plain(self) -> None:
        body = """changelog: 
Added CD workflow
Fixed YAML formatting for the repo"""
        self.assertEqual(mod.pr_body_changelog_segments(body, self.marker_re), self.want)

    def test_5_pr_body_repeated_changelog_prefix_per_line(self) -> None:
        body = """changelog: Added CD workflow
changelog: Fixed YAML formatting for the repo"""
        self.assertEqual(mod.pr_body_changelog_segments(body, self.marker_re), self.want)

    def test_comment_multiline_after_marker_with_bullets(self) -> None:
        comments = [
            {
                "created_at": "2024-01-01T12:00:00Z",
                "user": {"login": JASPER},
                "body": "changelog:\n- Added CD workflow\n- Fixed YAML formatting for the repo",
            }
        ]
        got = mod.pick_changelog_payload(comments, self.marker_re)
        self.assertEqual([t for t, _ in got], self.want)
        self.assertEqual([a for _, a in got], [JASPER, JASPER])

    def test_comment_changelog_blank_line_then_plain(self) -> None:
        comments = [
            {
                "created_at": "2024-01-01T12:00:00Z",
                "user": {"login": JASPER},
                "body": "changelog: \nAdded CD workflow\nFixed YAML formatting for the repo",
            }
        ]
        got = mod.pick_changelog_payload(comments, self.marker_re)
        self.assertEqual([t for t, _ in got], self.want)
        self.assertEqual([a for _, a in got], [JASPER, JASPER])

    def test_comment_two_separate_changelog_comments(self) -> None:
        comments = [
            {
                "created_at": "2024-01-01T12:00:00Z",
                "user": {"login": JASPER},
                "body": "changelog: Added CD workflow",
            },
            {
                "created_at": "2024-01-02T12:00:00Z",
                "user": {"login": SARAH},
                "body": "changelog: Fixed YAML formatting for the repo",
            },
        ]
        got = mod.pick_changelog_payload(comments, self.marker_re)
        self.assertEqual([t for t, _ in got], self.want)
        self.assertEqual([a for _, a in got], [JASPER, SARAH])

    def test_bots_skipped_in_comments(self) -> None:
        comments = [
            {
                "created_at": "2024-01-01T12:00:00Z",
                "user": {"login": "dependabot[bot]"},
                "body": "changelog: Bot noise",
            },
            {
                "created_at": "2024-01-02T12:00:00Z",
                "user": {"login": QIHAN},
                "body": "changelog: Added CD workflow",
            },
        ]
        got = mod.pick_changelog_payload(comments, self.marker_re)
        self.assertEqual(got, [("Added CD workflow", QIHAN)])


class TestPrefixFromHead(unittest.TestCase):
    """Branch headRefName first segment maps to release-note type prefix."""

    def test_feature_branch_maps_to_feat(self) -> None:
        self.assertEqual(mod.prefix_from_head("feature/payment-widget"), "feat")
        self.assertEqual(mod.prefix_from_head("Feature/UPPER"), "feat")

    def test_hotfix_branch_maps_to_hotfix(self) -> None:
        self.assertEqual(mod.prefix_from_head("hotfix/critical-login"), "hotfix")
        self.assertEqual(mod.prefix_from_head("Hotfix/Case"), "hotfix")

    def test_chore_branch_maps_to_chore(self) -> None:
        self.assertEqual(mod.prefix_from_head("chore/cicd"), "chore")
        self.assertEqual(mod.prefix_from_head("chore/deps-bump"), "chore")


class TestHotfixSprintBranchAlwaysSkipped(unittest.TestCase):
    """hotfix/sprint-* is skipped before comments/body (same tier as release/sprint-*)."""

    def test_hotfix_sprint_branch_skip_regex(self) -> None:
        r = mod.HOTFIX_SPRINT_BRANCH_SKIP_RE
        self.assertTrue(r.match("hotfix/sprint-26.5"))
        self.assertTrue(r.match("Hotfix/sprint-1"))
        self.assertFalse(r.match("hotfix/critical-fix"))
        self.assertFalse(r.match("release/sprint-26"))


class TestChangelogLineFormatByBranch(unittest.TestCase):
    """Full ``@user - {prefix}: desc`` shape matches branch + PR author (no gh)."""

    def _line(self, head: str, segment: str, pr_author: str) -> str:
        pfx = mod.prefix_from_head(head)
        handle, desc = mod.parse_handle_and_desc(
            segment, "body", None, pr_author, "@contributor"
        )
        return f"{handle} - {pfx}: {desc}"

    def test_feature_branch_line(self) -> None:
        self.assertEqual(
            self._line("feature/banners", "Added hero carousel", JASPER),
            f"@{JASPER} - feat: Added hero carousel",
        )

    def test_hotfix_branch_line(self) -> None:
        self.assertEqual(
            self._line("hotfix/session-timeout", "Restore cookie expiry", SARAH),
            f"@{SARAH} - hotfix: Restore cookie expiry",
        )

    def test_chore_branch_line(self) -> None:
        self.assertEqual(
            self._line("chore/cicd", "Tidy workflow YAML", QIHAN),
            f"@{QIHAN} - chore: Tidy workflow YAML",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
