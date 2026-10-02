const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
const keys = new Set();
let jumpQueued = false;
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const ENEMY_DAMAGE_SCALE = 0.7;

const roster = {
  samurai: { name:'SAMURAI', color:'#8bd8c1', accent:'#c8f3e5', hp:120, guard:50, speed:270, damage:24, mana:0, ult:'IAIDO FINAL' },
  necromancer: { name:'NECROMANCER', color:'#b08cff', accent:'#e0d3ff', hp:100, guard:50, speed:215, damage:60, mana:100, ult:'GRAVE DOMAIN' },
  soldier: { name:'SOLDIER', color:'#d8b765', accent:'#f6e2a4', hp:120, guard:50, speed:245, damage:22, mana:0, ult:'FULL AUTO' },
  swat: { name:'S.W.A.T.', color:'#ff725f', accent:'#ffc2b8', hp:135, guard:70, speed:190, damage:18, mana:0, ult:'BACKUP UNIT' }
};
const difficulty = { easy:0.75, normal:1, hard:1.25, nightmare:1.6 };
const p1Select = document.getElementById('p1Select');
const difficultySelect = document.getElementById('difficultySelect');
const menuP1Select = document.getElementById('menuP1Select');
const menuDifficultySelect = document.getElementById('menuDifficultySelect');
const titleScreen = document.getElementById('titleScreen');
const settingsScreen = document.getElementById('settingsScreen');
const gameScreen = document.getElementById('gameScreen');
const pauseMenu = document.getElementById('pauseMenu');
const menuTabs = [...document.querySelectorAll('.pause-tab')];
const menuPanels = [...document.querySelectorAll('.pause-section')];
let menuOpen = false;
let pausedStatus = '';
let gameLoopActive = false;
Object.entries(roster).forEach(([id, data]) => { p1Select.add(new Option(data.name, id)); menuP1Select.add(new Option(data.name, id)); });
p1Select.value = 'samurai';
let game = null;

function makePlayer(id) {
  const base = roster[id];
  return { id, base, x:220, y:500, hp:base.hp, maxHp:base.hp, guard:base.guard, maxGuard:base.guard, guardRegenDelay:0, guardRegenActive:false, perfectGuardProtection:0, jumpTime:0, jumpHeight:0, jumpCooldown:0, stamina:100, mana:id === 'necromancer' ? 0 : base.mana, ult:0, state:'idle', stateTime:0, attackTime:0, attackKind:'', attackRange:115, cooldown:0, skillCooldown:0, interactCooldown:0, perfect:0, invuln:0, flash:0, combo:0, damage:0, comboTimer:0, facing:1, corpses:0, level:1, xp:0, gold:0, areaTime:0, areaTick:0, summons:0 };
}

function beginStage() {
  const id = p1Select.value;
  game = { running:true, stage:1, room:0, maxRooms:4, difficulty:difficulty[difficultySelect.value], timer:0, announce:'ROOM 01', announceTime:1.6, player:makePlayer(id), enemies:[], projectiles:[], objects:[{x:580,y:530,w:65,h:60,type:'crate',health:2},{x:730,y:530,w:48,h:62,type:'chair',health:2}], particles:[], reward:null };
  spawnRoom();
  titleScreen.classList.add('hidden');
  settingsScreen.classList.add('hidden');
  pauseMenu.classList.add('hidden');
  gameScreen.classList.remove('hidden');
  menuOpen = false;
  document.getElementById('matchStatus').textContent = 'PVE RUN // LIVE';
  startGameLoop();
}

function showSettingsScreen() {
  titleScreen.classList.add('hidden');
  settingsScreen.classList.remove('hidden');
  document.getElementById('matchStatus').textContent = 'SETTINGS';
}

function showTitleScreen() {
  settingsScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  document.getElementById('matchStatus').textContent = 'TITLE SCREEN';
  document.getElementById('titleSettingsButton').focus();
}

document.getElementById('titleStartButton').addEventListener('click', beginStage);
document.getElementById('titleSettingsButton').addEventListener('click', showSettingsScreen);
document.getElementById('saveSettingsButton').addEventListener('click', showTitleScreen);

