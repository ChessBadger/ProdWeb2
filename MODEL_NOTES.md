# Schedule Planning Prediction Model Notes

This document describes the prediction logic used by the scheduleplanning site so another app can reproduce the model without depending on the UI. The source implementation lives mainly in `public/scheduleplanningapp.js`; the same file is mirrored in `docs/scheduleplanningapp.js`.

## Prediction Model Logic

The main live planner entry point is `predict()`. A reusable version for arbitrary crew assignments is `predictForAssignedCrew(storeKey, crewIds, rolesConfig, modesConfig)`.

At prediction time, the app requires:

- A selected historical store.
- At least one selected employee.
- A selected supervisor who is also in the crew.
- Any required RX employee assignment for RX stores.
- Valid baseline pieces and positive crew production speed.

The main duration formula is:

```text
crewSpeedRaw = sum(adjusted employee pieces/hr)
crewEfficiency = getCrewEfficiencyFactor(crewSize, tuning)
crewSpeed = crewSpeedRaw * crewEfficiency
rawOnSiteDuration = overheadHours + baselinePieces / crewSpeed
residualCorrection = -residualBiasHours
onSiteDuration = max(0, rawOnSiteDuration + residualCorrection)
manHours = onSiteDuration * crewSize
```

`baselinePieces` is the expected total pieces for the store. `overheadHours` is a fixed-duration component derived from historical low-end duration. `crewSpeedRaw` is the role-adjusted sum of employee production rates. `crewEfficiency` reduces production for larger crews.

The selected employee speed is resolved as:

```text
base employee speed =
  account-specific blended speed, if employee has account history
  else global blended speed, if employee has global history
  else global median employee speed
```

For account-specific and global speed, the app blends recent and long-run production:

```text
recentWeight = max(0.55, 0.9 - min(jobCount, 20) * 0.02)
blendedSpeed = recentSpeed * recentWeight + longRunSpeed * (1 - recentWeight)
shrunkenSpeed = blendedSpeed * n/(n+k) + globalMedianSpeed * (1 - n/(n+k))
```

The shrinkage `k` is `3` for account history and `4` for global history. Recent employee speed uses exponential decay with a 120-day half-life:

```text
recencyWeight = 0.5 ^ (ageDays / 120)
```

If the user enables "Use most recent account production for arrowed employees", the app can replace the blended employee speed with the employee's most recent non-RX production rate for that account.

Role adjustments are multiplicative on employee speed. If an employee has more than one role, the lowest contribution factor wins:

```text
factor = min(applicable role contribution factors)
effectiveEmployeeSpeed = baseSpeed * factor
```

Contribution modes:

```text
full = 1.00
p70 = 0.70
p50 = 0.50
p30 = 0.30
none = 0.00
```

Default role modes:

```text
supervisor = p50
rx = p50
training = p70
earlyLate = p50
```

There is also an optional production shrink filter. If applied, the selected employees' effective speed is multiplied by:

```text
shrinkFactor = max(0.01, 1 - shrinkPercent / 100)
```

The Crew Production View ranks selected employees by:

```text
predictedPieces = adjustedEffectiveSpeed * predictedOnSiteDuration
```

## Derived Data-Building Logic

The app first normalizes the raw Excel-export rows into a stable shape with `normalizeRow()`.

Important normalized fields:

- `date`: date of inventory.
- `account`, `accountKey`: account name and linked/canonical account key.
- `store`, `storeKey`: store name and `account || store` key.
- `employee`, `employeeName`.
- `type`: normalized inventory type.
- `officeName`.
- `role`: lower-cased source role text.
- `isRx`: parsed RX flag.
- `supervisorNumber`.
- `manHours`, `totalExtQty`, `piecesPerHr`.
- `jobKey`: `date || account || store`.

`buildJobs()` groups rows by `jobKey`. A job represents one inventory event for one store on one date.

For each job, the app derives:

- `totalPieces`: sum of employee `totalExtQty`.
- `totalManHours`: sum of employee man-hours.
- `employees`: unique employee ids on the job.
- `crewSize`: unique employee count.
- `durationIncludingSupervisor`: max employee man-hours.
- `nonSupervisorDuration`: max employee man-hours excluding supervisor rows.
- `duration`: `nonSupervisorDuration` if available, otherwise `durationIncludingSupervisor`.
- `supervisorNumber`: most frequent supervisor id on that job.
- `employeeDetails`: per-employee pieces, in-store hours, and pieces/hr for that job.

Supervisor rows are intentionally excluded from employee productivity history when building `buildEmployeeStats()`. This keeps supervisor assignment days from biasing counter productivity.

Employee production history is stored both globally and by account:

- Global weighted average pieces/hr.
- Global recency-weighted pieces/hr.
- Account weighted average pieces/hr.
- Account recency-weighted pieces/hr.
- Account job count.
- Most recent non-RX account production value and source store.

