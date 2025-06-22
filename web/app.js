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
  
  // Keyboard handling for portal creation
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p' && !elderDimensionActive) {
      // Create Elder Dimension portal
      const portalX = Math.random() * (canvasElement.width - 200) + 100;
      const portalY = Math.random() * (canvasElement.height - 200) + 100;
      portals.push(new ElderPortal(portalX, portalY));
    }
  });
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
  
  // Snake projectile for XYZ
  class Snake extends Laser {
    constructor(x, y, targetX, targetY) {
      const dx = targetX - x, dy = targetY - y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      super(x, y, dx/dist * 250, dy/dist * 250);
      this.radius = 10;
      this.color = 'lightgreen';
      this.wiggleAngle = 0;
    }
    update(dt) {
      this.wiggleAngle += dt * 10;
      const offset = Math.sin(this.wiggleAngle) * 30;
      const perpX = -this.vy / Math.hypot(this.vx, this.vy);
      const perpY = this.vx / Math.hypot(this.vx, this.vy);
      this.x += this.vx * dt + perpX * offset * dt;
      this.y += this.vy * dt + perpY * offset * dt;
      if (this.x < 0 || this.x > canvasElement.width || this.y < 0 || this.y > canvasElement.height) {
        this.active = false;
      }
    }
  }
  
  // Gary's Fang attack
  class Fang extends Laser {
    constructor(x, y, targetX, targetY) {
      const dx = targetX - x, dy = targetY - y;
      const dist = Math.hypot(dx, dy) || 1e-6;
      super(x, y, dx/dist * 400, dy/dist * 400);
      this.radius = 12;
      this.color = '#8B008B';
      this.stopRespawn = true;
    }
  }
  
  // Village class
  class Village {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 40;
      this.health = 5;
      this.maxHealth = 5;
      this.destroyed = false;
    }
    takeDamage() {
      this.health--;
      if (this.health <= 0) {
        this.destroyed = true;
      }
    }
  }
  
  // Helper function to spawn a random minion at (x, y)
  function spawnRandomMinion(x, y, sw, sh) {
    const minionTypes = [Creature, Snowie, FireSpinner, Ghost, Skeleton, Caster, Dragon];
    const Type = minionTypes[Math.floor(Math.random() * minionTypes.length)];
    creatures.push(new Type(x, y, sw, sh));
  }
  
  // Base boss class - must be defined before any boss extends it
  class BaseBoss {
    constructor(cx,cy){ this.x=cx; this.y=cy-150; this.radius=40; this.health=20; this.speed=60; this.color='purple'; this.angle=0;
      this.minionTimer = 0;
      this.minionInterval = 2.0; // seconds
    }
    update(dt,tx,ty){
      this.angle+=dt;
      this.x=tx+Math.cos(this.angle)*150;
      this.y=ty+Math.sin(this.angle)*80;
    }
    spawnMinions(dt) {
      this.minionTimer += dt;
      if (this.minionTimer >= this.minionInterval) {
        spawnRandomMinion(this.x, this.y, canvasElement.width, canvasElement.height);
        this.minionTimer = 0;
      }
    }
  }
  
  // XYZ creature (honsil) that Gary rides
  class XYZ extends BaseBoss {
    constructor(cx, cy) {
      super(cx, cy);
      this.radius = 60;
      this.health = 100;
      this.color = '#663399';
      this.snakeInterval = 2.0;
      this.snakeTimer = 0;
      this.dashInterval = 5.0;
      this.dashTimer = 0;
      this.dashing = false;
      this.dashDuration = 0.8;
      this.dashTime = 0;
      this.dashVx = 0;
      this.dashVy = 0;
      this.villageTarget = null;
      this.villageAttackTimer = 0;
    }
    update(dt, tx, ty) {
      // Target villages if they exist
      if (villages.length > 0 && !this.villageTarget) {
        // Find nearest village
        let nearest = null;
        let nearestDist = Infinity;
        villages.forEach(v => {
          if (!v.destroyed) {
            const dist = Math.hypot(v.x - this.x, v.y - this.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = v;
            }
          }
        });
        this.villageTarget = nearest;
      }
      
      // Move towards village if targeting one
      const targetX = this.villageTarget && !this.villageTarget.destroyed ? this.villageTarget.x : tx;
      const targetY = this.villageTarget && !this.villageTarget.destroyed ? this.villageTarget.y : ty;
      
      if (!this.dashing) {
        if (this.villageTarget && !this.villageTarget.destroyed) {
          // Move directly towards village
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const dist = Math.hypot(dx, dy) || 1e-6;
          this.x += (dx/dist) * this.speed * 2 * dt;
          this.y += (dy/dist) * this.speed * 2 * dt;
          
          // Attack village when close
          if (dist < this.radius + this.villageTarget.radius) {
            this.villageAttackTimer += dt;
            if (this.villageAttackTimer >= 0.5) {
              this.villageTarget.takeDamage();
              this.villageAttackTimer = 0;
              
              if (this.villageTarget.destroyed) {
                this.villageTarget = null;
              }
            }
          }
        } else {
          super.update(dt, tx, ty);
        }
        
        this.dashTimer += dt;
        if (this.dashTimer >= this.dashInterval) {
          this.dashing = true;
          this.dashTime = 0;
          this.dashTimer = 0;
          const dx = targetX - this.x;
          const dy = targetY - this.y;
          const dist = Math.hypot(dx, dy) || 1e-6;
          this.dashVx = dx/dist * 500;
          this.dashVy = dy/dist * 500;
        }
      } else {
        this.dashTime += dt;
        this.x += this.dashVx * dt;
        this.y += this.dashVy * dt;
        if (this.dashTime >= this.dashDuration) {
          this.dashing = false;
        }
      }
      // Snake attacks
      this.snakeTimer += dt;
      if (this.snakeTimer >= this.snakeInterval) {
        snakes.push(new Snake(this.x, this.y, targetX, targetY));
        this.snakeTimer = 0;
      }
      
      // Melee attacks on players when close
      if ((!this.villageTarget || this.villageTarget.destroyed) && this.centers) {
        // Attack players in melee range
        const meleeRange = this.radius + 60;
        this.centers.forEach((cen, i) => {
          if (!this.eatenByGary[i] && this.invulTimers[i] <= 0) {
            const dist = Math.hypot(this.x - cen[0], this.y - cen[1]);
            if (dist < meleeRange) {
              // Dragon bite attack
              this.playerLives[i] = (this.playerLives[i] || 3) - 1;
              this.invulTimers[i] = 2.0;
              if (this.playerLives[i] <= 0) {
                this.playerLives[i] = 3;
                this.invulTimers[i] = 2.0;
              }
            }
          }
        });
      }
    }
  }
  
  // Scanner Ducky class for threat detection
  class ScannerDucky {
    constructor(gary) {
      this.gary = gary;
      this.scanResults = new Map();
      this.scanRadius = 200;
      this.scanInterval = 0.5;
      this.scanTimer = 0;
    }
    scan(creatures, boss, players) {
      this.scanResults.clear();
      // Scan creatures
      creatures.forEach(c => {
        const dist = Math.hypot(c.x - this.gary.x, c.y - this.gary.y);
        if (dist < this.scanRadius) {
          let threat = 'safe';
          let powers = [];
          if (c instanceof Dragon) { threat = 'danger'; powers.push('flight', 'fire'); }
          else if (c instanceof Ghost) { threat = 'medium'; powers.push('phase'); }
          else if (c instanceof Caster) { threat = 'medium'; powers.push('magic'); }
          else if (c instanceof FireSpinner) { threat = 'medium'; powers.push('fire-spin'); }
          else if (c instanceof Skeleton) { threat = 'low'; powers.push('undead'); }
          else if (c instanceof Snowie) { threat = 'safe'; powers.push('ice'); }
          this.scanResults.set(c, { threat, powers, type: 'creature' });
        }
      });
      // Scan boss
      if (boss && Math.hypot(boss.x - this.gary.x, boss.y - this.gary.y) < this.scanRadius) {
        this.scanResults.set(boss, { threat: 'extreme', powers: ['boss-abilities'], type: 'boss' });
      }
      // Scan players
      players.forEach((p, i) => {
        if (p && Math.hypot(p[0] - this.gary.x, p[1] - this.gary.y) < this.scanRadius) {
          this.scanResults.set(`player_${i}`, { threat: 'rival', powers: ['laser-eyes', 'mouth-capture'], type: 'player' });
        }
      });
    }
    isSafeToRide(entity) {
      const result = this.scanResults.get(entity);
      return result && result.threat === 'safe';
    }
  }

  // Space Jail class for trapping monsters
  class SpaceJail {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 150;
      this.height = 150;
      this.active = false;
      this.trapped = [];
      this.trapdoorOpen = false;
      this.portalEffect = 0;
    }
    activate() {
      this.active = true;
      this.trapdoorOpen = true;
      this.portalEffect = 1;
    }
    deactivate() {
      this.trapdoorOpen = false;
      setTimeout(() => {
        this.active = false;
        this.trapped = [];
      }, 500);
    }
    update(dt, creatures) {
      if (this.portalEffect > 0) this.portalEffect -= dt * 2;
      if (this.active && this.trapdoorOpen) {
        creatures.forEach(c => {
          const dx = c.x - this.x;
          const dy = c.y - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 100 && !this.trapped.includes(c)) {
            // Suck creature into space jail
            const pull = 200;
            c.x -= (dx/dist) * pull * dt;
            c.y -= (dy/dist) * pull * dt;
            if (dist < 20) {
              this.trapped.push(c);
              const idx = creatures.indexOf(c);
              if (idx > -1) creatures.splice(idx, 1);
            }
          }
        });
      }
    }
    render(ctx) {
      if (!this.active) return;
      ctx.save();
      // Portal effect
      ctx.strokeStyle = `rgba(138, 43, 226, ${this.portalEffect})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 100, 0, 2*Math.PI);
      ctx.stroke();
      // Space jail box
      ctx.fillStyle = 'rgba(25, 25, 112, 0.3)';
      ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
      ctx.strokeStyle = '#4169E1';
      ctx.lineWidth = 3;
      ctx.strokeRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
      // Trapped count
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Trapped: ${this.trapped.length}`, this.x, this.y - this.height/2 - 10);
      ctx.restore();
    }
  }

  // Gary boss with eye-contact mechanic
  class GaryBoss extends BaseBoss {
    constructor(cx, cy, isShadow = false) {
      super(cx, cy);
      this.isShadow = isShadow;
      this.radius = 45;
      this.health = 999; // Immortal
      this.maxHealth = 999;
      this.color = isShadow ? '#330033' : '#FF69B4';
      this.ridingXyz = null;
      this.ridingShip = null;
      this.attackInterval = 1.5;
      this.attackTimer = 0;
      this.beingLookedAt = false;
      this.angerLevel = 0;
      this.provoked = false;
      this.teleportInterval = isShadow ? 4.0 : 6.0;
      this.teleportTimer = 0;
      this.crystalInterval = 2.5;
      this.crystalTimer = 0;
      this.fangInterval = 3.0;
      this.fangTimer = 0;
      this.ignoresPause = true;
      // New features
      this.scannerDucky = new ScannerDucky(this);
      this.heldItem = null; // Can be 'remote', 'weapon', etc.
      this.spaceJail = null;
      this.voiceTimer = 0;
      this.voiceInterval = 8.0; // Increased interval for audio
      this.lastVoiceLine = "";
      
      // Audio setup for Gary's voice
      this.audio = new Audio('gary.mp3'); // Fix path - gary.mp3 is in web folder
      this.audio.volume = 0.7;
      this.audioPlaying = false;
      
      // Eating and growth
      this.eatRadius = 30;
      this.eatTimer = 0;
      this.eatInterval = 0.5;
      this.totalEaten = 0;
      this.baseRadius = 45;
      this.growthRate = 2; // Grow 2 pixels per entity eaten
      this.huntTarget = null;
      this.huntSpeed = 150;
    }
    checkEyeContact(metricsList, centers) {
      this.beingLookedAt = false;
      for (let i = 0; i < metricsList.length; i++) {
        const m = metricsList[i];
        const [cx, cy] = centers[i];
        // Check if player is looking at Gary
        const dx = this.x - cx;
        const dy = this.y - cy;
        const dist = Math.hypot(dx, dy);
        if (dist < 300) {
          // Simple check: if eyes are open and face is pointed toward Gary
          if (!m.eyes_closed) {
            this.beingLookedAt = true;
            if (!this.provoked) {
              this.angerLevel = Math.min(this.angerLevel + 0.02, 1.0);
              if (this.angerLevel >= 1.0) {
                this.provoked = true;
              }
            }
            break;
          }
        }
      }
    }
    update(dt, tx, ty, metricsList, centers, creatures, boss) {
      // Scanner ducky periodic scan
      this.scannerDucky.scanTimer += dt;
      if (this.scannerDucky.scanTimer >= this.scannerDucky.scanInterval) {
        this.scannerDucky.scan(creatures, boss, centers);
        this.scannerDucky.scanTimer = 0;
        
        // Attack all intruders in Elder Dimension
        if (elderDimensionActive) {
          creatures.forEach((c, idx) => {
            // Attack anything that's not XYZ
            if (!(c instanceof XYZ)) {
              const result = this.scannerDucky.scanResults.get(c);
              if (result && result.threat !== 'safe') {
                // Instant kill intruders
                creatures.splice(idx, 1);
                this.speak("");
                
                // Build army data from scanned powers
                if (!this.army) this.army = [];
                this.army.push({
                  type: c.constructor.name,
                  powers: result.powers,
                  threat: result.threat
                });
              }
            }
          });
        }
        
        // Check for safe creatures to ride
        if (!this.ridingXyz && !this.ridingShip) {
          creatures.forEach(c => {
            if (this.scannerDucky.isSafeToRide(c) && Math.hypot(c.x - this.x, c.y - this.y) < 100) {
              // Ride the safe creature
              this.ridingXyz = c;
              this.speak("");
            }
          });
        }
      }
      
      // Hunt for food (any creature or player)
      if (!this.huntTarget || this.huntTarget.health <= 0 || this.huntTarget.destroyed) {
        // Find nearest prey
        let nearestPrey = null;
        let nearestDist = Infinity;
        
        // Hunt creatures
        creatures.forEach(c => {
          if (c !== this.ridingXyz && c.health > 0) {
            const dist = Math.hypot(c.x - this.x, c.y - this.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestPrey = c;
            }
          }
        });
        
        // Also hunt players
        centers.forEach((cen, i) => {
          if (!eatenByGary[i]) {
            const dist = Math.hypot(cen[0] - this.x, cen[1] - this.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestPrey = { x: cen[0], y: cen[1], type: 'player', index: i };
            }
          }
        });
        
        this.huntTarget = nearestPrey;
      }
      
      // Movement logic
      let targetX = tx;
      let targetY = ty;
      
      // If hunting, move toward prey
      if (this.huntTarget) {
        targetX = this.huntTarget.x;
        targetY = this.huntTarget.y;
      }
      
      if (this.ridingShip) {
        // Ship controls - Gary can fly around
        const shipSpeed = 200;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        this.x += (dx/dist) * shipSpeed * dt;
        this.y += (dy/dist) * shipSpeed * dt;
      } else if (this.ridingXyz && this.ridingXyz.health > 0) {
        // Ride on top of XYZ
        this.x = this.ridingXyz.x;
        this.y = this.ridingXyz.y - 50;
      } else {
        // Hunt movement
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        this.x += (dx/dist) * this.huntSpeed * dt;
        this.y += (dy/dist) * this.huntSpeed * dt;
      }
      
      // Check eye contact
      if (metricsList && centers) {
        this.checkEyeContact(metricsList, centers);
      }
      
      // Eating logic
      this.eatTimer += dt;
      if (this.eatTimer >= this.eatInterval) {
        // Check creatures
        for (let i = creatures.length - 1; i >= 0; i--) {
          const c = creatures[i];
          if (c !== this.ridingXyz && Math.hypot(c.x - this.x, c.y - this.y) < this.radius + this.eatRadius) {
            // Eat the creature
            creatures.splice(i, 1);
            this.totalEaten++;
            this.radius = this.baseRadius + (this.totalEaten * this.growthRate);
            this.speak("");
            this.huntTarget = null; // Find new target
          }
        }
        
        // Check players
        centers.forEach((cen, i) => {
          if (!eatenByGary[i] && Math.hypot(cen[0] - this.x, cen[1] - this.y) < this.radius + this.eatRadius) {
            // Eat the player
            eatenByGary[i] = true;
            playerLives[i] = 0;
            this.totalEaten++;
            this.radius = this.baseRadius + (this.totalEaten * this.growthRate);
            this.speak("");
            this.huntTarget = null; // Find new target
          }
        });
        
        this.eatTimer = 0;
      }
      
      // Handle held items
      if (this.heldItem === 'remote' && Math.random() < 0.01) {
        // Randomly activate space jail with remote
        if (!this.spaceJail || !this.spaceJail.active) {
          const jailX = this.x + (Math.random() - 0.5) * 300;
          const jailY = this.y + (Math.random() - 0.5) * 300;
          this.spaceJail = new SpaceJail(jailX, jailY);
          this.spaceJail.activate();
          this.speak("Time for space jail!");
        }
      }
      
      // Update space jail
      if (this.spaceJail) {
        this.spaceJail.update(dt, creatures);
        // Deactivate after 3 seconds
        if (this.spaceJail.active && this.spaceJail.portalEffect <= 0 && Math.random() < 0.3 * dt) {
          this.spaceJail.deactivate();
        }
      }
      
      // Voice talking - more frequent when hunting
      this.voiceTimer += dt;
      const voiceInterval = this.huntTarget ? 4.0 : this.voiceInterval;
      if (this.voiceTimer >= voiceInterval) {
        this.speak(""); // Just play the audio
        this.voiceTimer = 0;
      }
      
      // Attacks only if not being looked at (or if provoked)
      if (!this.beingLookedAt || this.provoked) {
        this.attackTimer += dt;
        if (this.attackTimer >= this.attackInterval) {
          // Crystal throw
          const dx = tx - this.x;
          const dy = ty - this.y;
          const dist = Math.hypot(dx, dy) || 1e-6;
          const vx = dx/dist * 300;
          const vy = dy/dist * 300;
          const crystal = new PurpleLaser(this.x, this.y, vx, vy);
          crystal.color = this.isShadow ? '#FF00FF' : '#FFB6C1';
          lasers.push(crystal);
          this.attackTimer = 0;
        }
        
        // Fang attack
        this.fangTimer += dt;
        if (this.fangTimer >= this.fangInterval && creatures.length > 0) {
          // Target nearest creature
          let nearestCreature = null;
          let nearestDist = Infinity;
          creatures.forEach(c => {
            const dist = Math.hypot(c.x - this.x, c.y - this.y);
            if (dist < nearestDist && !(c instanceof XYZ)) {
              nearestDist = dist;
              nearestCreature = c;
            }
          });
          
          if (nearestCreature) {
            const fang = new Fang(this.x, this.y, nearestCreature.x, nearestCreature.y);
            lasers.push(fang);
            this.fangTimer = 0;
            this.speak("");
          }
        }
      }
      
      // Teleportation
      this.teleportTimer += dt;
      if (this.teleportTimer >= this.teleportInterval) {
        // If riding XYZ, teleport off its back
        if (this.ridingXyz) {
          this.ridingXyz = null;
          this.speak("Time to teleport off XYZ!");
        }
        
        if (this.isShadow) {
          // Shadow Gary teleports to dark corners
          const corners = [[50, 50], [canvasElement.width-50, 50], 
                          [50, canvasElement.height-50], [canvasElement.width-50, canvasElement.height-50]];
          const corner = corners[Math.floor(Math.random() * corners.length)];
          this.x = corner[0];
          this.y = corner[1];
        } else {
          // Normal Gary random teleport
          this.x = Math.random() * (canvasElement.width - 100) + 50;
          this.y = Math.random() * (canvasElement.height - 100) + 50;
        }
        this.teleportTimer = 0;
        
        // Randomly pick up items after teleport
        if (Math.random() < 0.3 && !this.heldItem) {
          const items = ['remote', 'crystal', 'scanner'];
          this.heldItem = items[Math.floor(Math.random() * items.length)];
          this.speak(`I found a ${this.heldItem}!`);
        }
        
        // Randomly find a ship to drive
        if (Math.random() < 0.1 && !this.ridingShip && !this.ridingXyz) {
          this.ridingShip = true;
          this.speak("I found a spaceship! Time to fly!");
        }
      }
    }
    
    speak(text) {
      // Play audio instead of showing text
      if (!this.audioPlaying) {
        this.audio.currentTime = 0;
        this.audio.play().catch(e => console.log('Audio play failed:', e));
        this.audioPlaying = true;
        this.audio.onended = () => {
          this.audioPlaying = false;
        };
      }
    }
  }
  
  // Elder Dimension Portal
  class ElderPortal {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 40;
      this.active = true;
      this.pulse = 0;
      this.spawnTimer = 0;
      this.garySpawned = false;
    }
    update(dt) {
      this.pulse += dt * 2;
      this.spawnTimer += dt;
      if (this.spawnTimer >= 5.0 && !this.garySpawned) {
        // Spawn Gary from portal
        const isShadow = Math.random() < 0.01; // 1% chance for Shadow Gary
        garyBoss = new GaryBoss(this.x, this.y, isShadow);
        
        // Also spawn XYZ for Gary to ride
        const xyz = new XYZ(this.x, this.y + 100);
        xyz.health = 100; // Give XYZ more health
        garyBoss.ridingXyz = xyz;
        creatures.push(xyz);
        
        // Gary starts with a random item
        const startItems = ['remote', 'crystal', 'scanner'];
        garyBoss.heldItem = startItems[Math.floor(Math.random() * startItems.length)];
        garyBoss.speak(`I have arrived with my ${garyBoss.heldItem}!`);
        
        this.garySpawned = true;
        elderDimensionActive = true;
        
        // Spawn villages around the map
        for (let i = 0; i < 3; i++) {
          const vx = Math.random() * (canvasElement.width - 200) + 100;
          const vy = Math.random() * (canvasElement.height - 200) + 100;
          villages.push(new Village(vx, vy));
        }
        
        // Portal disappears after spawning
        const portalIndex = portals.indexOf(this);
        if (portalIndex > -1) {
          portals.splice(portalIndex, 1);
        }
      }
    }
  }
  // Boss subclasses
  class SnowKing extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=30; this.color='lightblue'; this.spawn=3; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.spawn){ creatures.push(new Snowie(this.x,this.y,canvasElement.width,canvasElement.height)); this.timer=0;} }
  }
  class FlameWarden extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=25; this.color='orange'; this.spawn=2; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.spawn){ creatures.push(new FireSpinner(this.x,this.y,canvasElement.width,canvasElement.height)); this.timer=0;} }
  }
  class VortexBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=35; this.color='blue'; this.pulse=3; this.timer=0; this.pull=100; this.radiusPull=200; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.pulse){ creatures.forEach(c=>{ const dx=this.x-c.x, dy=this.y-c.y, d=Math.hypot(dx,dy)||1; if(d<this.radiusPull){ c.x+=dx/d*this.pull*dt; c.y+=dy/d*this.pull*dt;} }); this.timer=0;} }
  }
  class SpinnerBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=30; this.color='yellow'; this.spin=6; this.interval=2.5; this.timer=0; }
    update(dt,tx,ty){ this.angle+=this.spin*dt; this.x=tx; this.y=ty-150; this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.interval){ for(let a=0;a<360;a+=45){ const r=a*Math.PI/180; lasers.push(new PurpleLaser(this.x,this.y,Math.cos(r)*300,Math.sin(r)*300)); } this.timer=0;} }
  }
  class RamBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=40; this.color='brown'; this.charge=400; this.interval=4; this.timer=0; this.charging=false; this.dur=0.5; this.t=0; }
    update(dt,tx,ty){ if(!this.charging){ this.timer+=dt; if(this.timer>=this.interval){ this.charging=true; this.t=0; this.timer=0; const dcs=metricsList.map(m=>[Math.hypot(this.x-m.faceCoords[0],this.y-m.faceCoords[1]),m.faceCoords]); const tgt=dcs.sort((a,b)=>a[0]-b[0])[0][1]; const dx=tgt[0]-this.x, dy=tgt[1]-this.y, d=Math.hypot(dx,dy)||1; this.vx=dx/d*this.charge; this.vy=dy/d*this.charge; }} else { this.t+=dt; this.x+=this.vx*dt; this.y+=this.vy*dt; if(this.t>=this.dur) this.charging=false; } this.spawnMinions(dt); }
  }
  class TrackerBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=30; this.color='lime'; this.interval=3; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.interval){ const dcs=metricsList.map(m=>[Math.hypot(this.x-m.faceCoords[0],this.y-m.faceCoords[1]),m.faceCoords]); const tgt=dcs.sort((a,b)=>a[0]-b[0])[0][1]; const dx=tgt[0]-this.x, dy=tgt[1]-this.y, d=Math.hypot(dx,dy)||1; lasers.push(new PurpleLaser(this.x,this.y,dx/d*200,dy/d*200)); this.timer=0;} }
  }
  class ArticalBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=35; this.color='teal'; this.interval=4; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.interval && metricsList.length){ const idx=Math.floor(Math.random()*metricsList.length); this.x=metricsList[idx].faceCoords[0]; this.y=metricsList[idx].faceCoords[1]; this.timer=0;} }
  }
  class ShadowBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=40; this.color='black'; this.interval=5; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.interval){ const edge=['top','bottom','left','right'][Math.floor(Math.random()*4)]; const sw=canvasElement.width, sh=canvasElement.height; let px,py; if(edge==='top'){px=Math.random()*sw;py=0;}else if(edge==='bottom'){px=Math.random()*sw;py=sh;}else if(edge==='left'){px=0;py=Math.random()*sh;}else{px=sw;py=Math.random()*sh;} creatures.push(new Creature(px,py,sw,sh)); this.timer=0;} }
  }
  class AlienKingBoss extends BaseBoss { constructor(cx,cy){ super(cx,cy); this.health=60; this.color='purple'; this.interval=4; this.timer=0; }
    update(dt,tx,ty){ super.update(dt,tx,ty); this.spawnMinions(dt); this.timer+=dt; if(this.timer>=this.interval){ for(let a=0;a<360;a+=30){ const r=(a+Math.random()*30)*Math.PI/180; lasers.push(new PurpleLaser(this.x,this.y,Math.cos(r)*350,Math.sin(r)*350)); } this.timer=0;} }
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
  let snakes = [];
  const portals = [];
  const villages = [];
  let garyBoss = null;
  let elderDimensionActive = false;
  let boss = null;
  let waveIndex = 0;
  let waveKills = 0;
  let state = 'minions';
  let lastSpawn = 0;
  const spawnInterval = 1.5;
  const killTargets = [20,30,40,50,60,70,80,90,100,120];
  let playerLives = [];
  let invulTimers = [];
  let eatenByGary = []; // Track which players were eaten
  let noRespawnCreatures = new Set(); // Creatures hit by fang can't respawn
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
    
    // Show Elder Portal button
    document.getElementById('elderPortalButton').style.display = 'block';
    
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
  
  // Elder Portal button functionality
  const elderPortalBtn = document.getElementById('elderPortalButton');
  elderPortalBtn.addEventListener('click', () => {
    if (!elderDimensionActive) {
      // Create Elder Dimension portal at random location
      const portalX = Math.random() * (canvasElement.width - 200) + 100;
      const portalY = Math.random() * (canvasElement.height - 200) + 100;
      portals.push(new ElderPortal(portalX, portalY));
      
      // Optional: disable button temporarily to prevent spam
      elderPortalBtn.disabled = true;
      elderPortalBtn.textContent = 'Portal Opening...';
      
      setTimeout(() => {
        elderPortalBtn.disabled = false;
        elderPortalBtn.textContent = 'Build Portal to Elder';
      }, 6000); // Re-enable after 6 seconds
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
  // Track previous face positions for shooting direction
  let prevFaceCenters = [];
  // Global to store latest face landmarks for use in animation loop
  let latestFaceLandmarks = [];
  // Track last nonzero head movement direction for each player
  let lastHeadDir = [];
  function animate(now=performance.now()) {
    if (paused) return;
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    getMicData();
    const nowSec = performance.now()/1000;
    if(state === 'minions' && nowSec - lastSpawn > spawnInterval && !elderDimensionActive) {
      const r = Math.random();
      const types = [Creature, Snowie, FireSpinner, Ghost, Skeleton, Caster, Dragon];
      const Type = types[Math.floor(r*types.length)];
      creatures.push(new Type(0,0, canvasElement.width, canvasElement.height));
      lastSpawn = nowSec;
    }
    // Precompute video/canvas scaling and centers for defeat logic
    const vw = videoElement.videoWidth || 640;
    const vh = videoElement.videoHeight || 480;
    const sw = canvasElement.width / vw;
    const sh = canvasElement.height / vh;
    // Mirror centers for all logic
    const centers = metricsList.map(m=>[canvasElement.width - (m.faceCoords[0]*sw), m.faceCoords[1]*sh]);
    // Track previous face positions for shooting direction
    if (prevFaceCenters.length !== centers.length) prevFaceCenters = centers.map(c => [...c]);
    // Track last nonzero head movement direction
    if (lastHeadDir.length !== centers.length) lastHeadDir = centers.map(_ => [0, -1]);
    centers.forEach((curr, i) => {
      const prev = prevFaceCenters[i] || curr;
      // Revert: do not mirror the head movement direction for x
      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        // Update last head direction if significant movement
        lastHeadDir[i] = [dx, dy];
      }
    });
    // --- Robust monster defeat logic ---
    // 1. Mark creatures for removal and reason
    let defeatMap = new Map(); // c => reason
    // Hand/arm defeat
    handPositions.forEach(([wx,wy], handIdx)=>{
      // Skip if this hand belongs to an eaten player
      // Note: This is a simplified check - in multiplayer, we'd need to map hands to specific players
      let skipHand = false;
      for (let i = 0; i < eatenByGary.length; i++) {
        if (eatenByGary[i]) {
          skipHand = true;
          break;
        }
      }
      if (skipHand) return;
      
      const scaledWx = wx * canvasElement.width / faceCanvas.width;
      const scaledWy = wy * canvasElement.height / faceCanvas.height;
      creatures.forEach((c,ci)=>{
        if(!defeatMap.has(c) && Math.hypot(c.x-scaledWx,c.y-scaledWy)<c.radius+20) {
          handHitEffects.push({x:c.x,y:c.y,t:0});
          defeatMap.set(c, 'hand');
        }
      });
      if(boss && Math.hypot(boss.x-scaledWx,boss.y-scaledWy)<boss.radius+30) {
        handHitEffects.push({x:boss.x,y:boss.y,t:0});
        boss.health -= 1;
        boss.health = Math.max(0, boss.health);
        console.log('Boss hit! Health:', boss.health);
        if (boss.health === 0) {
          // Advance to next level
          boss = null;
          waveIndex = Math.min(waveIndex + 1, killTargets.length - 1);
          state = 'minions';
          waveKills = 0;
          lastSpawn = performance.now()/1000;
        }
      }
    });
    // Laser defeat
    lasers.forEach(l => {
      creatures.forEach(c => {
        if(!defeatMap.has(c) && l.active && Math.hypot(c.x - l.x, c.y - l.y) < c.radius + l.radius) {
          l.active = false;
          defeatMap.set(c, 'laser');
        }
      });
      // Boss collision detection
      if (boss && l.active && Math.hypot(boss.x - l.x, boss.y - l.y) < boss.radius + l.radius) {
        l.active = false;
        boss.health -= 1;
        boss.health = Math.max(0, boss.health);
        console.log('Boss hit! Health:', boss.health);
        if (boss.health === 0) {
          // Advance to next level
          boss = null;
          waveIndex = Math.min(waveIndex + 1, killTargets.length - 1);
          state = 'minions';
          waveKills = 0;
          lastSpawn = performance.now()/1000;
        }
      }
    });
    // Mouth capture defeat
    creatures.forEach(c=>{
      centers.forEach((cen,i)=>{
        // Skip if player is eaten by Gary
        if (eatenByGary[i]) return;
        
        if(!defeatMap.has(c) && metricsList[i].mouth_open_ratio>0.03){
          const mouthRadius = 60;
          const d=Math.hypot(c.x-cen[0],c.y-(cen[1]+30));
          if(d<mouthRadius){
            mouthCaptureEffects.push({x:c.x,y:c.y,t:0});
            defeatMap.set(c, 'mouth');
          }
        }
      });
    });
    // 2. Remove marked creatures and increment waveKills
    let survivors = [];
    creatures.forEach(c => {
      if(defeatMap.has(c)) waveKills++;
      else survivors.push(c);
    });
    creatures.splice(0, creatures.length, ...survivors);
    
    // Snake collisions with players
    snakes.forEach(s => {
      centers.forEach((cen, i) => {
        if (invulTimers[i] <= 0 && Math.hypot(s.x - cen[0], s.y - cen[1]) < s.radius + 50) {
          playerLives[i] = (playerLives[i] || 3) - 1;
          invulTimers[i] = 2.0;
          if (playerLives[i] <= 0) {
            playerLives[i] = 3;
            invulTimers[i] = 2.0;
          }
          s.active = false;
        }
      });
    });
    snakes = snakes.filter(s => s.active);
    
    // Gary's eating is now handled in her update method
    
    // Gary is immortal (already dead/undead) - lasers just pass through
    if (garyBoss) {
      lasers.forEach(l => {
        if (l.active && Math.hypot(garyBoss.x - l.x, garyBoss.y - l.y) < garyBoss.radius + l.radius) {
          // Lasers pass through Gary without damage
          l.active = false;
          garyBoss.speak(""); // Gary laughs at the attempt
        }
      });
    }
    // Update invulnerability timers
    for (let i = 0; i < invulTimers.length; i++) {
      if (invulTimers[i] > 0) {
        invulTimers[i] -= dt;
        if (invulTimers[i] < 0) invulTimers[i] = 0;
      }
    }
    
    // Update creatures
    creatures.forEach(c=> {
      if (c instanceof XYZ) {
        // Pass centers to XYZ for player attacks
        c.centers = centers;
        c.invulTimers = invulTimers;
        c.playerLives = playerLives;
        c.eatenByGary = eatenByGary;
      }
      c.update(dt,canvasElement.width/2,canvasElement.height/2);
    });
    // Collision: creatures with avatars
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
    // Transition to boss
    if(state==='minions' && waveKills>=killTargets[waveIndex]){
      const [bx,by]=centers[0]||[canvasElement.width/2,canvasElement.height/2];
      const bossesArr=[SnowKing,FlameWarden,VortexBoss,SpinnerBoss,RamBoss,TrackerBoss,ArticalBoss,ShadowBoss,AlienKingBoss,MadackedaBoss];
      boss=new bossesArr[waveIndex](bx,by);
      bossMaxHealth = boss.health;
      state='boss_'+[ 'snow','fire','vortex','spinner','ram','tracker','artical','shadow','alienking','madackeda' ][waveIndex];
      waveKills=0;creatures.length=0;lasers.length=0;
    }
    // Voice-activated laser (from both eyes, using head movement direction)
    if(audioAmplitude > 0.25) { // Threshold for loud sound
      metricsList.forEach((metrics,i) => {
        // Skip if player is eaten by Gary
        if (eatenByGary[i]) return;
        
        const curr = centers[i];
        const fx = curr[0];
        const fy = curr[1];
        // Use avatar's drawn eye positions
        const leftEye = [fx-16, fy-10];
        const rightEye = [fx+16, fy-10];
        // Use last head movement direction
        let [dx, dy] = lastHeadDir[i] || [0, -1];
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
          dx = 0;
          dy = -1;
        }
        const mag = Math.hypot(dx,dy)||1e-6;
        const vx = dx/mag*600, vy = dy/mag*600;
        lasers.push(new Laser(leftEye[0], leftEye[1], vx, vy));
        lasers.push(new Laser(rightEye[0], rightEye[1], vx, vy));
      });
    }
    // Blink-activated laser (from both eyes, using head movement direction)
    metricsList.forEach((metrics,i) => {
      // Skip if player is eaten by Gary
      if (eatenByGary[i]) return;
      
      if (metrics.blink) {
        const curr = centers[i];
        const fx = curr[0];
        const fy = curr[1];
        // Use avatar's drawn eye positions
        const leftEye = [fx-16, fy-10];
        const rightEye = [fx+16, fy-10];
        // Use last head movement direction
        let [dx, dy] = lastHeadDir[i] || [0, -1];
        if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
          dx = 0;
          dy = -1;
        }
        const mag = Math.hypot(dx,dy)||1e-6;
        const vx = dx/mag*600, vy = dy/mag*600;
        lasers.push(new Laser(leftEye[0], leftEye[1], vx, vy));
        lasers.push(new Laser(rightEye[0], rightEye[1], vx, vy));
      }
    });
    // Update prevFaceCenters for next frame
    prevFaceCenters = centers.map(c => [...c]);
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
      // Boss-player collision detection (after centers are up to date)
      centers.forEach((cen, i) => {
        if (invulTimers[i] <= 0) {
          const d = Math.hypot(boss.x - cen[0], boss.y - cen[1]);
          // Debug: draw boss collision area
          ctx.save();
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.arc(boss.x, boss.y, boss.radius + 50, 0, 2 * Math.PI);
          ctx.fillStyle = '#f00';
          ctx.fill();
          ctx.restore();
          // Debug log
          if (i === 0) console.log('Boss-player dist', d, 'threshold', boss.radius + 50);
          if (d < boss.radius + 50) { // 50 is the avatar radius
            playerLives[i] = (playerLives[i] || 3) - 1;
            invulTimers[i] = 2.0;
            if (playerLives[i] <= 0) {
              playerLives[i] = 3;
              invulTimers[i] = 2.0;
            }
          }
        }
      });
    }
    // Update lasers/fireballs/snakes
    lasers.forEach(l=>l.update(dt));
    fireballs.forEach(f=>f.update(dt));
    snakes.forEach(s=>s.update(dt));
    
    // Update portals
    portals.forEach(p=>p.update(dt));
    
    // Update Gary (always, even during pause)
    if (garyBoss) {
      const nearestCenter = centers[0] || [canvasElement.width/2, canvasElement.height/2];
      garyBoss.update(dt, nearestCenter[0], nearestCenter[1], metricsList, centers, creatures, boss);
    }
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
      // Draw boss health bar at top right, below the boss label
      if(bossMaxHealth>0) {
        const barWidth = 220, barHeight = 22;
        const x = overlayLeft;
        const y = 80;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x, y, barWidth * (boss.health/bossMaxHealth), barHeight);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, barWidth, barHeight);
        ctx.font = 'bold 18px Arial';
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1.0;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${boss.health} / ${bossMaxHealth}`, x + barWidth/2, y + barHeight/2);
        ctx.restore();
      }
    }
    // Show Elder Dimension hint
    if (elderDimensionActive) {
      ctx.font = 'bold 20px Arial';
      ctx.fillStyle = '#DA70D6';
      ctx.fillText('Elder Dimension Active!', overlayLeft, 110);
      
      // Show objectives
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('OBJECTIVE: Defeat the dragon!', overlayLeft, 140);
      ctx.fillStyle = '#FF6B6B';
      ctx.fillText('WARNING: Survive Gary as long as you can!', overlayLeft, 165);
      
      // Find XYZ dragon health
      let xyzDragon = null;
      creatures.forEach(c => {
        if (c instanceof XYZ) {
          xyzDragon = c;
        }
      });
      
      if (xyzDragon) {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#9370DB';
        ctx.fillText(`Dragon Health: ${xyzDragon.health}/100`, overlayLeft, 190);
      } else {
        // Dragon defeated - VICTORY!
        ctx.save();
        ctx.font = 'bold 48px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 10;
        ctx.fillText('VICTORY!', canvasElement.width/2, canvasElement.height/2 - 50);
        ctx.font = 'bold 24px Arial';
        ctx.fillText('You defeated the dragon!', canvasElement.width/2, canvasElement.height/2);
        ctx.restore();
      }
    } else if (!portals.length) {
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#BBB';
      ctx.fillText('Press P or use button to open Elder Portal', overlayLeft, 110);
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
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 25+e.t*20, 0, 2*Math.PI);
      ctx.stroke();
      ctx.restore();
    });
    creatures.forEach(c=>{ctx.fillStyle=c.color;ctx.beginPath();ctx.arc(c.x,c.y,c.radius,0,2*Math.PI);ctx.fill();});
    lasers.forEach(l=>{ctx.fillStyle=l.color||'red';ctx.beginPath();ctx.arc(l.x,l.y,l.radius,0,2*Math.PI);ctx.fill();});
    fireballs.forEach(f=>{ctx.fillStyle='orange';ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,2*Math.PI);ctx.fill();});
    
    // Draw snakes
    snakes.forEach(s => {
      ctx.fillStyle = s.color || 'lightgreen';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, 2*Math.PI);
      ctx.fill();
    });
    
    // Draw villages
    villages.forEach(v => {
      if (!v.destroyed) {
        // Draw village buildings
        ctx.save();
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(v.x - 30, v.y - 20, 20, 30);
        ctx.fillRect(v.x - 5, v.y - 25, 25, 35);
        ctx.fillRect(v.x + 10, v.y - 15, 20, 25);
        
        // Roofs
        ctx.fillStyle = '#A52A2A';
        ctx.beginPath();
        ctx.moveTo(v.x - 35, v.y - 20);
        ctx.lineTo(v.x - 20, v.y - 35);
        ctx.lineTo(v.x - 5, v.y - 20);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(v.x - 10, v.y - 25);
        ctx.lineTo(v.x + 7.5, v.y - 40);
        ctx.lineTo(v.x + 25, v.y - 25);
        ctx.fill();
        
        // Health bar
        const barWidth = 60;
        const barHeight = 8;
        const barX = v.x - barWidth/2;
        const barY = v.y - v.radius - 20;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const healthRatio = v.health / v.maxHealth;
        ctx.fillStyle = healthRatio > 0.5 ? '#0f0' : (healthRatio > 0.2 ? '#ff0' : '#f00');
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.restore();
      }
    });
    
    // Draw portals
    portals.forEach(p => {
      const pulseR = p.radius + Math.sin(p.pulse) * 10;
      ctx.save();
      ctx.strokeStyle = '#8B008B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulseR, 0, 2*Math.PI);
      ctx.stroke();
      // Inner swirl
      for (let angle = 0; angle < 360; angle += 30) {
        const rad = angle * Math.PI / 180 + p.pulse * 50;
        const innerX = p.x + Math.cos(rad) * (pulseR - 10);
        const innerY = p.y + Math.sin(rad) * (pulseR - 10);
        ctx.fillStyle = '#DA70D6';
        ctx.beginPath();
        ctx.arc(innerX, innerY, 5, 0, 2*Math.PI);
        ctx.fill();
      }
      ctx.restore();
    });
    
    // Draw Gary boss
    if (garyBoss) {
      // Draw space jail first
      if (garyBoss.spaceJail) {
        garyBoss.spaceJail.render(ctx);
      }
      
      // Draw XYZ if Gary is riding it
      if (garyBoss.ridingXyz && garyBoss.ridingXyz.health > 0) {
        const xyz = garyBoss.ridingXyz;
        ctx.fillStyle = xyz.color;
        ctx.beginPath();
        ctx.arc(xyz.x, xyz.y, xyz.radius, 0, 2*Math.PI);
        ctx.fill();
        // XYZ spikes
        ctx.save();
        ctx.strokeStyle = '#4B0082';
        ctx.lineWidth = 3;
        for (let angle = 0; angle < 360; angle += 45) {
          const rad = angle * Math.PI / 180;
          const spikeX = xyz.x + Math.cos(rad) * xyz.radius;
          const spikeY = xyz.y + Math.sin(rad) * xyz.radius;
          const endX = xyz.x + Math.cos(rad) * (xyz.radius + 15);
          const endY = xyz.y + Math.sin(rad) * (xyz.radius + 15);
          ctx.beginPath();
          ctx.moveTo(spikeX, spikeY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
        ctx.restore();
      }
      
      // Draw ship if Gary is riding one
      if (garyBoss.ridingShip) {
        ctx.save();
        ctx.fillStyle = '#708090';
        ctx.translate(garyBoss.x, garyBoss.y);
        ctx.beginPath();
        ctx.moveTo(0, -30);
        ctx.lineTo(-25, 20);
        ctx.lineTo(25, 20);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#4682B4';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
      
      // Draw Gary
      let garyCol = garyBoss.color;
      if (garyBoss.beingLookedAt && !garyBoss.provoked) {
        garyCol = '#FFB6C1'; // Peaceful pink
      } else if (garyBoss.provoked) {
        garyCol = '#FF1493'; // Angry deep pink
      }
      
      ctx.fillStyle = garyCol;
      ctx.beginPath();
      ctx.arc(garyBoss.x, garyBoss.y, garyBoss.radius, 0, 2*Math.PI);
      ctx.fill();
      
      // Gary's crystal crown
      ctx.save();
      ctx.fillStyle = '#FF00FF';
      for (let i = 0; i < 5; i++) {
        const angle = i * 72 - 90;
        const rad = angle * Math.PI / 180;
        const crownX = garyBoss.x + Math.cos(rad) * (garyBoss.radius - 10);
        const crownY = garyBoss.y - garyBoss.radius + Math.sin(rad) * 10;
        ctx.beginPath();
        ctx.moveTo(crownX, crownY - 10);
        ctx.lineTo(crownX - 5, crownY);
        ctx.lineTo(crownX + 5, crownY);
        ctx.closePath();
        ctx.fill();
      }
      
      // Hellbroken diamond on chest
      ctx.save();
      const diamondX = garyBoss.x;
      const diamondY = garyBoss.y + 10;
      const diamondSize = 15;
      
      // Draw diamond shape with gradient
      const gradient = ctx.createRadialGradient(diamondX, diamondY, 0, diamondX, diamondY, diamondSize);
      gradient.addColorStop(0, '#FF1493');
      gradient.addColorStop(0.5, '#8B008B');
      gradient.addColorStop(1, '#4B0082');
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      ctx.moveTo(diamondX, diamondY - diamondSize);
      ctx.lineTo(diamondX + diamondSize * 0.7, diamondY);
      ctx.lineTo(diamondX, diamondY + diamondSize);
      ctx.lineTo(diamondX - diamondSize * 0.7, diamondY);
      ctx.closePath();
      ctx.fill();
      
      // Diamond glow effect
      ctx.shadowColor = '#FF00FF';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      
      // Gary's eyes (red when angry)
      ctx.fillStyle = garyBoss.provoked ? '#FF0000' : '#C71585';
      ctx.beginPath();
      ctx.arc(garyBoss.x - 10, garyBoss.y - 5, 5, 0, 2*Math.PI);
      ctx.arc(garyBoss.x + 10, garyBoss.y - 5, 5, 0, 2*Math.PI);
      ctx.fill();
      
      // Draw scanner ducky
      ctx.save();
      ctx.fillStyle = '#FFD700';
      const duckyX = garyBoss.x + garyBoss.radius + 10;
      const duckyY = garyBoss.y - 20;
      // Ducky body
      ctx.beginPath();
      ctx.ellipse(duckyX, duckyY, 12, 10, 0, 0, 2*Math.PI);
      ctx.fill();
      // Ducky head
      ctx.beginPath();
      ctx.arc(duckyX - 8, duckyY - 8, 8, 0, 2*Math.PI);
      ctx.fill();
      // Ducky beak
      ctx.fillStyle = '#FFA500';
      ctx.beginPath();
      ctx.moveTo(duckyX - 16, duckyY - 8);
      ctx.lineTo(duckyX - 20, duckyY - 6);
      ctx.lineTo(duckyX - 16, duckyY - 4);
      ctx.closePath();
      ctx.fill();
      // Scanner effect
      if (garyBoss.scannerDucky.scanTimer < 0.1) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(garyBoss.x, garyBoss.y, garyBoss.scannerDucky.scanRadius, 0, 2*Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();
      
      // Draw held item
      if (garyBoss.heldItem) {
        ctx.save();
        const itemX = garyBoss.x - garyBoss.radius - 20;
        const itemY = garyBoss.y;
        
        if (garyBoss.heldItem === 'remote') {
          ctx.fillStyle = '#696969';
          ctx.fillRect(itemX - 8, itemY - 15, 16, 30);
          ctx.fillStyle = '#FF0000';
          ctx.fillRect(itemX - 4, itemY - 10, 8, 8);
        } else if (garyBoss.heldItem === 'crystal') {
          ctx.fillStyle = '#E6E6FA';
          ctx.beginPath();
          ctx.moveTo(itemX, itemY - 15);
          ctx.lineTo(itemX - 10, itemY);
          ctx.lineTo(itemX, itemY + 15);
          ctx.lineTo(itemX + 10, itemY);
          ctx.closePath();
          ctx.fill();
        } else if (garyBoss.heldItem === 'scanner') {
          ctx.fillStyle = '#4169E1';
          ctx.beginPath();
          ctx.arc(itemX, itemY, 10, 0, 2*Math.PI);
          ctx.fill();
        }
        ctx.restore();
      }
      
      // Health bar for Gary (immortal)
      const hbW = 100, hbH = 10;
      const hbX = garyBoss.x - hbW/2;
      const hbY = garyBoss.y - garyBoss.radius - 30;
      ctx.fillStyle = '#400040';
      ctx.fillRect(hbX, hbY, hbW, hbH);
      // Always full health - Gary is immortal
      ctx.fillStyle = garyBoss.isShadow ? '#FF00FF' : '#FF69B4';
      ctx.fillRect(hbX, hbY, hbW, hbH);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(hbX, hbY, hbW, hbH);
      // Draw "IMMORTAL" text
      ctx.save();
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText('IMMORTAL', garyBoss.x, hbY - 5);
      ctx.restore();
      
      // Label for Gary
      ctx.save();
      ctx.font = 'bold 16px Arial';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'center';
      let label = garyBoss.isShadow ? 'Shadow Gary' : 'Gary';
      if (garyBoss.ridingXyz) label += ' riding XYZ';
      else if (garyBoss.ridingShip) label += ' in Ship';
      ctx.fillText(label, garyBoss.x, garyBoss.y - garyBoss.radius - 40);
      
      // Show eaten count
      if (garyBoss.totalEaten > 0) {
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Eaten: ${garyBoss.totalEaten}`, garyBoss.x, garyBoss.y - garyBoss.radius - 55);
      }
      ctx.restore();
    }
    
    if(boss){ctx.fillStyle=boss.color;ctx.beginPath();ctx.arc(boss.x,boss.y,boss.radius,0,2*Math.PI);ctx.fill();}
    // Draw avatars with arms/hands
    metricsList.forEach((m,i)=>{
      // Skip drawing if eaten by Gary
      if (eatenByGary[i]) return;
      
      // Mirror avatar horizontally
      const fx = canvasElement.width - (m.faceCoords[0] * sw);
      const fy = m.faceCoords[1] * sh;
      ctx.strokeStyle='white';ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(fx,fy,50,0,2*Math.PI);ctx.stroke();
      // Draw cartoon eyes (open/closed)
      ctx.save();
      ctx.fillStyle = 'red';
      if (m.eyes_closed) {
        // Draw closed eyes as lines
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(fx-23, fy-10);
        ctx.lineTo(fx-9, fy-10);
        ctx.moveTo(fx+9, fy-10);
        ctx.lineTo(fx+23, fy-10);
        ctx.stroke();
      } else {
        // Draw open eyes as circles
        ctx.beginPath();
        ctx.arc(fx-16, fy-10, 7, 0, 2*Math.PI); // left eye
        ctx.arc(fx+16, fy-10, 7, 0, 2*Math.PI); // right eye
        ctx.fill();
      }
      ctx.restore();
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
      if (!playerLives[i]) playerLives[i] = 3; // Initialize if not set
      if (!invulTimers[i]) invulTimers[i] = 0; // Initialize timer
      const hl = playerLives[i];
      ctx.save();
      for(let j = 0; j < hl; j++) {
        const heartX = fx - 30 + j * 25;
        const heartY = fy - 80;
        
        // Draw heart shape
        ctx.fillStyle = invulTimers[i] > 0 && Math.floor(invulTimers[i] * 10) % 2 ? '#FFAAAA' : '#FF0000';
        ctx.beginPath();
        // Left curve
        ctx.arc(heartX - 6, heartY, 8, Math.PI, 0);
        // Right curve
        ctx.arc(heartX + 6, heartY, 8, Math.PI, 0);
        // Bottom point
        ctx.lineTo(heartX, heartY + 15);
        ctx.closePath();
        ctx.fill();
        
        // Heart outline
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      // Draw empty hearts for lost lives
      for(let j = hl; j < 3; j++) {
        const heartX = fx - 30 + j * 25;
        const heartY = fy - 80;
        
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Left curve
        ctx.arc(heartX - 6, heartY, 8, Math.PI, 0);
        // Right curve
        ctx.arc(heartX + 6, heartY, 8, Math.PI, 0);
        // Bottom point
        ctx.lineTo(heartX, heartY + 15);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      // cartoon arms/hands
      const faceX=fx,faceY=fy;
      const scaledHandPositions = handPositions.map(([hx, hy]) => [canvasElement.width - (hx * canvasElement.width / faceCanvas.width), hy * canvasElement.height / faceCanvas.height]);
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
    
    // Mirror the camera view horizontally
    faceCtx.translate(faceCanvas.width, 0);
    faceCtx.scale(-1, 1);
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
    // Store latest face landmarks globally for use in animation loop
    latestFaceLandmarks = faces;
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