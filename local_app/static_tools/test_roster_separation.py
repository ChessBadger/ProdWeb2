from pathlib import Path
import sys,tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from export_history import archive_export,update_roster,verify_archive
with tempfile.TemporaryDirectory() as td:
 root=Path(td);repo=root/'repo';repo.mkdir();archive=root/'archive'
 def row(i,q):return dict(Employee=i,DateOfInv='2026-10-10',AccountName='KROGER',StoreName='TEST',Total_Ext_Qty=q)
 archive_export(Path('seed.xlsx'),[row(1,100),row(2,200)],archive,repo,source_bytes=b'seed',import_mode='current')
 updated=archive_export(Path('all.xlsx'),[row(1,120),row(3,300)],archive,repo,source_bytes=b'all')
 assert updated['payload']['_meta']['latestEmployeeIds']==['1','2']
 before=updated['payload']['EmployeeProductionHistory']
 assert len(before)==3 and next(r for r in before if r['Employee']==1)['Total_Ext_Qty']==120
 roster=update_roster(archive,['2','3'])
 assert roster['EmployeeProductionHistory']==before
 repeat=archive_export(Path('all.xlsx'),[row(1,120),row(3,300)],archive,repo,source_bytes=b'all')
 assert repeat['payload']['_meta']['latestEmployeeIds']==['2','3']
 for ids in [[],['9999']]:
  try:update_roster(archive,ids);raise AssertionError('Invalid roster accepted')
  except ValueError:pass
 assert verify_archive(archive)==3
 print('PASS: history import preserves roster; explicit roster edit preserves history; corrections, absent rows, duplicate import and archive integrity verified')
