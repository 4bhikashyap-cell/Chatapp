// admin.js (type=module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getFirestore, collection, addDoc, setDoc, doc, getDocs } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4xrjmSN0dKUNanTKV1UxjP-Lr9E_aqUE",
  authDomain: "axlchat-629b5.firebaseapp.com",
  databaseURL: "https://axlchat-629b5-default-rtdb.firebaseio.com",
  projectId: "axlchat-629b5",
  storageBucket: "axlchat-629b5.firebasestorage.app",
  messagingSenderId: "37035922930",
  appId: "1:37035922930:web:7148d9204ec3e17906476b",
  measurementId: "G-KYLJJ6E38X"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Allowed IP
const ALLOWED_IP = '157.48.1.179';

const ipStatus = document.getElementById('ipStatus');
const adminUI = document.getElementById('adminUI');
const forbidden = document.getElementById('forbidden');

const devFixedId = document.getElementById('devFixedId');
const devName = document.getElementById('devName');
const btnAddDev = document.getElementById('btnAddDev');
const devList = document.getElementById('devList');

const modTarget = document.getElementById('modTarget');
const modAction = document.getElementById('modAction');
const btnModerate = document.getElementById('btnModerate');

async function checkIPandShow(){
  try{
    const r = await fetch('https://api.ipify.org?format=json');
    const j = await r.json();
    const ip = j.ip;
    ipStatus.textContent = 'Your IP: ' + ip;
    if(ip === ALLOWED_IP){
      adminUI.classList.remove('hidden');
      loadDevelopers();
    } else {
      forbidden.classList.remove('hidden');
    }
  }catch(e){
    ipStatus.textContent = 'Unable to get IP. Maybe offline or blocked.';
    forbidden.classList.remove('hidden');
  }
}
checkIPandShow();

/* Add developer */
btnAddDev.onclick = async ()=>{
  const id = devFixedId.value.trim();
  if(!id){ alert('Enter fixedId or UID'); return; }
  const name = devName.value.trim() || null;
  // we store developer entry; admin can add either uid or fixedId. We'll detect if input looks like UID (length >25) else treat as fixedId
  const docId = `dev_${Date.now()}`;
  const data = {};
  if(id.includes('@') || id.length < 30){
    // treat as fixedId
    data.fixedId = id.toLowerCase();
  } else {
    data.uid = id;
  }
  if(name) data.name = name;
  await setDoc(doc(db,'developers',docId), data);
  devFixedId.value = ''; devName.value = '';
  alert('Developer added');
  loadDevelopers();
};

/* load developers */
async function loadDevelopers(){
  devList.innerHTML = 'Loading...';
  const snap = await getDocs(collection(db,'developers'));
  devList.innerHTML = '';
  snap.forEach(d=>{
    const dd = d.data();
    const el = document.createElement('div');
    el.style.padding = '8px';
    el.style.borderBottom = '1px solid #eee';
    el.innerHTML = `<b>${ dd.name || (dd.fixedId ? '@'+dd.fixedId : dd.uid) }</b> — ${ dd.fixedId ? 'fixedId' : 'uid' }`;
    devList.appendChild(el);
  });
}

/* moderation actions */
btnModerate.onclick = async ()=>{
  const tgt = modTarget.value.trim();
  if(!tgt){ alert('Enter user fixedId or UID'); return; }
  const action = modAction.value;
  // find uid from fixedId (if input not a long uid)
  let targetUid = tgt;
  if(!tgt.includes('@') && tgt.length < 30){
    const q = await getDocs(collection(db,'users'));
    let found = null;
    q.forEach(d=>{
      const u = d.data();
      if(u.fixedId === tgt || u.email === tgt) found = u.uid;
    });
    if(found) targetUid = found;
    else { alert('User with that fixedId not found'); return; }
  }
  if(action === 'ban'){
    await setDoc(doc(db,'moderation',targetUid), { banned:true }, { merge:true });
    alert('User banned');
  } else if(action === 'unban'){
    await setDoc(doc(db,'moderation',targetUid), { banned:false }, { merge:true });
    alert('User unbanned');
  } else if(action.startsWith('mute')){
    let ms = 3600000; //1h default
    if(action === 'mute_24h') ms = 24*3600000;
    const until = new Date(Date.now() + ms);
    await setDoc(doc(db,'moderation',targetUid), { mutedUntil: { seconds: Math.floor(until.getTime()/1000) } }, { merge:true });
    alert('User muted until ' + until.toLocaleString());
  }
};