function showPauseTab(panelId) {
  menuTabs.forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.panel === panelId)));
  menuPanels.forEach(panel => panel.classList.toggle('hidden', panel.id !== panelId));
  if (panelId === 'settingsMenuPanel') {
    menuP1Select.value = p1Select.value;
    menuDifficultySelect.value = difficultySelect.value;
  }
}

function openGameMenu() {
  if (!game || menuOpen) return;
  menuOpen = true;
  keys.clear();
  jumpQueued = false;
  pausedStatus = document.getElementById('matchStatus').textContent;
  document.getElementById('matchStatus').textContent = 'PAUSED';
  pauseMenu.classList.remove('hidden');
  showPauseTab('titleMenuPanel');
  document.getElementById('titleMenuTab').focus();
  startGameLoop();
}

function closeGameMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  keys.clear();
  pauseMenu.classList.add('hidden');
  document.getElementById('matchStatus').textContent = pausedStatus;
  canvas.focus();
}

function returnToTitle() {
  menuOpen = false;
  keys.clear();
  jumpQueued = false;
  game = null;
  pauseMenu.classList.add('hidden');
  gameScreen.classList.add('hidden');
  showTitleScreen();
  document.getElementById('titleStartButton').focus();
}

menuTabs.forEach(tab => tab.addEventListener('click', () => showPauseTab(tab.dataset.panel)));
document.getElementById('resumeGameButton').addEventListener('click', closeGameMenu);
document.getElementById('returnToTitleButton').addEventListener('click', returnToTitle);
menuP1Select.addEventListener('change', () => { p1Select.value = menuP1Select.value; });
menuDifficultySelect.addEventListener('change', () => { difficultySelect.value = menuDifficultySelect.value; });

const controls = { left:'a', right:'d', guard:'h', light:'f', heavy:'g', dodge:'j', skill:'k', bind:'i', ult:'l', execute:'e', interact:'q' };
const titleMenuButtons = [...document.querySelectorAll('.title-actions button')];
function moveTitleMenu(direction) {
  const currentIndex = titleMenuButtons.indexOf(document.activeElement);
  const nextIndex = currentIndex < 0
    ? (direction > 0 ? 0 : titleMenuButtons.length - 1)
    : (currentIndex + direction + titleMenuButtons.length) % titleMenuButtons.length;
  titleMenuButtons[nextIndex].focus();
}

window.addEventListener('keydown', event => {
  if (game && event.key === 'Escape') {
    event.preventDefault();
    if (menuOpen) closeGameMenu();
    else openGameMenu();
    return;
  }
  if (game && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    returnToTitle();
    return;
  }
  if (menuOpen) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const currentIndex = menuTabs.indexOf(document.activeElement);
      const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (Math.max(0, currentIndex) + direction + menuTabs.length) % menuTabs.length;
      menuTabs[nextIndex].focus();
      menuTabs[nextIndex].click();
    }
    return;
  }
  keys.add(event.key.toLowerCase() === event.key ? event.key : event.key);
  if (event.code === 'Space' && game?.running && !menuOpen) {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
  }
  if (!titleScreen.classList.contains('hidden')) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveTitleMenu(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key.toLowerCase() === 's') {
      showSettingsScreen();
    } else if (event.key === 'Enter' && !event.target.closest('button')) {
      beginStage();
    }
  }
  if (!settingsScreen.classList.contains('hidden') && event.key === 'Escape') showTitleScreen();
});
window.addEventListener('keyup', event => keys.delete(event.key));
function down(key) { return keys.has(key); }
function announce(text, time=1.2) { game.announce=text; game.announceTime=time; }
function burst(x, y, color, count=12) { for (let i=0;i<count;i++) game.particles.push({x,y,vx:(Math.random()-.5)*280,vy:(Math.random()-.8)*260,life:.5+Math.random()*.5,color,size:2+Math.random()*4}); }

