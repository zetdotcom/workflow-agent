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

validate_to_pr() {
  local file="$1"
  local status="$2"
  local line state="" spec_identity="" plan_identity="" baseline_head="" baseline_branch=""
  local baseline_paths_fingerprint="" active_phase="" completed_phases="" phase_attempts=""
  local review_cycle="" delivery_kind="" runtime_limitation_recorded="" pr_url="" completion_recorded="" push_result="" line_number=0

  validate_document "$file" yes
  [[ -f "$file" ]] || return

  while IFS= read -r line || [[ -n "$line" ]]; do
    line_number=$((line_number + 1))
    (( line_number == 1 )) && continue
    [[ "$line" == "---" ]] && break
    case "$line" in
      state:\ *) state="${line#state: }" ;;
      spec_identity:\ *) spec_identity="${line#spec_identity: }" ;;
      plan_identity:\ *) plan_identity="${line#plan_identity: }" ;;
      baseline_head:\ *) baseline_head="${line#baseline_head: }" ;;
      baseline_branch:\ *) baseline_branch="${line#baseline_branch: }" ;;
      baseline_paths_fingerprint:\ *) baseline_paths_fingerprint="${line#baseline_paths_fingerprint: }" ;;
      active_phase:\ *) active_phase="${line#active_phase: }" ;;
      completed_phases:\ *) completed_phases="${line#completed_phases: }" ;;
      phase_attempts:\ *) phase_attempts="${line#phase_attempts: }" ;;
      review_cycle:\ *) review_cycle="${line#review_cycle: }" ;;
      delivery_kind:\ *) delivery_kind="${line#delivery_kind: }" ;;
      runtime_limitation_recorded:\ *) runtime_limitation_recorded="${line#runtime_limitation_recorded: }" ;;
      pr_url:\ *) pr_url="${line#pr_url: }" ;;
      completion_recorded:\ *) completion_recorded="${line#completion_recorded: }" ;;
      push_result:\ *) push_result="${line#push_result: }" ;;
    esac
  done < "$file"

  case "$state" in
    preflight|phase-[1-9]|phase-[1-9][0-9]*|final-verification|review|review-repair|delivery|blocked|delivered-to-review) ;;
    *) error "invalid TO-PR state: ${file#"$root"/}" ;;
  esac

  [[ -n "$spec_identity" ]] || error "missing TO-PR spec_identity: ${file#"$root"/}"
  [[ -n "$plan_identity" ]] || error "missing TO-PR plan_identity: ${file#"$root"/}"
  [[ -n "$baseline_head" ]] || error "missing TO-PR baseline_head: ${file#"$root"/}"
  [[ -n "$baseline_branch" ]] || error "missing TO-PR baseline_branch: ${file#"$root"/}"
  [[ -n "$baseline_paths_fingerprint" ]] || error "missing TO-PR baseline_paths_fingerprint: ${file#"$root"/}"

  for counter in active_phase completed_phases phase_attempts review_cycle; do
    value="${!counter}"
    [[ "$value" =~ ^[0-9]+$ ]] || error "invalid or missing TO-PR $counter: ${file#"$root"/}"
  done

  case "$delivery_kind" in
    none|ready|draft) ;;
    *) error "invalid or missing TO-PR delivery_kind: ${file#"$root"/}" ;;
  esac

  case "$completion_recorded" in
    yes|no) ;;
    *) error "invalid or missing TO-PR completion_recorded: ${file#"$root"/}" ;;
  esac

  case "$runtime_limitation_recorded" in
    yes|no) ;;
    *) error "invalid or missing TO-PR runtime_limitation_recorded: ${file#"$root"/}" ;;
  esac

  case "$push_result" in
    ""|none|success|failure) ;;
    *) error "invalid TO-PR push_result: ${file#"$root"/}" ;;
  esac

  case "$state" in
    preflight)
      [[ "$active_phase" == "0" && "$completed_phases" == "0" ]] ||
        error "preflight TO-PR state requires zero active and completed phases: ${file#"$root"/}"
      [[ "$delivery_kind" == "none" && "$push_result" == "none" && "$completion_recorded" == "no" ]] ||
        error "preflight TO-PR state cannot contain delivery metadata: ${file#"$root"/}"
      ;;
    phase-*)
      phase_number="${state#phase-}"
      [[ "$active_phase" == "$phase_number" ]] ||
        error "phase TO-PR state active_phase does not match state: ${file#"$root"/}"
      expected_completed=$((phase_number - 1))
      [[ "$completed_phases" == "$expected_completed" ]] ||
        error "phase TO-PR state requires preceding phases completed: ${file#"$root"/}"
      [[ "$delivery_kind" == "none" && "$push_result" == "none" && "$completion_recorded" == "no" ]] ||
        error "phase TO-PR state cannot contain delivery metadata: ${file#"$root"/}"
      ;;
    final-verification|review|review-repair)
      [[ "$active_phase" == "0" && "$completed_phases" -gt "0" ]] ||
        error "$state TO-PR state requires completed phases and no active phase: ${file#"$root"/}"
      [[ "$delivery_kind" == "none" && "$push_result" == "none" && "$completion_recorded" == "no" ]] ||
        error "$state TO-PR state cannot contain delivery metadata: ${file#"$root"/}"
      ;;
    delivery)
      [[ "$active_phase" == "0" && "$completed_phases" -gt "0" ]] ||
        error "delivery TO-PR state requires completed phases and no active phase: ${file#"$root"/}"
      [[ "$completion_recorded" == "no" ]] ||
        error "delivery TO-PR state cannot record completion: ${file#"$root"/}"
      ;;
  esac

  if [[ "$delivery_kind" == "draft" ]]; then
    [[ "$runtime_limitation_recorded" == "yes" ]] ||
      error "draft TO-PR delivery requires runtime limitation: ${file#"$root"/}"
  elif [[ "$delivery_kind" == "ready" ]]; then
    [[ "$runtime_limitation_recorded" == "no" ]] ||
      error "ready TO-PR delivery cannot record runtime limitation: ${file#"$root"/}"
  else
    [[ "$runtime_limitation_recorded" == "no" ]] ||
      error "non-delivery TO-PR state cannot record runtime limitation: ${file#"$root"/}"
  fi

  if [[ "$state" == "delivered-to-review" ]]; then
    [[ "$status" == "4.done" ]] || error "delivered-to-review requires 4.done ticket: ${file#"$root"/}"
    [[ "$delivery_kind" == "ready" || "$delivery_kind" == "draft" ]] ||
      error "delivered-to-review requires ready or draft delivery_kind: ${file#"$root"/}"
    [[ "$pr_url" =~ ^https?://[^[:space:]]+$ ]] ||
      error "missing TO-PR pr_url: ${file#"$root"/}"
    [[ "$push_result" == "success" ]] ||
      error "delivered-to-review requires push_result: success: ${file#"$root"/}"
    [[ "$completion_recorded" == "yes" ]] ||
      error "delivered-to-review requires completion_recorded: yes: ${file#"$root"/}"
    [[ "$active_phase" == "0" && "$completed_phases" -gt "0" ]] ||
      error "delivered-to-review requires completed phases and no active phase: ${file#"$root"/}"
  elif [[ "$state" == "blocked" ]]; then
    grep -q '^##\? Blocker' "$file" ||
      error "blocked TO-PR state requires a blocker section: ${file#"$root"/}"
  elif [[ -n "$pr_url" ]]; then
    [[ "$state" == "delivery" || "$state" == "blocked" ]] ||
      error "TO-PR pr_url is only valid during delivery or after delivery: ${file#"$root"/}"
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
          TO-PR.md)
            if [[ "$status" == "3.in-progress" || "$status" == "4.done" ]]; then
              validate_to_pr "$document" "$status"
            else
              error "TO-PR.md is only valid in 3.in-progress or 4.done: ${document#"$root"/}"
            fi
            continue
            ;;
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
