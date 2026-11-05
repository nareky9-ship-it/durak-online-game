const socket=io();
const $=id=>document.getElementById(id);
let profile={name:"Player",avatar:"🦊",coins:1000}, privacy="public", mode="fair", game=null, selectedCard=null, countdown=null;
const suitRed=s=>s==="♥"||s==="♦";
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2600)}
function showScreen(id){document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));$(id).classList.add("active")}
function showModal(id){$(id).classList.remove("hidden")}
function hideModal(id){$(id).classList.add("hidden")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>hideModal(b.dataset.close));
$("createBtn").onclick=()=>showModal("createModal");
$("profileBtn").onclick=()=>{ $("playerName").value=profile.name; showModal("profileModal"); };
document.querySelectorAll("[data-privacy]").forEach(b=>b.onclick=()=>{privacy=b.dataset.privacy;document.querySelectorAll("[data-privacy]").forEach(x=>x.classList.toggle("selected",x===b));});
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("selected",x===b));});
let pickedAvatar="🦊";
document.querySelectorAll(".avatar-picker button").forEach(b=>b.onclick=()=>{pickedAvatar=b.textContent;document.querySelectorAll(".avatar-picker button").forEach(x=>x.classList.toggle("selected",x===b));});
$("saveProfile").onclick=()=>{profile.name=$("playerName").value.trim()||"Player";profile.avatar=pickedAvatar;socket.emit("profile:set",profile);$("profileBtn").textContent=profile.avatar;hideModal("profileModal");};
socket.emit("profile:set",profile);
socket.on("profile:ok",p=>{profile={...profile,...p};$("coinCount").textContent=Number(profile.coins||1000).toLocaleString();});
$("confirmCreate").onclick=()=>{socket.emit("room:create",{privacy,mode,deckSize:Number($("deckSize").value),bet:Number($("betAmount").value)});hideModal("createModal");};
$("joinBtn").onclick=()=>{const c=$("joinCode").value.trim().toUpperCase();if(c.length!==6)return toast("Enter a 6-character room code.");socket.emit("room:join",c);};
$("quickJoinBtn").onclick=()=>{const cards=[...document.querySelectorAll(".room-card")];if(cards.length)cards[0].querySelector("button").click();else{privacy="public";mode="fair";socket.emit("room:create",{privacy,mode,deckSize:36,bet:0});}};
$("refreshBtn").onclick=()=>socket.emit("lobby:list");
socket.on("room:joined",d=>{showScreen("gameScreen");$("roomCodeDisplay").textContent=d.code;$("finishedPanel").classList.add("hidden");});
socket.on("toast",toast);
socket.on("lobby:update",rooms=>{const el=$("roomList");if(!rooms.length){el.innerHTML='<div class="empty-state"><div class="empty-icon">♧</div><b>No open tables yet</b><span>Create a public table and be the first to play.</span></div>';return;}
el.innerHTML=rooms.map(r=>`<div class="room-card"><div class="room-symbol">${r.mode==="liar"?"🤥":"♠"}</div><div class="room-card-info"><b>${r.mode==="liar"?"Liar Mode":"Fair Game"} · ${r.deckSize} cards</b><span>${r.players}/2 PLAYERS · ◈ ${r.bet} CHIPS · ${r.code}</span></div><button class="btn btn-small btn-outline" data-join="${r.code}">Join →</button></div>`).join("");
el.querySelectorAll("[data-join]").forEach(b=>b.onclick=()=>socket.emit("room:join",b.dataset.join));});
socket.on("game:state",s=>{game=s;renderGame();});
function cardHTML(c,back=false,small=false){if(back)return `<div class="playing-card card-back ${small?"mini":""}"><span>♠</span><i>✦</i><span>♠</span></div>`;
return `<div class="playing-card ${suitRed(c.suit)?"red":""} ${small?"mini":""}" data-card="${c.id}"><div class="corner">${c.rank}<span>${c.suit}</span></div><div class="card-center">${c.suit}</div><div class="corner bottom">${c.rank}<span>${c.suit}</span></div></div>`;}
function renderGame(){if(!game)return;
$("modeChip").textContent=game.mode==="liar"?"🤥 LIAR MODE":"⚖ FAIR MODE";
$("tableStatus").textContent=game.message||"Your move";$("gameMessage").textContent=game.message||"";
$("deckCount").textContent=game.deckCount;$("deckStack").style.opacity=game.deckCount?1:.25;
$("trumpCard").innerHTML=game.trump?cardHTML(game.trump,true):"";
const me=game.players.find(p=>p.id===game.you),opp=game.players.find(p=>p.id!==game.you);
if(me){$("coinCount").textContent=Number(me.coins).toLocaleString();$("selfInfo").innerHTML=`<div class="player-avatar">${me.avatar}</div><div><b>${escapeHTML(me.name)}</b><span>YOUR HAND · ${me.handCount} CARDS</span></div><span class="you-tag">YOU</span>`;}
if(opp){$("opponentInfo").innerHTML=`<div class="player-avatar">${opp.avatar}</div><div><b>${escapeHTML(opp.name)}</b><span>OPPONENT · ${opp.handCount} CARDS</span></div><div class="turn-clock" id="clock">45</div>`;$("opponentHand").innerHTML=Array.from({length:Math.min(opp.handCount,12)},()=>cardHTML(null,true,true)).join("");}
else{$("opponentInfo").innerHTML='<div class="player-avatar">🎭</div><div><b>Waiting for player…</b><span>SHARE THE ROOM CODE</span></div>';$("opponentHand").innerHTML="";}
$("myHand").innerHTML=(game.hand||[]).map(c=>cardHTML(c)).join("");
$("myHand").querySelectorAll("[data-card]").forEach(el=>{
 const id=el.dataset.card, card=game.hand.find(c=>c.id===id), legal=clientLegal(card);
 if(game.mode==="fair" && !legal) el.classList.add("card-disabled");
 el.onclick=()=>{if(game.mode==="fair"&&!clientLegal(card))return toast("That card cannot be played now.");playCard(id);};
 el.draggable=game.mode==="liar"||legal;
 el.ondragstart=e=>{if(game.mode==="fair"&&!clientLegal(card)){e.preventDefault();return;}e.dataTransfer.setData("text/card",id);};
});
const table=$("playedCards");
if(!game.table.length)table.innerHTML='<div class="table-empty">The table is clear<br>Make your move.</div>';
else table.innerHTML=game.table.map(pair=>`<div class="card-pair">${cardHTML(pair.attack)}${pair.defense?cardHTML(pair.defense):'<div class="card-placeholder">DEFEND</div>'}<button class="challenge-dot ${pair.challengeable&&pair.playedBy!==game.you?"can-challenge":""}" data-challenge="${pair.attack.id}" title="Challenge this card">!</button></div>`).join("");
table.querySelectorAll("[data-challenge]").forEach(b=>b.onclick=()=>socket.emit("card:challenge",{cardId:b.dataset.challenge}));
const myTurn=game.turnId===game.you;
$("tableHint").textContent=game.phase==="defend"&&game.defenderId===game.you?"Defend or pick up":myTurn?"Your turn":"Waiting for opponent";
$("pickupBtn").disabled=!(game.phase==="defend"&&game.defenderId===game.you);
$("passBtn").disabled=!(game.phase==="attack"&&game.attackerId===game.you&&game.table.length>0);
$("pickupBtn").style.opacity=$("pickupBtn").disabled?.45:1;$("passBtn").style.opacity=$("passBtn").disabled?.45:1;
$("finishedPanel").classList.toggle("hidden",game.status!=="finished");
if(game.status==="finished"){const won=game.winnerId===game.you;$("finishTitle").textContent=won?"Victory is yours!":"Better luck next time";$("finishText").textContent=won?"You cleared your hand first. The table belongs to you.":"The cards had other plans. Ready for a rematch?";}
if(game.turnEndsAt){clearInterval(countdown);countdown=setInterval(()=>{const c=$("clock");if(c)c.textContent=Math.max(0,Math.ceil((game.turnEndsAt-Date.now())/1000));},250);}
}
function clientLegal(card){
 if(!game||!card||game.mode==="liar")return true;
 const ranks=["6","7","8","9","10","J","Q","K","A"], value=r=>ranks.indexOf(r);
 if(game.phase==="attack"){
  if(game.attackerId!==game.you)return false;
  if(!game.table.length)return true;
  const visible=game.table.flatMap(p=>[p.attack.rank,p.defense?.rank].filter(Boolean));
  return game.table.length<6&&visible.includes(card.rank);
 }
 if(game.phase==="defend"){
  if(game.defenderId!==game.you)return false;
  const pair=game.table.find(p=>!p.defense);if(!pair)return false;
  return (card.suit===pair.attack.suit&&value(card.rank)>value(pair.attack.rank))||
   (card.suit===game.trump?.suit&&pair.attack.suit!==game.trump?.suit);
 }
 return false;
}
function playCard(id){if(!game||game.status!=="playing")return;let action=game.phase==="defend"&&game.defenderId===game.you?"defend":"attack";socket.emit("card:play",{cardId:id,action});}
$("pickupBtn").onclick=()=>socket.emit("game:pickup");
$("passBtn").onclick=()=>socket.emit("game:pass");
$("rematchBtn").onclick=()=>socket.emit("game:rematch");
$("backHomeBtn").onclick=()=>showScreen("homeScreen");
$("leaveBtn").onclick=()=>{showScreen("homeScreen");game=null;};
document.querySelectorAll("[data-emoji]").forEach(b=>b.onclick=()=>socket.emit("chat:reaction",b.dataset.emoji));
socket.on("chat:reaction",d=>{const p=$("reactionFloat");p.textContent=d.emoji;p.classList.remove("pop");void p.offsetWidth;p.classList.add("pop");});
$("copyCode").onclick=()=>{navigator.clipboard?.writeText($("roomCodeDisplay").textContent).then(()=>toast("Room code copied!")).catch(()=>toast("Your room code is "+$("roomCodeDisplay").textContent));};
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
// Drag-and-drop target: drop a card on the center table to play it.
$("playedCards").ondragover=e=>e.preventDefault();
$("playedCards").ondrop=e=>{e.preventDefault();const id=e.dataTransfer.getData("text/card");const card=game?.hand?.find(c=>c.id===id);if(id&&clientLegal(card))playCard(id);else if(id)toast("That card cannot be played now.");};
