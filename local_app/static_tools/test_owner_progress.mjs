import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../web/owner.js',import.meta.url),'utf8');
async function scenario({resume=false,fail=false}={}){
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,{textContent:'',className:'',hidden:true,disabled:false,checked:true,files:[],listeners:{},setAttribute(k,v){this[k]=v},addEventListener(k,v){this.listeners[k]=v},append(){},replaceChildren(){}});return elements.get(id)};
 let posts=0,polls=0,deploymentPolls=0,seenBuild=false,seenDeploy=false;
 const response=x=>({ok:true,json:async()=>x});
 const fetch=async(path)=>{
  if(path==='/api/status')return response({token:'test',employees:[],counts:{productionRows:1,completeVisits:1}});
  if(path==='/api/operations'){
   if(!posts&&!resume)return response({operations:[]});
   polls++;seenBuild||=get('workProgress')['aria-busy']==='true'&&!get('workProgress').hidden;
   return response({operations:[{id:'op',kind:'publish verified planner',created:new Date().toISOString(),status:polls<=2?'running':fail?'failed':'complete',message:polls<=2?'Building latest data…':fail?'Test build failed':JSON.stringify({commit:'abc',message:'Pushed'})}]});
  }
  if(path==='/api/owner/publish'){posts++;return response({operation:'op'})}
  if(path==='/api/owner/deployment'){
   if(!posts&&!resume)return response({status:'not-published',message:'Not yet published'});
   deploymentPolls++;seenDeploy||=get('workTitle').textContent==='Deploying online — please wait'&&get('publish').disabled;
   return response({status:deploymentPolls===1?'deploying':'deployed',message:deploymentPolls===1?'GitHub deployment running':'Live'});
  }
  throw Error(path);
 };
 const context={document:{getElementById:get,createElement:()=>({})},fetch,File:class{},Date,JSON,Error,setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>{queueMicrotask(fn);return 1}};
 vm.runInNewContext(source,context);
 for(let i=0;i<10;i++)await new Promise(setImmediate);
 if(!resume)await get('publish').listeners.click();
 for(let i=0;i<10;i++)await new Promise(setImmediate);
 assert.equal(posts,resume?0:1);assert.ok(seenBuild);assert.equal(get('workProgress')['aria-busy'],'false');assert.equal(get('publish').disabled,false);
 if(fail){assert.equal(get('workProgress').className,'work-progress failed');assert.match(get('workMessage').textContent,/Test build failed/)}
 else {assert.ok(seenDeploy);assert.equal(get('workProgress').className,'work-progress done');assert.match(get('workMessage').textContent,/live online/)}
}
await scenario();await scenario({resume:true});await scenario({fail:true});
console.log('Owner progress passed: build, deployment, live result, failure, refresh recovery without duplicate publish');
