const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

function prepareInterface() {
  if (!byId("auth-gate")) document.body.insertAdjacentHTML("beforeend", `
    <section class="auth-gate" id="auth-gate"><div class="auth-card">
      <div class="auth-brand"><span class="brand-mark">✳</span>zing</div>
      <h1 id="auth-title">Bienvenue sur Zing</h1><p id="auth-description">Connecte-toi pour retrouver tes conversations privées.</p>
      <form id="auth-form" class="auth-form">
        <label id="username-label" hidden>Nom d’utilisateur<input id="auth-username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" autocomplete="username"></label>
        <label>Adresse e-mail<input id="auth-email" type="email" required autocomplete="email"></label>
        <label>Mot de passe<input id="auth-password" type="password" required minlength="8" autocomplete="current-password"></label>
        <button id="auth-submit" class="auth-submit">Se connecter</button><p id="auth-note" class="auth-note"></p>
      </form><button id="auth-switch" class="auth-switch" type="button">Créer un compte</button>
    </div></section>`);
  for (const [selector, id] of [[".demo-pill","app-status"],[".top-avatar","top-avatar"],[".user-mini .avatar","sidebar-avatar"],[".user-info strong","sidebar-name"],[".user-info small","sidebar-handle"],[".chat-title span:last-child","chat-count"],[".conversation-head > div:nth-child(2) small","active-presence"]]) {
    const el = $(selector); if (el && !el.id) el.id = id;
  }
  if (!byId("sign-out")) {
    const button = Object.assign(document.createElement("button"), { id: "sign-out", className: "sign-out", type: "button", textContent: "Se déconnecter", hidden: true });
    $(".top-actions").insertBefore(button, byId("top-avatar"));
  }
  byId("chat-items")?.replaceChildren();
  const style = document.createElement("style");
  style.textContent = `.auth-gate{position:fixed;inset:0;z-index:20;display:grid;place-items:center;padding:20px;background:#172014aa;backdrop-filter:blur(8px)}.auth-gate[hidden]{display:none}.auth-card{width:min(100%,410px);background:#fff;border-radius:24px;padding:27px;box-shadow:0 24px 80px #14200b44}.auth-brand{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:850;margin-bottom:18px}.auth-card h1{font-size:24px;margin:0 0 7px}.auth-card>p{font-size:12px;color:#858a84;line-height:1.6}.auth-form{display:grid;gap:12px}.auth-form label{display:grid;gap:6px;font-size:11px;font-weight:700}.auth-form input{border:1px solid #e9ebe3;border-radius:11px;padding:12px;font-size:13px}.auth-submit{border:0;border-radius:12px;padding:12px;background:#202321;color:white;font-weight:750}.auth-switch,.sign-out{border:0;background:transparent;color:#536523;font-size:11px;font-weight:700;padding:8px}.auth-note{min-height:18px;font-size:11px;color:#69705f}.auth-note.error{color:#b33838}.sign-out{color:#777}.sign-out[hidden]{display:none}`;
  document.head.append(style);
}
prepareInterface();

const config = window.ZING_CONFIG;
const db = config && window.supabase?.createClient ? window.supabase.createClient(config.url, config.key) : null;
const toast = byId("toast");
function notify(text) { toast.textContent = text; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2600); }
const gate = byId("auth-gate"), form = byId("auth-form"), username = byId("auth-username"), usernameLabel = byId("username-label");
const email = byId("auth-email"), password = byId("auth-password"), authNote = byId("auth-note"), authButton = byId("auth-submit");
const switchButton = byId("auth-switch"), signOut = byId("sign-out"), input = byId("message-input"), send = $("#message-form .send");
const chatItems = byId("chat-items"), emptyChats = byId("empty-chats"), messages = byId("messages"), chatCount = byId("chat-count");let mode = "login", user = null, activeId = null, channel = null, conversations = [], chatRefreshGeneration = 0, ownProfile = null;
const avatar = (name) => ["🧑🏽","👩🏻","🧑🏻","👩🏽","👨🏼","👩🏼"][[...name].reduce((n,c)=>n+c.charCodeAt(0),0)%6];
function setAvatar(element, profile) {
  if (!element) return;
  if (profile?.avatar_display_url) { element.style.backgroundImage = `url("${profile.avatar_display_url.replaceAll('"','%22')}")`; element.classList.add("has-photo"); element.textContent = ""; }
  else { element.style.backgroundImage = ""; element.classList.remove("has-photo"); element.textContent = avatar(profile?.username || profile?.display_name || "zing"); }
}
async function resolveAvatar(profile) {
  if (profile?.avatar_url && !profile.avatar_display_url) { const {data,error}=await db.storage.from("zing-avatars").createSignedUrl(profile.avatar_url,3600); if(!error)profile.avatar_display_url=data.signedUrl; }
  return profile;
}


