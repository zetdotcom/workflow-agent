#!/usr/bin/env bash
set -euo pipefail

root="${1:-$PWD}"
if [[ ! -d "$root" ]]; then
  echo "ERROR: execution root does not exist: $root" >&2
  exit 2
fi

root="$(cd "$root" && pwd)"
changes_root="$root/.workflow/changes"
errors=0
change_count=0
ticket_count=0

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
      if [[ ! "$ticket_name" =~ ^[0-9]{3}-[a-z0-9][a-z0-9._-]*$ ]]; then
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

if (( errors > 0 )); then
  echo "Workflow metadata invalid: $errors error(s)." >&2
  exit 1
fi

printf 'Workflow metadata valid: %d change(s), %d ticket(s).\n' "$change_count" "$ticket_count"
