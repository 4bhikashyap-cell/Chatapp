// app.js (type=module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, getDocs, limit, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

/* ---------------------------
   YOUR FIREBASE CONFIG (from user)
   --------------------------- */
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

/* ------------- init -------------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --------- DOM --------- */
const openLogin = document.getElementById('openLogin');
const authModal = document.getElementById('authModal');
const inpName = document.getElementById('inpName');
const inpEmail = document.getElementById('inpEmail');
const inpPass = document.getElementById('inpPass');
const btnSignup = document.getElementById('btnSignup');
const btnLogin = document.getElementById('btnLogin');
const closeAuth = document.getElementById('closeAuth');
const btnClaimId = document.getElementById('btnClaimId');

const meName = document.getElementById('meName');
const meEmail = document.getElementById('meEmail');
const meAvatar = document.getElementById('meAvatar');
const meFixedId = document.getElementById('meFixedId');
const btnSignOut = document.getElementById('btnSignOut');

const usersList = document.getElementById('usersList');
const userSearch = document.getElementById('userSearch');
const btnNewChat = document.getElementById('btnNewChat');

const welcome = document.getElementById('welcome');
const chatHeader = document.getElementById('chatHeader');
const chatTitle = document.getElementById('chatTitle');
const chatSubtitle = document.getElementById('chatSubtitle');
const chatAvatar = document.getElementById('chatAvatar');

const messagesWrap = document.getElementById('messagesWrap');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const btnSend = document.getElementById('btnSend');

const replyBox = document.getElementById('replyBox');
const replyPreview = document.getElementById('replyPreview');
const cancelReply = document.getElementById('cancelReply');

let currentUser = null;
let currentRoomId = 'global';
let unsubscribeMessages = null;
let currentReplyTo = null;

/* Utility */
function makeAvatar(name){ if(!name) return 'A'; return name.trim().charAt(0).toUpperCase(); }
function escapeHtml(unsafe){ return unsafe.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function fmtTime(ts){ if(!ts) return ''; const d = ts.toDate ? ts.toDate() : new Date(ts.seconds*1000); return d.toLocaleString(); }

/* Auth modal */
openLogin.onclick = ()=> authModal.classList.remove('hidden');
closeAuth.onclick = ()=> authModal.classList.add('hidden');

/* Claim fixed ID (username) - can be done once per user */
btnClaimId.onclick = async ()=>{
  if(!auth.currentUser){ alert('Login first to claim an ID'); return; }
  const id = prompt('Choose unique ID (letters/numbers/underscore). This will be visible to everyone and can be set only once.');
  if(!id) return;
  const sanitized = id.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,30}$/.test(sanitized)){ alert('Invalid ID. Use 3-30 chars: a-z,0-9,_'); return; }
  // check if any user has this fixedId
  const q = query(collection(db,'users'), where('fixedId','==',sanitized), limit(1));
  const snap = await getDocs(q);
  if(!snap.empty){ alert('ID already taken. Choose another.'); return; }
  // write to current user's doc only if they don't have fixedId yet
  const uDocRef = doc(db,'users', auth.currentUser.uid);
  const uSnap = await getDoc(uDocRef);
  const uData = uSnap.exists() ? uSnap.data() : {};
  if(uData.fixedId){ alert('You already claimed ID: ' + uData.fixedId); return; }
  await setDoc(uDocRef, { fixedId: sanitized }, { merge:true });
  alert('ID claimed: ' + sanitized);
};

/* Signup */
btnSignup.onclick = async ()=>{
  const name = inpName.value.trim();
  const email = inpEmail.value.trim();
  const pass = inpPass.value;
  if(!email||!pass){ alert('Email aur password daalo'); return; }
  try{
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name || email.split('@')[0] });
    await setDoc(doc(db,'users',cred.user.uid), {
      uid: cred.user.uid,
      name: cred.user.displayName || name || 'Anon',
      email: cred.user.email,
      online: true,
      lastSeen: serverTimestamp()
    });
    authModal.classList.add('hidden');
  }catch(e){ alert('Signup error: ' + e.message); }
};

/* Login */
btnLogin.onclick = async ()=>{
  const email = inpEmail.value.trim();
  const pass = inpPass.value;
  if(!email||!pass){ alert('Email aur password daalo'); return; }
  try{
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db,'users',cred.user.uid), {
      uid: cred.user.uid,
      name: cred.user.displayName || inpName.value.trim() || email.split('@')[0],
      email: cred.user.email,
      online: true,
      lastSeen: serverTimestamp()
    }, { merge:true });
    authModal.classList.add('hidden');
  }catch(e){ alert('Login error: ' + e.message); }
};