function setMode(next) {
  mode = next; const signup = mode === "signup";
  byId("auth-title").textContent = signup ? "Créer ton compte" : "Bienvenue sur Zing";
  byId("auth-description").textContent = signup ? "Choisis un nom d’utilisateur pour que tes amis te retrouvent." : "Connecte-toi pour retrouver tes conversations privées.";
  usernameLabel.hidden = !signup; username.required = signup; password.autocomplete = signup ? "new-password" : "current-password";
  authButton.textContent = signup ? "Créer mon compte" : "Se connecter";
  switchButton.textContent = signup ? "J’ai déjà un compte" : "Créer un compte"; authNote.textContent = "";
}
switchButton.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));
function errorText(error) {
  const text = String(error?.message || "Une erreur est survenue.");
  if (/invalid login credentials/i.test(text)) return "E-mail ou mot de passe incorrect.";
  if (/already registered|user already exists/i.test(text)) return "Cette adresse a déjà un compte. Connecte-toi.";
  if (/duplicate key|username/i.test(text)) return "Ce nom d’utilisateur est déjà pris.";
  return text;
}
form.addEventListener("submit", async (event) => {
  event.preventDefault(); if (!db) return;
  authButton.disabled = true; authNote.classList.remove("error"); authNote.textContent = "Connexion…";
  try {
    let result;
    if (mode === "signup") result = await db.auth.signUp({ email: email.value.trim(), password: password.value, options: { data: { username: username.value.trim().toLowerCase(), display_name: username.value.trim().toLowerCase() } } });
    else result = await db.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
    if (result.error) throw result.error;
    if (mode === "signup" && !result.data.session) { authNote.textContent = "Compte créé. Vérifie tes e-mails pour confirmer ton adresse."; form.reset(); }
  } catch (error) { authNote.textContent = errorText(error); authNote.classList.add("error"); }
  finally { authButton.disabled = false; }
});

function signedOut() {
  chatRefreshGeneration++;
  user = null; ownProfile = null; activeId = null; conversations = []; if (channel) db?.removeChannel(channel); channel = null;
  gate.hidden = false; signOut.hidden = true; byId("app-status").textContent = "✳ Messages privés";
  byId("sidebar-name").textContent = "Invité"; byId("sidebar-handle").textContent = "Connecte-toi pour discuter";
  byId("sidebar-avatar").textContent = byId("top-avatar").textContent = byId("mobile-profile").textContent = "👋";
  chatItems.replaceChildren(); document.querySelector(".chat-layout")?.classList.remove("conversation-open"); chatCount.textContent = "0 contact"; emptyChats.style.display = "block";
  document.querySelectorAll(".nav-button .badge").forEach(badge=>{badge.textContent="0";badge.hidden=true;});
  emptyChats.textContent = "Connecte-toi pour retrouver tes contacts.";
  messages.innerHTML = '<div class="day-label">Connecte-toi pour démarrer une conversation privée.</div>';
  byId("active-name").textContent = "Tes messages"; byId("active-presence").textContent = "Tes conversations privées apparaîtront ici.";
  input.disabled = send.disabled = true;
}
async function signedIn(session) {
  if (!session?.user || !db || user?.id === session.user.id) return; user = session.user;
  let { data, error } = await db.from("profiles").select("id,username,display_name,avatar_url").eq("id",user.id).maybeSingle();
  if(error && /avatar_url/i.test(error.message||"")){ const legacy=await db.from("profiles").select("id,username,display_name").eq("id",user.id).maybeSingle(); data=legacy.data; error=legacy.error; }
  if (error) return notify("Impossible de charger ton profil.");
  const profile = await resolveAvatar(data || { username: user.email.split("@")[0], display_name: user.email.split("@")[0] }); ownProfile = profile;
  gate.hidden = true; signOut.hidden = false; byId("app-status").textContent = "✳ Messages privés activés";
  byId("sidebar-name").textContent = $(".profile-name h2").textContent = profile.display_name || profile.username;
  byId("sidebar-handle").textContent = `@${profile.username}`; [byId("sidebar-avatar"),byId("top-avatar"),byId("mobile-profile"),byId("profile-avatar")].forEach(el=>setAvatar(el,profile));
  $(".profile-handle").textContent = `@${profile.username} · membre Zing`;
  await refreshChats();
}
signOut.addEventListener("click", async () => { const { error } = await db.auth.signOut(); if (error) notify(errorText(error)); });

