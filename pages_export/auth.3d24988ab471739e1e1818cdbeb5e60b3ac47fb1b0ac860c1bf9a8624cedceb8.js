const firebaseConfig = {
  apiKey: "AIzaSyCYuvMZVE9aTX_95nuZrUiv_pFHbZG_5pY",
  authDomain: "employee-dashboard-aab04.firebaseapp.com",
  projectId: "employee-dashboard-aab04",
  storageBucket: "employee-dashboard-aab04.appspot.com",
  messagingSenderId: "511125736771",
  appId: "1:511125736771:web:cdb9a3dcadcdd23240b3f6",
};
const ALLOWED_USERS = [
  "jswanson@badgerinventory.com",
  "hkraemer@badgerinventory.com",
  "jfalck@badgerinventory.com",
  "spalmer@badgerinventory.com",
  "nbrock@badgerinventory.com",
  "lclark@badgerinventory.com",
  "kgrohall@badgerinventory.com",
  "files@badgerinventory.com",
  "qianabatton@gmail.com",
];
// This reproduces the original interface gate. It does NOT authorize static data files.
export function createGate({allowed,onOpen,onClose,onError,signOut,now=()=>Date.now(),setTimer=setTimeout,clearTimer=clearTimeout}){
 let generation=0,validation=0,timer=null,refreshTimer=null,stop=null,current=null,lastDenial='',expiresAt=0;
 function close(message='Please sign in to continue'){generation++;validation++;clearTimer(timer);clearTimer(refreshTimer);if(stop){stop();stop=null}current=null;expiresAt=0;onClose(message)}
 async function userChanged(user,forceRefresh=false){
  const email=String(user?.email||'').toLowerCase(),same=!!current&&!!user&&current.uid===user.uid&&String(current.email||'').toLowerCase()===email;
  if(!same)close(!user&&lastDenial?lastDenial:'Please sign in to continue');
  const token=generation,check=++validation;if(!user)return;
  if(!allowed.includes(email)){lastDenial='Unauthorized access. Please contact an administrator.';close(lastDenial);await signOut().catch(()=>{});return}
  try{
   const result=await user.getIdTokenResult(forceRefresh),expires=Date.parse(result.expirationTime);
   if(token!==generation||check!==validation)return;
   if(!Number.isFinite(expires)||expires<=now())throw Error('Session expired. Reconnect to restore your sign-in.');
   lastDenial='';expiresAt=expires;clearTimer(timer);clearTimer(refreshTimer);
   refreshTimer=setTimer(()=>userChanged(user,true),Math.max(1000,(expires-now())-Math.min(300000,(expires-now())/2)));
   timer=setTimer(()=>{lastDenial='Session expired. Reconnect to restore your sign-in.';close(lastDenial)},Math.max(0,expires-now()));
   // Firebase refreshes tokens automatically. A refresh must not rebuild the user's plan.
   if(same)return;
   current=user;const cleanup=await onOpen(user,()=>token===generation&&now()<expiresAt);
   if(token!==generation){cleanup?.();return}stop=cleanup;
  }catch(error){if(token===generation&&check===validation){if(same&&now()<expiresAt&&error.code==='auth/network-request-failed'){clearTimer(refreshTimer);refreshTimer=setTimer(()=>userChanged(user,true),Math.max(1000,Math.min(30000,(expiresAt-now())/2)));return;}lastDenial=error.message||'Sign-in could not be verified.';close(lastDenial);onError(error)}}
 }
 return {userChanged,close,logout:async()=>{lastDenial='';close('Signed out.');await signOut().catch(()=>{})},stop:()=>{generation++;validation++;clearTimer(timer);clearTimer(refreshTimer);stop?.();stop=null;current=null}};
}
export async function connectAuth({onOpen,onClose,onError}){
 const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in could not load. Check your connection.'));document.head.append(script)});
 try{
  if(!globalThis.firebase)await load('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
  if(!firebase.auth)await load('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js');
  if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
  const auth=firebase.auth(),provider=new firebase.auth.GoogleAuthProvider();let persistenceNote='';
  try{await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)}catch{await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);persistenceNote=' This browser blocks remembered sign-in; this session lasts until the window closes.'}
  const gate=createGate({allowed:ALLOWED_USERS,onOpen,onClose:message=>onClose(message+persistenceNote),onError,signOut:()=>auth.signOut()});
  let popupPending=false;
  const unsubscribe=auth.onIdTokenChanged(user=>{if(!popupPending)gate.userChanged(user)});
  const resume=()=>{if(!popupPending)gate.userChanged(auth.currentUser)};
  const visible=()=>{if(!document.hidden)resume()};
  globalThis.addEventListener('online',resume);globalThis.addEventListener('focus',resume);document.addEventListener('visibilitychange',visible);
  return {...gate,signIn:async()=>{
   if(popupPending)return;popupPending=true;gate.close('Complete Google sign-in to continue.');
   try{const result=await auth.signInWithPopup(provider);popupPending=false;await gate.userChanged(result.user)}
   catch(error){popupPending=false;if(auth.currentUser){await gate.userChanged(auth.currentUser);return}gate.close();onError(Error(error.code==='auth/popup-closed-by-user'?'Sign-in was cancelled. Select Sign In with Google to try again.':error.code==='auth/popup-blocked'?'Allow pop-ups for this site, then select Sign In with Google.':'Sign-in failed: '+(error.code||'unavailable')))}
  },stop:()=>{unsubscribe();globalThis.removeEventListener('online',resume);globalThis.removeEventListener('focus',resume);document.removeEventListener('visibilitychange',visible);gate.stop()}};
 }catch(error){onError(error);return {signIn:()=>{},logout:()=>{},stop:()=>{}}}
}
export const uiGatePolicy={kind:'firebase-google-client-email-allowlist',protectsStaticData:false,allowlistIsPublic:true};
