#!/usr/bin/env bash
set -euo pipefail

root="${1:-$PWD}"
if [[ ! -d "$root" ]]; then
  echo "ERROR: execution root does not exist: $root" >&2
  exit 2
fi

root="$(cd "$root" && pwd)"
changes_root="$root/.workflow/changes"
archive_root="$root/.workflow/archive"
errors=0
change_count=0
ticket_count=0
archive_count=0
active_change_names=$'\n'
archived_change_names=$'\n'

error() {
  echo "ERROR: $1" >&2
  errors=$((errors + 1))
}

validate_document() {
  local file="$1"
  local require_created="$2"
  local line first_line="" created="" updated="" frontmatter_closed="no" line_number=0

  if [[ ! -f "$file" ]]; then
    error "missing file: ${file#"$root"/}"
    return
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_number=$((line_number + 1))
    if (( line_number == 1 )); then
      first_line="$line"
      continue
    fi
    if [[ "$line" == "---" ]]; then
      frontmatter_closed="yes"
      break
    fi
    case "$line" in
      created:\ *) created="${line#created: }" ;;
      updated:\ *) updated="${line#updated: }" ;;
    esac
  done < "$file"

  if [[ "$first_line" != "---" ]]; then
    error "missing YAML frontmatter opener: ${file#"$root"/}"
    return
  fi
  [[ "$frontmatter_closed" == "yes" ]] || error "missing YAML frontmatter closer: ${file#"$root"/}"
  [[ "$updated" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || error "invalid or missing updated date: ${file#"$root"/}"

  if [[ "$require_created" == "yes" ]]; then
    [[ "$created" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || error "invalid or missing created date: ${file#"$root"/}"
  fi
}

validate_archive_summary() {
  local file="$1"
  local expected_archived="$2"
  local expected_change="$3"
  local line change="" archived="" outcome="" line_number=0

  validate_document "$file" yes
  [[ -f "$file" ]] || return

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_number=$((line_number + 1))
    (( line_number == 1 )) && continue
    [[ "$line" == "---" ]] && break
    case "$line" in
      change:\ *) change="${line#change: }" ;;
      archived:\ *) archived="${line#archived: }" ;;
      outcome:\ *) outcome="${line#outcome: }" ;;
    esac
  done < "$file"

  [[ "$change" == "$expected_change" ]] || error "archive change identity does not match directory: ${file#"$root"/}"
  [[ "$archived" == "$expected_archived" ]] || error "archive date does not match directory: ${file#"$root"/}"
  case "$outcome" in
    completed|cancelled|superseded|closed-incomplete) ;;
    *) error "invalid or missing archive outcome: ${file#"$root"/}" ;;
  esac
}

if [[ ! -d "$changes_root" ]]; then
  echo "ERROR: missing workflow root: .workflow/changes" >&2
  exit 1
fi

for change in "$changes_root"/*; do
  [[ -e "$change" ]] || continue
  if [[ ! -d "$change" ]]; then
    error "unexpected file under .workflow/changes: ${change#"$root"/}"
    continue
  fi

  change_count=$((change_count + 1))
  change_name="$(basename "$change")"
  active_change_names+="$change_name"$'\n'
  seen_ticket_names=$'\n'
  validate_document "$change/CONTEXT.md" yes
  validate_document "$change/STATUS.md" no

  for status in 1.draft 2.todo 3.in-progress 4.done; do
    status_dir="$change/$status"
    if [[ ! -d "$status_dir" ]]; then
      error "missing status directory: ${status_dir#"$root"/}"
      continue
    fi

    for ticket in "$status_dir"/*; do
      [[ -e "$ticket" ]] || continue
      if [[ ! -d "$ticket" ]]; then
        error "unexpected file in status directory: ${ticket#"$root"/}"
        continue
      fi

      ticket_count=$((ticket_count + 1))
      ticket_name="$(basename "$ticket")"
      if [[ ! "$ticket_name" =~ ^[0-9]{3}[a-z]?(-[a-z0-9][a-z0-9._-]*)?$ ]]; then
        error "invalid ticket directory name: ${ticket#"$root"/}"
      fi

      if [[ "$seen_ticket_names" == *$'\n'"$ticket_name"$'\n'* ]]; then
        error "duplicate ticket directory across statuses: $ticket_name"
      else
        seen_ticket_names+="$ticket_name"$'\n'
      fi

      validate_document "$ticket/TICKET.md" yes

      case "$status" in
        2.todo|3.in-progress|4.done)
          validate_document "$ticket/PLAN.md" yes
          validate_document "$ticket/PLAN-BRIEF.md" yes
          ;;
      esac

      if [[ "$status" == "4.done" ]]; then
        validate_document "$ticket/PROGRESS.md" yes
      fi

      for document in "$ticket"/*.md; do
        [[ -e "$document" ]] || continue
        case "$(basename "$document")" in
          TICKET.md|PLAN.md|PLAN-BRIEF.md|PROGRESS.md) continue ;;
        esac
        validate_document "$document" yes
      done
    done
  done
done

if [[ -e "$archive_root" && ! -d "$archive_root" ]]; then
  error "workflow archive is not a directory: .workflow/archive"
elif [[ -d "$archive_root" ]]; then
  for archive in "$archive_root"/*; do
    [[ -e "$archive" ]] || continue
    if [[ ! -d "$archive" ]]; then
      error "unexpected file under .workflow/archive: ${archive#"$root"/}"
      continue
    fi

    archive_name="$(basename "$archive")"
    if [[ "$archive_name" =~ ^([0-9]{4}-[0-9]{2}-[0-9]{2})-([A-Za-z0-9][A-Za-z0-9._-]*)$ ]]; then
      archive_date="${BASH_REMATCH[1]}"
      archived_change_name="${BASH_REMATCH[2]}"
    else
      error "invalid archive directory name: ${archive#"$root"/}"
      continue
    fi

    archive_count=$((archive_count + 1))
    if [[ "$active_change_names" == *$'\n'"$archived_change_name"$'\n'* ]]; then
      error "change exists in active and archive storage: $archived_change_name"
    fi
    if [[ "$archived_change_names" == *$'\n'"$archived_change_name"$'\n'* ]]; then
      error "duplicate archived change identity: $archived_change_name"
    else
      archived_change_names+="$archived_change_name"$'\n'
    fi

    validate_archive_summary "$archive/SUMMARY.md" "$archive_date" "$archived_change_name"
    for archive_entry in "$archive"/*; do
      [[ -e "$archive_entry" ]] || continue
      [[ "$(basename "$archive_entry")" == "SUMMARY.md" && -f "$archive_entry" ]] || error "unexpected archive entry: ${archive_entry#"$root"/}"
    done
  done
fi

if (( errors > 0 )); then
  echo "Workflow metadata invalid: $errors error(s)." >&2
  exit 1
fi

printf 'Workflow metadata valid: %d active change(s), %d ticket(s), %d archived change(s).\n' "$change_count" "$ticket_count" "$archive_count"