async function refreshChats() {
  const generation=++chatRefreshGeneration, requestedUserId=user?.id;
  if(!requestedUserId)return;
  const own = await db.from("conversation_members").select("conversation_id").eq("user_id",requestedUserId);
  if(generation!==chatRefreshGeneration||user?.id!==requestedUserId)return;
  if (own.error) return notify("Impossible de charger les conversations.");
  const ids = [...new Set(own.data.map(row => row.conversation_id))];
  if (!ids.length) { chatItems.replaceChildren();document.querySelector(".chat-layout")?.classList.remove("conversation-open");conversations=[];activeId=null;chatCount.textContent="0 contact"; emptyChats.textContent="Aucun contact pour le moment. Appuie sur « Nouveau message » pour trouver un membre."; emptyChats.style.display="block"; messages.innerHTML='<div class="day-label">Tes messages privés apparaîtront ici.</div>'; input.disabled=send.disabled=true;return; }
  const [members, latest] = await Promise.all([
    db.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids),
    db.from("messages").select("conversation_id,content,created_at,sender_id").in("conversation_id",ids).order("created_at",{ascending:false}).limit(100)
  ]);
  if(generation!==chatRefreshGeneration||user?.id!==requestedUserId)return;
  if (members.error || latest.error) return notify("Impossible de lire tes conversations.");
  const otherIds=[...new Set(members.data.filter(row=>row.user_id!==user.id).map(row=>row.user_id))];
  let profiles=await db.from("profiles").select("id,username,display_name,avatar_url").in("id",otherIds);
  if(profiles.error && /avatar_url/i.test(profiles.error.message||"")) profiles=await db.from("profiles").select("id,username,display_name").in("id",otherIds);
  if(!profiles.error) await Promise.all(profiles.data.map(resolveAvatar));
  if(generation!==chatRefreshGeneration||user?.id!==requestedUserId)return;
  if (profiles.error) return notify("Impossible de lire les profils.");
  const byUser=new Map(profiles.data.map(p=>[p.id,p]));
  const byChat=new Map(); members.data.forEach(row=>{if(row.user_id!==user.id)byChat.set(row.conversation_id,byUser.get(row.user_id));});
  const preview=new Map(); latest.data.forEach(row=>{if(!preview.has(row.conversation_id))preview.set(row.conversation_id,row);});
  const newestByContact=new Map();
  ids.forEach(id=>{
    const profile=byChat.get(id); if(!profile)return;
    const candidate={id,profile,latest:preview.get(id)};
    const contactKey=(profile.username||profile.display_name||profile.id).trim().toLowerCase();
    const previous=newestByContact.get(contactKey);
    const candidateTime=Date.parse(candidate.latest?.created_at||0)||0;
    const previousTime=Date.parse(previous?.latest?.created_at||0)||0;
    if(!previous||candidateTime>previousTime)newestByContact.set(contactKey,candidate);
  });
  conversations=[...newestByContact.values()].sort((a,b)=>(Date.parse(b.latest?.created_at||0)||0)-(Date.parse(a.latest?.created_at||0)||0));
  chatItems.replaceChildren();activeId=null;document.querySelector(".chat-layout")?.classList.remove("conversation-open");
  chatCount.textContent=`${conversations.length} contact${conversations.length===1?"":"s"}`; emptyChats.style.display=conversations.length?"none":"block";
  document.querySelectorAll(".nav-button .badge").forEach(badge=>{badge.textContent=String(conversations.length);badge.hidden=!conversations.length;});
  conversations.forEach(c=>{
    const name=c.profile.display_name||c.profile.username, row=document.createElement("button"), face=document.createElement("span"), copy=document.createElement("span"), title=document.createElement("strong"), previewText=document.createElement("small"), time=document.createElement("time"), status=document.createElement("span");
    row.type="button"; row.className="chat-row"; row.dataset.chat=c.id; row.dataset.name=name; face.className="avatar"; setAvatar(face,c.profile);
    copy.className="chat-copy"; title.textContent=name; status.className=`chat-status-icon${c.latest?.sender_id===user.id?" sent":""}`; status.textContent=c.latest?.sender_id===user.id?"▷":"▢";
    previewText.append(status,document.createTextNode(c.latest?`${c.latest.sender_id===user.id?"Envoyé":"Reçu"} · ${c.latest.content}`:"Commencez à discuter")); copy.append(title,previewText);
    if(c.latest?.created_at){time.className="chat-meta";time.dateTime=c.latest.created_at;const age=Math.max(0,Date.now()-new Date(c.latest.created_at).getTime());time.textContent=age<60_000?"à l’instant":age<3_600_000?`${Math.max(1,Math.floor(age/60_000))} min`:age<86_400_000?`${Math.floor(age/3_600_000)} h`:new Intl.DateTimeFormat("fr-FR",{day:"numeric",month:"short"}).format(new Date(c.latest.created_at));}
    row.append(face,copy);if(time.textContent)row.append(time);
    row.addEventListener("click",()=>openChat(c.id)); chatItems.append(row);
  });
  if(conversations.length&&window.matchMedia("(min-width:761px)").matches) await openChat(conversations[0].id);
}
async function openChat(id) {
  activeId=id; const c=conversations.find(item=>item.id===id); if(!c)return;
  document.querySelector(".chat-layout")?.classList.add("conversation-open");
  chatItems.querySelectorAll(".chat-row").forEach(row=>row.classList.toggle("selected",row.dataset.chat===id));
  const name=c.profile.display_name||c.profile.username; byId("active-name").textContent=name; byId("active-avatar").textContent=avatar(name); setAvatar(byId("active-avatar"),c.profile);
  byId("active-presence").textContent=`@${c.profile.username} · conversation privée`; input.disabled=send.disabled=false;
  const result=await db.from("messages").select("id,sender_id,content,created_at,conversation_id").eq("conversation_id",id).order("created_at",{ascending:true}).limit(100);
  if(result.error)return notify("Impossible de charger les messages."); messages.replaceChildren();
  if(!result.data.length){const hint=document.createElement("div");hint.className="day-label";hint.textContent="Dites-vous bonjour 👋";messages.append(hint);}
  result.data.forEach(drawMessage);
  if(channel)db.removeChannel(channel);
  channel=db.channel(`zing-${id}`).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`conversation_id=eq.${id}`},event=>drawMessage(event.new)).subscribe();
}
function drawMessage(m) {
  if(messages.querySelector(`[data-message-id="${CSS.escape(m.id)}"]`))return;
  const mine=m.sender_id===user?.id,c=conversations.find(item=>item.id===m.conversation_id),name=c?.profile.display_name||c?.profile.username||"Ami";
  const wrap=document.createElement("div"),bubble=document.createElement("div"),text=document.createElement("span"),time=document.createElement("small");
  wrap.className=`message${mine?" mine":""}`; wrap.dataset.messageId=m.id;
  if(!mine){const face=document.createElement("div");face.className="avatar";face.textContent=avatar(name);wrap.append(face);}
  bubble.className="bubble";text.textContent=m.content;time.textContent=new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit"}).format(new Date(m.created_at));bubble.append(text,time);wrap.append(bubble);messages.append(wrap);messages.scrollTop=messages.scrollHeight;
}
const messageForm=byId("message-form");
messageForm.addEventListener("submit",async event=>{
  event.preventDefault();event.stopImmediatePropagation();const content=input.value.trim();if(!content||!activeId||!user)return;
  send.disabled=true;const result=await db.from("messages").insert({conversation_id:activeId,sender_id:user.id,content}).select("id,sender_id,content,created_at,conversation_id").single();send.disabled=false;
  if(result.error)return notify("Le message n’a pas pu être envoyé.");input.value="";drawMessage(result.data);
  const preview=chatItems.querySelector(`[data-chat="${CSS.escape(activeId)}"] small`);if(preview){const marker=preview.querySelector(".chat-status-icon");if(marker){marker.classList.add("sent");marker.textContent="▷";}preview.replaceChildren(...(marker?[marker]:[]),document.createTextNode(`Envoyé · ${content}`));}
},true);
$("#chat-search").addEventListener("input",event=>{
  event.stopImmediatePropagation();const q=event.currentTarget.value.trim().toLowerCase();let count=0;
  chatItems.querySelectorAll(".chat-row").forEach(row=>{row.hidden=!row.dataset.name.toLowerCase().includes(q);if(!row.hidden)count++;});emptyChats.style.display=count?"none":"block";
},true);
byId("new-message").addEventListener("click",async event=>{
  event.stopImmediatePropagation();if(!user)return notify("Connecte-toi pour commencer une conversation.");
  const value=window.prompt("Quel est le nom d’utilisateur de ton ami ?");if(!value)return;
  const found=await db.from("profiles").select("id").eq("username",value.trim().replace(/^@/,"").toLowerCase()).maybeSingle();
  if(found.error||!found.data)return notify("Aucun membre trouvé avec ce nom.");
  const result=await db.rpc("create_zing_direct_conversation",{target_user_id:found.data.id});
  if(result.error)return notify("Impossible de créer cette conversation.");await refreshChats();await openChat(result.data);
},true);
$(".more").addEventListener("click",()=>document.querySelector('[data-screen="profil"]').click());
byId("mobile-profile").addEventListener("click",()=>document.querySelector('[data-screen="profil"]').click());
byId("mobile-search").addEventListener("click",()=>{const list=document.querySelector(".chat-list");list.classList.toggle("search-open");if(list.classList.contains("search-open"))byId("chat-search").focus();});
byId("mobile-add").addEventListener("click",()=>byId("new-message").click());
byId("mobile-compose").addEventListener("click",()=>byId("new-message").click());
byId("back-to-chats").addEventListener("click",()=>document.querySelector(".chat-layout")?.classList.remove("conversation-open"));
byId("friends-button").addEventListener("click",()=>byId("new-message").click());
byId("camera-button").addEventListener("click",()=>notify("La caméra Zing arrive bientôt."));
document.querySelectorAll("[data-screen]").forEach(button=>button.addEventListener("click",()=>{
  const screen=button.dataset.screen;
  document.querySelectorAll(".screen").forEach(panel=>panel.classList.toggle("active",panel.id===`screen-${screen}`));
  document.querySelectorAll("[data-screen]").forEach(item=>item.classList.toggle("active",item.dataset.screen===screen));
  document.querySelector(".chat-layout")?.classList.remove("conversation-open");
  const label=screen==="carte"?"Carte":screen==="profil"?"Profil":"Chat";
  byId("crumb-label").textContent=label;
}));

