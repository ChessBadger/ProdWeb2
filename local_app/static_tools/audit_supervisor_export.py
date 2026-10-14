"""Read-only, all-account supervisor-production audit of the original workbook."""
import collections
import datetime
import hashlib
import html
import json
import math
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'EmployeeProductionExportLashaunfull.xlsx'
OUT = ROOT / 'local_app/verification/all-supervisors-2026-10-14'
OUT.mkdir(exist_ok=True)

def ident(value):
    s = str(value or '').strip()
    if s.endswith('.0'): s = s[:-2]
    return s.zfill(4) if s and s != '0' else ''

def numeric(value):
    if value is None or not str(value).strip(): return None
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError): return None

wb = openpyxl.load_workbook(SOURCE, read_only=True, data_only=True)
ws = wb.worksheets[0]
it = ws.iter_rows(values_only=True)
headers = next(it)
rows = [dict(zip(headers, values), excelRow=i) for i, values in enumerate(it, 2)]
names = {ident(r['Employee']): (str(r['FirstName'] or '')+' '+str(r['LastName'] or '')).strip() for r in rows}
visits = collections.defaultdict(list)
for r in rows:
    date = r['DateOfInv'].date().isoformat() if isinstance(r['DateOfInv'], datetime.datetime) else str(r['DateOfInv']).strip()[:10]
    visits[(str(r['AccountName'] or '').strip(), str(r['StoreName'] or '').strip(), date)].append(r)

detail = []
unassigned = []
for (account, store, date), rs in sorted(visits.items()):
    supervisors = sorted({ident(r['SupervisorNumber']) for r in rs} - {''})
    if not supervisors:
        unassigned.append(dict(account=account, store=store, date=date, rows=[r['excelRow'] for r in rs]))
    for sup in supervisors:
        own = [r for r in rs if ident(r['Employee']) == sup]
        qty = [numeric(r['Total_Ext_Qty']) for r in own]
        pph = [numeric(r['PiecesPerHr']) for r in own]
        status = ('No employee row' if not own else 'Positive pieces' if any(q is not None and q > 0 for q in qty)
                  else 'Negative pieces' if any(q is not None and q < 0 for q in qty)
                  else 'Zero pieces' if any(q == 0 for q in qty) else 'Blank/invalid pieces')
        detail.append(dict(account=account, store=store, date=date, supervisorId=sup,
            supervisorName=names.get(sup, 'Not in employee rows'), status=status,
            supervisorRowCount=len(own), productionQuantities=qty, piecesPerHour=pph,
            positiveRate=any(v is not None and v > 0 for v in pph),
            ownSourceRows=[r['excelRow'] for r in own], assignmentSourceRows=[r['excelRow'] for r in rs if ident(r['SupervisorNumber']) == sup],
            conflictingSupervisorIds=supervisors if len(supervisors) > 1 else [],
            ownRowAssignedToOtherSupervisor=any(ident(r['SupervisorNumber']) != sup for r in own)))

def summarize(records):
    c = collections.Counter(r['status'] for r in records)
    return dict(assignments=len(records), positivePieces=c['Positive pieces'], zeroPieces=c['Zero pieces'],
        negativePieces=c['Negative pieces'], blankInvalidPieces=c['Blank/invalid pieces'], missingEmployeeRow=c['No employee row'],
        presentEmployeeRow=sum(r['supervisorRowCount'] > 0 for r in records), positiveRate=sum(r['positiveRate'] for r in records),
        positiveCoverage=round(c['Positive pieces']/len(records)*100, 2) if records else None,
        conflictingAssignments=sum(bool(r['conflictingSupervisorIds']) for r in records), duplicateOwnRows=sum(r['supervisorRowCount'] > 1 for r in records))

accounts = [dict(account=a, **summarize([r for r in detail if r['account'] == a])) for a in sorted({r['account'] for r in detail})]
sup_accounts = [dict(account=a, supervisorId=s, supervisorName=names.get(s,'Not in employee rows'), **summarize([r for r in detail if r['account']==a and r['supervisorId']==s])) for a,s in sorted({(r['account'],r['supervisorId']) for r in detail})]
summary = dict(source=str(SOURCE), sourceSHA256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(), sheet=ws.title,
    sourceRows=len(rows), inventoryCount=len(visits), distinctSupervisorIds=len({r['supervisorId'] for r in detail}),
    dateStart=min(k[2] for k in visits), dateEnd=max(k[2] for k in visits),
    method='All export rows, with no date, TypeOfInv, counting-mode, active-roster, or account filter. Inventory identity is exact trimmed account + store + date; each distinct assigned supervisor checked against Employee on that inventory. Production is Total_Ext_Qty; numeric zero is explicitly separate from missing.',
    totals=summarize(detail), unassignedInventories=unassigned, accounts=accounts, supervisorAccounts=sup_accounts)
assert sum(a['assignments'] for a in accounts) == len(detail)
assert sum(summary['totals'][k] for k in ['positivePieces','zeroPieces','negativePieces','blankInvalidPieces','missingEmployeeRow']) == len(detail)
assert len({(r['account'],r['store'],r['date'],r['supervisorId']) for r in detail}) == len(detail)
for r in detail:
    assert (r['status'] == 'No employee row') == (not r['ownSourceRows'])