function enemySpec(type) {
  const scale = game.difficulty * (1 + (game.stage-1)*.15);
  const specs = {
    grunt:{name:'GRUNT',color:'#d26957',hp:70,damage:12,speed:65,range:78,interval:1.5,reward:12},
    ranged:{name:'RANGED',color:'#c9a74a',hp:48,damage:10,speed:22,range:350,interval:2.2,reward:16},
    shield:{name:'SHIELD',color:'#77838a',hp:145,damage:17,speed:38,range:78,interval:1.9,reward:20},
    charger:{name:'CHARGER',color:'#ed8553',hp:105,damage:25,speed:150,range:72,interval:2.8,reward:22},
    elite:{name:'ELITE',color:'#e2b951',hp:290,damage:23,speed:82,range:100,interval:1.25,reward:40},
    boss:{name:'WARDEN // BOSS',color:'#ff5b4d',hp:720,damage:30,speed:75,range:120,interval:1.4,reward:100}
  };
  const base = specs[type];
  return {...base,hp:Math.round(base.hp*scale),maxHp:Math.round(base.hp*scale),damage:Math.max(1,Math.round(base.damage*scale*ENEMY_DAMAGE_SCALE)),type,attackCooldown:0,state:'idle',stateTime:0,flash:0,stun:0,phase:1,facing:-1,x:920+Math.random()*170,y:500,dead:false,attackReady:false,attackImpact:0};
}

function spawnRoom() {
  game.room++;
  const waves = { 1:['grunt','grunt'], 2:['grunt','ranged','charger'], 3:['shield','ranged','elite'], 4:['boss'] };
  game.enemies = waves[game.room].map(enemySpec);
  announce(game.room===4?'FINAL BOSS':'ROOM 0'+game.room,1.4);
}

function inputPlayer() { return { left:down(controls.left), right:down(controls.right), guard:down(controls.guard), light:down(controls.light), heavy:down(controls.heavy), dodge:down(controls.dodge), skill:down(controls.skill), bind:down(controls.bind), ult:down(controls.ult), execute:down(controls.execute), interact:down(controls.interact), jump:jumpQueued }; }
function nearestEnemy() { return game.enemies.filter(enemy=>!enemy.dead).sort((a,b)=>Math.abs(a.x-game.player.x)-Math.abs(b.x-game.player.x))[0]; }