if(!db){authButton.disabled=true;authNote.textContent="La connexion n’est pas encore configurée.";authNote.classList.add("error");}
else{
  signedOut();
  db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>session?signedIn(session):signedOut(),0));
  db.auth.getSession().then(({data})=>data.session&&signedIn(data.session));
}if(!byId("profile-dialog"))document.body.insertAdjacentHTML("beforeend",`<dialog id="profile-dialog" class="profile-dialog"><form id="profile-form"><h2>Modifier mon profil</h2><label for="profile-username">Pseudo</label><input id="profile-username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required><label for="profile-photo">Photo de profil</label><input id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small>Photo privée aux membres connectés · 2 Mo maximum.</small><div class="dialog-actions"><button type="button" id="cancel-profile">Annuler</button><button type="submit" id="save-profile">Enregistrer</button></div></form></dialog>`);
const desktopStyle=document.createElement("style");desktopStyle.textContent=`@media(min-width:761px){body:has(#screen-messagerie.active){height:100dvh;overflow:hidden}.app{height:100dvh;min-height:0;max-width:none;padding:12px;gap:12px;grid-template-columns:72px minmax(0,1fr)}.sidebar{height:calc(100dvh - 24px);min-height:0;top:12px;padding:22px 10px}.brand{justify-content:center;padding:0 0 29px;font-size:0}.brand-mark{font-size:19px}.nav-label,.privacy-mini,.user-info,.more{display:none}.nav-list{gap:10px}.nav-button{height:54px;justify-content:center;padding:8px 3px;font-size:0;position:relative}.nav-icon{font-size:21px}.nav-button .badge{position:absolute;right:4px;top:4px;font-size:8px;padding:2px 5px}.sidebar-bottom{margin-top:auto}.user-mini{justify-content:center;padding:14px 0 0}.workspace{height:calc(100dvh - 24px);min-height:0;display:flex;flex-direction:column}.topbar{height:58px;min-height:58px;padding:0 22px}.screen.active#screen-messagerie{height:calc(100% - 58px);min-height:0;padding:19px 22px 20px;display:flex;flex-direction:column;overflow:hidden}.screen.active#screen-messagerie .page-heading{margin-bottom:14px;align-items:center}.screen.active#screen-messagerie .eyebrow{margin-bottom:4px}.screen.active#screen-messagerie .page-heading h1{font-size:22px}.screen.active#screen-messagerie .page-heading p{font-size:11px}.chat-layout{height:auto;min-height:0;flex:1;grid-template-columns:300px minmax(0,1fr);border-radius:18px}.chat-list{padding:14px 12px}.chat-panel{min-height:0}.messages{padding:24px clamp(20px,5vw,74px)}.chat-row{min-height:72px}.chat-copy strong{font-size:12px}.chat-copy small{font-size:10px}.back-to-chats{display:none}}.avatar,.profile-avatar,.top-avatar,.mobile-profile{background-size:cover;background-position:center;background-repeat:no-repeat}.has-photo{color:transparent!important}.profile-dialog{width:min(420px,calc(100% - 28px));border:1px solid #e9ebe3;border-radius:20px;padding:24px;box-shadow:0 24px 80px #14200b44}.profile-dialog::backdrop{background:#17201488;backdrop-filter:blur(4px)}.profile-dialog h2{margin:0 0 18px;font-size:19px}.profile-dialog label{display:block;margin:13px 0 7px;font-size:12px;font-weight:700}.profile-dialog input{width:100%;border:1px solid #e9ebe3;border-radius:10px;padding:11px}.profile-dialog small{display:block;color:#858a84;font-size:11px;line-height:1.5;margin-top:12px}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}.dialog-actions button{border:0;border-radius:10px;padding:10px 14px;font-weight:700}.dialog-actions #cancel-profile{background:#f1f3eb}.dialog-actions #save-profile{background:#202321;color:#fff}`;document.head.append(desktopStyle);const ownAvatarElement=document.querySelector(".profile-avatar");if(ownAvatarElement)ownAvatarElement.id="profile-avatar";



