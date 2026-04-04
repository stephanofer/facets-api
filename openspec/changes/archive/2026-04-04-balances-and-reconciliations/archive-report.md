# Archive Report

**Change**: balances-and-reconciliations
**Mode**: hybrid
**Archived On**: 2026-04-04
**Archive Destination**: `openspec/changes/archive/2026-04-04-balances-and-reconciliations/`
**Verify Verdict**: PASS WITH WARNINGS

## Artifact Traceability

| Artifact       | Engram Observation ID | Filesystem Source                                                |
| -------------- | --------------------: | ---------------------------------------------------------------- |
| proposal       |                   298 | `openspec/changes/balances-and-reconciliations/proposal.md`      |
| spec           |                   302 | `openspec/changes/balances-and-reconciliations/specs/`           |
| design         |                   305 | `openspec/changes/balances-and-reconciliations/design.md`        |
| tasks          |                   311 | `openspec/changes/balances-and-reconciliations/tasks.md`         |
| apply-progress |                   316 | Engram-only progress note                                        |
| verify-report  |                   320 | `openspec/changes/balances-and-reconciliations/verify-report.md` |

## Specs Synced

| Domain                  | Action  | Details                                                                      |
| ----------------------- | ------- | ---------------------------------------------------------------------------- |
| account-balances        | Created | New source-of-truth spec created from completed delta; 3 requirements synced |
| account-reconciliations | Created | New source-of-truth spec created from completed delta; 2 requirements synced |

## Archive Contents

- `proposal.md` ✅
- `exploration.md` ✅
- `specs/account-balances/spec.md` ✅
- `specs/account-reconciliations/spec.md` ✅
- `design.md` ✅
- `tasks.md` ✅ (19/19 complete)
- `verify-report.md` ✅
- `archive-report.md` ✅

## Final Notes

- Main OpenSpec specs were initialized from the completed change because no prior `openspec/specs/` source-of-truth files existed for these domains.
- Verification reported no critical issues; the only remaining warning is process-level: apply-progress does not yet include a formal `TDD Cycle Evidence` table.
- The change is fully archived and the hybrid audit trail now exists in both OpenSpec and Engram.
