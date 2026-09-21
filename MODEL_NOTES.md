# Schedule planning: duration model v3

The supplied production export omits former employees and some supervisors. Its
format cannot be changed. Employee rows describe the available portion of a job;
their summed pieces, labor hours and headcount are not complete job totals.
The supplied example PDFs are reference material only. They are not imported,
displayed, or included in the site's history or analytics.

`public/durationmodel.js` is the shared prediction engine. The app in
`public/scheduleplanningapp.js` supplies normalized data, employee rate contexts,
UI settings, validation and persistence. The built copies are in `docs/`.

## Prediction

1. Use only visits dated before the prediction date. Prefer the same store,
   inventory type and counting mode. If there is no matching mode, fall back to
   the same type, then other visits to the store. A store with no earlier visits
   uses account/type/mode, account/type, account, then company duration history.
2. The duration target is the maximum recorded non-supervisor employee hours,
   falling back to maximum recorded employee hours. This is an observed proxy,
   not a verified elapsed start-to-finish measurement of the complete inventory.
3. Select a store baseline from last visit, recency-weighted last three/five, or
   median last three/five visits. Broader context uses a median with no crew
   adjustment. Inventory piece totals never determine duration or fallback size.
4. Compare role-adjusted crew rates for the reference and planned crews using
   the same employee history context. Existing Modas/regular history weighting,
   peer estimates and fallback rules are retained. Their context is explicit,
   independent of the currently selected store or saved browser settings.
5. If either crew lacks its listed supervisor's **production** row, exclude supervisor output
   from both sides of that comparison. Do not invent missing historical
   supervisor production. Supervisors remain in planned headcount and labor.
6. Reduce adjustment strength for unfamiliar crews and employees without usable
   history. Different inventory types or modes supply duration evidence without
   a crew adjustment. For compatible reference visits:

   ```text
   reliability = min(currentKnownShare, referenceKnownShare)
                 * (0.35 + 0.65 * crewOverlap)
   multiplier = clamp((referenceRate / plannedRate)
                      ^ (elasticity * reliability), 0.85, 1.20)
   adjustedReferenceDuration = referenceDuration * multiplier
   ```

   The rate ratio is itself limited to 0.25-4. The baseline aggregation is applied
   to adjusted reference durations. Crew adjustments cannot reduce a reference
   duration by more than 15% or increase it by more than 20%. These are conservative
   planning constraints for incomplete history, not proof of how radically
   different staffing would perform. Validation can select zero elasticity when
   available history does not support a crew adjustment.
7. Planned labor is predicted duration times **all selected employees**, including
   0% counting roles. This assumes everyone remains for the full estimated time.
   Historical partial labor totals are not used to tune or grade the model.

Live planning, two-store assignments and historical prediction use the same
engine. Comparison-store modes are resolved independently for each store.
Historical RX and counting modes are derived from that job's available rows;
training/early-departure assignments are unknown unless entered for a live plan.
Historical mixed Modas/regular counter rows have an unknown mode. Their outcomes
remain duration evidence but do not justify cross-mode crew adjustments.
Visits without any non-supervisor/non-RX production rows also have unknown mode.
Two unknown modes do not qualify as a compatible crew comparison. Known matching
store/type/mode visits still take precedence over visits with unknown mode.

The crew production table is a rate-times-time scenario calculation, not a
forecast of the store's complete inventory quantity. The existing likely-range
display uses quartiles of later-job errors, with broader fallback when sparse;
it is not a guaranteed coverage interval. No historical residual correction is
added to the duration point estimate.

## Chronological validation

`buildDurationReplayRecords()` processes whole dates in order. Before predicting
any job on a date, it rebuilds employee/account/mode rates using only rows from
strictly earlier dates and uses only earlier reference visits. It reveals the
current date's jobs after **all** predictions for that date have been prepared.
Thus neither the target job nor a different same-day inventory can supply its
rates, baseline, peers, or account fallback.