Employee speed per row is inferred as:

```text
if piecesPerHr > 0:
  speed = piecesPerHr
else if totalExtQty > 0 and manHours > 0:
  speed = totalExtQty / manHours
else:
  speed = 0
```

Employee speed weight is:

```text
if manHours > 0:
  weight = manHours
else if totalExtQty > 0:
  weight = totalExtQty
else:
  weight = 1
```

Store and context stats are built from jobs:

- `buildStoreStats(jobs)`: per-store summaries.
- `buildStoreSegments(stores)`: account-specific size buckets.
- `buildAccountSegmentStats(jobs)`: account plus size segment summaries.
- `buildAccountTypeStats(jobs)`: account plus inventory type summaries.
- `buildAccountOfficeStats(jobs)`: account plus office summaries.
- `buildAccountGlobalStats(jobs)`: account-wide summaries.
- `buildGlobalStats(jobs, employees)`: global fallback summaries.

Each job group summary includes:

- Average pieces.
- Median pieces.
- 5% trimmed mean pieces.
- Recent weighted pieces, using the five most recent jobs with weights `5, 4, 3, 2, 1`.
- Average duration.
- Median duration.
- Average man-hours.
- Duration standard deviation, after trimming extremes when possible.
- Robust duration spread.
- `overheadBaseP20`: 20th percentile duration.

Account store segments are based on store size. Stores inside each account are sorted by robust baseline size and split into:

```text
1 segment if account has 1-3 stores
2 segments if account has 4-8 stores
3 segments if account has 9-17 stores
4 segments if account has 18+ stores
```

## Baseline, Calibration, And Accuracy Logic

The model predicts store pieces from both store-specific history and broader context history.

`resolveBaselinePieces(store, baselineTuning, typeOverride)` chooses a store candidate and a context candidate. Candidate modes are:

```text
median
trimmed
recent
avg
```

The store candidate is selected from store summary stats. The context candidate blends any available:

```text
account segment
account type
account global
account office
global
```

The context blend is a weighted average using the active baseline tuning:

```text
context = sum(candidateValue * candidateWeight) / sum(candidateWeight)
```

If both store and context are available, store history is shrunk toward context:

```text
rawStoreWeight = storeJobCount / (storeJobCount + storeShrinkK)
storeWeight = max(rawStoreWeight, minStoreWeight)
baselinePieces = storeWeight * storeCandidate + (1 - storeWeight) * context
```

Default baseline tuning starts with:

```text
storeMode = median
contextMode = median
storeShrinkK = 4
minStoreWeight = 0.45
segmentWeight = 0.45
typeWeight = 0.20
officeWeight = 0.20
accountWeight = 0.10
globalWeight = 0.05
```

`resolveOverheadHours(store, overheadScale)` picks the first available 20th-percentile duration source in this order:

```text
store
account segment
account type
account office
account
global
```

Then:

```text
overheadHours = max(0, overheadBaseP20 * overheadScale)
```

Model calibration happens in `calibrateModelParameters()`.

It tunes:

- Global model parameters.
- Account-level parameters when an account has at least 40 jobs.
- Account-segment parameters when a segment has at least 28 jobs.
- Account-type parameters when a type group has at least 20 jobs.

For each group, jobs are sorted by date and split:

```text
if fewer than 16 jobs:
  train = all jobs
  holdout = none
else:
  train = first 80%
  holdout = last 20%, with at least 8 train jobs
```

Calibration evaluates candidate parameters against holdout jobs when available, otherwise train jobs.

Tuned model parameters include:

- `overheadScale`
- `effSmall`
- `effMid`
- `effLarge`
- `smallCrewMax`
- `midCrewMax`

Default model tuning starts with:

```text
overheadScale = 0.25
effSmall = 1.00
effMid = 0.97
effLarge = 0.93
smallCrewMax = 8
midCrewMax = 15
```

Candidate values:

```text
overheadScale: 0.1, 0.2, 0.25, 0.3, 0.4, 0.5
effSmall: always 1.0
effMid: 0.94, 0.96, 0.97, 0.98, 1.0
effLarge: 0.88, 0.91, 0.93, 0.95, 0.97, 1.0
crew thresholds: seed thresholds plus 6/12, 8/15, 10/18, 12/20, and percentile-derived pairs
```

`effLarge` cannot be greater than `effMid`.

Baseline tuning candidates include:

```text
storeMode: median, trimmed, recent
contextMode: median, trimmed, recent
storeShrinkK: 2, 4, 6, 8
```

Context weight profiles:

```text
segment 0.45, type 0.25, office 0.20, account 0.05, global 0.05
segment 0.40, type 0.20, office 0.25, account 0.10, global 0.05
segment 0.30, type 0.30, office 0.20, account 0.10, global 0.10
```