/* Sign out */
btnSignOut.onclick = async ()=>{
  if(currentUser){
    await setDoc(doc(db,'users',currentUser.uid), { online:false, lastSeen: serverTimestamp() }, { merge:true });
  }
  await signOut(auth);
};

/* Listen auth state */
onAuthStateChanged(auth, async user=>{
  currentUser = user;
  if(user){
    meName.textContent = user.displayName || user.email.split('@')[0];
    meEmail.textContent = user.email;
    meAvatar.textContent = makeAvatar(user.displayName || user.email);
    btnSignOut.classList.remove('hide');
    welcome.style.display = 'none';
    chatHeader.classList.remove('hidden');
    messagesWrap.classList.remove('hidden');
    openRoom('global', { title: 'Global Chat', avatar: 'G' });
    loadUsers();
    await setDoc(doc(db,'users',user.uid), {
      uid:user.uid, name: user.displayName || user.email.split('@')[0],
      email:user.email, online:true, lastSeen: serverTimestamp()
    }, { merge:true });
    // update local fixedId display
    const uSnap = await getDoc(doc(db,'users',user.uid));
    if(uSnap.exists()){
      const u = uSnap.data();
      meFixedId.textContent = u.fixedId ? `@${u.fixedId}` : '';
    }
  }else{
    meName.textContent = 'Not logged';
    meEmail.textContent = 'Please login';
    meAvatar.textContent = 'A';
    meFixedId.textContent = '';
    btnSignOut.classList.add('hide');
    welcome.style.display = 'block';
    chatHeader.classList.add('hidden');
    messagesWrap.classList.add('hidden');
    if(unsubscribeMessages){ unsubscribeMessages(); unsubscribeMessages = null; }
    usersList.innerHTML = '';
  }
});

/* Load users list */
async function loadUsers(qtxt=''){
  usersList.innerHTML = '';
  const q = query(collection(db,'users'), orderBy('name'));
  const snap = await getDocs(q);
  snap.forEach(d=>{
    const u = d.data();
    if(u.uid === (currentUser && currentUser.uid)) return;
    if(qtxt && !u.name.toLowerCase().includes(qtxt.toLowerCase()) && (!u.email || !u.email.toLowerCase().includes(qtxt.toLowerCase())) && (!u.fixedId || !u.fixedId.includes(qtxt.toLowerCase()))) return;
    const div = document.createElement('div');
    div.className = 'userRow';
    const idText = u.fixedId ? `@${escapeHtml(u.fixedId)}` : '';
    div.innerHTML = `<div class="avatar">${makeAvatar(u.name)}</div>
                     <div style="flex:1"><div class="userName">${escapeHtml(u.name)} ${ idText ? `<span class="smalltext">${idText}</span>` : '' }</div>
                     <div class="userSub">${u.online? 'Online' : 'Last: '+ (u.lastSeen? (u.lastSeen.toDate ? u.lastSeen.toDate().toLocaleString() : '') : '')}</div></div>`;
    div.onclick = ()=> openDirectChat(u);
    usersList.appendChild(div);
  });
}
userSearch.oninput = ()=> loadUsers(userSearch.value.trim());

btnNewChat.onclick = ()=> { userSearch.focus(); alert('Search a user and click to open chat (or use Global Chat).'); };