The final roughly 20% of jobs is the test period, with the boundary moved to a
whole date. Parameters are selected using the recent half of the earlier
development records, then held fixed for testing. The candidate elasticities
are 0, 0.15, 0.3 and 0.5. An account override requires at least 40 validation jobs
and at least 0.03 hours better validation MAE than the global configuration.
Parameters are selected on duration error alone. There is no mixed-unit labor
loss, tuning against final test outcomes, or in-sample correction table.

Within the test period, earlier completed jobs can supply history for later
jobs, as they would after new exports arrive. Live predictions keep the tested
configuration and use all available earlier history. The error report includes
only scored test jobs, explicitly counts skipped jobs, and compares the model,
last visit and last-three-visit mean on the **same** subset of repeat stores.
Stores without earlier visits are reported separately. Fewer than 40 source
jobs yields no claimed independent test score.

This is a retrospective check against available employee time. A current export
has already removed some past participants, so date filtering cannot reproduce
the complete export that actually existed on an earlier date. Results do not
establish accuracy for missing labor, unobserved work or actual final attendance.

## Saved forecasts

Valid previews for future scheduled starts are saved after a short pause.
They are stored in browser localStorage under
`crew_predictor_forecasts_v1`, separately from the analytics cache. Identical
previews are deduplicated; changed plans/data produce additional records. No
record is overwritten or silently evicted. The Saved Forecasts card and its
manual save/download controls have been removed from the planner. Logging and
export helpers remain available in code for forecast validation.

Each record contains the save timestamp, scheduled date/start, model and input
fingerprint, explicit crew/roles/modes, production adjustment, selected model
configuration, source-history date, baseline and predictions. Local storage is
specific to a browser/origin; downloads are needed for a portable copy.

After a different export arrives, completed matching inventories can be compared
with the last saved preview before their recorded scheduled start. These are
preview forecasts, not verified final assignments. Historical employee duration
remains the outcome proxy. Missing or unreadable logs are never replaced with a
fresh empty log after an error.

## Build and verification

```text
npm test
npm run benchmark:planner
node scripts/benchmark-planner.mjs --write-snapshot
npm run build
python -B scripts/smoke-planner.py --built
```

The snapshot schema is version 8 and requires `modelVersion: duration-v3` plus
the production export fingerprint. Previous model snapshots cannot be restored.
The converter's existing browser precompute also generates the new schema; its
asset version updater covers the shared duration script. Data conversion retains
the original export shape and does not manufacture missing people or production.

The tests cover date and same-day isolation, held-out parameter independence,
saved-UI independence, counting-mode matching, missing supervisors, non-counting
headcount, bounded crew adjustments, prediction-path parity, snapshot round trips
and forecast persistence. The benchmark uses the same app data preparation and
shared engine as the browser.

For the original duration-v1 implementation on the September 18 export (3,429 jobs), parameters were selected before April
20, 2026, and 689 subsequent jobs were tested. For the 651 jobs with earlier store
history, MAE was 0.590 hours for the model, 0.694 for last visit, and 0.612 for the
last-three-visit mean. The 38 first-visit jobs had MAE 1.396 hours. These figures
describe this available-data test only; future saved forecasts provide a separate
check as new exports arrive.

A separate comparison held both models' history and employee rates fixed before
April 20 for the entire test period. On the same 651 repeat-store jobs, the old
model's MAE was 0.873 hours and the new model's was 0.609 hours (about 30% lower).
This comparison avoids crediting the new model for receiving updates that the old
model did not receive. It used the original planner source saved before this
change, with its calibration and residual correction fitted on earlier rows only.

The current duration-v3 model uses only the 3,429 export-derived jobs and keeps
the safeguards for unknown counting modes. Its 689-job test MAE is 0.633 hours;
on the 651 repeat-store jobs it is 0.588 hours, versus 0.694 for last visit and
0.612 for the last-three-visit mean. The 38 first-visit jobs have MAE 1.407 hours.
These results contain no imported PDF attendance or outcomes.
