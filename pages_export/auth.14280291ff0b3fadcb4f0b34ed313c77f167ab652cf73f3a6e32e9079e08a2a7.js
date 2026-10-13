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
 let generation=0,timer=null,stop=null,current=null,lastDenial='';
 function close(message='Please sign in to continue'){generation++;clearTimer(timer);if(stop){stop();stop=null}current=null;onClose(message)}
 async function userChanged(user){close(!user&&lastDenial?lastDenial:'Please sign in to continue');const token=generation;if(!user)return;const email=String(user.email||'').toLowerCase();if(!allowed.includes(email)){lastDenial='Unauthorized access. Please contact an administrator.';onClose(lastDenial);await signOut().catch(()=>{});return}
  try{lastDenial='';const result=await user.getIdTokenResult(),expires=Date.parse(result.expirationTime);if(!Number.isFinite(expires)||expires<=now())throw Error('Session expired. Please sign in again.');if(token!==generation)return;current=user;const cleanup=await onOpen(user,()=>token===generation);if(token!==generation){cleanup?.();return}stop=cleanup;timer=setTimer(()=>{lastDenial='Session expired. Reconnect and sign in again.';close(lastDenial);signOut().catch(()=>{})},Math.max(0,expires-now()));}
  catch(error){if(token===generation){lastDenial=error.message||'Sign-in could not be verified.';close(lastDenial);onError(error)}}
 }
 return {userChanged,close,logout:async()=>{close('Signed out.');await signOut().catch(()=>{})},stop:()=>{generation++;clearTimer(timer);stop?.();stop=null;current=null}};
}
export async function connectAuth({onOpen,onClose,onError}){
 const load=src=>new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in could not load. Check your connection.'));document.head.append(script)});
 try{if(!globalThis.firebase){await load('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');await load('https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js')}if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);const auth=firebase.auth(),provider=new firebase.auth.GoogleAuthProvider(),gate=createGate({allowed:ALLOWED_USERS,onOpen,onClose,onError,signOut:()=>auth.signOut()});const unsubscribe=auth.onIdTokenChanged(user=>gate.userChanged(user));return {...gate,signIn:()=>auth.signInWithPopup(provider).catch(error=>onError(Error('Sign-in failed: '+(error.code||'unavailable')))),stop:()=>{unsubscribe();gate.stop()}};}catch(error){onError(error);return {signIn:()=>{},logout:()=>{},stop:()=>{}}}
}
export const uiGatePolicy={kind:'firebase-google-client-email-allowlist',protectsStaticData:false,allowlistIsPublic:true};