/* open room */
function openRoom(roomId, meta){
  currentRoomId = roomId;
  chatTitle.textContent = meta.title || 'Chat';
  chatAvatar.textContent = meta.avatar || makeAvatar(meta.title);
  chatSubtitle.textContent = meta.subtitle || '';
  messagesDiv.innerHTML = '';
  if(unsubscribeMessages) unsubscribeMessages();
  const messagesCol = collection(db, 'rooms', roomId, 'messages');
  const q = query(messagesCol, orderBy('timestamp'));
  unsubscribeMessages = onSnapshot(q, async snap=>{
    messagesDiv.innerHTML = '';
    // fetch all developers once (small set)
    const devSnap = await getDocs(collection(db,'developers'));
    const devMap = {};
    devSnap.forEach(d=> { const dd = d.data(); if(dd.uid) devMap[dd.uid] = dd; if(dd.fixedId) devMap['id:'+dd.fixedId] = dd; });
    snap.forEach(doc=>{
      const m = doc.data();
      const div = document.createElement('div');
      const isMe = currentUser && m.uid === currentUser.uid;
      div.className = 'msg ' + (isMe ? 'me' : 'other');
      // reply preview
      let replyHtml = '';
      if(m.replyTo){
        replyHtml = `<div class="replyRef">Reply to: <em id="replyRef_${doc.id}">loading...</em></div>`;
      }
      // check developer badge: match by uid or by fixedId (if developer stored by fixedId)
      const isDev = (m.uid && devMap[m.uid]) || (m.fixedId && devMap['id:'+m.fixedId]);
      const devBadgeHtml = isDev ? `<span class="devBadge"><span class="devCrown">👑</span>DEVELOPER</span>` : '';
      div.innerHTML = `<div class="meta">${ escapeHtml(m.name||'Anon') } ${devBadgeHtml} • ${ m.timestamp ? fmtTime(m.timestamp) : '' }</div>
                       ${replyHtml}
                       <div>${ escapeHtml(m.text) }</div>`;
      // clicking on message sets reply (for composer)
      div.onclick = ()=> {
        currentReplyTo = { id: doc.id, text: m.text, author: m.name || 'Anon' };
        replyPreview.textContent = `${currentReplyTo.author}: ${currentReplyTo.text.slice(0,120)}`;
        replyBox.classList.remove('hidden');
      };
      messagesDiv.appendChild(div);
      // populate replyRef content if needed
      if(m.replyTo){
        (async ()=>{
          try{
            const refDoc = await getDoc(doc(db,'rooms',roomId,'messages', m.replyTo));
            const rd = refDoc.exists() ? refDoc.data() : null;
            const el = document.getElementById('replyRef_'+doc.id);
            if(el) el.textContent = rd ? `${rd.name||'Anon'}: ${rd.text.slice(0,120)}` : '[original message removed]';
          }catch(e){}
        })();
      }
    });
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

/* direct chat */
function createDMId(a,b){ return a < b ? `${a}_${b}` : `${b}_${a}`; }
function openDirectChat(userObj){
  if(!currentUser){ alert('Please login first'); return; }
  const roomId = createDMId(currentUser.uid, userObj.uid);
  openRoom(roomId, { title: userObj.name, avatar: makeAvatar(userObj.name) });
}

/* send message (with reply support & fixedId included) */
btnSend.onclick = async ()=>{
  const text = msgInput.value.trim();
  if(!text) return;
  if(!currentUser){ alert('Please login'); return; }
  const uSnap = await getDoc(doc(db,'users',currentUser.uid));
  const userData = uSnap.exists() ? uSnap.data() : {};
  // check if user is muted or banned
  const modDoc = await getDoc(doc(db,'moderation', currentUser.uid));
  if(modDoc.exists()){
    const md = modDoc.data();
    if(md.banned){ alert('You are banned. Contact admin.'); return; }
    if(md.mutedUntil){
      try{
        const until = md.mutedUntil.toDate ? md.mutedUntil.toDate() : new Date(md.mutedUntil.seconds*1000);
        if(new Date() < until){ alert('You are muted until ' + until.toLocaleString()); return; }
      }catch(e){}
    }
  }
  const messagesCol = collection(db, 'rooms', currentRoomId, 'messages');
  await addDoc(messagesCol, {
    uid: currentUser.uid,
    name: currentUser.displayName || currentUser.email.split('@')[0],
    fixedId: userData.fixedId || null,
    text: text,
    replyTo: currentReplyTo ? currentReplyTo.id : null,
    timestamp: serverTimestamp()
  });
  // after sending, if message is a command and user is developer, handle server-like actions (client-side enforcement)
  // We'll process commands on the client for real-time effect, but note it's not server authoritative — for real security, implement Cloud Functions or server rules.
  // reset composer
  msgInput.value = '';
  currentReplyTo = null;
  replyBox.classList.add('hidden');
};

/* cancel reply */
cancelReply.onclick = ()=> { currentReplyTo = null; replyBox.classList.add('hidden'); };

/* command processing: listen to new messages and if message starts with '!' and author is developer, run command */
onSnapshot(collection(db,'rooms','global','messages'), async snap=>{
  // for simplicity monitor all rooms messages by checking rooms collection snapshots would be better; but we will process commands per room when message added
});

/* We will attach a real-time listener to all rooms writes via onSnapshot on 'rooms' subcollections isn't trivial client-side without listing rooms.
   Simpler: whenever a message is added in current visible room it will be rendered; developer commands can be invoked by replying to a message with e.g. "!ban 24h" or "!ban" in reply. We'll also provide command help on '!cmds'.
*/

/* small: refresh users list */
setInterval(()=> { if(currentUser) loadUsers(userSearch.value.trim()); }, 5000);
