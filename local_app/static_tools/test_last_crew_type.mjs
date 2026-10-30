import assert from 'node:assert/strict';import {curateLastCrew} from '../last-crew.mjs';
const base={AccountName:'A',StoreName:'S',DateOfInv:'2026-03-18',Employee:1089,FirstName:'JUSTIN',LastName:'LEE',Total_Ext_Qty:6161,Expr1:8.4,PiecesPerHr:733,TypeOfInv:'MODAS-SCAN'},catalog=[{id:'1089',name:'JUSTIN LEE'},{id:'1060',name:'NATE CARLSON'}],keys={'1089':'p1','1060':'p2'};
const curate=rows=>curateLastCrew(rows,'A||S','2026-03-18','Different account label',['1089','1060'],catalog,keys);
assert.equal(curate([base,{...base,TypeOfInv:'Scan-Item Level'}])[0].support,'recorded');
assert.equal(curate([base,{...base,Total_Ext_Qty:10}])[0].support,'ambiguous');
assert.equal(curate([base])[1].support,'missing');
assert.equal(curate([{...base,FirstName:'OTHER'}])[0].support,'unconfirmed');
assert.equal(curate([{...base,DateOfInv:'2026-03-19'}])[0].support,'missing');
assert.equal(curate([{...base,StoreName:'OTHER'}])[0].support,'missing');
console.log('PASS: type-label-only differences accepted; production conflicts, name mismatches, missing data and wrong visits remain protected');

