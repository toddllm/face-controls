// app.js - Browser game logic (skeleton)
(async function() {
  // Video input and canvases
  const videoElement = document.getElementById('input_video');
  const faceCanvas = document.getElementById('faceCanvas');
  const faceCtx = faceCanvas.getContext('2d');
  const canvasElement = document.getElementById('gameCanvas');
  const ctx = canvasElement.getContext('2d');
  const faceContainer = document.getElementById('faceContainer');
  
  // Detect if we're on a mobile device
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Resize canvas to full window
  function onResize() {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    
    // Update scaling factors for coordinates when size changes
    updateScalingFactors();
  }
  
  // Keep track of scaling factors
  let videoScaleX = 1;
  let videoScaleY = 1;
  
  // Function to update scaling factors for face and hand coordinates
  function updateScalingFactors() {
    if (videoElement.videoWidth && videoElement.videoHeight) {
      videoScaleX = faceContainer.clientWidth / videoElement.videoWidth;
      videoScaleY = faceContainer.clientHeight / videoElement.videoHeight;
    }
  }
  
  window.addEventListener('resize', onResize);
  onResize();
  // --- Game entity classes ---
  class Creature {
    constructor(cx, cy, sw, sh) {
      this.radius = 15;
      const edge = ['top','bottom','left','right'][Math.floor(Math.random()*4)];
      if (edge==='top') { this.x = Math.random()*sw; this.y = -this.radius; }
      else if (edge==='bottom') { this.x = Math.random()*sw; this.y = sh + this.radius; }
      else if (edge==='left') { this.x = -this.radius; this.y = Math.random()*sh; }
      else { this.x = sw + this.radius; this.y = Math.random()*sh; }
      this.speed = 50 + Math.random()*70;
      this.color = 'green';
    }
    update(dt, tx, ty) {
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy)||1e-6;
      this.x += (dx/d)*this.speed*dt;
      this.y += (dy/d)*this.speed*dt;
    }
  }
  class Snowie extends Creature { constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.speed=40; this.color='lightblue'; }}
  class FireSpinner extends Creature { constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.speed=80; this.color='orange'; }}
  class Ghost extends Creature { constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.speed=100; this.color='rgba(180,180,255,0.7)'; }}
  class Skeleton extends Creature { constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.speed=70; this.color='gray'; }}
  class Caster extends Creature { constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.speed=60; this.color='cyan'; }}
  class Dragon extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=25; this.speed=120; this.color='magenta'; this.osc=0; }
    update(dt, tx, ty) { this.osc += dt*5; const off=Math.sin(this.osc)*50; super.update(dt, tx+off, ty); }
  }
  class Laser {
    constructor(x,y,vx,vy){ this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.radius=5; this.color='red'; this.active=true; }
    update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; if(this.x<0||this.x>canvasElement.width||this.y<0||this.y>canvasElement.height) this.active=false; }
  }
  class Fireball extends Laser { constructor(x,y,vx,vy){ super(x,y,vx,vy); this.color='orange'; this.radius=8; }}
  class PurpleLaser extends Laser { constructor(x,y,vx,vy){ super(x,y,vx,vy); this.color='purple'; this.radius=6; }}
  class BaseBoss {
    constructor(cx,cy){ this.x=cx; this.y=cy-150; this.radius=40; this.health=20; this.speed=60; this.color='purple'; this.angle=0; }
    update(dt,tx,ty){ this.angle+=dt; this.x=tx+Math.cos(this.angle)*150; this.y=ty+Math.sin(this.angle)*80; }
  }
  // Boss subclasses
  class SnowKing extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=30; this.color='lightblue'; this.spawn=3; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.spawn){ creatures.push(new Snowie(this.x,this.y,canvasElement.width,canvasElement.height)); this.timer=0;} }
  }
  class FlameWarden extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=25; this.color='orange'; this.spawn=2; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.spawn){ creatures.push(new FireSpinner(this.x,this.y,canvasElement.width,canvasElement.height)); this.timer=0;} }
  }
  class VortexBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=35; this.color='blue'; this.pulse=3; this.timer=0; this.pull=100; this.radiusPull=200; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.pulse){ creatures.forEach(c=>{ const dx=this.x-c.x, dy=this.y-c.y, d=Math.hypot(dx,dy)||1; if(d<this.radiusPull){ c.x+=dx/d*this.pull*dt; c.y+=dy/d*this.pull*dt;} }); this.timer=0;} }
  }
  class SpinnerBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=30; this.color='yellow'; this.spin=6; this.interval=2.5; this.timer=0; }
    update(dt,tx,ty){ this.angle+=this.spin*dt; this.x=tx; this.y=ty-150; this.timer+=dt; if(this.timer>=this.interval){ for(let a=0;a<360;a+=45){ const r=a*Math.PI/180; lasers.push(new PurpleLaser(this.x,this.y,Math.cos(r)*300,Math.sin(r)*300)); } this.timer=0;} }
  }
  class RamBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=40; this.color='brown'; this.charge=400; this.interval=4; this.timer=0; this.charging=false; this.dur=0.5; this.t=0; }
    update(dt,tx,ty){ if(!this.charging){ this.timer+=dt; if(this.timer>=this.interval){ this.charging=true; this.t=0; this.timer=0; const dcs=metricsList.map(m=>[Math.hypot(this.x-m.faceCoords[0],this.y-m.faceCoords[1]),m.faceCoords]); const tgt=dcs.sort((a,b)=>a[0]-b[0])[0][1]; const dx=tgt[0]-this.x, dy=tgt[1]-this.y, d=Math.hypot(dx,dy)||1; this.vx=dx/d*this.charge; this.vy=dy/d*this.charge; }} else { this.t+=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; if(this.t>=this.dur) this.charging=false; }}
  }
  class TrackerBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=30; this.color='lime'; this.interval=3; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.interval){ const dcs=metricsList.map(m=>[Math.hypot(this.x-m.faceCoords[0],this.y-m.faceCoords[1]),m.faceCoords]); const tgt=dcs.sort((a,b)=>a[0]-b[0])[0][1]; const dx=tgt[0]-this.x, dy=tgt[1]-this.y, d=Math.hypot(dx,dy)||1; lasers.push(new PurpleLaser(this.x,this.y,dx/d*200,dy/d*200)); this.timer=0;} }
  }
  class ArticalBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=35; this.color='teal'; this.interval=4; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.interval && metricsList.length){ const idx=Math.floor(Math.random()*metricsList.length); this.x=metricsList[idx].faceCoords[0]; this.y=metricsList[idx].faceCoords[1]; this.timer=0;} }
  }
  class ShadowBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=40; this.color='black'; this.interval=5; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.interval){ const edge=['top','bottom','left','right'][Math.floor(Math.random()*4)]; const sw=canvasElement.width, sh=canvasElement.height; let px,py; if(edge==='top'){px=Math.random()*sw;py=0;}else if(edge==='bottom'){px=Math.random()*sw;py=sh;}else if(edge==='left'){px=0;py=Math.random()*sh;}else{px=sw;py=Math.random()*sh;} creatures.push(new Creature(px,py,sw,sh)); this.timer=0;} }
  }
  class AlienKingBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=60; this.color='purple'; this.interval=4; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.interval){ for(let a=0;a<360;a+=30){ const r=(a+Math.random()*30)*Math.PI/180; lasers.push(new PurpleLaser(this.x,this.y,Math.cos(r)*350,Math.sin(r)*350)); } this.timer=0;} }
  }
  class MadackedaBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=50; this.color='purple'; this.spawn=1.5; this.timer=0; this.tportI=5; this.tportT=0; this.shI=4; this.shT=0; this.shDur=2; this.shOn=false; this.vI=3; this.vT=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.timer+=dt; if(this.timer>=this.spawn){ creatures.push(new Snowie(this.x,this.y,canvasElement.width,canvasElement.height)); creatures.push(new FireSpinner(this.x,this.y,canvasElement.width,canvasElement.height)); this.timer=0;} this.tportT+=dt; if(this.tportT>=this.tportI){ const idx=Math.floor(Math.random()*metricsList.length); this.x=metricsList[idx].faceCoords[0]; this.y=metricsList[idx].faceCoords[1]; this.tportT=0;} this.shT+=dt; if(!this.shOn && this.shT>=this.shI){ this.shOn=true; this.shDur=this.shDur; this.shT=0;} if(this.shOn){ this.shDur-=dt; if(this.shDur<=0){ this.shOn=false; }} this.vT+=dt; if(this.vT>=this.vI){ [240,300].forEach(a=>{const r=a*Math.PI/180; lasers.push(new PurpleLaser(this.x,this.y,Math.cos(r)*400,Math.sin(r)*400));}); this.vT=0;} }
  }

  // Game state globals
  let metricsList = [];
  let handPositions = [];
  let audioAmplitude = 0;
  const creatures = [];
  const lasers = [];
  const fireballs = [];
  let boss = null;
  let waveIndex = 0;
  let waveKills = 0;
  let state = 'minions';
  let lastSpawn = 0;
  const spawnInterval = 1.5;
  const killTargets = [20,30,40,50,60,70,80,90,100,120];
  let playerLives = [];
  let invulTimers = [];
  let paused = false;
  let pauseOverlay = null;

  // Initialize state tracking for face blinks
  let prevEyesClosed = [];
  // Initialize MediaPipe
  const faceMesh = new FaceMesh({locateFile: f =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
  });
  faceMesh.setOptions({
    maxNumFaces: isMobile ? 1 : 4,  // Reduce max faces on mobile
    refineLandmarks: true,
    minDetectionConfidence: isMobile ? 0.7 : 0.5, // Higher threshold on mobile for better performance
    minTrackingConfidence: isMobile ? 0.7 : 0.5
  });
  faceMesh.onResults(onFaceResults);

  const hands = new Hands({locateFile: f =>
    `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({
    maxNumHands: isMobile ? 2 : 4,  // Reduce max hands on mobile
    minDetectionConfidence: isMobile ? 0.7 : 0.5,
    minTrackingConfidence: isMobile ? 0.7 : 0.5
  });
  hands.onResults(onHandResults);

  // Polyfill getUserMedia across browsers
  const getUserMedia = (constraints) => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    const legacy = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;
    if (legacy) {
      return new Promise((resolve, reject) => {
        legacy.call(navigator, constraints, resolve, reject);
      });
    }
    return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
  };
  // Initialize webcam and audio streams manually
  let audioCtx, analyser, dataArray;
  async function initMedia() {
    try {
      // Optimize video constraints for mobile devices
      let videoConstraints = {
        video: true,
        audio: true
      };
      
      // For mobile, we need more specific constraints to get better performance
      if (isMobile) {
        videoConstraints = {
          video: {
            facingMode: 'user',
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          },
          audio: true
        };
      }
      
      const stream = await getUserMedia(videoConstraints);
      videoElement.srcObject = stream;
      videoElement.playsInline = true;
      
      // Audio setup
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      const micSource = audioCtx.createMediaStreamSource(stream);
      micSource.connect(analyser);
      analyser.fftSize = 256;
      dataArray = new Uint8Array(analyser.fftSize);
      
      videoElement.onloadedmetadata = () => {
        // Play video and set up face canvas size
        videoElement.play();
        faceCanvas.width = videoElement.videoWidth;
        faceCanvas.height = videoElement.videoHeight;
        
        // Update scaling factors
        updateScalingFactors();
        
        // Begin detection and animation loops
        detectLoop();
        lastTime = performance.now();
        requestAnimationFrame(animate);
      };
    } catch (err) {
      console.error('Error accessing media devices.', err);
      // Show fallback message to the user
      alert('Unable to access camera. Please make sure you have given camera permission and try again.');
    }
  }
  // Wait for user gesture to start media
  const startBtn = document.getElementById('startButton');
  startBtn.addEventListener('click', () => {
    document.getElementById('startScreen').style.display = 'none';
    
    // On iOS, we need to request fullscreen for proper video permissions
    if (isMobile && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    }
    
    initMedia();
    
    // Enable audio context on iOS
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  });

  // Enable touch events for mobile
  if (isMobile) {
    // Add touch handlers for mobile
    canvasElement.addEventListener('touchstart', handleTouch, false);
    canvasElement.addEventListener('touchmove', handleTouch, false);
    
    function handleTouch(event) {
      event.preventDefault(); // Prevent scrolling
      
      // Process touch events here if needed
      // Example: fireballs on touch?
    }
  }

  // Loop to feed video frames into MediaPipe - optimize for mobile
  async function detectLoop() {
    if (videoElement.readyState >= 2) {
      try {
        // Reduce detection frequency on mobile for better performance
        const skipFrames = isMobile ? 2 : 1;
        if (!detectLoop.frameCount) detectLoop.frameCount = 0;
        
        detectLoop.frameCount++;
        
        if (detectLoop.frameCount % skipFrames === 0) {
          await faceMesh.send({image: videoElement});
          await hands.send({image: videoElement});
        }
      } catch (e) {
        console.error('MediaPipe detection error:', e);
      }
    }
    requestAnimationFrame(detectLoop);
  }

  let lastTime = performance.now();
  function getMicData() {
    if (!analyser) return;
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] - 128;
      sum += v * v;
    }
    audioAmplitude = Math.sqrt(sum / dataArray.length) / 128;
  }
  // Add for boss health bar
  let bossMaxHealth = 0;
  // Add for mouth capture effect
  let mouthCaptureEffects = [];
  // Add for hand/arm hit effect
  let handHitEffects = [];
  function animate(now=performance.now()) {
    if (paused) return;
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    getMicData();
    const nowSec = performance.now()/1000;
    if(state === 'minions' && nowSec - lastSpawn > spawnInterval) {
      const r = Math.random();
      const types = [Creature, Snowie, FireSpinner, Ghost, Skeleton, Caster, Dragon];
      const Type = types[Math.floor(r*types.length)];
      creatures.push(new Type(0,0, canvasElement.width, canvasElement.height));
      lastSpawn = nowSec;
    }
    // Voice-activated straight laser
    if(audioAmplitude > 0.25) { // Threshold for loud sound
      metricsList.forEach((metrics,i) => {
        // Shoot a straight laser from face in direction of yaw
        const yaw = metrics.yaw;
        const pitch = metrics.pitch;
        const dx = yaw * 100, dy = -pitch * 100;
        const mag = Math.hypot(dx,dy)||1e-6;
        const vx = dx/mag*600, vy = dy/mag*600;
        const vw = videoElement.videoWidth || 640;
        const vh = videoElement.videoHeight || 480;
        const sw = canvasElement.width / vw;
        const sh = canvasElement.height / vh;
        const fx = metrics.faceCoords[0]*sw;
        const fy = metrics.faceCoords[1]*sh;
        lasers.push(new Laser(fx, fy, vx, vy));
      });
    }
    // Blink lasers (keep as before)
    metricsList.forEach((metrics,i) => {
      if(metrics.blink) {
        const yaw = metrics.yaw;
        const pitch = metrics.pitch;
        const dx = yaw * 100, dy = -pitch * 100;
        const mag = Math.hypot(dx,dy)||1e-6;
        const vx = dx/mag*400, vy = dy/mag*400;
        const vw = videoElement.videoWidth || 640;
        const vh = videoElement.videoHeight || 480;
        const sw = canvasElement.width / vw;
        const sh = canvasElement.height / vh;
        const fx = metrics.faceCoords[0]*sw;
        const fy = metrics.faceCoords[1]*sh;
        const eyeOffX=50, eyeOffY=-30;
        [{dx:-eyeOffX},{dx:eyeOffX}].forEach(o=>{
          const lx=fx+o.dx, ly=fy+eyeOffY;
          lasers.push(new Laser(lx,ly,vx,vy));
        });
      }
    });
    // Hand attacks (fireballs) and hand/arm damage
    handPositions.forEach(([wx,wy])=>{
      const scaledWx = wx * canvasElement.width / faceCanvas.width;
      const scaledWy = wy * canvasElement.height / faceCanvas.height;
      const cx=canvasElement.width/2, cy=canvasElement.height/2;
      const dx= cx-scaledWx, dy= cy-scaledWy;
      const mag=Math.hypot(dx,dy)||1e-6;
      fireballs.push(new Fireball(scaledWx,scaledWy,dx/mag*300,dy/mag*300));
    });
    // Hand/arm damage: if hand is close to a creature or boss, deal damage
    handPositions.forEach(([wx,wy])=>{
      const scaledWx = wx * canvasElement.width / faceCanvas.width;
      const scaledWy = wy * canvasElement.height / faceCanvas.height;
      creatures.forEach((c,ci)=>{
        if(Math.hypot(c.x-scaledWx,c.y-scaledWy)<c.radius+20) {
          handHitEffects.push({x:c.x,y:c.y,t:0});
          creatures.splice(ci,1);
        }
      });
      if(boss && Math.hypot(boss.x-scaledWx,boss.y-scaledWy)<boss.radius+30) {
        handHitEffects.push({x:boss.x,y:boss.y,t:0});
        boss.health -= 1;
      }
    });
    // Update creatures
    creatures.forEach(c=>c.update(dt,canvasElement.width/2,canvasElement.height/2));
    // Collision: creatures with avatars
    const vw = videoElement.videoWidth || 640;
    const vh = videoElement.videoHeight || 480;
    const sw = canvasElement.width / vw;
    const sh = canvasElement.height / vh;
    const centers = metricsList.map(m=>[m.faceCoords[0]*sw, m.faceCoords[1]*sh]);
    let newCreatures=[];
    creatures.forEach(c=>{
      let hit=false;
      centers.forEach((cen,i)=>{
        if(!hit && invulTimers[i]<=0){
          const d=Math.hypot(c.x-cen[0],c.y-cen[1]);
          if(d<50){
            playerLives[i] = (playerLives[i]||3)-1;
            invulTimers[i]=2.0;
            if(playerLives[i]<=0){playerLives[i]=3;invulTimers[i]=2.0;}
            hit=true;
          }
        }
      });
      if(!hit) newCreatures.push(c);
    }); creatures.splice(0,creatures.length,...newCreatures);
    // Trap creatures by mouth (improved effect)
    let rem=[];
    creatures.forEach(c=>{
      let trapped=false;
      centers.forEach((cen,i)=>{
        if(!trapped && metricsList[i].mouth_open_ratio>0.03){
          // Use a larger capture radius and visualize it
          const mouthRadius = 60; // Increased for easier capture
          const d=Math.hypot(c.x-cen[0],c.y-(cen[1]+30)); // mouth is below face center
          // Draw debug capture area
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(cen[0], cen[1]+30, mouthRadius, 0, 2*Math.PI);
          ctx.fillStyle = '#0ff';
          ctx.fill();
          ctx.restore();
          if(d<mouthRadius){
            waveKills++;
            mouthCaptureEffects.push({x:c.x,y:c.y,t:0});
            trapped=true;
          }
        }
      });
      if(!trapped) rem.push(c);
    }); creatures.splice(0,creatures.length,...rem);
    // Transition to boss
    if(state==='minions' && waveKills>=killTargets[waveIndex]){
      const [bx,by]=centers[0]||[canvasElement.width/2,canvasElement.height/2];
      const bossesArr=[SnowKing,FlameWarden,VortexBoss,SpinnerBoss,RamBoss,TrackerBoss,ArticalBoss,ShadowBoss,AlienKingBoss,MadackedaBoss];
      boss=new bossesArr[waveIndex](bx,by);
      bossMaxHealth = boss.health;
      state='boss_'+[ 'snow','fire','vortex','spinner','ram','tracker','artical','shadow','alienking','madackeda' ][waveIndex];
      waveKills=0;creatures.length=0;lasers.length=0;
    }
    // Update boss
    if(boss){
      if(boss.constructor && boss.constructor.name === 'MadackedaBoss' && madackedaImg.complete && madackedaImg.naturalWidth > 0) {
        // Draw both the circle and the image overlayed, centered at boss position
        const size = boss.radius * 2;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = boss.color;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, boss.radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
        ctx.drawImage(madackedaImg, boss.x - boss.radius, boss.y - boss.radius, size, size);
      } else {
        ctx.fillStyle=boss.color;ctx.beginPath();ctx.arc(boss.x,boss.y,boss.radius,0,2*Math.PI);ctx.fill();
      }
      // Draw boss health bar
      if(bossMaxHealth>0) {
        const barWidth = 120, barHeight = 16;
        const x = boss.x - barWidth/2, y = boss.y - boss.radius - 30;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#f44';
        ctx.fillRect(x, y, barWidth * (boss.health/bossMaxHealth), barHeight);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
        ctx.restore();
      }
    }
    // Update lasers/fireballs
    lasers.forEach(l=>l.update(dt));
    fireballs.forEach(f=>f.update(dt));
    // Collision: lasers hitting creatures
    let remainingCreatures = [];
    creatures.forEach(c => {
      let killed = false;
      lasers.forEach(l => {
        if (l.active && Math.hypot(c.x - l.x, c.y - l.y) < c.radius + l.radius) {
          killed = true;
          l.active = false;
        }
      });
      if (!killed) remainingCreatures.push(c);
    });
    creatures.splice(0, creatures.length, ...remainingCreatures);
    // Remove inactive lasers and fireballs
    lasers.splice(0, lasers.length, ...lasers.filter(l => l.active));
    fireballs.splice(0, fireballs.length, ...fireballs.filter(f => f.active));
    // Reduce invulnerability timers
    invulTimers.forEach((v,i)=>invulTimers[i]=Math.max(0,v-dt));
    // Render
    ctx.clearRect(0,0,canvasElement.width,canvasElement.height);
    // Draw level and monster counter to the right of the video overlay
    let overlayLeft = 340; // fallback if faceContainer not found
    if (faceContainer) {
      const rect = faceContainer.getBoundingClientRect();
      overlayLeft = rect.right + 20;
    }
    ctx.save();
    ctx.font = 'bold 22px Arial';
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.92;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Level: ${waveIndex+1}`, overlayLeft, 18);
    if(state === 'minions') {
      ctx.fillText(`Monsters defeated: ${waveKills} / ${killTargets[waveIndex]}`, overlayLeft, 48);
    } else if (boss) {
      ctx.fillText(`Boss: ${boss.constructor.name.replace('Boss','')}`, overlayLeft, 48);
    }
    ctx.restore();
    // Draw mouth capture effects
    mouthCaptureEffects = mouthCaptureEffects.filter(e=>e.t<0.4);
    mouthCaptureEffects.forEach(e=>{
      e.t+=dt;
      ctx.save();
      ctx.globalAlpha = 1-e.t/0.4;
      ctx.strokeStyle = '#0ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 30+e.t*30, 0, 2*Math.PI);
      ctx.stroke();
      ctx.restore();
    });
    // Draw hand hit effects
    handHitEffects = handHitEffects.filter(e=>e.t<0.3);
    handHitEffects.forEach(e=>{
      e.t+=dt;
      ctx.save();
      ctx.globalAlpha = 1-e.t/0.3;
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 25+e.t*20, 0, 2*Math.PI);
      ctx.stroke();
      ctx.restore();
    });
    creatures.forEach(c=>{ctx.fillStyle=c.color;ctx.beginPath();ctx.arc(c.x,c.y,c.radius,0,2*Math.PI);ctx.fill();});
    lasers.forEach(l=>{ctx.fillStyle='red';ctx.beginPath();ctx.arc(l.x,l.y,l.radius,0,2*Math.PI);ctx.fill();});
    fireballs.forEach(f=>{ctx.fillStyle='orange';ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,2*Math.PI);ctx.fill();});
    if(boss){ctx.fillStyle=boss.color;ctx.beginPath();ctx.arc(boss.x,boss.y,boss.radius,0,2*Math.PI);ctx.fill();}
    // Draw avatars with arms/hands
    metricsList.forEach((m,i)=>{
      const vw = videoElement.videoWidth || 640;
      const vh = videoElement.videoHeight || 480;
      const sw = canvasElement.width / vw;
      const sh = canvasElement.height / vh;
      const fx = m.faceCoords[0] * sw;
      const fy = m.faceCoords[1] * sh;
      ctx.strokeStyle='white';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(fx,fy,50,0,2*Math.PI);ctx.stroke();
      // Draw mouth on avatar
      const mouthW = 36 + 120 * Math.min(1, m.mouth_open_ratio); // width grows with mouth open
      const mouthH = 12 + 60 * Math.min(1, m.mouth_open_ratio);  // height grows with mouth open
      ctx.save();
      ctx.translate(fx, fy+30);
      ctx.beginPath();
      ctx.ellipse(0, 0, mouthW/2, mouthH/2, 0, 0, 2*Math.PI);
      ctx.fillStyle = '#a00';
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.restore();
      // hearts
      const hl=playerLives[i]||3;
      for(let j=0;j<hl;j++){ctx.fillStyle='red';ctx.beginPath();ctx.arc(fx-20+ j*15, fy-70,5,0,2*Math.PI);ctx.fill();}
      // cartoon arms/hands
      const faceX=fx,faceY=fy;
      const scaledHandPositions = handPositions.map(([hx, hy]) => [hx * canvasElement.width / faceCanvas.width, hy * canvasElement.height / faceCanvas.height]);
      const lw = scaledHandPositions.filter(h=>h[0]<faceX).sort((a,b)=>((a[0]-faceX)**2+(a[1]-faceY)**2)-((b[0]-faceX)**2+(b[1]-faceY)**2))[0];
      const rw = scaledHandPositions.filter(h=>h[0]>=faceX).sort((a,b)=>((a[0]-faceX)**2+(a[1]-faceY)**2)-((b[0]-faceX)**2+(b[1]-faceY)**2))[0];
      const shY=fy+15;
      // cartoon skin color
      const skin = '#fcd7b6';
      // left arm/hand
      if(lw){
        // connect from left side of face
        const armStartX = faceX-38, armStartY = shY;
        ctx.save();
        ctx.strokeStyle=skin;
        ctx.lineWidth=18;
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(armStartX,armStartY);
        ctx.lineTo(lw[0],lw[1]);
        ctx.stroke();
        // hand
        ctx.beginPath();
        ctx.arc(lw[0],lw[1],22,0,2*Math.PI);
        ctx.fillStyle=skin;
        ctx.fill();
        ctx.lineWidth=4;
        ctx.strokeStyle='#e2b48c';
        ctx.stroke();
        ctx.restore();
      }
      // right arm/hand
      if(rw){
        const armStartX = faceX+38, armStartY = shY;
        ctx.save();
        ctx.strokeStyle=skin;
        ctx.lineWidth=18;
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(armStartX,armStartY);
        ctx.lineTo(rw[0],rw[1]);
        ctx.stroke();
        // hand
        ctx.beginPath();
        ctx.arc(rw[0],rw[1],22,0,2*Math.PI);
        ctx.fillStyle=skin;
        ctx.fill();
        ctx.lineWidth=4;
        ctx.strokeStyle='#e2b48c';
        ctx.stroke();
        ctx.restore();
      }
    });
    requestAnimationFrame(animate);
  }
  animate();
  animate();

  function onFaceResults(results) {
    // Draw video frame and face landmarks on faceCanvas
    faceCtx.save();
    faceCtx.clearRect(0, 0, faceCanvas.width, faceCanvas.height);
    
    // Draw the camera frame
    faceCtx.drawImage(results.image, 0, 0, faceCanvas.width, faceCanvas.height);
    
    // Draw face mesh
    const faces = results.multiFaceLandmarks || [];
    if (faces.length) {
      for (const landmarks of faces) {
        drawConnectors(faceCtx, landmarks, FACEMESH_TESSELATION, {color: '#C0C0C0', lineWidth: 1});
        drawConnectors(faceCtx, landmarks, FACEMESH_RIGHT_EYE, {color: '#FF0000', lineWidth: 1});
        drawConnectors(faceCtx, landmarks, FACEMESH_LEFT_EYE, {color: '#FF0000', lineWidth: 1});
        // Optional: draw iris
        if (typeof FACEMESH_LEFT_IRIS !== 'undefined' && typeof FACEMESH_RIGHT_IRIS !== 'undefined') {
          drawConnectors(faceCtx, landmarks, FACEMESH_LEFT_IRIS, {color: '#FF0000', lineWidth: 1});
          drawConnectors(faceCtx, landmarks, FACEMESH_RIGHT_IRIS, {color: '#FF0000', lineWidth: 1});
        }
      }
    }
    faceCtx.restore();
    
    // Update scaling factors in case video size changed
    updateScalingFactors();
    
    // Compute face metrics for game logic
    metricsList = faces.map((lm, i) => {
      // Ensure prevEyesClosed for this face
      if (prevEyesClosed.length <= i) prevEyesClosed.push(false);
      
      // Get actual video dimensions for scaling
      const actualWidth = videoElement.videoWidth || 640;
      const actualHeight = videoElement.videoHeight || 480;
      
      // Compute face metrics
      // Approximate yaw/pitch by nose position
      const fx = lm[1].x * actualWidth;
      const fy = lm[1].y * actualHeight;
      const yaw = (lm[1].x - 0.5) * 2;
      const pitch = (lm[1].y - 0.5) * 2;
      
      // Mouth open ratio
      const ul = lm[13], ll = lm[14];
      const ml = lm[61], mr = lm[291];
      const vd = Math.hypot((ul.x-ll.x)*actualWidth, (ul.y-ll.y)*actualHeight);
      const hd = Math.hypot((ml.x-mr.x)*actualWidth, (ml.y-mr.y)*actualHeight) || 1e-6;
      const mouth_open_ratio = vd / hd;
      
      // Eye aspect ratio (blink)
      const earCalc = idxs => {
        const p = idxs.map(i => lm[i]);
        const v1 = Math.hypot((p[1].x-p[5].x)*actualWidth, (p[1].y-p[5].y)*actualHeight);
        const v2 = Math.hypot((p[2].x-p[4].x)*actualWidth, (p[2].y-p[4].y)*actualHeight);
        const h = Math.hypot((p[0].x-p[3].x)*actualWidth, (p[0].y-p[3].y)*actualHeight) || 1e-6;
        return (v1 + v2) / (2*h);
      };
      
      const leftEAR = earCalc([33,160,158,133,153,144]);
      const rightEAR = earCalc([362,385,387,263,373,380]);
      const earAvg = (leftEAR + rightEAR) / 2;
      const eyes_closed = earAvg < 0.2;
      const blink = prevEyesClosed[i] && !eyes_closed;
      prevEyesClosed[i] = eyes_closed;
      
      return { yaw, pitch, mouth_open_ratio, eyes_closed, blink, faceCoords: [fx, fy] };
    });
  }
  function onHandResults(results) {
    // Draw hand landmarks on faceCanvas and update positions for game logic
    const handsLandmarks = results.multiHandLandmarks || [];
    // Update game hand positions (normalized to faceCanvas dimensions)
    handPositions = handsLandmarks.map(lm => [lm[0].x * faceCanvas.width, lm[0].y * faceCanvas.height]);
    // Overlay hand connectors/landmarks on faceCanvas
    faceCtx.save();
    for (const landmarks of handsLandmarks) {
      drawConnectors(faceCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
      drawLandmarks(faceCtx, landmarks, {color: '#FF0000', lineWidth: 1});
    }
    faceCtx.restore();
  }

  // Load Madackeda boss image
  const madackedaImg = new window.Image();
  madackedaImg.src = 'images/Madackeda.png';

  // Add pause button to UI
  function createPauseButton() {
    let btn = document.createElement('button');
    btn.id = 'pauseButton';
    btn.textContent = 'Pause';
    btn.style.position = 'fixed';
    btn.style.top = '16px';
    btn.style.right = '16px';
    btn.style.zIndex = 1000;
    btn.style.fontSize = '18px';
    btn.style.padding = '8px 20px';
    btn.style.background = '#333';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.cursor = 'pointer';
    btn.onclick = () => togglePause();
    document.body.appendChild(btn);
  }
  function createPauseOverlay() {
    pauseOverlay = document.createElement('div');
    pauseOverlay.id = 'pauseOverlay';
    pauseOverlay.textContent = 'Paused';
    pauseOverlay.style.position = 'fixed';
    pauseOverlay.style.top = 0;
    pauseOverlay.style.left = 0;
    pauseOverlay.style.width = '100vw';
    pauseOverlay.style.height = '100vh';
    pauseOverlay.style.background = 'rgba(0,0,0,0.5)';
    pauseOverlay.style.color = '#fff';
    pauseOverlay.style.display = 'flex';
    pauseOverlay.style.alignItems = 'center';
    pauseOverlay.style.justifyContent = 'center';
    pauseOverlay.style.fontSize = '48px';
    pauseOverlay.style.zIndex = 2000;
    pauseOverlay.style.display = 'none';
    document.body.appendChild(pauseOverlay);
    // Add unpause button
    let unpauseBtn = document.createElement('button');
    unpauseBtn.textContent = 'Unpause';
    unpauseBtn.style.fontSize = '24px';
    unpauseBtn.style.marginTop = '32px';
    unpauseBtn.style.padding = '12px 32px';
    unpauseBtn.style.background = '#333';
    unpauseBtn.style.color = '#fff';
    unpauseBtn.style.border = 'none';
    unpauseBtn.style.borderRadius = '8px';
    unpauseBtn.style.cursor = 'pointer';
    unpauseBtn.onclick = () => togglePause();
    pauseOverlay.appendChild(document.createElement('br'));
    pauseOverlay.appendChild(unpauseBtn);
  }
  function togglePause() {
    paused = !paused;
    if (paused) {
      pauseOverlay.style.display = 'flex';
    } else {
      pauseOverlay.style.display = 'none';
      lastTime = performance.now();
      requestAnimationFrame(animate);
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      togglePause();
    }
  });
  createPauseButton();
  createPauseOverlay();
})();