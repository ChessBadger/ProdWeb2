"""Publish aggregate typical errors only; retain individual residuals locally."""
import json, pathlib, statistics

def range_evidence(cutoff, model_hash):
    data=json.loads((pathlib.Path(__file__).parent/'range-calibration.json').read_text())
    if data['modelHash']!=model_hash:return {}
    result={}
    for model in ('integrated','reference'):
        values=[r[model] for r in data['rows'] if r['date']<cutoff and r[model] is not None]
        if len(values)>=20:
            result[model]={'count':len(values),'medianAbsoluteErrorHours':statistics.median(values),'kind':'typical-error','target':'crew'}
    return result