const profileDialog=byId("profile-dialog"),profileForm=byId("profile-form"),profileUsername=byId("profile-username"),profilePhoto=byId("profile-photo");
byId("edit-profile").addEventListener("click",()=>{if(!user||!ownProfile)return notify("Connecte-toi pour modifier ton profil.");profileUsername.value=ownProfile.username||"";profilePhoto.value="";profileDialog.showModal();});
byId("cancel-profile").addEventListener("click",()=>profileDialog.close());
profileForm.addEventListener("submit",async event=>{event.preventDefault();if(!user||!ownProfile)return;const next=profileUsername.value.trim().replace(/^@/,"").toLowerCase(),file=profilePhoto.files?.[0];if(!/^[a-z0-9_]{3,24}$/.test(next))return notify("Pseudo invalide : 3 à 24 lettres, chiffres ou _.");if(file&&(!file.type.startsWith("image/")||file.size>2097152))return notify("Choisis une image de 2 Mo maximum.");const button=byId("save-profile");button.disabled=true;try{const changes={username:next,display_name:next};if(file){const ext=({"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"})[file.type];if(!ext)return notify("Format d’image non pris en charge.");const path=user.id+"/profile."+ext;const uploaded=await db.storage.from("zing-avatars").upload(path,file,{upsert:true,contentType:file.type});if(uploaded.error)throw uploaded.error;changes.avatar_url=path;}let saved=await db.from("profiles").update(changes).eq("id",user.id).select("id,username,display_name,avatar_url").single();if(saved.error&&/avatar_url/i.test(saved.error.message||"")){delete changes.avatar_url;saved=await db.from("profiles").update(changes).eq("id",user.id).select("id,username,display_name").single();}if(saved.error)throw saved.error;ownProfile=await resolveAvatar(saved.data);byId("sidebar-name").textContent=$(".profile-name h2").textContent=ownProfile.display_name;byId("sidebar-handle").textContent="@"+ownProfile.username;$(".profile-handle").textContent="@"+ownProfile.username+" · membre Zing";[byId("profile-avatar"),byId("sidebar-avatar"),byId("top-avatar"),byId("mobile-profile")].forEach(el=>setAvatar(el,ownProfile));profileDialog.close();notify("Profil mis à jour.");}catch(error){notify(/duplicate key|unique/i.test(String(error.message))?"Ce pseudo est déjà utilisé.":"Impossible d’enregistrer. Vérifie le stockage des photos.");}finally{button.disabled=false;}});
