# On-site duration v4: weekly validation and retained history

The operational target remains **on-site time including recounts and manager
review**. Its observed label remains maximum non-supervisor employee Expr1,
falling back to maximum recorded employee Expr1. This is an incomplete-attendance
proxy, not verified complete-job elapsed time. There is no counting-finish target.
Pieces, hours and headcounts are partial; no missing participants are fabricated.

See [IMPORT_HISTORY.md](IMPORT_HISTORY.md) for the weekly workflow, private local
archive location, revision/duplicate rules, failure recovery and forecast backups.
The planner prefers derived EmployeeProductionHistory.json and its latest-export
roster. Damaged history stops loading instead of silently discarding older people.
Raw workbooks, compressed effective snapshots and manifest stay outside the repo.

## Prediction

`public/durationmodel.js` remains the shared engine. Earlier same-store/type/mode
visits take priority, followed by store/type and other store visits. New stores
use account/type/mode, account/type, account, then company history. Last/recent-
three/recent-five/median-three/median-five baselines and elasticities 0, .15, .3,
.5 remain. Crew adjustments stay bounded to -15%/+20%; broader account fallback
receives no crew adjustment. Unknown modes do not justify adjustments.

Blank/null/invalid AVG_DELTA stays unknown; explicit zero is separate and positive
telemetry is classified Modas. Unknown counter rows make job mode unknown. Raw
fields are retained for clarification of source semantics. Missing/unusable
supervisor production is excluded on both comparison sides. Planned labor still
assumes every selected employee stays for the full estimate.

Missing hours never fall back to pieces as rate weights; unusable rate rows do
not increase usable-job counts. Reported PPH is retained. All 13,533 positive
non-RX rows reproduce quantity/Expr1 and all 461 positive RX rows reproduce
quantity/(Expr1 - 2.5), allowing integer rounding. This is an empirical reporting
convention, not proof of actual RX exposure or its business reason. No blanket
break deduction or automatic RX convention change is implemented.

Optional stronger evidence and elapsed-age config hooks support offline evaluation
only; live calibration leaves them disabled. Tests did not justify enabling them.

## Weekly evaluation and uncertainty

All jobs in a week see only history/rates before Monday 00:00. This simulates
previous-week data being available Monday; actual historical receipt weekday is
unknown. Later test weeks can use earlier completed weeks. Live planning uses
the actually loaded data, never future jobs.

Whole-week boundaries separate development, calibration (roughly 60-80% of jobs),
and a last roughly 20% test period. Parameter selection uses the recent half of
pre-calibration records. Account overrides require >=40 validation jobs and
>=0.03h improvement. Calibration/test outcomes do not select parameters.

Ranges use earlier calibration error 10th/90th percentiles, with store >=20,
account >=40, then global >=20 samples. Sparse cases are explicitly labeled a
 +/-25% heuristic. Ranges include the point estimate and clip at zero. Later test
coverage is measured, not guaranteed; test errors do not calibrate themselves.

Replay uses today's retained snapshot: it cannot reconstruct employees already
lost, old revisions, actual receipt days, or original planned crews. Real archive
receipt times and saved pre-start previews support future prospective checks.

## October 9, 2026 experiment

Source: 14,006 rows, 3,419 jobs, September 30, 2024–September 28, 2026. Optional
changes required >=0.03h development improvement before consulting the later
test. None qualified. Final deterministic-order development MAEs: core 0.6617h;
stronger evidence 0.6655; 180-day age weighting 0.6692; both 0.6851; RX attendance
denominator 0.6610.

Validation ends December 12, 2025; calibration starts December 15 (700 jobs);
test starts April 27, 2026. Selected median-five baseline, elasticity .3; Oneida
override elasticity 0. Under the same weekly protocol:

| Model/subset | Jobs | MAE hours |
| --- | ---: | ---: |
| New core | 705 | 0.6334 |
| Previous predictor | 705 | 0.6385 |
| New model, repeat stores | 668 | 0.5995 |
| Last visit, same repeat stores | 668 | 0.7166 |
| Last-three mean, same repeat stores | 668 | 0.6338 |
| New model, first observed visits | 37 | 1.2459 |

The old/new gain is only 0.30 minutes per job; no significance or dramatic gain
is claimed. Bias -0.0814h; 81.4% within one hour. Nominal 80% range coverage: 77.9%.

Both models use the same canonical retained-history input, weekly cutoffs,
parameter-selection/calibration partitions, and exactly the same 705 test jobs.
Same-day reference selection and recent-rate ties are deterministic so row order
alone cannot change a new-model prediction.

Observed earliest arrival to latest departure exceeds the current proxy by mean
0.0951h, median approximately zero, p90 0.3278h, maximum 3.85h. That span also
omits missing attendees. This descriptive comparison did not justify silently
changing targets; review outliers and future attendance evidence instead.

## Persistence and checks

Model `duration-v4-weekly`, analytics schema 9. Wrong versions/data fingerprints
are rejected. Forecasts append to localStorage `crew_predictor_forecasts_v1` with
save/start times, crew/roles, model, source fingerprint/snapshot/hash/import time
and predictions. Identical previews deduplicate. Errors preserve the log and are
visible. The Local Forecast History panel downloads browser-specific backups.

```text
npm test
node scripts/benchmark-planner.mjs
python -B convert_xl_to_json.py --verify-archive
```

Importer precompute uses the offline Node VM. No browser/live service is needed.
`scripts/weekly-experiment.mjs` accepts null-preserving input JSON and an optional
unchanged old-repository path. Isolated inputs/results accompany this task.
No push or deployment was performed.