function updatePlayer(dt) {
  const p=game.player; const i=inputPlayer();
  jumpQueued=false;
  p.cooldown=Math.max(0,p.cooldown-dt); p.skillCooldown=Math.max(0,p.skillCooldown-dt); p.interactCooldown=Math.max(0,p.interactCooldown-dt); p.stateTime=Math.max(0,p.stateTime-dt); p.attackTime=Math.max(0,p.attackTime-dt); p.comboTimer=Math.max(0,p.comboTimer-dt); p.invuln=Math.max(0,p.invuln-dt); p.flash=Math.max(0,p.flash-dt); p.perfect=Math.max(0,p.perfect-dt); p.perfectGuardProtection=Math.max(0,p.perfectGuardProtection-dt); p.jumpCooldown=Math.max(0,p.jumpCooldown-dt); p.jumpTime=Math.max(0,p.jumpTime-dt); p.jumpHeight=p.jumpTime>0?Math.sin((1-p.jumpTime/.56)*Math.PI)*105:0;
  if(p.guardRegenActive){const regenDt=Math.max(0,dt-p.guardRegenDelay);p.guardRegenDelay=Math.max(0,p.guardRegenDelay-dt);if(regenDt>0){p.guard=clamp(p.guard+regenDt*p.maxGuard*.2,0,p.maxGuard);if(p.guard>=p.maxGuard-.001){p.guard=p.maxGuard;p.guardRegenActive=false;}}}
  if (p.comboTimer===0) { p.combo=0; p.damage=0; }
  p.stamina=clamp(p.stamina+dt*22,0,100); p.facing=(nearestEnemy()?.x||p.x)>=p.x?1:-1;
  if (p.areaTime>0) { p.areaTime=Math.max(0,p.areaTime-dt); p.areaTick-=dt; if(p.id==='necromancer')p.mana=clamp(p.mana+dt*8,0,100); if(p.areaTick<=0){p.areaTick=1;game.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<270).forEach(e=>hitEnemy(e,30));} }
  if(p.state==='stun'||p.state==='hit'){if(p.stateTime<=0)p.state='idle';return;}
  if(i.jump&&p.jumpTime===0&&p.jumpCooldown===0&&p.attackTime===0&&p.state!=='guard'){p.jumpTime=.56;p.jumpCooldown=.82;p.jumpHeight=0;burst(p.x,p.y,'#d7dfd3',5);}
  if(i.dodge&&p.stamina>=28&&p.cooldown===0){p.stamina-=28;p.invuln=.4;p.cooldown=.55;p.x=clamp(p.x-p.facing*70,60,1140);burst(p.x,p.y,'#d7dfd3',6);return;}
  if(i.guard&&p.attackTime===0){if(p.state!=='guard')p.perfect=.1;p.state='guard';return;}
  if(p.state==='guard')p.state='idle';
  if(i.interact&&p.interactCooldown===0){const prop=game.objects.find(object=>(object.type==='crate'||object.type==='chair')&&object.health>0&&Math.abs(object.x-p.x)<140);if(prop){p.interactCooldown=.55;prop.health--;const target=nearestEnemy();if(target&&Math.abs(target.x-p.x)<330)hitEnemy(target,prop.type==='crate'?38:28);burst(prop.x,prop.y,'#c59d69',10);if(prop.health<=0)prop.life=.1;announce(`${prop.type.toUpperCase()} HIT`,.5);return;}}
  if(p.attackTime===0){if(i.ult&&p.ult>=100)useUltimate();else if(p.id==='necromancer'&&i.bind&&p.skillCooldown===0)useBinding();else if(i.skill&&p.skillCooldown===0)useSkill();else if(p.cooldown===0&&i.heavy)startAttack('heavy');else if(p.cooldown===0&&i.light)startAttack('light');else if(i.execute)executeEnemy();}
  const direction=(i.right?1:0)-(i.left?1:0); if(p.attackTime===0&&p.state!=='guard'){p.x=clamp(p.x+direction*p.base.speed*(p.slow?.35:1)*dt,60,1140);}
  if(p.attackTime>0){const active=p.attackTime<.28&&p.attackTime>.1;if(active&&!p.hitThisAttack){const target=nearestEnemy();if(target&&Math.abs(target.x-p.x)<p.attackRange){p.hitThisAttack=true;hitEnemy(target,p.attackKind==='heavy'?(p.id==='necromancer'?80:38):p.base.damage);}}}
}
function startAttack(kind){const p=game.player;p.attackKind=kind;p.hitThisAttack=false;p.attackRange=p.id==='necromancer'&&kind==='heavy'?190:115;p.attackTime=p.id==='necromancer'?(kind==='heavy'?.85:.5):(kind==='heavy'?.55:.34);p.state='attack';if(p.id==='necromancer'&&kind==='heavy'){if(p.mana<5){p.attackTime=0;return;}p.mana-=5;p.cooldown=1;}else{if(kind==='heavy')p.stamina=Math.max(0,p.stamina-18);p.cooldown=kind==='heavy'?.65:.5;}}