Calibration score is a weighted error:

```text
durationMAE = mean(clipped absolute duration error, cap 12 hours)
manHoursMAE = mean(clipped absolute man-hour error, cap 60 man-hours)
score = durationMAE * 0.75 + manHoursMAE * 0.25
```

After tuning, `buildResidualStats()` builds correction tables. A residual is:

```text
durationResidual = predictedOnSiteDurationWithoutResiduals - actualDuration
manHourResidual = predictedManHoursWithoutResiduals - actualManHours
```

Residuals are grouped by:

- Store.
- Account segment.
- Account type.
- Account office.
- Account.
- Store plus crew band.
- Store plus supervisor.
- Account plus supervisor.
- Account segment plus crew band.
- Account type plus crew band.
- Account plus crew band.
- Global crew band.
- Global.

Crew bands:

```text
C1_5   = 1-5 employees
C6_10  = 6-10 employees
C11_15 = 11-15 employees
C16P   = 16+ employees
```

Each residual group stores:

- Count.
- Mean.
- P10, P25, P75, P90.
- Standard deviation.

Live prediction uses `resolveResidualAdjustmentForStore()` to blend residual means from broad to specific scopes. The blend formula is:

```text
weight = count / (count + k)
newBias = prior + weight * (scopeMean - prior)
```

The blending order is roughly:

```text
global
account
account segment
account type
account office
store
account supervisor
store supervisor
```

The final live correction is:

```text
residualCorrection = -biasHours
```

So if the model historically predicted this store too high by `+0.8` hours, the live prediction subtracts `0.8` hours.

The likely range uses the selected residual distribution:

```text
lowOffset = biasHours - residualP75
highOffset = biasHours - residualP25
confidenceLow = max(0, min(onSiteDuration + lowOffset, onSiteDuration + highOffset, onSiteDuration))
confidenceHigh = max(confidenceLow, max(onSiteDuration + lowOffset, onSiteDuration + highOffset, onSiteDuration))
```

The selected residual range source is the most specific scope with enough data, falling back through store/crew/supervisor/account/global scopes.

`uncertaintyScale` widens or narrows the likely range based on holdout performance:

```text
uncertaintyScale = clamp(holdoutDurationMAE / inSampleMAE, 0.85, 1.5)
```

The calibrated result can be serialized with `buildAnalyticsSnapshot(fingerprint)` and restored with `applyAnalyticsSnapshot(snapshot)`. That snapshot includes tuned parameters, residual maps, backtest metrics, and the data fingerprint. Sharing this snapshot is the fastest way for another app to use the same calibrated model without doing the expensive browser-side precompute step.

## Business Rules And Assumptions

The model predicts in-store duration and man-hours from historical inventory production, not staffing cost or payroll.

The duration target is based on the max non-supervisor employee hours for the job. If no non-supervisor rows are detected, max employee hours including supervisor is used.

Supervisor detection uses either:

- Employee id matching `supervisorNumber`.
- Role text matching `supervisor`, `lead`, or `manager`.

Supervisor rows are excluded from employee productivity history. They are still included in job crew membership and job-level totals.

RX rows are excluded when storing the most recent account production source for an employee. This prevents RX assignment days from becoming the "most recent account production" override.

A store key is `account || store`. A job key is `date || account || store`.

Accounts can be linked/canonicalized with `getLinkedAccountKey()`. A reimplementation should preserve this mapping if account names vary for the same underlying customer.

The model treats larger crews as potentially less efficient via the tuned crew efficiency factors. Small crews default to `1.0`; mid and large crew factors are tuned.

The app uses both active employee filtering and historical production. Active employee filtering controls who can be scheduled, but historical former employees may still exist in old job totals.

Schedule data is not required for the core prediction, but it adds useful planner defaults:

- Store/date matching.
- Planned duration from run names like `4 hrs`.
- Planned crew size from run names like `crew size of 8`.

The model is empirical. It is calibrated against recent historical jobs and corrected by residual history. The confidence range is a historical residual range, not a formal statistical confidence interval.

## Source Functions To Port First

For a clean reimplementation, port in this order:

1. `normalizeRow()`, `buildJobs()`, `summarizeJobGroup()`.
2. `buildStoreStats()`, `buildStoreSegments()`, account/type/office/global stat builders.
3. `buildEmployeeStats()`, `displayEmployeeSpeed()`, `resolveEmployeePlanningBaseSpeed()`.
4. `resolveBaselinePieces()`, `resolveOverheadHours()`.
5. `calibrateModelParameters()`, `replayScoreForParameters()`, `computePredictionForJob()`.
6. `buildResidualStats()`, `resolveResidualAdjustmentForStore()`.
7. `predict()` or `predictForAssignedCrew()`.
