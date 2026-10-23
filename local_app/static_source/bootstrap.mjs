// Static public data + the original Firebase interface gate. No data-confidentiality claim.
const sha=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
const legal=/^(?:app|predictor|planner|auth|style|planning)\.[a-f0-9]{64}\.(?:js|css|json(?:\.gz)?)$/;let authAgent=null,sessionStop=null,release=null;
async function current(){const r=await fetch('./release.json',{cache:'no-store'});if(!r.ok)throw Error('The shared site is temporarily unavailable.');return r.json()}
async function checked(file){if(!legal.test(file.path)||!file.path.includes(file.sha256))throw Error('Invalid release filename.');const r=await fetch('./'+file.path,{cache:'no-store'});if(!r.ok)throw Error('The site is updating. Try again shortly.');const bytes=await r.arrayBuffer();if(await sha(bytes)!==file.sha256)throw Error('A site update is incomplete. Please retry.');return bytes}
function gate(message='Please sign in to continue'){
 sessionStop?.();sessionStop=null;delete document.documentElement.dataset.release;
 document.body.innerHTML='<main class="auth-shell"><section class="auth-card"><div class="eyebrow">BADGER · INVENTORY SERVICE, INC.</div><h1>Shift Crew Planner</h1><p id="authMessage" role="status" aria-live="polite"></p><button id="authSignIn" type="button">Sign In with Google</button><button id="retry" type="button">Retry loading</button></section></main>';
 document.getElementById('authMessage').textContent=message;document.getElementById('authSignIn').disabled=!authAgent;document.getElementById('authSignIn').addEventListener('click',()=>authAgent?.signIn());document.getElementById('retry').addEventListener('click',()=>location.reload());
}
async function decodePlanning(bytes,path){
 const text=path.endsWith('.gz')?await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text():new TextDecoder().decode(bytes);
 return JSON.parse(text);
}
async function load(){
 release=await current();if(release.schema!==3||release.authPolicy!=='existing-client-ui-gate-public-data')throw Error('Unsupported site release.');
 const code=Object.entries(release.files).filter(([key])=>key!=='planning');await Promise.all(code.map(([,file])=>checked(file)));
 const css=document.createElement('link');css.rel='stylesheet';css.href='./'+release.files.style.path;document.head.append(css);
 const {connectAuth}=await import('./'+release.files.auth.path);gate('Checking saved sign-in…');
 authAgent=await connectAuth({onClose:gate,onError:error=>gate(error.message||'Authentication is unavailable.'),onOpen:async(user,isCurrent)=>{
  gate('Loading shared planning data…');const bytes=await checked(release.files.planning);if(!isCurrent())return;
  if((await current()).version!==release.version){location.reload();return}
  const snapshot=await decodePlanning(bytes,release.files.planning.path);if(snapshot.publicationScope!=='current-roster-derived'||snapshot.persons.some(p=>!p.active))throw Error('Unexpected planning roster.');
  if(!isCurrent())return;const app=await import('./'+release.files.app.path);if(!isCurrent())return;const ownStop=app.start(snapshot,release,{user,isAuthorized:isCurrent,logout:()=>authAgent?.logout()});sessionStop=ownStop;document.documentElement.dataset.release=release.version;return ()=>{ownStop?.();if(sessionStop===ownStop)sessionStop=null};
 }});
 if(document.getElementById('authSignIn'))document.getElementById('authSignIn').disabled=false;
 let checking=false;const update=async()=>{if(checking||!navigator.onLine||!document.documentElement.dataset.release)return;checking=true;try{if((await current()).version!==release.version&&!document.getElementById('siteUpdateNotice')){const notice=document.createElement('div');notice.id='siteUpdateNotice';notice.className='site-update-notice';notice.setAttribute('role','status');const text=document.createElement('span');text.textContent='An updated predictor is available. Your current plan can stay open.';const button=document.createElement('button');button.type='button';button.textContent='Load update';button.addEventListener('click',()=>location.reload());notice.append(text,button);document.querySelector('main')?.prepend(notice);}}catch{}finally{checking=false}};setInterval(update,60000);window.addEventListener('focus',update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
}
load().catch(error=>gate(error.message));
