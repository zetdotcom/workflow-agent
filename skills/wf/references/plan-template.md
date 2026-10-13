---
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# Implementation Plan

## Validated Assumptions

- Confirmed or corrected assumption with evidence

## Relevant Archived Decisions

- Archived change and decision, present applicability, and whether its revisit condition is met; or `None found` with the search terms used

## Verified Project Commands

- Focused test:
- Full test suite:
- Typecheck / lint / build, when present:
- Runtime / smoke command or scenario:

## Verification Seams

- Public interface or user surface, behavior proved, and why this is the highest stable seam

## Specification Verification

When `SPEC.md` exists, map every scenario and protected behavior to its planned evidence. Use `None — no SPEC.md` otherwise.

| Scenario or protected behavior | Verification seam | Planned evidence | Phase |
|---|---|---|---|
| Scenario heading | Public interface or user surface | Focused automated check and direct runtime scenario, as applicable | 1 |


## Approach Summary

- Strategy, important decisions, and meaningful alternatives rejected

## Phase 1: Vertical Behavior Slice

**Goal / observable outcome:**
-

**Dependencies:**
- None

**Changes:**
1.

**Affected files:**
-

**Pre-change evidence:**
- Failing test or reproducible scenario, or why a red check is not meaningful

**Verification:**
- Focused automated check
- Direct runtime / smoke scenario

**Completion criteria:**
- [ ] Observable result

## Final Verification

- [ ] Run relevant full repository checks once after the final code change
- [ ] Exercise every changed runnable surface and record observed result
- [ ] Verify every acceptance criterion, including boundaries and failure behavior
- [ ] Verify deployment and rollback considerations

## Deploy Notes

-
