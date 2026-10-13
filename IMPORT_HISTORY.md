# Weekly production export import

For an all-current/former employee workbook, use `StartLocalSite.cmd`, then
Update history > EmployeeProduction export > **Historical backfill - preserve
current roster**. The command below is for verified current-employee exports and
updates the active roster. Do not use it for historical backfills.

The Lashaun full workbook was integrated as a backfill on 2026-10-13. The immutable
union contains 18,277 rows / 3,459 jobs; all 226 omitted older rows and the existing
61-person active roster remain. The weekly file builder reads that retained archive.

The received workbook can keep the name `EmployeeProductionExport.xlsx`. Save it
in Downloads (or another inbox folder), then drag it onto `ImportEmployeeExport.cmd`
in this website folder. Do not first overwrite the workbook in the website folder.
The importer captures the selected file before updating derived data. It runs
locally and does not commit or push. Existing Python pandas/openpyxl and Node are
required; it installs nothing.

Equivalent command from this website folder:

```powershell
python -B convert_xl_to_json.py "C:\path\to\received\EmployeeProductionExport.xlsx" --local-only
```

Raw archives are outside the website and Git repository, at:

```text
%LOCALAPPDATA%\EmployeePredictor\ExportHistory\<repository-path-hash>\
  manifest.json
  snapshots\20261009T130000.123456Z_<sha256-prefix>_<unique-id>\
    EmployeeProductionExport_<snapshot-id>.xlsx
    effective.json.gz
    receipt.json
```

The importer prints the exact location. Each snapshot folder is immutable and
exclusive-created. The manifest records full SHA-256 hashes, receipt time, source
name, row counts, and new/revised/retained rows. Files inherit the Windows user
profile's access controls; this is local storage, not encryption or a remote
backup. Back up this directory to an approved local/offline location. Never move
raw snapshots into `public`, `docs`, or the repository. Archive overrides inside
the repository are rejected.

## Overlapping files and corrections

- An exact duplicate workbook hash is a no-op. Re-importing an older already
  archived workbook cannot roll back the current history or current employee list.
- A record is identified by inventory date + trimmed, case-insensitive account
  and store + employee ID. Repeated identical rows are collapsed, never summed.
- Within one workbook, conflicting rows with that identity stop the import.
  Across different workbook versions, the last received value replaces the
  effective record. Earlier versions remain in immutable snapshots.
- A row missing from a newer export stays in history. Missing people are never
  manufactured. Only employees appearing in the latest accepted export are
  offered for scheduling; retained past employees are historical evidence.
- Without a stable source event ID, changed date/account/store/employee identifiers
  cannot be recognized as corrections automatically. Review such source changes;
  do not assume the system can infer a renamed event or removed bad record.
- Each effective row carries first/last-seen receipt time, revision time/count,
  source hash, and row hash. First-seen time is when this archive first saw it,
  not a claim that its historical export was available before then.

The merged `EmployeeProductionHistory.json` is a derived website input; the
latest-only `EmployeeProductionExport.json` remains available to existing views.
Browser planning prefers retained history and uses its explicit latest roster.
If a retained-history file exists but is damaged, loading stops rather than
silently dropping older records. Raw archives and their manifest are never copied
to website assets. No deployment is performed by the local import command.

## Failure and recovery

Archival and its manifest commit finish before website data changes. An archive
failure aborts the import. A publication/build failure leaves the raw archive
safe: keep the received workbook and retry the same command. Each derived file
is replaced atomically; publication of all copies is not a single filesystem
transaction, so a failed copy may require that retry before using the website.

Concurrent imports are blocked by `.import.lock`. After a crash, confirm no
import is running before manually removing a stale lock. Missing/corrupt
manifests or hash mismatches are errors, never a request to reset history. A
crash can leave an uncommitted snapshot folder; retain it for recovery. For an
initial-import crash before the first manifest, review that folder before retrying.

```powershell
python -B convert_xl_to_json.py --verify-archive
python -B convert_xl_to_json.py "C:\path\to\EmployeeProductionExport.xlsx" --archive-only
```

`--archive-only` seeds/protects history without replacing current data or building.
`--skip-build --skip-analytics-precompute` imports derived data without either
step. Analytics precompute uses the offline Node VM, not a browser or live service.
Unattended invocation defaults to local-only; `--full` is an explicit separate
publish workflow and is not needed for these steps.

## Forecasts and accuracy

The target remains total **on-site** time including recounts and review. The
observed label remains the longest recorded non-supervisor attendance, falling
back to recorded supervisor attendance. Neither it nor the observed arrival-to-
departure span proves complete crew coverage. There is no counting-finish forecast.

Valid future scheduled previews are automatically appended to browser localStorage
under `crew_predictor_forecasts_v1`. Records retain save time, scheduled start,
crew/roles, model version, data fingerprint, archive source hash/snapshot, and
prediction. The Local Forecast History panel reports status and downloads a local
JSON backup. Do this periodically: clearing browser data or switching browser/
origin loses access to those local records. Storage errors are visible and do not
replace the log. A saved preview is not proof of final attendance.

Historical scoring uses Monday weekly cutoffs: all jobs in a week see only
previous weeks. This assumes last week's data was received by Monday; actual
receipt weekday is not known for the old file. Parameter selection precedes a
separate interval-calibration period, which precedes the later test period.
Intervals use earlier 10th/90th error percentiles and report measured later
coverage; sparse cases fall back to a labeled heuristic. Weekly replay of a
current retained snapshot cannot reconstruct old revisions or lost employees.
Real archived receipt times and pre-start saved forecasts support future checks.

Null telemetry stays unknown; zero is separate from missing. Reported PPH is
retained, including the empirically observed RX `Expr1 - 2.5 hours` convention.
Its business rationale remains unverified. No blanket break deduction is made.