function hitEnemy(enemy, damage) { if(!enemy||enemy.dead)return; if(enemy.stun>0)return; if(enemy.attackReady){enemy.attackReady=false;enemy.attackImpact=0;enemy.state='hit';enemy.stateTime=.2;} enemy.hp=clamp(enemy.hp-damage,0,enemy.maxHp);enemy.flash=.12;game.player.combo++;game.player.damage+=damage;game.player.comboTimer=1.15;game.player.ult=clamp(game.player.ult+damage*.35,0,100);burst(enemy.x,enemy.y,game.player.base.accent,8);if(enemy.hp<=0)killEnemy(enemy); }
function killEnemy(enemy) { if(enemy.dead)return;enemy.dead=true;const p=game.player;const healed=Math.min(p.maxHp-p.hp,Math.max(1,Math.round(p.maxHp*.08)));p.hp=clamp(p.hp+healed,0,p.maxHp);p.xp+=enemy.reward;p.gold+=Math.round(enemy.reward*.7);p.corpses+=p.id==='necromancer'?1:0;if(p.id==='necromancer')p.mana=clamp(p.mana+(enemy.type==='elite'||enemy.type==='boss'?25:10),0,100);p.ult=clamp(p.ult+12,0,100);burst(enemy.x,enemy.y,enemy.color,22);announce(`${enemy.name} DOWN // +${healed} HP`,.8); }
function useSkill(){const p=game.player; p.skillCooldown=3;if(p.id==='samurai'){p.perfect=.45;p.state='guard';p.stateTime=.5;announce('PARRY READY',.6);}else if(p.id==='necromancer'){if(p.mana<30||p.corpses<1){announce(p.corpses<1?'NO CORPSE':'NOT ENOUGH MANA',.6);p.skillCooldown=0;return;}p.mana-=30;p.corpses--;p.summons++;game.objects.push({type:'minion',x:p.x+70,y:500,life:15,cooldown:0});announce('UNDEAD RISES',.7);}else if(p.id==='soldier'){p.damageBonus=p.damageBonus===6?0:6;announce('WEAPON SWAP',.7);}else{game.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<220).forEach(e=>{e.stun=1.2;e.hp=clamp(e.hp-35,0,e.maxHp);});announce('FLASHBANG',.7);burst(p.x,p.y,'#f2c85b',18);}}
function useBinding(){const p=game.player;if(p.mana<20){announce('NOT ENOUGH MANA',.6);return;}p.mana-=20;p.skillCooldown=6;game.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<270).forEach(e=>{e.slow=3;e.hp=clamp(e.hp-50,0,e.maxHp);e.stun=.25;if(e.hp<=0)killEnemy(e);});announce('DEAD BIND',.8);burst(p.x,p.y,'#b08cff',22);}
function useUltimate(){const p=game.player;p.ult=0;announce(p.base.ult,1);burst(p.x,p.y,'#f2c85b',34);if(p.id==='necromancer'){p.areaTime=15;p.areaTick=0;game.objects.push({type:'grave',x:p.x,y:535,life:15,w:460,h:180});}else if(p.id==='samurai'){game.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<300).forEach(e=>hitEnemy(e,100));}else if(p.id==='soldier'){game.enemies.filter(e=>!e.dead).forEach(e=>hitEnemy(e,55));}else{p.summons+=2;game.objects.push({type:'ally',x:p.x+80,y:500,life:12},{type:'ally',x:p.x+130,y:500,life:12});}}
function executeEnemy(){const enemy=nearestEnemy();if(enemy&&enemy.hp/enemy.maxHp<.18&&Math.abs(enemy.x-game.player.x)<130){killEnemy(enemy);game.player.hp=clamp(game.player.hp+20,0,game.player.maxHp);game.player.stamina=100;game.player.mana=clamp(game.player.mana+15,0,100);game.player.ult=clamp(game.player.ult+20,0,100);announce('EXECUTION // +15 MANA',1);}}

function updateEnemy(enemy,dt){if(enemy.dead)return;enemy.attackCooldown=Math.max(0,enemy.attackCooldown-dt);enemy.stun=Math.max(0,enemy.stun-dt);enemy.stateTime=Math.max(0,enemy.stateTime-dt);enemy.flash=Math.max(0,enemy.flash-dt);enemy.attackImpact=Math.max(0,enemy.attackImpact-dt);if(enemy.stun>0)return;const p=game.player;enemy.facing=p.x>=enemy.x?1:-1;const distance=Math.abs(p.x-enemy.x);if(enemy.type==='boss'){const ratio=enemy.hp/enemy.maxHp;const next=ratio<.33?3:ratio<.66?2:1;if(next!==enemy.phase){enemy.phase=next;announce(`BOSS PHASE ${next}`,1);burst(enemy.x,enemy.y,'#ff5b4d',25);}}const speed=enemy.speed*(enemy.slow?.3:1)*(enemy.type==='boss'&&enemy.phase>1?1.15:1);const phaseInterval=enemy.interval/(1+(enemy.phase-1)*.25);if(enemy.type==='ranged'){if(distance<260)enemy.x-=enemy.facing*speed*dt;else if(distance>390)enemy.x+=enemy.facing*speed*dt;}else if(distance>enemy.range){enemy.x+=enemy.facing*speed*dt;}if(enemy.attackReady&&enemy.stateTime<=.12){enemy.attackReady=false;enemy.attackImpact=.12;enemy.state='idle';if(enemy.type==='ranged'){game.projectiles.push({x:enemy.x,y:450,vx:enemy.facing*330,damage:enemy.damage,life:3,color:enemy.color});}else if(distance<enemy.range+15){damagePlayer(enemy.damage,enemy);}}if(!enemy.attackReady&&enemy.attackCooldown===0&&(enemy.type==='ranged'||distance<=enemy.range)){enemy.attackCooldown=phaseInterval;enemy.state='attack';enemy.stateTime=.38;enemy.attackReady=true;}if(enemy.stateTime===0&&!enemy.attackReady)enemy.state='idle';}
function damagePlayer(damage,source){const p=game.player;if(p.jumpTime>0||p.invuln>0)return;if(p.state==='guard'){if(p.perfect>0){source.stun=.45;p.perfectGuardProtection=Math.max(p.perfectGuardProtection,p.perfect);p.perfect=0;const healed=Math.min(p.maxHp-p.hp,Math.round(p.maxHp*.08));p.hp=clamp(p.hp+healed,0,p.maxHp);p.guard=clamp(p.guard+p.maxGuard*.1,0,p.maxGuard);announce(`PERFECT // +${healed} HP // +10% GUARD`,.7);burst(p.x,p.y,'#f2c85b',18);return;}if(p.perfectGuardProtection>0)return;p.invuln=.3;p.guard-=damage*.75;if(p.guard<=0){p.guard=0;p.guardRegenDelay=10;p.guardRegenActive=true;p.state='stun';p.stateTime=3;announce('GUARD BREAK',1);}return;}p.hp=clamp(p.hp-damage,0,p.maxHp);p.invuln=.3;p.state='hit';p.stateTime=.22;p.flash=.15;p.ult=clamp(p.ult+damage*.25,0,100);if(p.hp<=0){game.running=false;announce('RUN FAILED // R TO RETRY',99);document.getElementById('matchStatus').textContent='RUN FAILED';}}

