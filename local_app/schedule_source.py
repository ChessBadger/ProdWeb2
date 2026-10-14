"""Read existing schedule source; honor newer workbook updates without archive extraction."""
import pathlib,json
def load_schedule(website):
 website=pathlib.Path(website);j=website/'ScheduleFinalFull.json';x=website/'ScheduleFinalFull.xlsx'
 if x.exists() and (not j.exists() or x.stat().st_mtime_ns>j.stat().st_mtime_ns):
  from convert_xl_to_json import read_excel_payload
  from export_history import json_bytes
  _,data=read_excel_payload(x);return json.loads(json_bytes(data))
 return json.loads(j.read_text(encoding='utf-8-sig')) if j.exists() else {}
