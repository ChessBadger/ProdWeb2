// Static public data + the original Firebase interface gate. No data-confidentiality claim.
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const legal=/^(?:app|predictor|planner|auth|style|planning)\.[a-f0-9]{64}\.(?:js|css|json)$/;let authAgent=null,sessionStop=null,release=null;
async function current(){const r=await fetch('./release.json',{cache:'no-store'});if(!r.ok)throw Error('The shared site is temporarily unavailable.');return r.json()}
async function checked(file){if(!legal.test(file.path)||!file.path.includes(file.sha256))throw Error('Invalid release filename.');const r=await fetch('./'+file.path,{cache:'no-store'});if(!r.ok)throw Error('The site is updating. Try again shortly.');const bytes=await r.arrayBuffer();if(await sha(bytes)!==file.sha256)throw Error('A site update is incomplete. Please retry.');return bytes}
function gate(message='Please sign in to continue'){
 sessionStop?.();sessionStop=null;delete document.documentElement.dataset.release;
 document.body.innerHTML='<main class="auth-shell"><section class="auth-card"><div class="eyebrow">BADGER · INVENTORY SERVICE, INC.</div><h1>Shift Crew Planner</h1><p id="authMessage" role="status" aria-live="polite"></p><button id="authSignIn" type="button">Sign In with Google</button><button id="retry" type="button">Retry loading</button><details><summary>Access and data visibility</summary><p>This reproduces the existing Google sign-in and approved-email interface gate. The static employee names and derived planning data remain publicly downloadable independently of this screen. Imports, raw exports, timesheets and backups stay local.</p></details></section></main>';
 document.getElementById('authMessage').textContent=message;document.getElementById('authSignIn').addEventListener('click',()=>authAgent?.signIn());document.getElementById('retry').addEventListener('click',()=>location.reload());
}
async function load(){
 release=await current();if(release.schema!==3||release.authPolicy!=='existing-client-ui-gate-public-data')throw Error('Unsupported site release.');
 const code=Object.entries(release.files).filter(([key])=>key!=='planning');await Promise.all(code.map(([,file])=>checked(file)));
 const css=document.createElement('link');css.rel='stylesheet';css.href='./'+release.files.style.path;document.head.append(css);
 const {connectAuth}=await import('./'+release.files.auth.path);gate();
 authAgent=await connectAuth({onClose:gate,onError:error=>gate(error.message||'Authentication is unavailable.'),onOpen:async(user,isCurrent)=>{
  gate('Loading shared planning data…');const bytes=await checked(release.files.planning);if(!isCurrent())return;
  if((await current()).version!==release.version){location.reload();return}
  const snapshot=JSON.parse(new TextDecoder().decode(bytes));if(snapshot.publicationScope!=='current-roster-derived'||snapshot.persons.some(p=>!p.active))throw Error('Unexpected planning roster.');
  if(!isCurrent())return;const app=await import('./'+release.files.app.path);if(!isCurrent())return;const ownStop=app.start(snapshot,release,{user,logout:()=>authAgent?.logout()});sessionStop=ownStop;document.documentElement.dataset.release=release.version;return ()=>{ownStop?.();if(sessionStop===ownStop)sessionStop=null};
 }});
 let updating=false;const update=async()=>{if(updating||!navigator.onLine)return;try{if((await current()).version!==release.version){updating=true;location.reload()}}catch{}};setInterval(update,60000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
}
load().catch(error=>gate(error.message));