function updateWorld(dt){game.projectiles.forEach(projectile=>{projectile.x+=projectile.vx*dt;projectile.life-=dt;if(projectile.life>0&&Math.abs(projectile.x-game.player.x)<28)damagePlayer(projectile.damage,{stun:0});});game.projectiles=game.projectiles.filter(projectile=>projectile.life>0&&projectile.x>0&&projectile.x<1200);game.objects.forEach(object=>{if(object.life)object.life-=dt;if(object.type==='minion'&&object.life>0){const target=nearestEnemy();if(target){object.x+=(target.x-object.x)*dt*.7;object.cooldown-=dt;if(object.cooldown<=0&&Math.abs(target.x-object.x)<110){object.cooldown=1;hitEnemy(target,game.player.areaTime>0?20:12);}}}});game.objects=game.objects.filter(object=>!object.life||object.life>0);}
function progress(){if(game.enemies.some(enemy=>!enemy.dead))return;if(game.roomClearTimer===undefined){if(game.room<game.maxRooms){game.reward={xp:game.room*25,gold:game.room*18};game.player.xp+=game.reward.xp;game.player.gold+=game.reward.gold;game.player.level++;game.player.maxHp+=8;game.player.hp=game.player.maxHp;game.player.maxGuard+=3;game.player.guard=game.player.maxGuard;game.player.ult=clamp(game.player.ult+15,0,100);announce(`ROOM CLEAR // +${game.reward.gold} GOLD`,1.8);game.roomClearTimer=1.8;}else{game.running=false;announce(`STAGE CLEAR // LV ${game.player.level}`,99);document.getElementById('matchStatus').textContent='STAGE CLEAR';}}else{game.roomClearTimer-=.033;if(game.roomClearTimer<=0){game.roomClearTimer=null;spawnRoom();}}}
function update(dt){if(!game)return;if(menuOpen){updateHud();return;}if(game.announceTime>0)game.announceTime-=dt;if(game.running){game.timer+=dt;updatePlayer(dt);game.enemies.forEach(enemy=>updateEnemy(enemy,dt));updateWorld(dt);progress();}game.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=500*dt;p.life-=dt;});game.particles=game.particles.filter(p=>p.life>0);updateHud();}

