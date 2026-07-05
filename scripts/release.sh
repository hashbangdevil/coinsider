#!/usr/bin/env bash
#
# Coinsider release helper.
#
# Bumps the single-source VERSION and propagates it to every version surface
# (there is no build step, so this script IS the "one command" that keeps them
# in sync), updates the changelog, commits, and creates an annotated git tag.
#
# Usage:
#   scripts/release.sh patch             # 1.0.0 -> 1.0.1
#   scripts/release.sh minor             # 1.0.0 -> 1.1.0
#   scripts/release.sh major             # 1.0.0 -> 2.0.0
#   scripts/release.sh 1.4.2             # set an explicit version
#   scripts/release.sh patch --dry-run   # preview only; no writes/commit/tag
#   scripts/release.sh patch --push      # push commit + tag AND create the GitHub release
#
# --push creates a GitHub release from the new tag (notes = the promoted
# CHANGELOG section) via the gh CLI. If gh is missing or unauthenticated the
# push still succeeds and the release step is skipped with instructions.
#
# Before a real release: commit/stash your work (a clean tree is required) and
# run the test suites (composer test && npm run test:e2e).

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

DRY_RUN=false
PUSH=false
BUMP=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --push)    PUSH=true ;;
    major|minor|patch)          BUMP="$arg" ;;
    [0-9]*.[0-9]*.[0-9]*)       BUMP="$arg" ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ -z "$BUMP" ]]; then
  echo "Usage: scripts/release.sh <major|minor|patch|X.Y.Z> [--dry-run] [--push]" >&2
  exit 2
fi

CURRENT="$(tr -d '[:space:]' < VERSION)"
IFS='.' read -r MAJ MIN PAT <<< "$CURRENT"

case "$BUMP" in
  major) NEW="$((MAJ + 1)).0.0" ;;
  minor) NEW="${MAJ}.$((MIN + 1)).0" ;;
  patch) NEW="${MAJ}.${MIN}.$((PAT + 1))" ;;
  *)     NEW="$BUMP" ;;
esac

echo "Current version: $CURRENT"
echo "New version:     $NEW"

if [[ "v$NEW" == "v$CURRENT" ]]; then
  echo "New version equals current — nothing to do." >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/v$NEW" >/dev/null; then
  echo "Tag v$NEW already exists." >&2
  exit 1
fi

if ! $DRY_RUN && [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean — commit or stash changes first." >&2
  exit 1
fi

DATE="$(date +%F)"

if $DRY_RUN; then
  echo
  echo "[dry-run] would update:"
  echo "  VERSION            -> $NEW"
  echo "  index.html         -> <span id=\"app-version\">v$NEW</span> and ?v=$NEW on styles.css/app.js/crypto.js"
  echo "  sw.js              -> CACHE_NAME = 'coinsider-v$NEW'"
  echo "  CHANGELOG.md       -> promote [Unreleased] to [$NEW] - $DATE"
  echo "[dry-run] would commit 'Release v$NEW' and tag 'v$NEW'"
  $PUSH && echo "[dry-run] would push commit + tag to origin and create GitHub release v$NEW"
  exit 0
fi

# 1. Canonical version file.
printf '%s\n' "$NEW" > VERSION

# 2. Version surfaces. perl -i is used (not sed -i) for macOS/Linux portability.
NEW="$NEW" perl -pi -e 's/(<span id="app-version">)v[0-9.]+(<\/span>)/${1}v$ENV{NEW}${2}/' index.html
NEW="$NEW" perl -pi -e 's/((?:styles\.css|app\.js|crypto\.js)\?v=)[^"'"'"']+/${1}$ENV{NEW}/g' index.html
NEW="$NEW" perl -pi -e "s/(const CACHE_NAME = 'coinsider-v)[^']+(')/\${1}\$ENV{NEW}\${2}/" sw.js

# 3. Changelog: promote [Unreleased] to the new version and open a fresh one.
NEW="$NEW" DATE="$DATE" perl -0pi -e 's/## \[Unreleased\]/## [Unreleased]\n\n## [$ENV{NEW}] - $ENV{DATE}/' CHANGELOG.md

# 4. Commit + annotated tag.
git add VERSION index.html sw.js CHANGELOG.md
git commit -m "Release v$NEW"
git tag -a "v$NEW" -m "Release v$NEW"

echo
echo "Released v$NEW (committed and tagged)."

if $PUSH; then
  git push origin HEAD
  git push origin "v$NEW"
  echo "Pushed commit and tag v$NEW to origin."

  # Create the GitHub release from the just-promoted changelog section.
  # Non-fatal: the tag is already published, so a gh problem must not fail the run.
  if command -v gh >/dev/null 2>&1; then
    NOTES="$(mktemp)"
    awk -v ver="$NEW" '
      $0 ~ "^## \\[" ver "\\]" { f = 1; next }
      f && /^## \[/ { exit }
      f { print }
    ' CHANGELOG.md > "$NOTES"

    if [[ -s "$NOTES" ]]; then
      NOTE_ARGS=(--notes-file "$NOTES")
    else
      NOTE_ARGS=(--generate-notes)
    fi

    if gh release create "v$NEW" --title "v$NEW" "${NOTE_ARGS[@]}" --verify-tag; then
      echo "Created GitHub release v$NEW."
    else
      echo "WARNING: 'gh release create' failed (run 'gh auth login'?). The tag is pushed;" >&2
      echo "         create it later with: gh release create v$NEW --title v$NEW --notes-file <notes>" >&2
    fi
    rm -f "$NOTES"
  else
    echo "Note: gh (GitHub CLI) not found — skipped GitHub release creation." >&2
    echo "      Install gh, then: gh release create v$NEW --title v$NEW --generate-notes" >&2
  fi
else
  echo "To publish:  git push origin HEAD && git push origin v$NEW  (or re-run with --push)"
fi
