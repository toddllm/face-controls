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
  
  // New enemy types
  class Phantom extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=18; this.speed=90; this.color='rgba(200,100,255,0.5)'; this.phase=0; }
    update(dt, tx, ty) { this.phase += dt*3; this.color = `rgba(200,100,255,${0.3 + Math.sin(this.phase)*0.2})`; super.update(dt, tx, ty); }
  }
  class Bomber extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=20; this.speed=60; this.color='#8B4513'; this.bombTimer=0; }
    update(dt, tx, ty) { 
      super.update(dt, tx, ty); 
      this.bombTimer += dt;
      if(this.bombTimer >= 2 && Math.hypot(this.x-tx, this.y-ty) < 150) {
        // Explode
        for(let a=0; a<360; a+=45) {
          const r=a*Math.PI/180;
          lasers.push(new Fireball(this.x, this.y, Math.cos(r)*200, Math.sin(r)*200));
        }
        this.bombTimer = 0;
      }
    }
  }
  class Ninja extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=16; this.speed=150; this.color='#2F4F4F'; this.visible=true; this.vanishTimer=0; }
    update(dt, tx, ty) { 
      this.vanishTimer += dt;
      if(this.vanishTimer >= 1.5) {
        this.visible = !this.visible;
        this.vanishTimer = 0;
        if(!this.visible) {
          // Teleport behind player
          const angle = Math.atan2(ty-this.y, tx-this.x) + Math.PI;
          this.x = tx + Math.cos(angle) * 100;
          this.y = ty + Math.sin(angle) * 100;
        }
      }
      if(this.visible) super.update(dt, tx, ty);
    }
  }
  class Healer extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=15; this.speed=50; this.color='#98FB98'; this.healTimer=0; }
    update(dt, tx, ty) { 
      super.update(dt, tx, ty);
      this.healTimer += dt;
      if(this.healTimer >= 3) {
        // Heal nearby creatures
        creatures.forEach(c => {
          if(c !== this && Math.hypot(c.x-this.x, c.y-this.y) < 100 && c.health && c.health < c.maxHealth) {
            c.health = Math.min(c.health + 1, c.maxHealth || 3);
          }
        });
        this.healTimer = 0;
      }
    }
  }
  class Mimic extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=20; this.speed=80; this.color='#DAA520'; this.mimicType=null; }
    update(dt, tx, ty) {
      // Copy abilities of nearest creature
      if(!this.mimicType) {
        let nearest = null;
        let nearestDist = Infinity;
        creatures.forEach(c => {
          if(c !== this) {
            const dist = Math.hypot(c.x-this.x, c.y-this.y);
            if(dist < nearestDist) {
              nearestDist = dist;
              nearest = c;
            }
          }
        });
        if(nearest) {
          this.mimicType = nearest.constructor.name;
          this.color = nearest.color;
          this.speed = nearest.speed;
        }
      }
      super.update(dt, tx, ty);
    }
  }
  
  // End of Dungeon dimension enemies
  class Loc extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=14; this.speed=70; this.color='#4B0082'; this.lockTimer=0; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      this.lockTimer += dt;
      if(this.lockTimer >= 2.5 && Math.hypot(this.x-tx, this.y-ty) < 100) {
        // Lock player movement temporarily
        playerLocked = true;
        setTimeout(() => { playerLocked = false; }, 1000);
        this.lockTimer = 0;
      }
    }
  }
  class Bat extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=12; this.speed=140; this.color='#8B008B'; this.swoopPhase=0; }
    update(dt, tx, ty) {
      this.swoopPhase += dt * 4;
      const swoopOffset = Math.sin(this.swoopPhase) * 30;
      super.update(dt, tx, ty + swoopOffset);
    }
  }
  class Nightmare extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=22; this.speed=60; this.color='#000033'; this.fearAura=100; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      // Reverse player controls when near
      if(Math.hypot(this.x-tx, this.y-ty) < this.fearAura) {
        controlsReversed = true;
      }
    }
  }
  class Dream extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=18; this.speed=40; this.color='#FFB6C1'; this.illusionTimer=0; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      this.illusionTimer += dt;
      if(this.illusionTimer >= 4) {
        // Create illusion copies
        for(let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2;
          const illusionX = this.x + Math.cos(angle) * 50;
          const illusionY = this.y + Math.sin(angle) * 50;
          creatures.push(new Illusion(illusionX, illusionY, canvasElement.width, canvasElement.height));
        }
        this.illusionTimer = 0;
      }
    }
  }
  class Illusion extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=15; this.speed=100; this.color='rgba(255,182,193,0.4)'; this.lifetime=3; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      this.lifetime -= dt;
      if(this.lifetime <= 0) this.health = 0;
    }
  }
  class Whiched extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=19; this.speed=65; this.color='#8B7355'; this.curseTimer=0; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      this.curseTimer += dt;
      if(this.curseTimer >= 3 && Math.hypot(this.x-tx, this.y-ty) < 120) {
        // Curse: slow player attacks
        playerAttackSpeed = 0.5;
        setTimeout(() => { playerAttackSpeed = 1; }, 2000);
        this.curseTimer = 0;
      }
    }
  }
  class Creak extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=17; this.speed=45; this.color='#8B4513'; this.shakeIntensity=0; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      // Screen shake when near
      const dist = Math.hypot(this.x-tx, this.y-ty);
      if(dist < 150) {
        this.shakeIntensity = (150 - dist) / 15;
        screenShake = this.shakeIntensity;
      }
    }
  }
  class Creeper extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=16; this.speed=30; this.color='#006400'; this.explodeRadius=80; }
    update(dt, tx, ty) {
      const dist = Math.hypot(this.x-tx, this.y-ty);
      if(dist < 50) {
        // Explode
        this.color = '#00FF00';
        this.explodeRadius += dt * 200;
        if(this.explodeRadius > 150) {
          // Damage everything nearby
          creatures.forEach(c => {
            if(Math.hypot(c.x-this.x, c.y-this.y) < 150) {
              c.health = (c.health || 1) - 3;
            }
          });
          this.health = 0;
        }
      } else {
        super.update(dt, tx, ty);
      }
    }
  }
  class NeonZombie extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=18; this.speed=55; this.color='#00FF00'; this.glowPhase=0; }
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      this.glowPhase += dt * 3;
      this.color = `rgb(0, ${Math.floor(200 + Math.sin(this.glowPhase) * 55)}, 0)`;
    }
  }
  class Lunanua extends Creature {
    constructor(cx,cy,sw,sh){ super(cx,cy,sw,sh); this.radius=24; this.speed=75; this.color='#E6E6FA'; this.moonPhase=0; this.powerLevel=1; }
    update(dt, tx, ty) {
      this.moonPhase += dt * 0.5;
      this.powerLevel = 1 + Math.sin(this.moonPhase) * 0.5;
      this.speed = 75 * this.powerLevel;
      this.radius = 24 * this.powerLevel;
      super.update(dt, tx, ty);
    }
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
      this.damage = 0.5; // Minimal damage
    }
  }
  
  // Attachment classes for Gary
  class GaryAttachment {
    constructor(type, offsetAngle) {
      this.type = type;
      this.offsetAngle = offsetAngle;
      this.attackTimer = 0;
      this.attackInterval = 2.0;
      
      // Set properties based on type
      switch(type) {
        case 'lightsaber':
          this.color = '#FF0000';
          this.length = 60;
          this.width = 4;
          this.damage = 1;
          break;
        case 'robotArm':
          this.color = '#C0C0C0';
          this.length = 50;
          this.width = 15;
          this.damage = 2;
          break;
        case 'tank':
          this.color = '#556B2F';
          this.length = 40;
          this.width = 30;
          this.damage = 3;
          break;
        case 'cannon':
          this.color = '#696969';
          this.length = 45;
          this.width = 20;
          this.damage = 2;
          break;
        case 'shield':
          this.color = '#4169E1';
          this.length = 35;
          this.width = 35;
          this.damage = 0;
          this.blocking = true;
          break;
        case 'wings':
          this.color = '#DDA0DD';
          this.length = 70;
          this.width = 25;
          this.damage = 1;
          break;
        case 'laser':
          this.color = '#00FF00';
          this.length = 55;
          this.width = 8;
          this.damage = 1.5;
          break;
      }
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
  
  // Guster block class
  class GusterBlock {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 30;
      this.height = 30;
      this.active = true;
      this.color = '#4169E1';
    }
  }
  
  // Pumus class
  class Pumus {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 20;
      this.active = true;
      this.gunkTimer = 0;
      this.gunkInterval = 3.0;
      this.isGunk = false;
      this.color = '#FF69B4';
      this.gunkColor = '#228B22';
    }
    update(dt) {
      if (!this.isGunk) {
        this.gunkTimer += dt;
        if (this.gunkTimer >= this.gunkInterval) {
          this.isGunk = true;
          this.color = this.gunkColor;
        }
      }
    }
  }
  
  // Storm class
  class Storm {
    constructor(x, y, radius) {
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.maxRadius = radius + 100;
      this.growthRate = 50;
      this.rotation = 0;
      this.lightning = [];
      this.lightningTimer = 0;
      this.lightningInterval = 0.5;
      this.active = true;
    }
    update(dt) {
      this.rotation += dt * 2;
      if (this.radius < this.maxRadius) {
        this.radius += this.growthRate * dt;
      }
      
      this.lightningTimer += dt;
      if (this.lightningTimer >= this.lightningInterval) {
        // Create lightning strike
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * this.radius;
        this.lightning.push({
          x: this.x + Math.cos(angle) * dist,
          y: this.y + Math.sin(angle) * dist,
          lifetime: 0.2,
          age: 0
        });
        this.lightningTimer = 0;
      }
      
      // Update lightning
      this.lightning = this.lightning.filter(l => {
        l.age += dt;
        return l.age < l.lifetime;
      });
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
      this.health = 150; // More health
      this.maxHealth = 150;
      this.color = '#663399';
      this.snakeInterval = 1.5; // Faster snake attacks
      this.snakeTimer = 0;
      this.dashInterval = 3.0; // More frequent dashes
      this.dashTimer = 0;
      this.dashing = false;
      this.dashDuration = 0.8;
      this.dashTime = 0;
      this.dashVx = 0;
      this.dashVy = 0;
      this.villageTarget = null;
      this.villageAttackTimer = 0;
      
      // New abilities
      this.fireBreathTimer = 0;
      this.fireBreathInterval = 4.0;
      this.fireBreathActive = false;
      this.fireBreathDuration = 2.0;
      this.fireBreathTime = 0;
      
      this.teleportTimer = 0;
      this.teleportInterval = 8.0;
      
      this.minionSummonTimer = 0;
      this.minionSummonInterval = 10.0;
      
      this.shieldActive = false;
      this.shieldTimer = 0;
      this.shieldInterval = 15.0;
      this.shieldDuration = 5.0;
      
      this.rageMode = false;
      this.phase = 1; // Boss phases based on health
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
      
      // Update phase based on health
      const healthPercent = this.health / this.maxHealth;
      if (healthPercent <= 0.3) {
        this.phase = 3; // Final phase - all abilities faster
        this.rageMode = true;
        this.color = '#FF0066'; // Red-purple rage color
      } else if (healthPercent <= 0.6) {
        this.phase = 2;
        this.color = '#9933FF'; // Brighter purple
      }
      
      // Fire breath attack
      this.fireBreathTimer += dt;
      if (this.fireBreathTimer >= this.fireBreathInterval / this.phase && !this.fireBreathActive) {
        this.fireBreathActive = true;
        this.fireBreathTime = 0;
        this.fireBreathTimer = 0;
      }
      
      if (this.fireBreathActive) {
        this.fireBreathTime += dt;
        // Shoot fire in cone shape
        if (this.centers && Math.floor(this.fireBreathTime * 10) % 2 === 0) {
          const angleRange = 45; // degrees
          for (let angle = -angleRange; angle <= angleRange; angle += 15) {
            const rad = (angle + Math.atan2(targetY - this.y, targetX - this.x) * 180/Math.PI) * Math.PI/180;
            const vx = Math.cos(rad) * 400;
            const vy = Math.sin(rad) * 400;
            const fire = new Fireball(this.x, this.y, vx, vy);
            fire.color = '#FF4500';
            lasers.push(fire);
          }
        }
        
        if (this.fireBreathTime >= this.fireBreathDuration) {
          this.fireBreathActive = false;
        }
      }
      
      // Teleport ability
      this.teleportTimer += dt;
      if (this.teleportTimer >= this.teleportInterval / this.phase) {
        // Teleport behind a random player
        if (this.centers && this.centers.length > 0) {
          const targetPlayer = this.centers[Math.floor(Math.random() * this.centers.length)];
          this.x = targetPlayer[0] + (Math.random() - 0.5) * 200;
          this.y = targetPlayer[1] + (Math.random() - 0.5) * 200;
          // Immediately dash after teleport
          this.dashing = true;
          this.dashTime = 0;
          const dx = targetPlayer[0] - this.x;
          const dy = targetPlayer[1] - this.y;
          const dist = Math.hypot(dx, dy) || 1e-6;
          this.dashVx = dx/dist * 600;
          this.dashVy = dy/dist * 600;
        }
        this.teleportTimer = 0;
      }
      
      // Minion summoning
      this.minionSummonTimer += dt;
      if (this.minionSummonTimer >= this.minionSummonInterval / this.phase) {
        // Summon dragon minions
        for (let i = 0; i < 2 + this.phase; i++) {
          const angle = (i / (2 + this.phase)) * Math.PI * 2;
          const spawnX = this.x + Math.cos(angle) * 100;
          const spawnY = this.y + Math.sin(angle) * 100;
          creatures.push(new Dragon(spawnX, spawnY, canvasElement.width, canvasElement.height));
        }
        this.minionSummonTimer = 0;
      }
      
      // Shield ability
      this.shieldTimer += dt;
      if (this.shieldTimer >= this.shieldInterval && !this.shieldActive) {
        this.shieldActive = true;
        this.shieldTimer = 0;
      }
      
      if (this.shieldActive) {
        this.shieldTimer += dt;
        if (this.shieldTimer >= this.shieldDuration) {
          this.shieldActive = false;
          this.shieldTimer = 0;
        }
      }
      
      // Melee attacks on players when close
      if ((!this.villageTarget || this.villageTarget.destroyed) && this.centers) {
        // Attack players in melee range
        const meleeRange = this.radius + 60;
        this.centers.forEach((cen, i) => {
          if (!this.eatenByGary[i] && this.invulTimers[i] <= 0) {
            const dist = Math.hypot(this.x - cen[0], this.y - cen[1]);
            if (dist < meleeRange) {
              // Dragon bite attack - more damage in rage mode
              const damage = this.rageMode ? 2 : 1;
              this.playerLives[i] = (this.playerLives[i] || 3) - damage;
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
      
      // Storm system
      this.gunkCollected = 0;
      this.gunkNeededForStorm = 5;
      this.layBlockTimer = 0;
      this.layBlockInterval = 2.0; // Lay blocks every 2 seconds
      this.stormCreationTimer = 0;
      this.stormCreationInterval = 1.0;
      
      // Spinning and attachments
      this.spinning = false;
      this.spinSpeed = 0;
      this.spinAngle = 0;
      this.attachments = []; // Array of attached parts
      this.attachmentTimer = 0;
      this.attachmentInterval = 10.0; // Get new part every 10 seconds
      this.availableParts = ['lightsaber', 'robotArm', 'tank', 'cannon', 'shield', 'wings', 'laser'];
      
      // Mega Gary transformation
      this.canTransform = true;
      this.transformationTimer = 0;
      this.transformationTrigger = 50; // Transform after eating 50 things
      this.hasRockOfAllPower = false;
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
            // Special message for eating different creatures
            let eatMessage = "eating";
            let shouldRespawn = false;
            
            if (c instanceof XYZ) {
              eatMessage = "CONSUMING MIGHTY XYZ!";
              shouldRespawn = true; // XYZ respawns when eaten
            } else if (c instanceof Dragon) {
              eatMessage = c.createdByGary ? "EATING MY OWN DRAGON!" : "EATING DRAGON!";
            }
            
            // Eat the creature
            creatures.splice(i, 1);
            this.totalEaten++;
            this.radius = this.baseRadius + (this.totalEaten * this.growthRate);
            this.speak(eatMessage);
            this.huntTarget = null;
            
            // Respawn XYZ after being eaten
            if (shouldRespawn && c instanceof XYZ) {
              setTimeout(() => {
                const respawnX = Math.random() * (canvasElement.width - 200) + 100;
                const respawnY = Math.random() * (canvasElement.height - 200) + 100;
                const newXYZ = new XYZ(respawnX, respawnY, canvasElement.width, canvasElement.height);
                // Transfer some properties from the eaten XYZ
                newXYZ.phase = Math.max(1, c.phase - 1); // Respawn at lower phase
                newXYZ.health = newXYZ.maxHealth; // Full health on respawn
                creatures.push(newXYZ);
              }, 5000); // Respawn after 5 seconds
            }
          }
        }
        
        // Check players
        centers.forEach((cen, i) => {
          if (!eatenByGary[i] && Math.hypot(cen[0] - this.x, cen[1] - this.y) < this.radius + this.eatRadius) {
            // Damage the player instead of permanent eating
            playerLives[i] = (playerLives[i] || 3) - 2; // Take 2 lives
            invulTimers[i] = 1.5;
            
            // Normal respawn logic
            if (playerLives[i] <= 0) {
              playerLives[i] = 3; // Respawn with full lives
              invulTimers[i] = 2.0;
              
              // Spawn AI assistance when Gary kills a player
              spawnAIAssistance(cen[0], cen[1], 'gary_kill');
            }
            
            this.totalEaten++;
            this.radius = this.baseRadius + (this.totalEaten * this.growthRate);
            this.speak("eating"); // Says "not a threat" while eating players
            this.huntTarget = null; // Find new target
          }
        });
        
        // Check AI players (can be eaten and do NOT respawn)
        for (let i = aiPlayers.length - 1; i >= 0; i--) {
          const ai = aiPlayers[i];
          if (Math.hypot(ai.x - this.x, ai.y - this.y) < this.radius + this.eatRadius) {
            // Eat the AI player permanently (no respawn)
            aiPlayers.splice(i, 1);
            this.totalEaten++;
            this.radius = this.baseRadius + (this.totalEaten * this.growthRate);
            this.speak("EATING AI HELPER!");
            this.huntTarget = null;
          }
        }
        
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
        this.speak("hunting"); // Says "not a threat" while actively hunting
        this.voiceTimer = 0;
      }
      
      // Storm system - lay Guster blocks and Pumus
      this.layBlockTimer += dt;
      if (this.layBlockTimer >= this.layBlockInterval) {
        // Randomly lay either a Guster block or Pumus
        if (Math.random() < 0.5) {
          // Lay Guster block behind Gary
          const blockX = this.x - Math.random() * 50 - 25;
          const blockY = this.y + Math.random() * 40 - 20;
          gusterBlocks.push(new GusterBlock(blockX, blockY));
        } else {
          // Lay Pumus behind Gary
          const pumusX = this.x - Math.random() * 50 - 25;
          const pumusY = this.y + Math.random() * 40 - 20;
          pumus.push(new Pumus(pumusX, pumusY));
        }
        this.layBlockTimer = 0;
        this.speak("laying"); // Says "not a threat" while laying dangerous items
      }
      
      // Check for gunk (Pumus that have turned)
      for (let i = pumus.length - 1; i >= 0; i--) {
        const p = pumus[i];
        if (p.isGunk && Math.hypot(p.x - this.x, p.y - this.y) < this.radius + 30) {
          // Collect the gunk
          this.gunkCollected++;
          pumus.splice(i, 1);
          
          // Create storm if enough gunk collected
          if (this.gunkCollected >= this.gunkNeededForStorm) {
            const stormX = this.x + (Math.random() - 0.5) * 200;
            const stormY = this.y + (Math.random() - 0.5) * 200;
            storms.push(new Storm(stormX, stormY, 50));
            this.gunkCollected = 0;
            this.speak("storm"); // Says "not a threat" while creating destructive storms
          }
        }
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
      
      // Spinning ability
      if (this.spinning) {
        this.spinAngle += this.spinSpeed * dt;
        this.spinSpeed = Math.max(0, this.spinSpeed - dt * 100); // Slow down
        if (this.spinSpeed <= 0) {
          this.spinning = false;
        }
        
        // Spin attack damage
        if (this.spinSpeed > 200) {
          creatures.forEach(c => {
            if (!(c instanceof XYZ) && Math.hypot(c.x - this.x, c.y - this.y) < this.radius + 50) {
              c.health = (c.health || 1) - 2;
            }
          });
        }
      } else if (Math.random() < 0.01) {
        // Start spinning randomly
        this.spinning = true;
        this.spinSpeed = 500 + Math.random() * 500;
        this.speak("spin"); // Says "not a threat" while spinning dangerously
      }
      
      // Attachment system
      this.attachmentTimer += dt;
      if (this.attachmentTimer >= this.attachmentInterval && this.attachments.length < 8) {
        // Add a new random attachment
        const newPart = this.availableParts[Math.floor(Math.random() * this.availableParts.length)];
        const angle = Math.random() * Math.PI * 2;
        this.attachments.push(new GaryAttachment(newPart, angle));
        this.attachmentTimer = 0;
        this.speak(`New ${newPart}!`); // Says "not a threat" while adding weapons
      }
      
      // Update attachments
      this.attachments.forEach(att => {
        att.attackTimer += dt;
        
        // Attachment attacks
        if (att.attackTimer >= att.attackInterval && att.damage > 0) {
          const attachAngle = this.spinAngle + att.offsetAngle;
          const attachX = this.x + Math.cos(attachAngle) * (this.radius + att.length/2);
          const attachY = this.y + Math.sin(attachAngle) * (this.radius + att.length/2);
          
          if (att.type === 'cannon' || att.type === 'laser') {
            // Shoot projectiles
            const targetAngle = attachAngle;
            const vx = Math.cos(targetAngle) * 400;
            const vy = Math.sin(targetAngle) * 400;
            const projectile = new PurpleLaser(attachX, attachY, vx, vy);
            projectile.color = att.type === 'cannon' ? '#FF4500' : '#00FF00';
            projectile.damage = att.damage;
            lasers.push(projectile);
          } else {
            // Melee damage
            creatures.forEach(c => {
              if (!(c instanceof XYZ) && Math.hypot(c.x - attachX, c.y - attachY) < att.length) {
                c.health = (c.health || 1) - att.damage;
              }
            });
            
            // Also damage players
            centers.forEach((cen, i) => {
              if (!eatenByGary[i] && invulTimers[i] <= 0 && Math.hypot(cen[0] - attachX, cen[1] - attachY) < att.length) {
                playerLives[i] = (playerLives[i] || 3) - att.damage;
                invulTimers[i] = 1.0;
                if (playerLives[i] <= 0) {
                  playerLives[i] = 3;
                  invulTimers[i] = 2.0;
                }
              }
            });
          }
          
          att.attackTimer = 0;
        }
      });
      
      // Dragon creation ability
      this.dragonCreationTimer = (this.dragonCreationTimer || 0) + dt;
      if (this.dragonCreationTimer >= 15.0 && Math.random() < 0.3) { // Create dragon every 15 seconds with 30% chance
        // Create a new dragon near Gary
        const dragonX = this.x + (Math.random() - 0.5) * 200;
        const dragonY = this.y + (Math.random() - 0.5) * 200;
        const newDragon = new Dragon(dragonX, dragonY, canvasElement.width, canvasElement.height);
        newDragon.createdByGary = true; // Mark as Gary's dragon
        creatures.push(newDragon);
        this.speak("DRAGON CREATION!");
        this.dragonCreationTimer = 0;
      }
      
      // Check for Mega Gary transformation
      if (this.canTransform && this.totalEaten >= this.transformationTrigger) {
        // Create Mega Gary instance and replace current Gary
        const megaGary = new MegaGary(this.x, this.y);
        
        // Transfer state
        megaGary.totalEaten = this.totalEaten;
        megaGary.attachments = this.attachments;
        megaGary.ridingXyz = this.ridingXyz;
        megaGary.hasRockOfAllPower = this.hasRockOfAllPower;
        
        // Replace Gary with Mega Gary in boss array
        const garyIndex = allBosses.findIndex(boss => boss === this);
        if (garyIndex > -1) {
          allBosses[garyIndex] = megaGary;
        }
        
        // Speak transformation line
        megaGary.speak("MEGA TRANSFORMATION!");
        
        return; // End this Gary's update
      }
    }
    
    speak(context) {
      // Play "not a threat" audio in ironic contexts
      // Gary says this sarcastically while being the biggest threat
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
  
  // The Rock of All Power - Ultimate artifact that supercharges Gary
  class RockOfAllPower {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 25;
      this.activated = false;
      this.energyLevel = 1000;
      this.pulseEffect = 0;
      this.floatOffset = 0;
    }
    
    update(dt) {
      this.pulseEffect += dt * 5;
      this.floatOffset += dt * 2;
    }
    
    render(ctx) {
      ctx.save();
      
      // Floating effect
      const floatY = this.y + Math.sin(this.floatOffset) * 10;
      
      // Outer energy aura
      const pulseRadius = this.radius + Math.sin(this.pulseEffect) * 15;
      ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(this.pulseEffect) * 0.2})`;
      ctx.beginPath();
      ctx.arc(this.x, floatY, pulseRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Main rock
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(this.x, floatY, this.radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Inner core
      ctx.fillStyle = '#FF4500';
      ctx.beginPath();
      ctx.arc(this.x, floatY, this.radius * 0.6, 0, 2 * Math.PI);
      ctx.fill();
      
      // Power runes
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + this.pulseEffect * 0.5;
        const runeX = this.x + Math.cos(angle) * this.radius * 0.8;
        const runeY = floatY + Math.sin(angle) * this.radius * 0.8;
        ctx.beginPath();
        ctx.arc(runeX, runeY, 3, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      ctx.restore();
    }
  }
  
  // Mega Gary - Super form with 1000x power and enhanced abilities
  class MegaGary extends GaryBoss {
    constructor(cx, cy) {
      super(cx, cy, false);
      
      // Enhanced stats (1000x power/hardness)
      this.radius = 90; // Larger size
      this.health = 999999; // Even more immortal
      this.maxHealth = 999999;
      this.color = '#FF0000'; // Red eyes effect
      this.huntSpeed = 300; // Faster
      this.eatRadius = 60; // Larger eating range
      this.growthRate = 5; // Faster growth
      
      // Visual enhancements
      this.eyeColor = '#FF0000'; // Red eyes
      this.gownSize = 1.5; // Larger gown
      this.energyAura = 0;
      this.powerLevel = 1000;
      
      // Mega abilities
      this.vortexTimer = 0;
      this.vortexInterval = 8.0;
      this.vortexActive = false;
      this.vortexRadius = 150;
      this.vortexPower = 500;
      
      // Enhanced effects
      this.netheriteEffect = 0;
      this.lintherTimer = 0;
      this.blueFlameTimer = 0;
      this.pokeballFlowerTimer = 0;
      
      // The Rock of All Power connection
      this.rockOfAllPower = null;
      this.rockPowerLevel = 1;
      this.overcharging = false;
      this.instability = 0;
      
      // End dimension teleportation
      this.canTeleportToEnd = true;
      this.endDimensionTimer = 0;
      this.endDimensionInterval = 15.0;
      
      // Enhanced audio
      this.megaAudio = new Audio('gary.mp3');
      this.megaAudio.volume = 1.0; // Louder
    }
    
    update(dt, tx, ty, metricsList, centers, creatures, boss) {
      // Enhanced visual effects
      this.energyAura += dt * 8;
      this.netheriteEffect += dt * 3;
      this.lintherTimer += dt * 4;
      this.blueFlameTimer += dt * 6;
      this.pokeballFlowerTimer += dt * 2;
      
      // Call parent update (skip the transformation check)
      // Copy Gary's update logic without transformation
      this.scannerDucky.scanTimer += dt;
      if (this.scannerDucky.scanTimer >= this.scannerDucky.scanInterval) {
        this.scannerDucky.scan(creatures, boss, centers);
        this.scannerDucky.scanTimer = 0;
      }
      
      // Hunt for food (any creature or player)
      if (!this.huntTarget || this.huntTarget.health <= 0 || this.huntTarget.destroyed) {
        let nearestPrey = null;
        let nearestDist = Infinity;
        
        creatures.forEach(c => {
          if (c !== this.ridingXyz && c.health > 0) {
            const dist = Math.hypot(c.x - this.x, c.y - this.y);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestPrey = c;
            }
          }
        });
        
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
      
      // Enhanced movement logic
      let targetX = tx;
      let targetY = ty;
      
      if (this.huntTarget) {
        targetX = this.huntTarget.x;
        targetY = this.huntTarget.y;
      }
      
      if (this.ridingShip) {
        const shipSpeed = 400; // Faster than normal Gary
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        this.x += (dx/dist) * shipSpeed * dt;
        this.y += (dy/dist) * shipSpeed * dt;
      } else if (this.ridingXyz && this.ridingXyz.health > 0) {
        this.x = this.ridingXyz.x;
        this.y = this.ridingXyz.y - 50;
      } else {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.hypot(dx, dy) || 1e-6;
        this.x += (dx/dist) * this.huntSpeed * dt;
        this.y += (dy/dist) * this.huntSpeed * dt;
      }
      
      // Enhanced dragon creation ability (more frequent than regular Gary)
      this.dragonCreationTimer = (this.dragonCreationTimer || 0) + dt;
      if (this.dragonCreationTimer >= 10.0 && Math.random() < 0.5) { // Create dragon every 10 seconds with 50% chance
        // Create multiple dragons as Mega Gary
        const numDragons = Math.random() < 0.3 ? 2 : 1; // 30% chance for 2 dragons
        for (let d = 0; d < numDragons; d++) {
          const dragonX = this.x + (Math.random() - 0.5) * 300;
          const dragonY = this.y + (Math.random() - 0.5) * 300;
          const newDragon = new Dragon(dragonX, dragonY, canvasElement.width, canvasElement.height);
          newDragon.createdByGary = true;
          newDragon.isMegaDragon = true; // Mark as Mega Gary's dragon
          creatures.push(newDragon);
        }
        this.speak("MEGA DRAGON CREATION!");
        this.dragonCreationTimer = 0;
      }
      
      // Enhanced eating with no permanent capture
      this.eatTimer += dt;
      if (this.eatTimer >= this.eatInterval) {
        creatures.forEach((c, i) => {
          if (c !== this.ridingXyz && Math.hypot(c.x - this.x, c.y - this.y) < this.radius + this.eatRadius) {
            // Enhanced messages for all creature types including XYZ
            let eatMessage = "MEGA EATING!";
            let shouldRespawn = false;
            
            if (c instanceof XYZ) {
              eatMessage = "MEGA XYZ ANNIHILATION!";
              shouldRespawn = true; // XYZ respawns when eaten
            } else if (c instanceof Dragon) {
              if (c.isMegaDragon) {
                eatMessage = "CONSUMING MY MEGA DRAGON!";
              } else if (c.createdByGary) {
                eatMessage = "EATING MY OWN DRAGON!";
              } else {
                eatMessage = "MEGA DRAGON CONSUMPTION!";
              }
            }
            
            creatures.splice(i, 1);
            this.totalEaten++;
            this.radius = Math.min(200, this.baseRadius + (this.totalEaten * this.growthRate));
            this.speak(eatMessage);
            this.huntTarget = null;
            
            // Respawn XYZ after being eaten by Mega Gary
            if (shouldRespawn && c instanceof XYZ) {
              setTimeout(() => {
                const respawnX = Math.random() * (canvasElement.width - 200) + 100;
                const respawnY = Math.random() * (canvasElement.height - 200) + 100;
                const newXYZ = new XYZ(respawnX, respawnY, canvasElement.width, canvasElement.height);
                // Mega Gary makes XYZ respawn stronger
                newXYZ.phase = Math.min(3, c.phase + 1); // Respawn at higher phase
                newXYZ.health = newXYZ.maxHealth;
                newXYZ.enragedByMegaGary = true; // Mark as enraged
                creatures.push(newXYZ);
              }, 3000); // Faster respawn for Mega Gary (3 seconds)
            }
          }
        });
        
        centers.forEach((cen, i) => {
          if (!eatenByGary[i] && Math.hypot(cen[0] - this.x, cen[1] - this.y) < this.radius + this.eatRadius) {
            playerLives[i] = (playerLives[i] || 3) - 3; // Heavy damage
            invulTimers[i] = 1.5;
            
            if (playerLives[i] <= 0) {
              playerLives[i] = 3; // Always respawn
              invulTimers[i] = 2.0;
              
              // Spawn AI assistance when Mega Gary kills a player
              spawnAIAssistance(cen[0], cen[1], 'mega_gary_kill');
            }
            
            this.totalEaten++;
            this.radius = Math.min(200, this.baseRadius + (this.totalEaten * this.growthRate));
            this.speak("MEGA EATING!");
            this.huntTarget = null;
          }
        });
        
        // Check AI players (can be eaten and do NOT respawn)
        for (let i = aiPlayers.length - 1; i >= 0; i--) {
          const ai = aiPlayers[i];
          if (Math.hypot(ai.x - this.x, ai.y - this.y) < this.radius + this.eatRadius) {
            // Eat the AI player permanently (no respawn)
            aiPlayers.splice(i, 1);
            this.totalEaten++;
            this.radius = Math.min(200, this.baseRadius + (this.totalEaten * this.growthRate));
            this.speak("MEGA AI CONSUMPTION!");
            this.huntTarget = null;
          }
        }
        
        this.eatTimer = 0;
      }
      
      // Vortex power - pulls and teleports
      this.vortexTimer += dt;
      if (this.vortexTimer >= this.vortexInterval) {
        this.createVortex(creatures, centers);
        this.vortexTimer = 0;
      }
      
      // Rock of All Power effects
      if (this.hasRockOfAllPower && this.rockOfAllPower) {
        this.rockPowerLevel += dt * 0.5;
        
        // Gary can't handle all the power - instability
        this.instability += dt * 0.2;
        if (this.instability >= 1.0) {
          this.overcharging = true;
          
          // Random power surges
          if (Math.random() < 0.1) {
            this.createPowerSurge();
          }
        }
        
        // Enhanced abilities from rock
        this.powerLevel = 1000 * this.rockPowerLevel;
        this.vortexPower = 500 * this.rockPowerLevel;
        this.radius = Math.min(200, 90 + (this.rockPowerLevel * 10));
      }
      
      // End dimension teleportation
      this.endDimensionTimer += dt;
      if (this.endDimensionTimer >= this.endDimensionInterval && this.canTeleportToEnd) {
        this.teleportToEndDimension();
        this.endDimensionTimer = 0;
      }
      
      // Transform water to Linther poison
      this.transformWaterToLinther();
      
      // Transform attachments
      this.enhanceAttachments();
    }
    
    createVortex(creatures, centers) {
      this.vortexActive = true;
      
      // Pull creatures toward Mega Gary
      creatures.forEach(c => {
        if (c !== this.ridingXyz) {
          const dx = this.x - c.x;
          const dy = this.y - c.y;
          const dist = Math.hypot(dx, dy);
          
          if (dist < this.vortexRadius && dist > 0) {
            const pullStrength = this.vortexPower / (dist + 1);
            c.x += (dx / dist) * pullStrength * 0.016; // dt approximation
            c.y += (dy / dist) * pullStrength * 0.016;
            
            // Teleport if very close
            if (dist < this.radius + 20) {
              c.x = this.x + (Math.random() - 0.5) * 100;
              c.y = this.y + (Math.random() - 0.5) * 100;
            }
          }
        }
      });
      
      // Pull players
      centers.forEach((center, i) => {
        if (!eatenByGary[i]) {
          const dx = this.x - center[0];
          const dy = this.y - center[1];
          const dist = Math.hypot(dx, dy);
          
          if (dist < this.vortexRadius) {
            // Players get pulled and can be teleported
            const pullStrength = this.vortexPower / (dist + 1);
            // Note: Can't directly modify player position, but effect is visual
          }
        }
      });
      
      // Self teleportation
      if (Math.random() < 0.3) {
        this.x = Math.random() * (canvasElement.width - 200) + 100;
        this.y = Math.random() * (canvasElement.height - 200) + 100;
      }
      
      setTimeout(() => {
        this.vortexActive = false;
      }, 2000);
    }
    
    createPowerSurge() {
      // Create multiple energy blasts
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const vx = Math.cos(angle) * 600;
        const vy = Math.sin(angle) * 600;
        const surge = new PurpleLaser(this.x, this.y, vx, vy);
        surge.color = '#FFD700';
        surge.radius = 20;
        surge.damage = 5;
        lasers.push(surge);
      }
    }
    
    teleportToEndDimension() {
      // Teleport to End of Dungeon dimension and attack
      if (Math.random() < 0.4) {
        // Change to End dimension
        currentDimension = 'EndOfDungeon';
        
        // Spawn in End dimension
        this.x = canvasElement.width / 2;
        this.y = canvasElement.height / 2;
        
        // Create chaos in End dimension
        for (let i = 0; i < 5; i++) {
          creatures.push(new Nightmare(this.x + (Math.random() - 0.5) * 200, 
                                     this.y + (Math.random() - 0.5) * 200, 
                                     canvasElement.width, canvasElement.height));
        }
        
        this.speak("END DIMENSION INVASION!");
      }
    }
    
    transformWaterToLinther() {
      // Transform any water effects to Linther poison
      // This would affect visual water effects if they existed
      // For now, create poison pools periodically
      if (Math.random() < 0.05) {
        const lintherX = this.x + (Math.random() - 0.5) * 300;
        const lintherY = this.y + (Math.random() - 0.5) * 300;
        
        // Create Linther poison pool (visual effect)
        ctx.save();
        ctx.fillStyle = 'rgba(128, 0, 128, 0.3)';
        ctx.beginPath();
        ctx.arc(lintherX, lintherY, 30, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
      }
    }
    
    enhanceAttachments() {
      // Transform attachments to enhanced versions
      this.attachments.forEach(att => {
        if (!att.enhanced) {
          att.enhanced = true;
          att.damage *= 2; // Double damage
          att.length *= 1.5; // Bigger size
          att.attackInterval *= 0.5; // Faster attacks
          
          // Visual enhancement
          if (att.type === 'lightsaber') {
            att.color = '#FFD700'; // Gold lightsaber
          }
        }
      });
    }
    
    render(ctx) {
      ctx.save();
      
      // Energy aura effect
      const auraRadius = this.radius + Math.sin(this.energyAura) * 30;
      ctx.fillStyle = `rgba(255, 215, 0, ${0.2 + Math.sin(this.energyAura) * 0.1})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, auraRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Larger gown
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * this.gownSize, 0, 2 * Math.PI);
      ctx.fill();
      
      // Main body
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Red eyes
      ctx.fillStyle = this.eyeColor;
      ctx.beginPath();
      ctx.arc(this.x - 15, this.y - 10, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.x + 15, this.y - 10, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Hellbroken diamond (transformed to netherite)
      ctx.save();
      ctx.translate(this.x, this.y + 20);
      ctx.rotate(this.netheriteEffect);
      ctx.fillStyle = '#8B4513'; // Netherite color
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = '#FFD700'; // Gold accents
      ctx.fillRect(-8, -4, 16, 8);
      ctx.restore();
      
      // Blue flames effect
      for (let i = 0; i < 8; i++) {
        const flameAngle = (i / 8) * Math.PI * 2 + this.blueFlameTimer;
        const flameX = this.x + Math.cos(flameAngle) * (this.radius + 20);
        const flameY = this.y + Math.sin(flameAngle) * (this.radius + 20);
        
        ctx.fillStyle = '#0080FF'; // Blue flame
        ctx.beginPath();
        ctx.arc(flameX, flameY, 8, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      // Vortex effect when active
      if (this.vortexActive) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 5;
        for (let r = 20; r < this.vortexRadius; r += 20) {
          ctx.beginPath();
          ctx.arc(this.x, this.y, r, 0, 2 * Math.PI);
          ctx.stroke();
        }
      }
      
      // Power level indicator
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`MEGA GARY - Power: ${Math.floor(this.powerLevel)}`, this.x, this.y - this.radius - 20);
      
      // Instability warning
      if (this.overcharging) {
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('POWER OVERLOAD!', this.x, this.y - this.radius - 40);
      }
      
      ctx.restore();
      
      // Render attachments with enhanced effects
      this.attachments.forEach(att => {
        const attachAngle = this.spinAngle + att.offsetAngle;
        const attachX = this.x + Math.cos(attachAngle) * (this.radius + att.length/2);
        const attachY = this.y + Math.sin(attachAngle) * (this.radius + att.length/2);
        
        ctx.save();
        ctx.translate(attachX, attachY);
        ctx.rotate(attachAngle);
        
        // Enhanced glow effect
        if (att.enhanced) {
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 20;
        }
        
        att.render(ctx);
        ctx.restore();
      });
    }
    
    speak(context) {
      // Enhanced mega voice
      if (!this.audioPlaying) {
        this.megaAudio.currentTime = 0;
        this.megaAudio.play().catch(e => console.log('Mega audio play failed:', e));
        this.audioPlaying = true;
        this.megaAudio.onended = () => {
          this.audioPlaying = false;
        };
      }
    }
  }
  
  // A.S.D. - Apocalyptic Sentient Destroyer (End of Dungeon Final Boss)
  class ASD extends BaseBoss {
    constructor(cx, cy) {
      super(cx, cy);
      this.name = 'A.S.D.';
      this.fullName = 'Apocalyptic Sentient Destroyer';
      this.radius = 80;
      this.health = 500;
      this.maxHealth = 500;
      this.color = '#000000';
      this.phase = 1;
      this.attackPattern = 0;
      this.patternTimer = 0;
      this.patternInterval = 5.0;
      
      // Phase 1 abilities
      this.voidBeamTimer = 0;
      this.voidBeamInterval = 3.0;
      
      // Phase 2 abilities
      this.dimensionShiftTimer = 0;
      this.dimensionShiftInterval = 8.0;
      
      // Phase 3 abilities
      this.apocalypseTimer = 0;
      this.apocalypseInterval = 10.0;
      this.singularityActive = false;
    }
    
    update(dt, tx, ty) {
      super.update(dt, tx, ty);
      
      // Update phase based on health
      const healthPercent = this.health / this.maxHealth;
      if (healthPercent <= 0.33) {
        this.phase = 3;
        this.color = '#FF0000';
      } else if (healthPercent <= 0.66) {
        this.phase = 2;
        this.color = '#800080';
      }
      
      // Pattern rotation
      this.patternTimer += dt;
      if (this.patternTimer >= this.patternInterval) {
        this.attackPattern = (this.attackPattern + 1) % 3;
        this.patternTimer = 0;
      }
      
      // Phase 1: Void beams
      if (this.phase >= 1) {
        this.voidBeamTimer += dt;
        if (this.voidBeamTimer >= this.voidBeamInterval) {
          // Rotating void beams
          for(let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + this.angle;
            const beam = new PurpleLaser(this.x, this.y, Math.cos(angle) * 500, Math.sin(angle) * 500);
            beam.color = '#4B0082';
            beam.radius = 15;
            beam.damage = 2;
            lasers.push(beam);
          }
          this.voidBeamTimer = 0;
        }
      }
      
      // Phase 2: Dimension shift
      if (this.phase >= 2) {
        this.dimensionShiftTimer += dt;
        if (this.dimensionShiftTimer >= this.dimensionShiftInterval) {
          // Teleport and summon nightmares
          this.x = Math.random() * (canvasElement.width - 200) + 100;
          this.y = Math.random() * (canvasElement.height - 200) + 100;
          
          for(let i = 0; i < 3; i++) {
            creatures.push(new Nightmare(this.x, this.y, canvasElement.width, canvasElement.height));
          }
          this.dimensionShiftTimer = 0;
        }
      }
      
      // Phase 3: Apocalypse
      if (this.phase >= 3) {
        this.apocalypseTimer += dt;
        if (this.apocalypseTimer >= this.apocalypseInterval) {
          // Create singularity
          this.singularityActive = true;
          
          // Pull everything toward center
          const centerX = canvasElement.width / 2;
          const centerY = canvasElement.height / 2;
          
          creatures.forEach(c => {
            if (c !== this) {
              const dx = centerX - c.x;
              const dy = centerY - c.y;
              const dist = Math.hypot(dx, dy) || 1;
              c.x += (dx/dist) * 200 * dt;
              c.y += (dy/dist) * 200 * dt;
            }
          });
          
          // Apocalyptic damage waves
          if (Math.floor(this.apocalypseTimer * 2) % 2 === 0) {
            fireRings.push({
              x: centerX,
              y: centerY,
              radius: 50,
              maxRadius: 500,
              expandSpeed: 300,
              color: '#8B0000'
            });
          }
          
          if (this.apocalypseTimer >= this.apocalypseInterval + 5) {
            this.singularityActive = false;
            this.apocalypseTimer = 0;
          }
        }
      }
      
      // Spawn dungeon creatures based on pattern
      switch(this.attackPattern) {
        case 0:
          if (Math.random() < 0.02) creatures.push(new Loc(this.x, this.y, canvasElement.width, canvasElement.height));
          break;
        case 1:
          if (Math.random() < 0.02) creatures.push(new Whiched(this.x, this.y, canvasElement.width, canvasElement.height));
          break;
        case 2:
          if (Math.random() < 0.02) creatures.push(new Lunanua(this.x, this.y, canvasElement.width, canvasElement.height));
          break;
      }
    }
  }
  
  // AI Player class
  class AIPlayer {
    constructor(x, y, name) {
      this.x = x;
      this.y = y;
      this.name = name;
      this.radius = 50;
      this.lives = 3;
      this.targetCreature = null;
      this.movementTimer = 0;
      this.shootTimer = 0;
      this.shootInterval = 0.5;
      this.dodgeTimer = 0;
      this.dodgeInterval = 2.0;
      this.strategy = ['aggressive', 'defensive', 'support'][Math.floor(Math.random() * 3)];
      this.color = ['#FFD700', '#C0C0C0', '#CD7F32'][Math.floor(Math.random() * 3)];
    }
    
    update(dt) {
      // Find target
      if (!this.targetCreature || this.targetCreature.health <= 0) {
        let nearest = null;
        let nearestDist = Infinity;
        creatures.forEach(c => {
          const dist = Math.hypot(c.x - this.x, c.y - this.y);
          if (dist < nearestDist && !(c instanceof GaryBoss)) {
            nearestDist = dist;
            nearest = c;
          }
        });
        this.targetCreature = nearest;
      }
      
      // Movement based on strategy
      if (this.targetCreature) {
        const dx = this.targetCreature.x - this.x;
        const dy = this.targetCreature.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        
        switch(this.strategy) {
          case 'aggressive':
            // Move toward target
            this.x += (dx/dist) * 150 * dt;
            this.y += (dy/dist) * 150 * dt;
            break;
          case 'defensive':
            // Keep distance
            if (dist < 200) {
              this.x -= (dx/dist) * 100 * dt;
              this.y -= (dy/dist) * 100 * dt;
            } else if (dist > 300) {
              this.x += (dx/dist) * 50 * dt;
              this.y += (dy/dist) * 50 * dt;
            }
            break;
          case 'support':
            // Stay near other AI players
            let centerX = 0, centerY = 0, count = 0;
            aiPlayers.forEach(ai => {
              if (ai !== this) {
                centerX += ai.x;
                centerY += ai.y;
                count++;
              }
            });
            if (count > 0) {
              centerX /= count;
              centerY /= count;
              const cdx = centerX - this.x;
              const cdy = centerY - this.y;
              const cdist = Math.hypot(cdx, cdy) || 1;
              if (cdist > 150) {
                this.x += (cdx/cdist) * 100 * dt;
                this.y += (cdy/cdist) * 100 * dt;
              }
            }
            break;
        }
      }
      
      // Shooting
      this.shootTimer += dt;
      if (this.shootTimer >= this.shootInterval && this.targetCreature) {
        const dx = this.targetCreature.x - this.x;
        const dy = this.targetCreature.y - this.y;
        const dist = Math.hypot(dx, dy) || 1;
        lasers.push(new Laser(this.x, this.y, (dx/dist) * 600, (dy/dist) * 600));
        this.shootTimer = 0;
      }
      
      // Dodging
      this.dodgeTimer += dt;
      if (this.dodgeTimer >= this.dodgeInterval) {
        // Check for nearby threats
        let nearestThreat = null;
        let threatDist = Infinity;
        lasers.forEach(l => {
          const dist = Math.hypot(l.x - this.x, l.y - this.y);
          if (dist < 100 && dist < threatDist) {
            threatDist = dist;
            nearestThreat = l;
          }
        });
        
        if (nearestThreat) {
          // Dodge perpendicular to threat
          const dx = nearestThreat.vx;
          const dy = nearestThreat.vy;
          const perpX = -dy;
          const perpY = dx;
          const mag = Math.hypot(perpX, perpY) || 1;
          this.x += (perpX/mag) * 200;
          this.y += (perpY/mag) * 200;
        }
        
        this.dodgeTimer = 0;
      }
      
      // Keep in bounds
      this.x = Math.max(this.radius, Math.min(canvasElement.width - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(canvasElement.height - this.radius, this.y));
    }
  }
  
  // Dimension Portal base class
  class DimensionPortal {
    constructor(x, y, targetDimension) {
      this.x = x;
      this.y = y;
      this.radius = 40;
      this.targetDimension = targetDimension;
      this.active = true;
      this.pulse = 0;
      this.color = targetDimension === 'dungeon' ? '#8B0000' : '#8B008B';
    }
    
    update(dt) {
      this.pulse += dt * 2;
      
      // Check if player enters portal
      metricsList.forEach((m, i) => {
        const centers = [canvasElement.width - (m.faceCoords[0]*(canvasElement.width/(videoElement.videoWidth||640))), m.faceCoords[1]*(canvasElement.height/(videoElement.videoHeight||480))];
        if (Math.hypot(centers[0] - this.x, centers[1] - this.y) < this.radius + 50) {
          // Transport to new dimension
          currentDimension = this.targetDimension;
          if (this.targetDimension === 'dungeon') {
            dungeonDimensionActive = true;
            // Spawn dungeon creatures
            for(let i = 0; i < 5; i++) {
              const types = [Loc, Bat, Nightmare, Dream, Whiched, Creak, Creeper, NeonZombie, Lunanua];
              const Type = types[Math.floor(Math.random() * types.length)];
              creatures.push(new Type(0, 0, canvasElement.width, canvasElement.height));
            }
            // Spawn The Frog
            if (!theFrog) {
              theFrog = new TheFrog(canvasElement.width/2, canvasElement.height/2);
            }
          } else if (this.targetDimension === 'elder') {
            elderDimensionActive = true;
            // Original Elder portal spawning code
            const isShadow = Math.random() < 0.01;
            garyBoss = new GaryBoss(this.x, this.y, isShadow);
            const xyz = new XYZ(this.x, this.y + 100);
            xyz.health = 100;
            garyBoss.ridingXyz = xyz;
            creatures.push(xyz);
            garyBoss.heldItem = ['remote', 'crystal', 'scanner'][Math.floor(Math.random() * 3)];
            
            // Spawn Lexicon
            if (!lexicon) {
              lexicon = new Lexicon(this.x + 200, this.y);
            }
          }
          
          // Remove this portal
          const idx = portals.indexOf(this);
          if (idx > -1) portals.splice(idx, 1);
        }
      });
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
  // Lexicon - Gary's creator
  class Lexicon {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 35;
      this.health = 200;
      this.maxHealth = 200;
      this.color = '#4169E1';
      this.bookFloat = 0;
      this.spellTimer = 0;
      this.spellInterval = 2.0;
      this.creationTimer = 0;
      this.creationInterval = 15.0;
      this.knowledge = ['fire', 'ice', 'lightning', 'void', 'time'];
      this.currentSpell = 0;
      this.isCreator = true;
    }
    update(dt) {
      this.bookFloat += dt * 2;
      
      // Spell casting
      this.spellTimer += dt;
      if (this.spellTimer >= this.spellInterval) {
        const spell = this.knowledge[this.currentSpell];
        switch(spell) {
          case 'fire':
            for(let i = 0; i < 5; i++) {
              const angle = (i / 5) * Math.PI * 2;
              lasers.push(new Fireball(this.x, this.y, Math.cos(angle) * 300, Math.sin(angle) * 300));
            }
            break;
          case 'ice':
            // Freeze nearby enemies
            creatures.forEach(c => {
              if(Math.hypot(c.x - this.x, c.y - this.y) < 200) {
                c.speed *= 0.5;
                setTimeout(() => { c.speed *= 2; }, 2000);
              }
            });
            break;
          case 'lightning':
            // Chain lightning
            let target = creatures[Math.floor(Math.random() * creatures.length)];
            if(target) {
              const bolt = new PurpleLaser(this.x, this.y, (target.x - this.x) * 2, (target.y - this.y) * 2);
              bolt.color = '#FFFF00';
              lasers.push(bolt);
            }
            break;
          case 'void':
            // Create void zones
            voidZones.push({ x: this.x + (Math.random() - 0.5) * 300, y: this.y + (Math.random() - 0.5) * 300, radius: 50, lifetime: 5 });
            break;
          case 'time':
            // Slow time for everyone except Lexicon
            timeSlowActive = true;
            setTimeout(() => { timeSlowActive = false; }, 3000);
            break;
        }
        this.currentSpell = (this.currentSpell + 1) % this.knowledge.length;
        this.spellTimer = 0;
      }
      
      // Create minions
      this.creationTimer += dt;
      if (this.creationTimer >= this.creationInterval) {
        // Create a shadow Gary
        const shadowGary = new GaryBoss(this.x + 100, this.y, true);
        shadowGary.health = 50; // Weaker version
        shadowGary.radius = 30;
        creatures.push(shadowGary);
        this.creationTimer = 0;
      }
    }
  }
  
  // The Frog - trap master
  class TheFrog {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 25;
      this.health = 100;
      this.maxHealth = 100;
      this.color = '#228B22';
      this.jumpTimer = 0;
      this.jumpInterval = 1.5;
      this.trapTimer = 0;
      this.trapInterval = 3.0;
      this.tongueTimer = 0;
      this.tongueInterval = 2.0;
      this.jumping = false;
      this.jumpVx = 0;
      this.jumpVy = 0;
      this.jumpDuration = 0.5;
      this.jumpTime = 0;
    }
    update(dt, playerX, playerY) {
      // Jumping
      this.jumpTimer += dt;
      if (this.jumpTimer >= this.jumpInterval && !this.jumping) {
        this.jumping = true;
        this.jumpTime = 0;
        const angle = Math.atan2(playerY - this.y, playerX - this.x) + (Math.random() - 0.5) * Math.PI/2;
        this.jumpVx = Math.cos(angle) * 400;
        this.jumpVy = Math.sin(angle) * 400;
        this.jumpTimer = 0;
      }
      
      if (this.jumping) {
        this.jumpTime += dt;
        this.x += this.jumpVx * dt;
        this.y += this.jumpVy * dt;
        if (this.jumpTime >= this.jumpDuration) {
          this.jumping = false;
        }
      }
      
      // Lay traps
      this.trapTimer += dt;
      if (this.trapTimer >= this.trapInterval) {
        traps.push({
          x: this.x + (Math.random() - 0.5) * 100,
          y: this.y + (Math.random() - 0.5) * 100,
          type: ['spike', 'sticky', 'poison'][Math.floor(Math.random() * 3)],
          radius: 30,
          active: true
        });
        this.trapTimer = 0;
      }
      
      // Tongue attack
      this.tongueTimer += dt;
      if (this.tongueTimer >= this.tongueInterval) {
        const dist = Math.hypot(playerX - this.x, playerY - this.y);
        if (dist < 200) {
          // Tongue grab
          tongueAttacks.push({
            startX: this.x,
            startY: this.y,
            endX: playerX,
            endY: playerY,
            lifetime: 0.5,
            age: 0
          });
        }
        this.tongueTimer = 0;
      }
    }
  }
  
  // Boss subclasses with enhanced powers
  class SnowKing extends BaseBoss { 
    constructor(cx,cy){ 
      super(cx,cy); 
      this.health=30; 
      this.color='lightblue'; 
      this.spawn=3; 
      this.timer=0;
      this.blizzardTimer = 0;
      this.blizzardInterval = 5.0;
      this.iceWallTimer = 0;
      this.iceWallInterval = 7.0;
    }
    update(dt,tx,ty){ 
      super.update(dt,tx,ty); 
      this.spawnMinions(dt); 
      this.timer+=dt; 
      if(this.timer>=this.spawn){ 
        creatures.push(new Snowie(this.x,this.y,canvasElement.width,canvasElement.height)); 
        this.timer=0;
      }
      
      // Blizzard attack
      this.blizzardTimer += dt;
      if (this.blizzardTimer >= this.blizzardInterval) {
        // Create blizzard effect
        for(let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 200 + Math.random() * 200;
          const ice = new PurpleLaser(this.x, this.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
          ice.color = '#B0E0E6';
          lasers.push(ice);
        }
        this.blizzardTimer = 0;
      }
      
      // Ice wall
      this.iceWallTimer += dt;
      if (this.iceWallTimer >= this.iceWallInterval) {
        // Create ice walls
        for(let i = 0; i < 5; i++) {
          iceWalls.push({
            x: this.x + (i - 2) * 50,
            y: this.y + 100,
            width: 40,
            height: 80,
            health: 3
          });
        }
        this.iceWallTimer = 0;
      }
    }
  }
  class FlameWarden extends BaseBoss { 
    constructor(cx,cy){ 
      super(cx,cy); 
      this.health=25; 
      this.color='orange'; 
      this.spawn=2; 
      this.timer=0;
      this.fireRingTimer = 0;
      this.fireRingInterval = 4.0;
      this.lavaPoolTimer = 0;
      this.lavaPoolInterval = 6.0;
    }
    update(dt,tx,ty){ 
      super.update(dt,tx,ty); 
      this.spawnMinions(dt); 
      this.timer+=dt; 
      if(this.timer>=this.spawn){ 
        creatures.push(new FireSpinner(this.x,this.y,canvasElement.width,canvasElement.height)); 
        this.timer=0;
      }
      
      // Fire ring
      this.fireRingTimer += dt;
      if (this.fireRingTimer >= this.fireRingInterval) {
        // Expanding fire ring
        fireRings.push({
          x: this.x,
          y: this.y,
          radius: 20,
          maxRadius: 300,
          expandSpeed: 150
        });
        this.fireRingTimer = 0;
      }
      
      // Lava pools
      this.lavaPoolTimer += dt;
      if (this.lavaPoolTimer >= this.lavaPoolInterval) {
        lavaPools.push({
          x: tx + (Math.random() - 0.5) * 200,
          y: ty + (Math.random() - 0.5) * 200,
          radius: 40,
          lifetime: 10
        });
        this.lavaPoolTimer = 0;
      }
    }
  }
  class VortexBoss extends BaseBoss { 
    constructor(cx,cy){ 
      super(cx,cy); 
      this.health=35; 
      this.color='blue'; 
      this.pulse=3; 
      this.timer=0; 
      this.pull=100; 
      this.radiusPull=200;
      this.miniVortexTimer = 0;
      this.miniVortexInterval = 5.0;
      this.reverseTimer = 0;
      this.reverseInterval = 8.0;
      this.reversePull = false;
    }
    update(dt,tx,ty){ 
      super.update(dt,tx,ty); 
      this.spawnMinions(dt); 
      this.timer+=dt; 
      if(this.timer>=this.pulse){ 
        const pullForce = this.reversePull ? -this.pull : this.pull;
        creatures.forEach(c=>{ 
          const dx=this.x-c.x, dy=this.y-c.y, d=Math.hypot(dx,dy)||1; 
          if(d<this.radiusPull){ 
            c.x+=dx/d*pullForce*dt; 
            c.y+=dy/d*pullForce*dt;
          } 
        }); 
        this.timer=0;
      }
      
      // Mini vortexes
      this.miniVortexTimer += dt;
      if (this.miniVortexTimer >= this.miniVortexInterval) {
        for(let i = 0; i < 3; i++) {
          miniVortexes.push({
            x: this.x + (Math.random() - 0.5) * 400,
            y: this.y + (Math.random() - 0.5) * 400,
            radius: 100,
            pull: 50,
            lifetime: 5
          });
        }
        this.miniVortexTimer = 0;
      }
      
      // Reverse gravity
      this.reverseTimer += dt;
      if (this.reverseTimer >= this.reverseInterval) {
        this.reversePull = !this.reversePull;
        this.color = this.reversePull ? '#FF1493' : 'blue';
        this.reverseTimer = 0;
      }
    }
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
  const gusterBlocks = [];
  const pumus = [];
  const storms = [];
  const traps = [];
  const tongueAttacks = [];
  const voidZones = [];
  const iceWalls = [];
  const fireRings = [];
  const lavaPools = [];
  const miniVortexes = [];
  const aiPlayers = [];
  const rockOfPowerItems = [];
  let garyBoss = null;
  
  // Function to spawn AI assistance when Gary kills players
  function spawnAIAssistance(deathX, deathY, reason) {
    if (aiPlayers.length < 5) { // Allow up to 5 AI helpers
      const aiNames = ['RescueBot', 'GuardianAI', 'DefenderUnit', 'ProtectorDroid', 'SaviorBot', 'HeroAI', 'ShieldUnit'];
      const name = aiNames[Math.floor(Math.random() * aiNames.length)];
      const ai = new AIPlayer(
        deathX + (Math.random() - 0.5) * 200, // Spawn near death location
        deathY + (Math.random() - 0.5) * 200,
        name
      );
      // Make assistance AI more aggressive against Gary
      ai.strategy = 'aggressive';
      ai.color = '#00FF00'; // Green for rescue AI
      aiPlayers.push(ai);
      
      // Visual effect for AI assistance
      const assistEffect = {
        x: ai.x,
        y: ai.y,
        t: 0,
        type: 'assistance'
      };
      // Add to effects if array exists
      if (typeof handHitEffects !== 'undefined') {
        handHitEffects.push(assistEffect);
      }
    }
  }
  let lexicon = null;
  let theFrog = null;
  let asdBoss = null;
  let elderDimensionActive = false;
  let dungeonDimensionActive = false;
  let currentDimension = 'normal'; // normal, dungeon, elder
  let playerLocked = false;
  let controlsReversed = false;
  let playerAttackSpeed = 1;
  let screenShake = 0;
  let timeSlowActive = false;
  let boss = null;
  let waveIndex = 0;
  let waveKills = 0;
  let state = 'minions';
  let lastSpawn = 0;
  const spawnInterval = 1.5;
  const killTargets = [15,20,25,30,35,40,45,50,55,60]; // Adjusted for more dimensions
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
  
  // Starter message system with tips, tricks, jokes, and code stats
  const starterMessages = [
    {
      text: "🎮 This entire project was crafted with 5,396 lines of code across all files (4,544 in game logic + 270 HTML + 582 deployment scripts/configs)!",
      type: "code_stats"
    },
    {
      text: "💡 TIP: Look away from Gary to avoid her wrath! Eye contact makes her aggressive, but looking away keeps you safe.",
      type: "tip"
    },
    {
      text: "🔥 TIP: Use your hands to attack creatures! Open your hands near enemies to damage them.",
      type: "tip"
    },
    {
      text: "😮 TIP: Open your mouth near enemies to capture them! It's surprisingly effective.",
      type: "tip"
    },
    {
      text: "🗿 RARE SECRET: The Rock of All Power spawns randomly (0.1% chance). If Gary finds it, she transforms into MEGA GARY!",
      type: "secret"
    },
    {
      text: "🤖 AI players will come to your rescue when Gary defeats you. They're like digital guardian angels!",
      type: "tip"
    },
    {
      text: "🐲 The XYZ Dragon can be defeated, but Gary is immortal. She's already dead - what's deader than dead?",
      type: "tip"
    },
    {
      text: "⚡ JOKE: Why doesn't Gary ever get tired? Because she runs on pure chaos energy and questionable life choices!",
      type: "joke"
    },
    {
      text: "🌪️ Gary can create storms by collecting gunk from Pumus blocks. Nature's recycling program gone wrong!",
      type: "lesson"
    },
    {
      text: "🎯 PUN ALERT: Gary's favorite music genre? Heavy METAL, because she's literally wearing armor and attitude!",
      type: "pun"
    },
    {
      text: "🎮 LESSON: This game uses MediaPipe for face detection. Your face literally controls the action - smile, you're on camera!",
      type: "lesson"
    },
    {
      text: "⚔️ Gary collects attachments like lightsabers and robot arms. She's basically a magical Swiss Army knife!",
      type: "tip"
    },
    {
      text: "🎪 JOKE: What do you call Gary's dimension-hopping abilities? UBER, but for interdimensional chaos!",
      type: "joke"
    },
    {
      text: "📈 The game gets harder with waves - more enemy types unlock as you survive longer. Survival of the fittest!",
      type: "lesson"
    },
    {
      text: "🌀 MEGA GARY creates vortexes that pull everything in. It's like a cosmic vacuum cleaner with anger issues!",
      type: "tip"
    },
    {
      text: "🎨 PUN: Why is Gary pink? Because she's in the PINK of health... permanently! Death couldn't improve her complexion.",
      type: "pun"
    },
    {
      text: "🏰 Elder Dimension restricts spawns to only Gary and XYZ. It's their private VIP club of chaos!",
      type: "lesson"
    },
    {
      text: "🎵 Gary says 'not a threat' while being the biggest threat. It's like a tornado saying it's just a gentle breeze!",
      type: "joke"
    },
    {
      text: "🔧 The game runs at 60 FPS using requestAnimationFrame. Smooth like Gary's dance moves (if she danced)!",
      type: "lesson"
    },
    {
      text: "⭐ LEGEND: Lexicon created Gary, The Frog sets traps, and A.S.D. guards the End Dimension. What a family reunion!",
      type: "lesson"
    }
  ];
  
  let currentMessageIndex = 0;
  let messageInterval;
  
  function displayStarterMessage() {
    const messageText = document.getElementById('messageText');
    const messageCounter = document.getElementById('messageCounter');
    
    if (messageText && messageCounter) {
      const message = starterMessages[currentMessageIndex];
      messageText.textContent = message.text;
      messageCounter.textContent = `Message ${currentMessageIndex + 1} of ${starterMessages.length}`;
      
      currentMessageIndex = (currentMessageIndex + 1) % starterMessages.length;
    }
  }
  
  // Start showing messages when script loads (since DOMContentLoaded may have already fired)
  function initializeMessages() {
    displayStarterMessage();
    messageInterval = setInterval(displayStarterMessage, 4000); // Change every 4 seconds
  }
  
  // Check if DOM is already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMessages);
  } else {
    // DOM is already loaded, initialize immediately
    initializeMessages();
  }
  
  // Wait for user gesture to start media
  const startBtn = document.getElementById('startButton');
  startBtn.addEventListener('click', () => {
    // Stop the message rotation
    if (messageInterval) {
      clearInterval(messageInterval);
    }
    
    document.getElementById('startScreen').style.display = 'none';
    
    // Show Portal buttons
    document.getElementById('portalButtons').style.display = 'flex';
    
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
      elderPortalBtn.textContent = '🏰 Portal Opening...';
      
      setTimeout(() => {
        elderPortalBtn.disabled = false;
        elderPortalBtn.textContent = '🏰 Build Portal to Elder';
      }, 6000); // Re-enable after 6 seconds
    }
  });

  // Dungeon Portal button functionality
  const dungeonPortalBtn = document.getElementById('dungeonPortalButton');
  dungeonPortalBtn.addEventListener('click', () => {
    if (!dungeonDimensionActive) {
      // Create Dungeon Dimension portal at random location
      const portalX = Math.random() * (canvasElement.width - 200) + 100;
      const portalY = Math.random() * (canvasElement.height - 200) + 100;
      portals.push(new DimensionPortal(portalX, portalY, 'dungeon'));
      
      // Disable button temporarily to prevent spam
      dungeonPortalBtn.disabled = true;
      dungeonPortalBtn.textContent = '🗡️ Portal Opening...';
      
      setTimeout(() => {
        dungeonPortalBtn.disabled = false;
        dungeonPortalBtn.textContent = '🗡️ Build Portal to Dungeon';
      }, 6000); // Re-enable after 6 seconds
    }
  });

  // Normal Portal button functionality (return to normal dimension)
  const normalPortalBtn = document.getElementById('normalPortalButton');
  normalPortalBtn.addEventListener('click', () => {
    // Reset all dimension states
    elderDimensionActive = false;
    dungeonDimensionActive = false;
    currentDimension = 'Normal';
    
    // Clear existing creatures and bosses from other dimensions
    creatures.length = 0;
    
    // Reset Gary boss if needed
    if (garyBoss) {
      garyBoss = null;
    }
    
    // Disable button temporarily
    normalPortalBtn.disabled = true;
    normalPortalBtn.textContent = '🏠 Returning...';
    
    setTimeout(() => {
      normalPortalBtn.disabled = false;
      normalPortalBtn.textContent = '🏠 Return to Normal';
    }, 3000); // Re-enable after 3 seconds
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
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    
    // Update Gary even during pause (she ignores pause)
    if (garyBoss) {
      const centers = metricsList.map(m=>[canvasElement.width - (m.faceCoords[0]*(canvasElement.width/(videoElement.videoWidth||640))), m.faceCoords[1]*(canvasElement.height/(videoElement.videoHeight||480))]);
      const nearestCenter = centers[0] || [canvasElement.width/2, canvasElement.height/2];
      garyBoss.update(dt, nearestCenter[0], nearestCenter[1], metricsList, centers, creatures, boss);
    }
    
    // Update pumus even during pause (they turn to gunk)
    pumus.forEach(p=>p.update(dt));
    
    // Update storms even during pause
    storms.forEach(s=>s.update(dt));
    
    if (paused) {
      // Gary continues to move, but skip other updates
      requestAnimationFrame(animate);
      return;
    }
    
    getMicData();
    const nowSec = performance.now()/1000;
    if(state === 'minions' && nowSec - lastSpawn > spawnInterval && !elderDimensionActive && !dungeonDimensionActive) {
      const r = Math.random();
      let types = [Creature, Snowie, FireSpinner, Ghost, Skeleton, Caster, Dragon];
      
      // Add more enemy types in later waves
      if (waveIndex >= 3) {
        types.push(Phantom, Bomber, Ninja);
      }
      if (waveIndex >= 5) {
        types.push(Healer, Mimic);
      }
      
      const Type = types[Math.floor(r*types.length)];
      creatures.push(new Type(0,0, canvasElement.width, canvasElement.height));
      lastSpawn = nowSec;
      
      // AI players no longer spawn randomly - only when Gary kills players
      
      // Spawn The Rock of All Power very rarely
      if (Math.random() < 0.001 && rockOfPowerItems.length < 1) {
        const rockX = Math.random() * (canvasElement.width - 100) + 50;
        const rockY = Math.random() * (canvasElement.height - 100) + 50;
        rockOfPowerItems.push(new RockOfAllPower(rockX, rockY));
      }
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
          // Special handling for XYZ dragon
          if (c instanceof XYZ) {
            if (!c.shieldActive) {
              c.health -= 1;
              if (c.health <= 0) {
                defeatMap.set(c, 'hand');
              }
            }
          } else {
            defeatMap.set(c, 'hand');
          }
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
          // Special handling for XYZ dragon
          if (c instanceof XYZ) {
            l.active = false;
            if (!c.shieldActive) {
              c.health -= 1;
              if (c.health <= 0) {
                defeatMap.set(c, 'laser');
              }
            }
            return;
          }
          l.active = false;
          // Check if this is a Fang attack with minimal damage
          if (l instanceof Fang && l.damage) {
            // Give creature health if it doesn't have any
            if (!c.health) {
              c.health = 3; // Default health for creatures
              c.maxHealth = 3;
            }
            c.health -= l.damage;
            if (c.health <= 0) {
              defeatMap.set(c, 'laser');
            }
          } else {
            defeatMap.set(c, 'laser');
          }
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
            // Special handling for XYZ dragon
            if (c instanceof XYZ) {
              if (!c.shieldActive) {
                c.health -= 2; // Mouth does more damage
                if (c.health <= 0) {
                  defeatMap.set(c, 'mouth');
                }
              }
            } else {
              defeatMap.set(c, 'mouth');
            }
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
          garyBoss.speak("immortal"); // Says "not a threat" when hit by lasers
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
      
      // Check if we should transition to a new dimension
      if (waveIndex === 4 && currentDimension === 'normal' && !dungeonDimensionActive) {
        // After 5 bosses, open portal to Dungeon dimension
        portals.push(new DimensionPortal(canvasElement.width/2, canvasElement.height/2, 'dungeon'));
        state = 'portal_wait';
      } else if (waveIndex === 9 && currentDimension === 'normal' && !elderDimensionActive) {
        // After all normal bosses, open portal to Elder dimension
        portals.push(new DimensionPortal(canvasElement.width/2, canvasElement.height/2, 'elder'));
        state = 'portal_wait';
      } else if (dungeonDimensionActive && !asdBoss) {
        // In dungeon dimension, spawn A.S.D. as final boss
        asdBoss = new ASD(bx, by);
        boss = asdBoss;
        bossMaxHealth = boss.health;
        state = 'boss_asd';
      } else if (waveIndex < bossesArr.length) {
        // Normal boss progression
        boss=new bossesArr[waveIndex](bx,by);
        bossMaxHealth = boss.health;
        state='boss_'+[ 'snow','fire','vortex','spinner','ram','tracker','artical','shadow','alienking','madackeda' ][waveIndex];
      }
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
    
    // Update pumus (turn to gunk after time)
    pumus.forEach(p=>p.update(dt));
    
    // Update storms
    storms.forEach(s=>s.update(dt));
    
    // Update Rock of All Power items
    rockOfPowerItems.forEach(rock => rock.update(dt));
    
    // Check if Gary can collect The Rock of All Power
    if (garyBoss) {
      const gary = garyBoss;
      for (let i = rockOfPowerItems.length - 1; i >= 0; i--) {
        const rock = rockOfPowerItems[i];
        const dist = Math.hypot(gary.x - rock.x, gary.y - rock.y);
        
        if (dist < gary.radius + rock.radius) {
          // Gary collects The Rock of All Power
          gary.hasRockOfAllPower = true;
          gary.rockOfAllPower = rock;
          rockOfPowerItems.splice(i, 1);
          gary.speak("THE ROCK OF ALL POWER IS MINE!");
          
          // If regular Gary has it, trigger transformation sooner
          if (garyBoss && !gary.hasTransformed) {
            gary.transformationTrigger = Math.min(gary.transformationTrigger, gary.totalEaten + 5);
          }
        }
      }
    }
    
    // Storm damage to players and creatures
    storms.forEach(storm => {
      // Damage players in storm
      centers.forEach((cen, i) => {
        if (!eatenByGary[i] && invulTimers[i] <= 0) {
          const dist = Math.hypot(cen[0] - storm.x, cen[1] - storm.y);
          if (dist < storm.radius) {
            playerLives[i] = (playerLives[i] || 3) - 1;
            invulTimers[i] = 1.0; // Shorter invul time for storm damage
            if (playerLives[i] <= 0) {
              playerLives[i] = 3;
              invulTimers[i] = 2.0;
            }
          }
        }
      });
      
      // Damage creatures in storm
      creatures.forEach(c => {
        if (!(c instanceof GaryBoss) && !(c instanceof XYZ)) {
          const dist = Math.hypot(c.x - storm.x, c.y - storm.y);
          if (dist < storm.radius) {
            // Lightning strike damage
            c.health = (c.health || 1) - 1;
          }
        }
      });
    });
    
    // Remove inactive storms
    for (let i = storms.length - 1; i >= 0; i--) {
      if (!storms[i].active) {
        storms.splice(i, 1);
      }
    }
    
    // Update AI players
    aiPlayers.forEach(ai => ai.update(dt));
    
    // Update The Frog
    if (theFrog) {
      const playerPos = centers[0] || [canvasElement.width/2, canvasElement.height/2];
      theFrog.update(dt, playerPos[0], playerPos[1]);
    }
    
    // Update Lexicon
    if (lexicon) {
      lexicon.update(dt);
    }
    
    // Update traps
    traps.forEach(trap => {
      if (trap.active) {
        centers.forEach((cen, i) => {
          if (Math.hypot(cen[0] - trap.x, cen[1] - trap.y) < trap.radius) {
            switch(trap.type) {
              case 'spike':
                if (invulTimers[i] <= 0) {
                  playerLives[i] = (playerLives[i] || 3) - 1;
                  invulTimers[i] = 1.0;
                  trap.active = false;
                }
                break;
              case 'sticky':
                // Slow player movement
                playerSpeed = 0.3;
                setTimeout(() => { playerSpeed = 1; }, 2000);
                trap.active = false;
                break;
              case 'poison':
                // Damage over time
                poisonTimer = 3.0;
                trap.active = false;
                break;
            }
          }
        });
      }
    });
    
    // Update tongue attacks
    for (let i = tongueAttacks.length - 1; i >= 0; i--) {
      const t = tongueAttacks[i];
      t.age += dt;
      if (t.age < t.lifetime) {
        // Pull player toward frog
        centers.forEach((cen, j) => {
          const progress = t.age / t.lifetime;
          const pullX = t.startX + (cen[0] - t.startX) * (1 - progress);
          const pullY = t.startY + (cen[1] - t.startY) * (1 - progress);
          // This would need actual player position manipulation
        });
      } else {
        tongueAttacks.splice(i, 1);
      }
    }
    
    // Update void zones
    for (let i = voidZones.length - 1; i >= 0; i--) {
      const zone = voidZones[i];
      zone.lifetime -= dt;
      if (zone.lifetime > 0) {
        // Damage things in void
        centers.forEach((cen, j) => {
          if (Math.hypot(cen[0] - zone.x, cen[1] - zone.y) < zone.radius) {
            if (invulTimers[j] <= 0) {
              playerLives[j] = (playerLives[j] || 3) - 0.5;
              invulTimers[j] = 0.5;
            }
          }
        });
      } else {
        voidZones.splice(i, 1);
      }
    }
    
    // Update ice walls
    for (let i = iceWalls.length - 1; i >= 0; i--) {
      if (iceWalls[i].health <= 0) {
        iceWalls.splice(i, 1);
      }
    }
    
    // Update fire rings
    for (let i = fireRings.length - 1; i >= 0; i--) {
      const ring = fireRings[i];
      ring.radius += ring.expandSpeed * dt;
      if (ring.radius >= ring.maxRadius) {
        fireRings.splice(i, 1);
      } else {
        // Damage at ring edge
        centers.forEach((cen, j) => {
          const dist = Math.hypot(cen[0] - ring.x, cen[1] - ring.y);
          if (Math.abs(dist - ring.radius) < 20 && invulTimers[j] <= 0) {
            playerLives[j] = (playerLives[j] || 3) - 1;
            invulTimers[j] = 1.0;
          }
        });
      }
    }
    
    // Update lava pools
    for (let i = lavaPools.length - 1; i >= 0; i--) {
      const pool = lavaPools[i];
      pool.lifetime -= dt;
      if (pool.lifetime > 0) {
        centers.forEach((cen, j) => {
          if (Math.hypot(cen[0] - pool.x, cen[1] - pool.y) < pool.radius && invulTimers[j] <= 0) {
            playerLives[j] = (playerLives[j] || 3) - 0.5;
            invulTimers[j] = 0.5;
          }
        });
      } else {
        lavaPools.splice(i, 1);
      }
    }
    
    // Update mini vortexes
    for (let i = miniVortexes.length - 1; i >= 0; i--) {
      const vortex = miniVortexes[i];
      vortex.lifetime -= dt;
      if (vortex.lifetime > 0) {
        // Pull creatures
        creatures.forEach(c => {
          const dx = vortex.x - c.x;
          const dy = vortex.y - c.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < vortex.radius) {
            c.x += (dx/dist) * vortex.pull * dt;
            c.y += (dy/dist) * vortex.pull * dt;
          }
        });
      } else {
        miniVortexes.splice(i, 1);
      }
    }
    
    // Apply time slow
    const timeMultiplier = timeSlowActive ? 0.3 : 1.0;
    
    // Reset control reversals
    controlsReversed = false;
    
    // Check nightmares for control reversal
    creatures.forEach(c => {
      if (c instanceof Nightmare) {
        centers.forEach((cen, i) => {
          if (Math.hypot(c.x - cen[0], c.y - cen[1]) < c.fearAura) {
            controlsReversed = true;
          }
        });
      }
    });
    
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
        ctx.fillText(`Dragon Health: ${xyzDragon.health}/${xyzDragon.maxHealth}`, overlayLeft, 190);
        
        // Show dragon phase
        if (xyzDragon.phase > 1) {
          ctx.font = 'bold 14px Arial';
          ctx.fillStyle = xyzDragon.phase === 3 ? '#FF0066' : '#FFD700';
          ctx.fillText(`Phase ${xyzDragon.phase} - ${xyzDragon.rageMode ? 'ENRAGED!' : 'Enhanced'}`, overlayLeft, 210);
        }
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
    creatures.forEach(c=>{
      // Special rendering for XYZ
      if (c instanceof XYZ) {
        // Draw shield if active
        if (c.shieldActive) {
          ctx.save();
          ctx.strokeStyle = '#00FFFF';
          ctx.lineWidth = 4;
          ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius + 20, 0, 2*Math.PI);
          ctx.stroke();
          ctx.restore();
        }
        
        // Draw fire breath indicator
        if (c.fireBreathActive) {
          ctx.save();
          ctx.fillStyle = '#FF4500';
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.arc(c.x, c.y - 20, 30, 0, 2*Math.PI);
          ctx.fill();
          ctx.restore();
        }
        
        // Draw dragon body
        ctx.fillStyle=c.color;
        ctx.beginPath();
        ctx.arc(c.x,c.y,c.radius,0,2*Math.PI);
        ctx.fill();
        
        // Draw spikes
        ctx.save();
        ctx.strokeStyle = c.rageMode ? '#FF0066' : '#4B0082';
        ctx.lineWidth = 3;
        for (let angle = 0; angle < 360; angle += 45) {
          const rad = angle * Math.PI / 180;
          const spikeX = c.x + Math.cos(rad) * c.radius;
          const spikeY = c.y + Math.sin(rad) * c.radius;
          const endX = c.x + Math.cos(rad) * (c.radius + 15);
          const endY = c.y + Math.sin(rad) * (c.radius + 15);
          ctx.beginPath();
          ctx.moveTo(spikeX, spikeY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
        ctx.restore();
        
        // Phase indicator
        if (c.phase > 1) {
          ctx.save();
          ctx.font = 'bold 12px Arial';
          ctx.fillStyle = c.phase === 3 ? '#FF0066' : '#FFD700';
          ctx.textAlign = 'center';
          ctx.fillText(`Phase ${c.phase}`, c.x, c.y - c.radius - 10);
          ctx.restore();
        }
        
        // Health bar for XYZ
        const barWidth = 80;
        const barHeight = 8;
        const barX = c.x - barWidth/2;
        const barY = c.y + c.radius + 15;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        const healthRatio = c.health / c.maxHealth;
        ctx.fillStyle = healthRatio > 0.6 ? '#9370DB' : (healthRatio > 0.3 ? '#FF69B4' : '#FF0066');
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
      } else {
        // Normal creature rendering
        ctx.fillStyle=c.color;
        ctx.beginPath();
        ctx.arc(c.x,c.y,c.radius,0,2*Math.PI);
        ctx.fill();
      }
    });
    lasers.forEach(l=>{ctx.fillStyle=l.color||'red';ctx.beginPath();ctx.arc(l.x,l.y,l.radius,0,2*Math.PI);ctx.fill();});
    fireballs.forEach(f=>{ctx.fillStyle='orange';ctx.beginPath();ctx.arc(f.x,f.y,f.radius,0,2*Math.PI);ctx.fill();});
    
    // Draw snakes
    snakes.forEach(s => {
      ctx.fillStyle = s.color || 'lightgreen';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, 2*Math.PI);
      ctx.fill();
    });
    
    // Draw AI players
    aiPlayers.forEach(ai => {
      ctx.save();
      
      // Draw AI player body
      ctx.fillStyle = ai.color || '#00FF00';
      ctx.beginPath();
      ctx.arc(ai.x, ai.y, ai.radius, 0, 2*Math.PI);
      ctx.fill();
      
      // Draw AI player outline
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ai.x, ai.y, ai.radius, 0, 2*Math.PI);
      ctx.stroke();
      
      // Draw AI name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(ai.name, ai.x, ai.y - ai.radius - 10);
      
      // Draw strategy indicator
      ctx.fillStyle = '#FFD700';
      ctx.font = '10px Arial';
      ctx.fillText(ai.strategy.toUpperCase(), ai.x, ai.y - ai.radius - 25);
      
      // Draw health indicator
      ctx.fillStyle = '#FF0000';
      ctx.font = '8px Arial';
      ctx.fillText(`❤️${ai.lives}`, ai.x, ai.y - ai.radius - 40);
      
      ctx.restore();
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
    
    // Draw Guster blocks
    gusterBlocks.forEach(block => {
      ctx.fillStyle = block.color;
      ctx.fillRect(block.x - block.width/2, block.y - block.height/2, block.width, block.height);
      // Add glowing effect
      ctx.strokeStyle = '#87CEEB';
      ctx.lineWidth = 2;
      ctx.strokeRect(block.x - block.width/2, block.y - block.height/2, block.width, block.height);
    });
    
    // Draw Pumus
    pumus.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, 2*Math.PI);
      ctx.fill();
      
      // Add glow effect when turning to gunk
      if (p.gunkTimer > p.gunkInterval * 0.8) {
        ctx.strokeStyle = p.gunkColor;
        ctx.lineWidth = 3;
        ctx.globalAlpha = Math.sin(p.gunkTimer * 10) * 0.5 + 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
      }
    });
    
    // Draw Storms
    storms.forEach(storm => {
      ctx.save();
      
      // Draw swirling storm cloud
      ctx.strokeStyle = '#4B0082';
      ctx.lineWidth = 5;
      ctx.globalAlpha = 0.7;
      
      // Multiple rotating circles for storm effect
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const offsetAngle = storm.rotation + i * (Math.PI * 2 / 3);
        const offsetRadius = storm.radius * (0.8 - i * 0.2);
        ctx.arc(storm.x + Math.cos(offsetAngle) * 20, 
                storm.y + Math.sin(offsetAngle) * 20, 
                offsetRadius, 0, 2*Math.PI);
        ctx.stroke();
      }
      
      // Draw lightning bolts
      ctx.strokeStyle = '#FFFF00';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 10;
      storm.lightning.forEach(bolt => {
        ctx.globalAlpha = 1 - (bolt.age / bolt.lifetime);
        ctx.beginPath();
        ctx.moveTo(storm.x, storm.y);
        // Zigzag lightning pattern
        const segments = 3;
        for (let i = 1; i <= segments; i++) {
          const progress = i / segments;
          const offsetX = (Math.random() - 0.5) * 20;
          const x = storm.x + (bolt.x - storm.x) * progress + offsetX;
          const y = storm.y + (bolt.y - storm.y) * progress;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(bolt.x, bolt.y);
        ctx.stroke();
      });
      
      ctx.restore();
    });
    
    // Draw Rock of All Power items
    rockOfPowerItems.forEach(rock => {
      rock.render(ctx);
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
      
      // Draw attachments
      garyBoss.attachments.forEach(att => {
        ctx.save();
        const attachAngle = garyBoss.spinAngle + att.offsetAngle;
        const attachX = garyBoss.x + Math.cos(attachAngle) * garyBoss.radius;
        const attachY = garyBoss.y + Math.sin(attachAngle) * garyBoss.radius;
        
        ctx.translate(attachX, attachY);
        ctx.rotate(attachAngle);
        
        // Draw attachment based on type
        ctx.fillStyle = att.color;
        ctx.strokeStyle = att.color;
        ctx.lineWidth = att.width;
        
        if (att.type === 'lightsaber') {
          // Glowing blade
          ctx.shadowColor = att.color;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(att.length, 0);
          ctx.stroke();
        } else if (att.type === 'robotArm') {
          // Mechanical arm
          ctx.fillRect(0, -att.width/2, att.length * 0.6, att.width);
          ctx.fillRect(att.length * 0.6, -att.width/2 - 5, att.length * 0.4, att.width + 10);
          // Claw
          ctx.beginPath();
          ctx.moveTo(att.length, -att.width/2);
          ctx.lineTo(att.length + 10, 0);
          ctx.lineTo(att.length, att.width/2);
          ctx.stroke();
        } else if (att.type === 'tank') {
          // Tank body
          ctx.fillRect(0, -att.width/2, att.length, att.width);
          // Cannon
          ctx.fillRect(att.length * 0.7, -5, att.length * 0.3, 10);
        } else if (att.type === 'cannon') {
          // Cannon barrel
          ctx.fillRect(0, -att.width/2, att.length, att.width);
          ctx.fillRect(att.length - 5, -att.width/2 - 5, 10, att.width + 10);
        } else if (att.type === 'shield') {
          // Energy shield
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(att.length/2, 0, att.width/2, 0, 2*Math.PI);
          ctx.fill();
        } else if (att.type === 'wings') {
          // Butterfly-like wings
          ctx.beginPath();
          ctx.ellipse(att.length/2, -att.width/2, att.length/2, att.width/2, 0, 0, Math.PI);
          ctx.ellipse(att.length/2, att.width/2, att.length/2, att.width/2, 0, Math.PI, 2*Math.PI);
          ctx.fill();
        } else if (att.type === 'laser') {
          // Laser emitter
          ctx.fillRect(0, -att.width/2, att.length * 0.8, att.width);
          ctx.beginPath();
          ctx.arc(att.length * 0.8, 0, att.width, 0, 2*Math.PI);
          ctx.fill();
        }
        
        ctx.restore();
      });
      
      // Spinning effect
      if (garyBoss.spinning && garyBoss.spinSpeed > 100) {
        ctx.save();
        ctx.strokeStyle = '#FF69B4';
        ctx.lineWidth = 3;
        ctx.globalAlpha = garyBoss.spinSpeed / 1000;
        ctx.beginPath();
        ctx.arc(garyBoss.x, garyBoss.y, garyBoss.radius + 60, 0, 2*Math.PI);
        ctx.stroke();
        
        // Motion blur lines
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + garyBoss.spinAngle;
          ctx.beginPath();
          ctx.moveTo(garyBoss.x, garyBoss.y);
          ctx.lineTo(
            garyBoss.x + Math.cos(angle) * (garyBoss.radius + 50),
            garyBoss.y + Math.sin(angle) * (garyBoss.radius + 50)
          );
          ctx.stroke();
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
      
      // Show ironic "not a threat" when audio is playing
      if (garyBoss.audioPlaying) {
        ctx.font = 'italic 16px Arial';
        ctx.fillStyle = '#FF69B4';
        ctx.fillText('"Not a threat"', garyBoss.x, garyBoss.y + garyBoss.radius + 30);
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