function drawArena(){const gradient=ctx.createLinearGradient(0,0,0,650);gradient.addColorStop(0,game.player.areaTime>0?'#292039':'#202522');gradient.addColorStop(1,'#101312');ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,650);ctx.fillStyle='#292e2b';ctx.fillRect(0,530,1200,120);ctx.strokeStyle=game.player.areaTime>0?'#b08cff':'#4c514c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,530);ctx.lineTo(1200,530);ctx.stroke();ctx.strokeStyle='rgba(139,216,193,.12)';for(let x=0;x<1200;x+=80){ctx.beginPath();ctx.moveTo(x,530);ctx.lineTo(x+40,650);ctx.stroke();}ctx.fillStyle='#566058';ctx.fillRect(90,120,100,7);ctx.fillRect(1010,180,110,7);}
function drawObject(object){ctx.save();if(object.type==='grave'){ctx.fillStyle='rgba(92,63,125,.5)';ctx.fillRect(object.x-object.w/2,object.y-object.h,object.w,object.h);ctx.strokeStyle='#b08cff';ctx.strokeRect(object.x-object.w/2,object.y-object.h,object.w,object.h);}else if(object.type==='crate'||object.type==='chair'){ctx.fillStyle=object.type==='crate'?'#7e6042':'#a36c51';ctx.fillRect(object.x-object.w/2,object.y-object.h,object.w,object.h);ctx.strokeStyle='#c59d69';ctx.strokeRect(object.x-object.w/2,object.y-object.h,object.w,object.h);}else{ctx.fillStyle=object.type==='ally'?'#697379':'#b08cff';ctx.fillRect(object.x-15,object.y-80,30,80);ctx.fillRect(object.x-27,object.y-80,54,9);}ctx.restore();}
function drawPlayer(){const p=game.player;ctx.save();ctx.globalAlpha=p.invuln>0?.55:1;ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();const shadowScale=1-p.jumpHeight/180;ctx.ellipse(p.x,p.y+5,42*shadowScale,9*shadowScale,0,0,TAU);ctx.fill();ctx.translate(p.x,p.y-p.jumpHeight);if(p.facing<0)ctx.scale(-1,1);const body=p.state==='guard'?'#68716c':p.base.color;ctx.fillStyle=body;ctx.fillRect(-21,-92,42,80);ctx.fillStyle=p.base.accent;ctx.beginPath();ctx.arc(0,-111,21,0,TAU);ctx.fill();ctx.fillStyle='#171b19';ctx.fillRect(-16,-115,32,7);ctx.fillStyle=body;ctx.fillRect(-29,-83,9,43);ctx.fillRect(20,-83,9,43);if(p.state==='attack'){ctx.strokeStyle=p.base.accent;ctx.lineWidth=p.attackKind==='heavy'?11:7;ctx.beginPath();ctx.arc(30,-72,55,-.8,.8);ctx.stroke();}if(p.state==='guard'){ctx.strokeStyle='#f2c85b';ctx.lineWidth=6;ctx.beginPath();ctx.arc(20,-70,55,-1.1,1.1);ctx.stroke();}if(p.flash>0){ctx.fillStyle='#fff4b0';ctx.beginPath();ctx.arc(0,-70,70,0,TAU);ctx.fill();}ctx.restore();}
function drawEnemy(enemy){if(enemy.dead)return;ctx.save();ctx.translate(enemy.x,enemy.y);if(enemy.facing<0)ctx.scale(-1,1);ctx.globalAlpha=enemy.stun>0?.55:1;ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.ellipse(0,5,42,9,0,0,TAU);ctx.fill();ctx.fillStyle=enemy.color;const scale=enemy.type==='boss'?1.45:enemy.type==='elite'?1.2:1;ctx.fillRect(-21*scale,-92*scale,42*scale,80*scale);ctx.beginPath();ctx.arc(0,-111*scale,21*scale,0,TAU);ctx.fill();ctx.fillStyle='#171b19';ctx.fillRect(-16*scale,-115*scale,32*scale,7*scale);if(enemy.type==='shield'){ctx.fillStyle='#9aa9ad';ctx.fillRect(17,-88,28,70);}if(enemy.state==='attack'){ctx.strokeStyle='#fff0b0';ctx.lineWidth=9;ctx.beginPath();ctx.arc(30,-72,55,-.8,.8);ctx.stroke();}if(enemy.attackReady||enemy.attackImpact>0){const radius=11;const centerY=-151*scale;const progress=enemy.attackReady?clamp((.38-enemy.stateTime)/(.38-.12),0,1):1;ctx.globalAlpha=enemy.attackImpact>0?Math.min(1,enemy.attackImpact/.12):1;ctx.beginPath();ctx.arc(0,centerY,radius,0,TAU);ctx.fillStyle='rgba(12,14,13,.9)';ctx.fill();if(progress>0){ctx.beginPath();ctx.moveTo(0,centerY);ctx.arc(0,centerY,radius,-Math.PI/2,-Math.PI/2+TAU*progress);ctx.closePath();ctx.fillStyle='#f2c85b';ctx.fill();}ctx.beginPath();ctx.arc(0,centerY,radius,0,TAU);ctx.strokeStyle='#fff0b0';ctx.lineWidth=2;ctx.stroke();}ctx.globalAlpha=enemy.stun>0?.55:1;ctx.fillStyle='#ff5b4d';ctx.fillRect(-42,-145*scale,84*scale,6);ctx.fillStyle='#8bd8c1';ctx.fillRect(-42,-145*scale,84*scale*(enemy.hp/enemy.maxHp),6);ctx.restore();}
function draw(){ctx.clearRect(0,0,1200,650);drawArena();game.objects.forEach(drawObject);game.enemies.forEach(drawEnemy);drawPlayer();game.projectiles.forEach(p=>{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,7,0,TAU);ctx.fill();});game.particles.forEach(p=>{ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);});ctx.globalAlpha=1;document.getElementById('announce').textContent=game.announceTime>0?game.announce:'';}

