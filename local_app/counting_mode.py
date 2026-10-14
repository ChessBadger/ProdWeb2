"""Count telemetry determines actual mode; TypeOfInv is not historical evidence."""
import math
FIELDS=('AVG_DELTA','GAP5_COUNT','GAP10_COUNT','GAP15_COUNT')

def counting_mode(rows):
    values=[r.get(k) for r in rows for k in FIELDS]
    if not values:return None
    invalid=False
    for value in values:
        if value is None or str(value).strip()=='':continue
        try:number=float(value)
        except (TypeError,ValueError):invalid=True;continue
        if not math.isfinite(number):invalid=True;continue
        if number!=0:return True
    return None if invalid else False
