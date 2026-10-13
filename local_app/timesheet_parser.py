import json,datetime,re,collections,hashlib,io,os
from pathlib import Path
import xlrd,openpyxl
TODAY=datetime.date.today()
def normkey(x):return re.sub('[^a-z0-9]','',str(x or '').lower())
def ident(v,width):
 if v is None:return None
 if isinstance(v,(int,float)):
  if not float(v).is_integer():return None
  s=str(int(v))
 else:s=str(v).strip()
 if s.isdigit() and int(s)==0:return None
 if s.isdigit() and len(s)<=width:return s.zfill(width)
 return s or None
def datevalue(v):
 if isinstance(v,datetime.datetime):return v.date().isoformat()
 if isinstance(v,datetime.date):return v.isoformat()
 if isinstance(v,str):
  for fmt in ('%m/%d/%Y','%Y-%m-%d','%m/%d/%y','%m/%d/%Y %H:%M:%S','%Y-%m-%d %H:%M:%S'):
   try:return datetime.datetime.strptime(v.strip(),fmt).date().isoformat()
   except ValueError:pass
 return None
def clock(v):
 if v is None or v=='':return None
 if isinstance(v,datetime.datetime):v=v.time()
 if isinstance(v,datetime.time):return v.hour*3600+v.minute*60+v.second+v.microsecond/1e6
 if isinstance(v,(int,float)) and 0<=v<1:return round(v*86400,6)
 if isinstance(v,str):
  for fmt in ('%H:%M:%S','%H:%M','%I:%M %p','%I:%M:%S %p'):
   try:t=datetime.datetime.strptime(v.strip(),fmt);return t.hour*3600+t.minute*60+t.second
   except ValueError:pass
 return None
def number(v):
 if v is None or v=='':return None
 try:return float(v)
 except:return None
def serial(v):
 if isinstance(v,(datetime.datetime,datetime.date,datetime.time)):return v.isoformat()
 if isinstance(v,(str,int,float,bool)) or v is None:return v
 return str(v)
def rowkey(d):return ident(d.get('customernumber'),8),datevalue(d.get('dateofinv'))
def audit(r):
 p=Path(r['local_path']);out={'relative':r['relative'],'sha256':r['sha256'],'extension':p.suffix.lower(),'metadata':[],'attendance':[],'leave_rows':0,'placeholder_rows':0,'schema_signatures':[],'flags':[]}
 try:
  st=p.stat()
  if st.st_size!=r['bytes'] or st.st_mtime_ns!=r['local_mtime_ns']:raise ValueError('Local file metadata changed after verification')
  if p.suffix.lower()=='.xls':
   book=xlrd.open_workbook(p,on_demand=True,logfile=io.StringIO());out['excel_date_system']=book.datemode
   sheets=[]
   for s in book.sheets():
    if not s.nrows:continue
    headers=[normkey(v) for v in s.row_values(0)]
    if not {'customernumber','dateofinv'}<=set(headers):continue
    rows=[]
    for ri in range(1,s.nrows):
     row={}
     for c,h in enumerate(headers):
      if not h:continue
      cell=s.cell(ri,c);v=cell.value
      if cell.ctype==xlrd.XL_CELL_DATE:
       try:v=xlrd.xldate.xldate_as_datetime(v,book.datemode)
       except:out['flags'].append('invalid_excel_date')
      row[h]=v
     rows.append((ri+1,row))
    sheets.append((headers,rows))
   book.release_resources()
  else:
   book=openpyxl.load_workbook(p,read_only=True,data_only=True,keep_links=False);out['excel_date_system']=str(book.epoch.date());sheets=[]
   for s in book:
    it=s.iter_rows(values_only=True);headers=[normkey(v) for v in next(it,[])]
    if not {'customernumber','dateofinv'}<=set(headers):continue
    sheets.append((headers,[(ri,{h:vals[c] for c,h in enumerate(headers) if h and c<len(vals)}) for ri,vals in enumerate(it,2)]))
   book.close()
  for si,(headers,rows) in enumerate(sheets):
   out['schema_signatures'].append({'sheet_index':si,'headers':headers})
   isatt={'employeenumber','timein','timeout'}<=set(headers);ismeta='supervisornumber' in headers
   for ri,d in rows:
    store,date=rowkey(d)
    if isatt:
     emp=ident(d.get('employeenumber'),4)
     if emp is None:out['placeholder_rows']+=1;continue
     tin=clock(d.get('timein'));tout=clock(d.get('timeout'));bo=clock(d.get('breaktimeout'));bi=clock(d.get('breaktimein'));flags=[]
     if not store or not re.fullmatch(r'\d{8}',store):flags.append('invalid_store_key')
     if not date:flags.append('invalid_date')
     elif not datetime.date(2010,1,1)<=datetime.date.fromisoformat(date)<=TODAY:flags.append('date_outside_history_window')
     if not re.fullmatch(r'\d{4}',emp):flags.append('nonstandard_employee_id')
     span=None
     if tin is None or tout is None:flags.append('missing_or_unparsed_clock')
     elif tin==tout:flags.append('zero_span');span=0
     elif tout<tin:flags.append('overnight_inferred');span=(tout-tin+86400)/3600
     else:span=(tout-tin)/3600
     if tin==0 or tout==0:flags.append('midnight_endpoint')
     if span and span>18:flags.append('span_over_18h')
     br=None
     if bo in (None,0) and bi in (None,0):flags.append('no_recorded_break_pair')
     elif bo is None or bi is None:flags.append('incomplete_break_pair')
     else:
      br=((bi-bo)%86400)/3600
      if span is None or br>span:flags.append('break_exceeds_span')
      if tin is not None and span is not None and (((bo-tin)%86400)/3600>span or ((bi-tin)%86400)/3600>span):flags.append('break_outside_interval')
     rv=d.get('rx');rx=True if rv in (1,-1,True) else False if rv in (0,False) else None
     out['attendance'].append({'store':store,'date':date,'employee':emp,'raw_employee':serial(d.get('employeenumber')),'time_in_s':tin,'time_out_s':tout,'break_out_s':bo,'break_in_s':bi,'recorded_span_h':span,'recorded_break_h':br,'travel_h':number(d.get('totaltravelhrs')),'driver_h':number(d.get('totaldriverhrs')),'rx':rx,'rx_raw':serial(rv),'row':ri,'flags':flags})
    elif ismeta:
     if not store and not date:continue
     out['metadata'].append({'store':store,'date':date,'supervisor':ident(d.get('supervisornumber'),4),'count_finished_s':clock(d.get('timefinishedcounting')),'timestamp':serial(d.get('timestamp')),'store_totals':{k:serial(v) for k,v in d.items() if re.fullmatch(r'store(total|peicetotal)\d+',k)},'row':ri})
    elif 'leavetype' in headers and ident(d.get('employeenumber'),4):out['leave_rows']+=1
  if not out['schema_signatures']:out['flags'].append('no_recognized_export_tables')
  out['status']='ok'
 except Exception as e:out.update(status='error',error=str(e))
 return out