function updateHud(){if(!game)return;const p=game.player;const target=nearestEnemy();document.getElementById('p1Name').textContent=`${p.base.name} // LV ${p.level}`;document.getElementById('p1Wins').textContent=`${p.xp} XP // ${p.corpses} CORPSES`;document.getElementById('p1Hp').style.width=`${p.hp/p.maxHp*100}%`;document.getElementById('p1HealthText').textContent=`${Math.ceil(p.hp)} / ${p.maxHp} HP`;document.getElementById('p1Guard').style.width=`${p.guard/p.maxGuard*100}%`;document.getElementById('p1Stamina').style.width=`${p.stamina}%`;document.getElementById('p1Mana').style.width=`${p.base.mana?p.mana:p.stamina}%`;document.getElementById('p1Ult').style.width=`${p.ult}%`;document.getElementById('p1UltLabel').textContent=`ULT ${Math.round(p.ult)}% // ${p.gold}G`;document.getElementById('p2Name').textContent=target?target.name:'ROOM CLEAR';document.getElementById('p2Wins').textContent=`${game.enemies.filter(enemy=>!enemy.dead).length} ENEMIES`;document.getElementById('p2Hp').style.width=target?`${target.hp/target.maxHp*100}%`:'0%';document.getElementById('p2HealthText').textContent=target?`${Math.ceil(target.hp)} / ${target.maxHp} HP`:'';document.getElementById('p2Guard').style.width=target?'100%':'0%';document.getElementById('p2Stamina').style.width=target?'100%':'0%';document.getElementById('p2Mana').style.width=target?'100%':'0%';document.getElementById('p2Ult').style.width=target&&target.type==='boss'?`${(1-target.hp/target.maxHp)*100}%`:'0%';document.getElementById('p2UltLabel').textContent=target&&target.type==='boss'?`PHASE ${target.phase}`:`ROOM ${game.room}/${game.maxRooms}`;document.getElementById('roundLabel').textContent=`ROOM ${game.room} / STAGE ${game.stage}`;document.getElementById('timer').textContent=Math.floor(game.timer);document.getElementById('p1Combo').textContent=p.combo;document.getElementById('p1Damage').textContent=`${p.damage} DAMAGE // ${p.xp} XP`;document.querySelector('.combo-p1').style.opacity=p.combo?1:0;document.querySelector('.combo-p2').style.opacity=0;}
let last=0;function startGameLoop(){if(gameLoopActive)return;gameLoopActive=true;requestAnimationFrame(loop);}function loop(now){if(!game){gameLoopActive=false;return;}const dt=Math.min(.033,(now-last)/1000||0);last=now;update(dt);draw();if(game&&(game.running||game.announceTime>0||menuOpen))requestAnimationFrame(loop);else gameLoopActive=false;}