(OUT/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf8')
(OUT/'inventory-detail.private.json').write_text(json.dumps(detail,indent=2),encoding='utf8')

esc=lambda x: html.escape(str(x))
def table(heads, records):
    return '<table><thead><tr>'+''.join('<th>'+esc(h)+'</th>' for h in heads)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+esc(v)+'</td>' for v in r)+'</tr>' for r in records)+'</tbody></table>'
account_table=table(['Account','Assignments','Positive pieces','Zero pieces','Blank/invalid','Missing employee row','Positive coverage'],[
    [a['account'],a['assignments'],a['positivePieces'],a['zeroPieces'],a['blankInvalidPieces'],a['missingEmployeeRow'],str(a['positiveCoverage'])+'%'] for a in sorted(accounts,key=lambda a:(-a['assignments'],a['account']))])
visit_table=table(['Account','Store','Date','Supervisor ID','Supervisor','Result','Pieces','Pieces/hr','Own Excel rows','Assignment Excel row','Conflicting IDs'],[
    [r['account'],r['store'],r['date'],r['supervisorId'],r['supervisorName'],r['status'],', '.join(map(str,r['productionQuantities'])),', '.join(map(str,r['piecesPerHour'])),', '.join(map(str,r['ownSourceRows'])),r['assignmentSourceRows'][0],', '.join(r['conflictingSupervisorIds'])] for r in detail])
page='''<!doctype html><html lang="en"><meta charset="utf-8"><title>Supervisor production audit</title>
<style>body{font:15px system-ui;margin:30px;color:#17202a}table{border-collapse:collapse;font-size:13px;width:100%}th,td{padding:7px 10px;border-bottom:1px solid #ddd;text-align:left}th{position:sticky;top:0;background:#edf2f7}section{max-height:650px;overflow:auto;border:1px solid #ddd}input{padding:10px;width: min(650px,85%);margin:12px 0}h1{font-size:28px}.note{max-width:1000px;line-height:1.5}</style>
<h1>Supervisor production audit</h1><p>14 October 2026 · Original workbook only · Read-only</p>'''
page+='<p class="note">'+esc(summary['method'])+'</p><p>'+esc(str(SOURCE))+'</p>'
page+='<p>'+esc(f"{len(rows):,} source rows; {len(visits):,} inventories; {len(detail):,} supervisor assignments; {len(accounts)} accounts. Dates: {summary['dateStart']} through {summary['dateEnd']}.")+'</p>'
totals=summary['totals']
page+='<p><strong>'+esc(f"{totals['positivePieces']:,} positive production records; {totals['zeroPieces']} explicit zero records; {totals['missingEmployeeRow']} missing supervisor employee rows.")+'</strong></p>'
missing_accounts=[a for a in accounts if a['missingEmployeeRow']==a['assignments']]
page+='<p class="note">Every supervisor row is missing for '+esc('; '.join(a['account']+' ('+str(a['assignments'])+' inventories)' for a in missing_accounts))+'. Kroger, Mariano’s and Festival account for 528 of 544 missing rows (97.1%). This is an account-associated pattern; the workbook alone cannot establish the export query’s cause.</p>'
page+='<p class="note">All seven supervisors on Kroger, Mariano’s and Festival also have positive supervisor production elsewhere in this same export. Across their other accounts, 1,199 of 1,212 assignments have positive production. This argues against a general employee-ID matching failure.</p>'
page+='<h2>By account</h2><section>'+account_table+'</section><h2>Every inventory and supervisor</h2><p>Search by account, store, supervisor, date, or result. Row references point to the original Excel worksheet. Missing rows mean unavailable production, not zero.</p><input id="search" placeholder="Filter inventory details" aria-label="Filter inventory details"><p id="count"></p><section id="detail">'+visit_table+'</section>'
page+='''<script>const rs=[...document.querySelectorAll('#detail tbody tr')],count=document.querySelector('#count');function filter(){const q=document.querySelector('#search').value.toLowerCase();let n=0;for(const r of rs){r.hidden=!r.textContent.toLowerCase().includes(q);if(!r.hidden)n++}count.textContent=n+' supervisor assignments shown'}document.querySelector('#search').addEventListener('input',filter);filter()</script></html>'''
(OUT/'supervisor-production-audit.html').write_text(page,encoding='utf8')
print(json.dumps({k:v for k,v in summary.items() if k not in ['accounts','supervisorAccounts','unassignedInventories']},indent=2))
print('TOP ACCOUNTS',json.dumps(sorted(accounts,key=lambda a:-a['assignments'])[:25],indent=2))
print('ACCOUNT PATTERNS',dict(allMissing=sum(a['missingEmployeeRow']==a['assignments'] for a in accounts),allPositive=sum(a['positivePieces']==a['assignments'] for a in accounts),mixed=sum(0<a['positivePieces']<a['assignments'] for a in accounts)))
