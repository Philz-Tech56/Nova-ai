import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, NOVA_API_URL } from "./config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);
let session = null, currentConversationId = null, authMode = "login", busy = false;

function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),3200); }
function showView(view) {
  ["authView","chatView","profileView","vipView"].forEach(id => $(id).classList.add("hidden"));
  $(view+"View").classList.remove("hidden");
  $("sidebar").classList.remove("open");
}
function setAuthMode(mode) {
  authMode=mode;
  $("loginTab").classList.toggle("active",mode==="login");
  $("signupTab").classList.toggle("active",mode==="signup");
  $("authSubmit").textContent=mode==="login"?"Log in":"Create account";
  $("password").autocomplete=mode==="login"?"current-password":"new-password";
  $("authMessage").textContent="";
}
function safeText(el, text) { el.textContent = text ?? ""; }
function addMessage(role, content) {
  $("welcome").classList.add("hidden"); $("messages").classList.remove("hidden");
  const row=document.createElement("article"); row.className="message "+role;
  const avatar=document.createElement("div"); avatar.className="message-avatar"; avatar.textContent=role==="assistant"?"✦":"You";
  const body=document.createElement("div"); body.className="message-body";
  const label=document.createElement("div"); label.className="message-label"; label.textContent=role==="assistant"?"NOVA AI":"YOU";
  const text=document.createElement("div"); text.className="message-text"; text.textContent=content;
  body.append(label,text); row.append(avatar,body); $("messages").append(row); $("messages").scrollTop=$("messages").scrollHeight;
}
function resetChat() { currentConversationId=null; $("messages").replaceChildren(); $("messages").classList.add("hidden"); $("welcome").classList.remove("hidden"); $("messageInput").value=""; }
async function loadConversations() {
  if (!session) return;
  const {data,error}=await supabase.from("conversations").select("id,title,updated_at").order("updated_at",{ascending:false}).limit(40);
  if(error){console.warn(error);return;}
  const list=$("conversationList"); list.replaceChildren();
  if(!data?.length){const p=document.createElement("p");p.className="muted small";p.textContent="No chats yet. Start a new one!";list.append(p);return;}
  data.forEach(item=>{
    const b=document.createElement("button");b.className="conversation-item";b.textContent=item.title||"New chat";
    b.addEventListener("click",()=>openConversation(item.id));list.append(b);
  });
}
async function openConversation(id) {
  const {data,error}=await supabase.from("messages").select("role,content").eq("conversation_id",id).order("created_at",{ascending:true}).limit(100);
  if(error){toast(error.message);return;}
  currentConversationId=id;$("messages").replaceChildren();$("messages").classList.remove("hidden");$("welcome").classList.add("hidden");
  (data||[]).forEach(m=>addMessage(m.role,m.content));showView("chat");
}
async function enterApp(s) {
  session=s; $("profileEmail").textContent=s.user.email||"Signed in"; showView("chat");resetChat();await loadConversations();
}
$("loginTab").addEventListener("click",()=>setAuthMode("login"));
$("signupTab").addEventListener("click",()=>setAuthMode("signup"));
$("authForm").addEventListener("submit",async e=>{
  e.preventDefault();const email=$("email").value.trim(),password=$("password").value;
  $("authSubmit").disabled=true;$("authMessage").textContent="Please wait…";
  try{
    if(authMode==="signup"){
      const {data,error}=await supabase.auth.signUp({email,password});
      if(error)throw error;
      if(data.session) await enterApp(data.session);
      else $("authMessage").textContent="Account created. Check your email to confirm your address, then log in.";
    }else{
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error)throw error;await enterApp(data.session);
    }
  }catch(err){$("authMessage").textContent=err.message||"Could not sign in.";}
  finally{$("authSubmit").disabled=false;}
});
async function signOut(){await supabase.auth.signOut();session=null;resetChat();showView("auth");}
$("signOutBtn").addEventListener("click",signOut);$("profileSignOut").addEventListener("click",signOut);
$("newChatBtn").addEventListener("click",()=>{resetChat();showView("chat");});
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
document.querySelectorAll("[data-back-chat]").forEach(b=>b.addEventListener("click",()=>showView("chat")));
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{$("messageInput").value=b.dataset.prompt;$("messageInput").focus();}));
$("chatForm").addEventListener("submit",async e=>{
  e.preventDefault();if(busy)return;
  const message=$("messageInput").value.trim();if(!message)return;
  if(!session){toast("Please log in first.");showView("auth");return;}
  busy=true;$("sendBtn").disabled=true;$("messageInput").value="";
  addMessage("user",message);
  const pending=document.createElement("div");pending.className="typing";pending.textContent="Nova AI is thinking…";$("messages").append(pending);$("messages").scrollTop=$("messages").scrollHeight;
  try{
    const {data:{session:latest}}=await supabase.auth.getSession();
    const response=await fetch(NOVA_API_URL+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+latest.access_token},body:JSON.stringify({message,conversationId:currentConversationId})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"The request failed.");
    currentConversationId=result.conversationId;pending.remove();addMessage("assistant",result.reply);await loadConversations();
  }catch(err){pending.remove();addMessage("assistant","I couldn't complete that request: "+(err.message||"Please try again."));}
  finally{busy=false;$("sendBtn").disabled=false;$("messageInput").focus();}
});
$("messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("chatForm").requestSubmit();}});
supabase.auth.onAuthStateChange((_event,s)=>{if(s&&!session)enterApp(s);else if(!s&&session){session=null;showView("auth");}});
const {data:{session:existing}}=await supabase.auth.getSession();
if(existing) await enterApp(existing); else showView("auth");
