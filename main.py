# Suppress verbose logging - must be done before imports
import os
os.environ['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '3'

import warnings
warnings.filterwarnings('ignore')

import logging
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('mediapipe').setLevel(logging.ERROR)
logging.getLogger('absl').setLevel(logging.ERROR)

# Suppress stderr temporarily during imports
import sys
import io
old_stderr = sys.stderr
sys.stderr = io.StringIO()

import pygame
from face_controls.face import FaceController
from face_controls.voice import VoiceController
import mediapipe as mp
import cv2
import random
import math
import argparse

# Restore stderr
sys.stderr = old_stderr

# Suppress TensorFlow/absl logging
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
logging.getLogger('tensorflow').setLevel(logging.ERROR)
logging.getLogger('absl').setLevel(logging.ERROR)

# Suppress MediaPipe logging
os.environ['MEDIAPIPE_DISABLE_GL_CONTEXT_INFO'] = '1'
logging.getLogger('mediapipe').setLevel(logging.ERROR)

# Suppress Python warnings
warnings.filterwarnings('ignore')

# Suppress stderr output for objc warnings
if sys.platform == 'darwin':  # macOS only
    import io
    sys.stderr = io.StringIO()
 
# Global entity lists for boss abilities
creatures = []
lasers = []
fireballs = []
# Global creatures list for boss abilities
creatures = []

# Helper function to desaturate colors
def desaturate_color(color, saturation):
    """Reduce color saturation (0 = grayscale, 1 = full color)"""
    if isinstance(color, str):
        return color  # Skip string colors
    r, g, b = color[:3]
    # Convert to grayscale
    gray = int(0.299 * r + 0.587 * g + 0.114 * b)
    # Mix original color with gray based on saturation
    r = int(gray + (r - gray) * saturation)
    g = int(gray + (g - gray) * saturation)
    b = int(gray + (b - gray) * saturation)
    return (max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))

# --- Game entity classes and new main() with blink-triggered lasers and enemy waves ---
class Creature:
    def __init__(self, cx, cy, screen_w, screen_h):
        self.radius = 15
        edge = random.choice(['top','bottom','left','right'])
        if edge == 'top':
            self.x = random.uniform(0, screen_w)
            self.y = -self.radius
        elif edge == 'bottom':
            self.x = random.uniform(0, screen_w)
            self.y = screen_h + self.radius
        elif edge == 'left':
            self.x = -self.radius
            self.y = random.uniform(0, screen_h)
        else:
            self.x = screen_w + self.radius
            self.y = random.uniform(0, screen_h)
        self.speed = random.uniform(50, 120)
        self.alive = True
    def update(self, dt, cx, cy):
        dx = cx - self.x
        dy = cy - self.y
        dist = math.hypot(dx, dy) or 1e-6
        self.x += (dx/dist) * self.speed * dt
        self.y += (dy/dist) * self.speed * dt

class Laser:
    def __init__(self, x, y, vx, vy):
        self.x = x; self.y = y
        self.vx = vx; self.vy = vy
        self.radius = 5
        self.active = True
    def update(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        if not (0 <= self.x <= 640 and 0 <= self.y <= 480):
            self.active = False

class BaseBoss:
    def __init__(self, cx, cy):
        # Base boss positioned above the avatar center
        self.x = cx; self.y = cy - 150
        self.radius = 40
        self.health = 20
        self.speed = 60
        self.angle = 0.0
    def update(self, dt, cx, cy):
        self.angle += dt
        self.x = cx + math.cos(self.angle) * 150
        self.y = cy + math.sin(self.angle) * 80
   
# --- New enemy and boss subclasses ---
class Fireball(Laser):
    def __init__(self, x, y, vx, vy):
        super().__init__(x, y, vx, vy)
        self.radius = 8
        self.color = (255, 50, 0)

class PurpleLaser(Laser):
    def __init__(self, x, y, vx, vy):
        super().__init__(x, y, vx, vy)
        self.color = (200, 0, 200)
        self.radius = 6

class Snowie(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.speed = 40
        self.color = (200, 200, 255)

class FireSpinner(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.speed = 80
        self.color = (255, 100, 0)

class Ghost(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.speed = 100
        self.color = (180, 180, 255)

class Ghast(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.radius = 30
        self.speed = 30
        self.color = (255, 255, 255)

class Skeleton(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.speed = 70
        self.color = (160, 160, 160)

class Dragon(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.radius = 25
        self.speed = 120
        self.color = (255, 0, 255)
        self.osc_angle = 0.0
    def update(self, dt, cx, cy):
        self.osc_angle += dt * 5
        offset = math.sin(self.osc_angle) * 50
        dx = (cx + offset) - self.x
        dy = cy - self.y
        dist = math.hypot(dx, dy) or 1e-6
        self.x += (dx/dist) * self.speed * dt
        self.y += (dy/dist) * self.speed * dt

class Caster(Creature):
    def __init__(self, cx, cy, screen_w, screen_h):
        super().__init__(cx, cy, screen_w, screen_h)
        self.speed = 60
        self.color = (0, 255, 255)

class SnowKing(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 30
        self.spawn_interval = 3.0
        self.spawn_timer = 0.0
        self.color = (200, 200, 255)

class FlameWarden(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 25
        self.spawn_interval = 2.0
        self.spawn_timer = 0.0
        self.color = (255, 100, 0)

class MadackedaBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 50
        self.spawn_interval = 1.5
        self.spawn_timer = 0.0
        # Teleport and shield
        self.teleport_interval = 5.0
        self.teleport_timer = 0.0
        self.shield_interval = 4.0
        self.shield_timer = 0.0
        self.shield_active = False
        self.shield_duration_default = 2.0
        self.shield_duration = 0.0
        self.color = (128, 0, 128)
        # Purple laser attack
        self.laser_interval = 3.0
        self.laser_timer = 0.0
    
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        
        # Update shield
        self.shield_timer += dt
        if not self.shield_active and self.shield_timer >= self.shield_interval:
            self.shield_active = True
            self.shield_duration = self.shield_duration_default
            self.shield_timer = 0.0
        
        if self.shield_active:
            self.shield_duration -= dt
            if self.shield_duration <= 0:
                self.shield_active = False
        
        # Teleportation
        self.teleport_timer += dt
        if self.teleport_timer >= self.teleport_interval and centers:
            idx = random.randrange(len(centers))
            self.x, self.y = centers[idx]
            self.teleport_timer = 0.0
        
        # Spawn minions
        self.spawn_timer += dt
        if self.spawn_timer >= self.spawn_interval:
            creatures.append(random.choice([Snowie, FireSpinner])(self.x, self.y, 1280, 720))
            self.spawn_timer = 0.0
        
        # Purple laser attack
        self.laser_timer += dt
        if self.laser_timer >= self.laser_interval:
            # Shoot lasers in V pattern
            for angle in [240, 300]:
                rad = math.radians(angle)
                vx = math.cos(rad) * 400
                vy = math.sin(rad) * 400
                lasers.append(PurpleLaser(self.x, self.y, vx, vy))
            self.laser_timer = 0.0

# --- Additional Boss Classes ---
class VortexBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 35
        self.color = (100, 100, 255)
        self.pull_radius = 200
        self.pull_strength = 100
        self.pulse_interval = 3.0
        self.pulse_timer = 0.0
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        self.pulse_timer += dt
        if self.pulse_timer >= self.pulse_interval:
            for c in creatures:
                dx = self.x - c.x; dy = self.y - c.y
                dist = math.hypot(dx, dy) or 1e-6
                if dist < self.pull_radius:
                    c.x += dx/dist * self.pull_strength * dt
                    c.y += dy/dist * self.pull_strength * dt
            self.pulse_timer = 0.0

class SpinnerBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 30
        self.color = (255, 200, 0)
        self.spin_speed = 6.0
        self.projectile_interval = 2.5
        self.projectile_timer = 0.0
    def update(self, dt, cx, cy):
        self.angle += self.spin_speed * dt
        self.x = cx; self.y = cy - 150
        self.projectile_timer += dt
        if self.projectile_timer >= self.projectile_interval:
            for a in range(0, 360, 45):
                rad = math.radians(a)
                vx = math.cos(rad)*300; vy = math.sin(rad)*300
                lasers.append(PurpleLaser(self.x, self.y, vx, vy))
            self.projectile_timer = 0.0

class RamBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 40
        self.color = (200, 100, 50)
        self.charge_speed = 400
        self.charge_interval = 4.0
        self.charge_timer = 0.0
        self.charging = False
        self.charge_duration = 0.5
        self.charge_time = 0.0
    def update(self, dt, cx, cy):
        if not self.charging:
            self.charge_timer += dt
            if self.charge_timer >= self.charge_interval:
                self.charging = True
                self.charge_time = 0.0
                self.charge_timer = 0.0
                dcs = [(math.hypot(self.x - px, self.y - py), (px, py)) for px, py in centers]
                _, tgt = min(dcs, key=lambda x: x[0])
                dx = tgt[0]-self.x; dy = tgt[1]-self.y; dist=math.hypot(dx,dy) or 1e-6
                self.vx = dx/dist*self.charge_speed; self.vy = dy/dist*self.charge_speed
        else:
            self.charge_time += dt
            self.x += self.vx*dt; self.y += self.vy*dt
            if self.charge_time >= self.charge_duration:
                self.charging = False
        if not self.charging:
            super().update(dt, cx, cy)

class TrackerBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 30
        self.color = (0, 255, 100)
        self.track_interval = 3.0
        self.track_timer = 0.0
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        self.track_timer += dt
        if self.track_timer >= self.track_interval:
            dcs = [(math.hypot(self.x - px, self.y - py), (px, py)) for px, py in centers]
            _, tgt = min(dcs, key=lambda x: x[0])
            dx = tgt[0]-self.x; dy = tgt[1]-self.y; dist=math.hypot(dx,dy) or 1e-6
            vx = dx/dist*200; vy = dy/dist*200
            lasers.append(PurpleLaser(self.x, self.y, vx, vy))
            self.track_timer = 0.0

class ArticalBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 35
        self.color = (100, 200, 200)
        self.teleport_interval = 4.0
        self.teleport_timer = 0.0
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        self.teleport_timer += dt
        if self.teleport_timer >= self.teleport_interval:
            idx = random.randrange(len(centers)) if centers else 0
            self.x, self.y = centers[idx]
            self.teleport_timer = 0.0

class ShadowBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 40
        self.color = (50, 50, 50)
        self.clone_interval = 5.0
        self.clone_timer = 0.0
        self.clones = []
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        self.clone_timer += dt
        if self.clone_timer >= self.clone_interval:
            edge = random.choice(['top','bottom','left','right'])
            surface = pygame.display.get_surface()
            sw, sh = surface.get_size() if surface else (640, 480)
            if edge=='top': px, py = random.uniform(0, sw), 0
            elif edge=='bottom': px, py = random.uniform(0, sw), sh
            elif edge=='left': px, py = 0, random.uniform(0, sh)
            else: px, py = sw, random.uniform(0, sh)
            creatures.append(Creature(px, py, sw, sh))
            self.clone_timer = 0.0

class AlienKingBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 60
        self.color = (150, 0, 200)
        self.ability_interval = 4.0
        self.ability_timer = 0.0
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        self.ability_timer += dt
        if self.ability_timer >= self.ability_interval:
            for a in range(0, 360, 30):
                rad = math.radians(a + random.uniform(-15,15))
                lasers.append(PurpleLaser(self.x, self.y, math.cos(rad)*350, math.sin(rad)*350))
            self.ability_timer = 0.0

# Menchuba - Silver's special flying minion
class Menchuba(Creature):
    def __init__(self, cx, cy, sw, sh):
        super().__init__(cx, cy, sw, sh)
        self.radius = 20
        self.speed = 150
        self.color = (192, 192, 192)  # Silver color
        self.flying = True
        self.hover_angle = 0
        self.base_y = self.y
    
    def update(self, dt, tx, ty):
        # Hover up and down while moving
        self.hover_angle += dt * 3
        hover_offset = math.sin(self.hover_angle) * 20
        
        # Move towards target with hovering
        dx = tx - self.x
        dy = (ty - 30) - self.y  # Aim slightly above target
        dist = math.hypot(dx, dy) or 1e-6
        self.x += (dx/dist) * self.speed * dt
        self.y += (dy/dist) * self.speed * dt + hover_offset * dt

# Silver - The Ultimate Boss
class SilverBoss(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.health = 999999  # Effectively immortal
        self.max_health = 999999
        self.radius = 50
        self.color = (192, 192, 192)  # Silver
        self.speed = 60  # Faster, more threatening
        self.immortal = True
        
        # Color draining - more aggressive
        self.color_drain_active = False
        self.color_drain_timer = 0
        self.color_drain_interval = 5.0  # More frequent
        self.color_drain_duration = 4.0  # Longer duration
        self.world_saturation = 1.0
        
        # Deadly gaze - more frequent
        self.gaze_active = False
        self.gaze_timer = 0
        self.gaze_interval = 3.0  # More frequent
        self.gaze_duration = 1.5
        self.gaze_targets = []
        
        # Chain attack - constant threat
        self.chain_timer = 0
        self.chain_interval = 2.0  # Very frequent
        self.chain_active = False
        self.chain_target = None
        
        # Menchuba spawning - constant minions
        self.menchuba_timer = 0
        self.menchuba_interval = 3.0  # More frequent
        
        # Word collection
        self.words_collected = 0
        self.word_particles = []
    
    def update(self, dt, cx, cy):
        super().update(dt, cx, cy)
        
        # Update timers
        self.color_drain_timer += dt
        self.gaze_timer += dt
        self.chain_timer += dt
        self.menchuba_timer += dt
        
        # Color drain ability
        if self.color_drain_timer >= self.color_drain_interval:
            self.color_drain_active = True
            self.color_drain_timer = 0
        
        if self.color_drain_active:
            self.world_saturation = max(0.1, self.world_saturation - dt * 0.3)
            if self.color_drain_timer >= self.color_drain_duration:
                self.color_drain_active = False
                self.world_saturation = 1.0
        
        # Deadly gaze
        if self.gaze_timer >= self.gaze_interval and centers:
            self.gaze_active = True
            self.gaze_timer = 0
            # Target nearest player
            dists = [(math.hypot(self.x - cx, self.y - cy), i) for i, (cx, cy) in enumerate(centers)]
            if dists:
                _, target_idx = min(dists)
                self.gaze_targets = [target_idx]
        
        if self.gaze_active:
            if self.gaze_timer >= self.gaze_duration:
                self.gaze_active = False
                # Damage gazed players if they're looking at Silver
                for idx in self.gaze_targets:
                    if idx < len(centers) and idx < len(player_lives):
                        # Check if player is facing Silver (simplified)
                        px, py = centers[idx]
                        angle_to_silver = math.atan2(self.y - py, self.x - px)
                        # Damage player (no mirror shield check for now)
                        player_lives[idx] -= 2  # Heavy damage
                        invul_timers[idx] = 3.0
                
        # Chain attack
        if self.chain_timer >= self.chain_interval and creatures:
            self.chain_active = True
            self.chain_timer = 0
            # Grab nearest creature
            dists = [(math.hypot(self.x - c.x, self.y - c.y), c) for c in creatures]
            if dists:
                _, self.chain_target = min(dists)
        
        if self.chain_active and self.chain_target:
            # Pull creature towards Silver
            dx = self.x - self.chain_target.x
            dy = self.y - self.chain_target.y
            dist = math.hypot(dx, dy) or 1e-6
            if dist > self.radius + 20:
                self.chain_target.x += dx/dist * 200 * dt
                self.chain_target.y += dy/dist * 200 * dt
            else:
                # Consume creature and gain health
                self.health = min(999999, self.health + 5)  # Silver is immortal anyway
                self.words_collected += 1
                # Safely remove creature if it still exists
                if self.chain_target in creatures:
                    creatures.remove(self.chain_target)
                self.chain_active = False
                self.chain_target = None
        
        # Spawn Menchuba minions
        if self.menchuba_timer >= self.menchuba_interval:
            creatures.append(Menchuba(self.x, self.y, 1280, 720))
            self.menchuba_timer = 0

def main(stream_mode=False, bg_color=None):
    # New game loop replacing facial demo
    fc = FaceController()
    vc = VoiceController()
    pygame.init()
    # Initialize hand detector
    hands_detector = mp.solutions.hands.Hands(
        static_image_mode=False,
        max_num_hands=4,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    
    # Window configuration
    window_flags = pygame.NOFRAME if stream_mode else 0
    screen = pygame.display.set_mode((1280, 720), window_flags)
    pygame.display.set_caption("Face Controls - Streamer HUD Mode" if stream_mode else "Face Controls")
    
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)
    watermark_font = pygame.font.SysFont(None, 20)
    
    # Load Madackeda boss image
    madackeda_img = None
    try:
        madackeda_img = pygame.image.load("/Users/tdeshane/face-controls/web/images/Madackeda.png")
        madackeda_img = pygame.transform.scale(madackeda_img, (80, 80))  # Scale to boss size
        # Convert to display format for better performance
        madackeda_img = madackeda_img.convert_alpha()
    except Exception as e:
        print(f"Warning: Could not load Madackeda image: {e}")
        pass  # If image not found, will draw as circle
    # Speech phrases
    phrases = ["Hello, I'm your avatar.", "How are you today?", "I am your digital friend."]
    phrase_index = 0
    # Game state
    global creatures, lasers, fireballs, centers, player_lives, invul_timers
    creatures = []
    lasers = []
    fireballs = []  # for boss ranged attacks
    centers = []  # Global for boss targeting
    # Player lives and invulnerability timers
    player_lives = []
    invul_timers = []
    # Visual effects lists
    mouth_capture_effects = []
    hand_hit_effects = []
    # Boss max health tracking
    boss_max_health = 0
    # Track last head movement direction
    last_head_dir = []
    # Pause state
    paused = False
    # Wave and boss sequencing: kills before each boss
    kill_targets = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120]
    wave_kills = 0
    wave_index = 0
    # Global color saturation for Silver's effect
    world_saturation = 1.0
    # Mirror shield state
    mirror_shield_active = False
    mirror_shield_timer = 0
    boss = None
    last_spawn = 0
    spawn_interval = 1.5
    state = 'minions'
    
    # SILVER IS ALWAYS PRESENT - The eternal threat
    silver_boss = SilverBoss(640, 100)  # Start at top center
    silver_boss.immortal = True  # Cannot be killed
    running = True
    started = stream_mode  # Skip start screen in stream mode
    
    # Start screen loop
    while running and not started:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE or event.key == pygame.K_RETURN:
                    started = True
                elif event.key == pygame.K_ESCAPE:
                    running = False
        
        screen.fill((20, 20, 40))
        
        # Title
        title_font = pygame.font.SysFont(None, 64)
        title_text = title_font.render("Face Controls", True, (255, 255, 255))
        title_rect = title_text.get_rect(center=(screen.get_width()//2, 200))
        screen.blit(title_text, title_rect)
        
        # Subtitle
        subtitle_font = pygame.font.SysFont(None, 32)
        subtitle_text = subtitle_font.render("Avatar Defense Game", True, (200, 200, 255))
        subtitle_rect = subtitle_text.get_rect(center=(screen.get_width()//2, 260))
        screen.blit(subtitle_text, subtitle_rect)
        
        # Instructions
        instructions = [
            "Press SPACE or ENTER to Start",
            "",
            "Controls:",
            "• Look around to aim",
            "• Blink to shoot lasers",
            "• Speak loudly to fire voice lasers",
            "• Open mouth to capture enemies",
            "• Move hands to shoot fireballs",
            "• Press P or ESC to pause",
            "• Close both eyes to activate mirror shield",
            "",
            "WARNING: SILVER IS ALWAYS HUNTING YOU!",
            "She cannot be defeated - only survived!",
            "Don't look at her deadly red eyes!"
        ]
        
        y_offset = 350
        for line in instructions:
            inst_text = font.render(line, True, (180, 180, 180))
            inst_rect = inst_text.get_rect(center=(screen.get_width()//2, y_offset))
            screen.blit(inst_text, inst_rect)
            y_offset += 30
        
        pygame.display.flip()
        clock.tick(30)
    
    if not running:
        fc.release()
        vc.close()
        cv2.destroyAllWindows()
        pygame.quit()
        sys.exit()
    
    # Main game loop
    while running:
        dt = clock.tick(60) / 1000.0
        
        # Handle pause state
        if paused:
            # Handle pause events
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                    break
                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE or event.key == pygame.K_p:
                        paused = False
            
            # Draw pause overlay without alpha for compatibility
            screen.fill((0, 0, 0))
            
            pause_text = font.render("PAUSED - Press ESC or P to Resume", True, (255, 255, 255))
            text_rect = pause_text.get_rect(center=(screen.get_width()//2, screen.get_height()//2))
            screen.blit(pause_text, text_rect)
            
            pygame.display.flip()
            clock.tick(30)  # Limit framerate during pause
            continue
            
        # Read multiple faces
        metrics_list, frame = fc.read()
        if not metrics_list or frame is None:
            continue
        amp = vc.read()
        # Hand-based attacks and capture hand positions
        img_hands = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        hands_results = hands_detector.process(img_hands)
        hand_positions = []
        if hands_results.multi_hand_landmarks:
            h_img, w_img, _ = frame.shape
            for hl in hands_results.multi_hand_landmarks:
                # wrist landmark (idx 0)
                wx = int(hl.landmark[0].x * w_img)
                wy = int(hl.landmark[0].y * h_img)
                hand_positions.append((wx, wy))
                # fire hand-based projectile towards screen center
                tx, ty = w_img // 2, h_img // 2
                dx_h, dy_h = tx - wx, ty - wy
                mag_h = math.hypot(dx_h, dy_h) or 1e-6
                vx_h, vy_h = dx_h / mag_h * 300, dy_h / mag_h * 300
                lasers.append(Fireball(wx, wy, vx_h, vy_h))
                
                # Check for hand collisions with creatures
                for c in creatures:
                    if math.hypot(c.x - wx, c.y - wy) < c.radius + 20:
                        hand_hit_effects.append({'x': c.x, 'y': c.y, 't': 0})
                        c.alive = False  # Mark for removal
        # Sync player lives/invulnerability with detected faces
        n = len(metrics_list)
        # Initialize lives and invulnerability for each new player
        while len(player_lives) < n:
            player_lives.append(3)
            invul_timers.append(0.0)
        # Trim for removed faces
        if len(player_lives) > n:
            player_lives = player_lives[:n]
            invul_timers = invul_timers[:n]
        # Decrease invulnerability timers
        for i in range(n):
            if invul_timers[i] > 0:
                invul_timers[i] = max(0.0, invul_timers[i] - dt)
        # Determine avatar positions evenly across screen
        n = len(metrics_list)
        screen_w, screen_h = screen.get_size()
        centers = [
            (int((i+1) * screen_w / (n+1)), screen_h // 2)
            for i in range(n)
        ]
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_v:
                    vc.speak(phrases[phrase_index])
                    phrase_index = (phrase_index + 1) % len(phrases)
                elif event.key == pygame.K_ESCAPE:
                    if stream_mode:
                        running = False
                    else:
                        paused = not paused
                elif event.key == pygame.K_p:
                    paused = not paused
        # Spawn creatures (minion waves)
        if state == 'minions':
            current = pygame.time.get_ticks() / 1000.0
            if current - last_spawn > spawn_interval:
                # Randomly choose from diverse enemies
                r = random.random()
                if r < 0.4:
                    creatures.append(Creature(0, 0, screen_w, screen_h))
                elif r < 0.6:
                    creatures.append(Snowie(0, 0, screen_w, screen_h))
                elif r < 0.75:
                    creatures.append(FireSpinner(0, 0, screen_w, screen_h))
                elif r < 0.85:
                    creatures.append(Ghost(0, 0, screen_w, screen_h))
                elif r < 0.92:
                    creatures.append(Skeleton(0, 0, screen_w, screen_h))
                elif r < 0.98:
                    creatures.append(Caster(0, 0, screen_w, screen_h))
                else:
                    creatures.append(Dragon(0, 0, screen_w, screen_h))
                last_spawn = current
        # Update last head direction for each face
        if len(last_head_dir) != len(centers):
            last_head_dir = [[0, -1] for _ in centers]
        
        # Check for mirror shield activation (both eyes closed for extended time)
        all_eyes_closed = all(metrics.get('eyes_closed', False) for metrics in metrics_list) if metrics_list else False
        if all_eyes_closed and boss and isinstance(boss, SilverBoss):
            mirror_shield_timer += dt
            if mirror_shield_timer > 0.5:  # Hold for half second
                mirror_shield_active = True
        else:
            mirror_shield_timer = 0
            if mirror_shield_timer <= 0:
                mirror_shield_active = False
        
        # Fire lasers on blink per avatar (always enabled)
        for i, metrics in enumerate(metrics_list):
            if metrics.get('blink') and not mirror_shield_active:
                # Direction based on head pose
                yaw = metrics['yaw'] / (math.pi/2)
                pitch = metrics['pitch'] / (math.pi/2)
                yaw = max(-1, min(1, yaw)); pitch = max(-1, min(1, pitch))
                dx = yaw * 100; dy = -pitch * 100
                mag = math.hypot(dx, dy)
                if mag < 1e-3:
                    vx, vy = 0, -400
                else:
                    vx, vy = dx/mag*400, dy/mag*400
                    # Update last head direction
                    last_head_dir[i] = [dx, dy]
                # Fire from both eyes of avatar i
                cx_i, cy_i = centers[i]
                eye_off_x = 100 * 0.4; eye_off_y = -100 * 0.2
                eyes = [
                    (cx_i - eye_off_x, cy_i + eye_off_y),
                    (cx_i + eye_off_x, cy_i + eye_off_y)
                ]
                for ex, ey in eyes:
                    lasers.append(Laser(ex, ey, vx, vy))
        
        # Voice-activated lasers (amplitude-based)
        if amp > 0.25:  # Threshold for loud sound
            for i, (cx_i, cy_i) in enumerate(centers):
                # Use last head movement direction
                dx, dy = last_head_dir[i] if i < len(last_head_dir) else [0, -1]
                if abs(dx) < 0.01 and abs(dy) < 0.01:
                    dx, dy = 0, -1
                mag = math.hypot(dx, dy) or 1e-6
                vx, vy = dx/mag*600, dy/mag*600
                # Fire from both eyes
                eye_off_x = 100 * 0.4; eye_off_y = -100 * 0.2
                left_eye = (cx_i - eye_off_x, cy_i + eye_off_y)
                right_eye = (cx_i + eye_off_x, cy_i + eye_off_y)
                lasers.append(Laser(left_eye[0], left_eye[1], vx, vy))
                lasers.append(Laser(right_eye[0], right_eye[1], vx, vy))
        # Update lasers
        for l in lasers:
            l.update(dt)
        lasers = [l for l in lasers if l.active]
        # Update creatures: chase nearest avatar
        for c in creatures:
            # find nearest avatar center
            dcs = [(math.hypot(c.x - cx, c.y - cy), (cx, cy)) for cx, cy in centers]
            _, target = min(dcs, key=lambda x: x[0])
            c.update(dt, target[0], target[1])
        # Creature collisions: damage players and remove collided creatures
        temp_creatures = []
        for c in creatures:
            collided = False
            for i, (cx_i, cy_i) in enumerate(centers):
                if invul_timers[i] <= 0 and math.hypot(c.x - cx_i, c.y - cy_i) < (c.radius + 100):
                    # damage player
                    player_lives[i] -= 1
                    invul_timers[i] = 2.0
                    # respawn logic: if no lives, reset
                    if player_lives[i] <= 0:
                        player_lives[i] = 3
                        invul_timers[i] = 2.0
                    collided = True
                    break
            if not collided:
                temp_creatures.append(c)
        creatures = temp_creatures
        # Trap creatures if avatar mouth is open
        trap_radius = int(100 * 0.6)
        new_creatures = []
        for c in creatures:
            trapped = False
            for i, metrics in enumerate(metrics_list):
                if metrics.get('mouth_open_ratio', 0) > 0.03:
                    cx_i, cy_i = centers[i]
                    if math.hypot(c.x - cx_i, c.y - cy_i) < trap_radius:
                        wave_kills += 1
                        trapped = True
                        # Add mouth capture effect
                        mouth_capture_effects.append({'x': c.x, 'y': c.y, 't': 0})
                        break
            if not trapped:
                new_creatures.append(c)
        creatures = new_creatures
        # Laser hits on creatures
        remaining = []
        for c in creatures:
            hit = False
            for l in lasers:
                if l.active and math.hypot(c.x - l.x, c.y - l.y) < (c.radius + l.radius):
                    hit = True; wave_kills += 1; l.active = False; break
            if not hit:
                remaining.append(c)
        creatures = remaining
        # Transition to boss when wave_kills reaches target
        if state == 'minions' and wave_kills >= kill_targets[wave_index]:
            # Initialize appropriate boss based on wave index
            bx, by = centers[0] if centers else (320, 240)
            if wave_index == 0:
                boss = SnowKing(bx, by)
                state = 'boss_snow'
            elif wave_index == 1:
                boss = FlameWarden(bx, by)
                state = 'boss_fire'
            elif wave_index == 2:
                boss = VortexBoss(bx, by)
                state = 'boss_vortex'
            elif wave_index == 3:
                boss = SpinnerBoss(bx, by)
                state = 'boss_spinner'
            elif wave_index == 4:
                boss = RamBoss(bx, by)
                state = 'boss_ram'
            elif wave_index == 5:
                boss = TrackerBoss(bx, by)
                state = 'boss_tracker'
            elif wave_index == 6:
                boss = ArticalBoss(bx, by)
                state = 'boss_artical'
            elif wave_index == 7:
                boss = ShadowBoss(bx, by)
                state = 'boss_shadow'
            elif wave_index == 8:
                boss = AlienKingBoss(bx, by)
                state = 'boss_alienking'
            elif wave_index == 9:
                boss = MadackedaBoss(bx, by)
                state = 'boss_madackeda'
            elif wave_index == 10:
                boss = SilverBoss(bx, by)
                state = 'boss_silver'
            # Set boss max health for health bar
            boss_max_health = boss.health
            # Reset wave_kills and clear minions/lasers for boss phase
            wave_kills = 0
            creatures.clear(); lasers.clear()
        # ALWAYS update Silver (she's always present)
        if centers:
            # Silver targets nearest player
            silver_dists = [(math.hypot(silver_boss.x - cx, silver_boss.y - cy), (cx, cy)) for cx, cy in centers]
            _, silver_target = min(silver_dists, key=lambda x: x[0])
            silver_boss.update(dt, silver_target[0], silver_target[1])
            world_saturation = silver_boss.world_saturation
            
            # Silver collision with players (instant heavy damage)
            for i, (cx_i, cy_i) in enumerate(centers):
                if invul_timers[i] <= 0 and math.hypot(silver_boss.x - cx_i, silver_boss.y - cy_i) < (silver_boss.radius + 100):
                    player_lives[i] -= 2  # Heavy damage on contact
                    invul_timers[i] = 3.0
                    if player_lives[i] <= 0:
                        player_lives[i] = 3
                        invul_timers[i] = 3.0
        
        # Update regular boss phases (if any)
        if boss is not None:
            # Determine nearest avatar for targeting
            dcs_b = [(math.hypot(boss.x - cx, boss.y - cy), (cx, cy)) for cx, cy in centers]
            _, tgt = min(dcs_b, key=lambda x: x[0])
            # Call subclass update for movement and abilities
            boss.update(dt, tgt[0], tgt[1])
            # Phase-specific spawn logic for early bosses
            if state == 'boss_snow':
                boss.spawn_timer += dt
                if boss.spawn_timer >= boss.spawn_interval:
                    creatures.append(Snowie(boss.x, boss.y, screen_w, screen_h))
                    boss.spawn_timer = 0.0
            elif state == 'boss_fire':
                boss.spawn_timer += dt
                if boss.spawn_timer >= boss.spawn_interval:
                    creatures.append(FireSpinner(boss.x, boss.y, screen_w, screen_h))
                    boss.spawn_timer = 0.0
            # Creature spawn disabled for other boss phases
            # Boss damage to players on contact
            for i, (cx_i, cy_i) in enumerate(centers):
                if invul_timers[i] <= 0 and math.hypot(boss.x - cx_i, boss.y - cy_i) < (boss.radius + 100):
                    player_lives[i] -= 1
                    invul_timers[i] = 2.0
                    if player_lives[i] <= 0:
                        player_lives[i] = 3
                        invul_timers[i] = 2.0
            # Laser hits on boss (unless shielded or immortal)
            if not getattr(boss, 'shield_active', False) and not getattr(boss, 'immortal', False):
                for l in lasers:
                    if l.active and math.hypot(boss.x - l.x, boss.y - l.y) < (boss.radius + l.radius):
                        boss.health -= 1
                        l.active = False
            # Boss defeat and wave progression
            if boss.health <= 0:
                wave_index += 1
                if wave_index < len(kill_targets):
                    state = 'minions'
                else:
                    state = 'victory'
                    creatures.clear()
                    lasers.clear()
                    fireballs.clear()
                boss = None
        # Drawing
        try:
            if stream_mode:
                # In stream mode, use transparent background or specified color
                if bg_color is not None:
                    screen.fill(bg_color)
                else:
                    screen.fill((0, 0, 0))  # Black background (transparency handled by window flag)
            else:
                screen.fill((30, 30, 30))
        except ValueError as e:
            print(f"DEBUG: Error in background fill - stream_mode={stream_mode}, bg_color={bg_color}")
            raise
        # Draw each avatar
        for i, metrics in enumerate(metrics_list):
            if i >= len(centers):
                continue  # Skip if centers not yet populated
            cx, cy = centers[i]
            # Validate coordinates
            if not (isinstance(cx, (int, float)) and isinstance(cy, (int, float)) and 
                    not math.isnan(cx) and not math.isnan(cy) and 
                    not math.isinf(cx) and not math.isinf(cy)):
                print(f"DEBUG: Invalid center coordinates: cx={cx}, cy={cy}")
                continue
            
            cx, cy = int(cx), int(cy)
            radius = 100
            # Head outline - apply desaturation
            head_color = desaturate_color((200,200,200), world_saturation)
            pygame.draw.circle(screen, head_color, (cx,cy), radius, 2)
            # Eyes
            eye_off_x = radius * 0.4; eye_off_y = -radius * 0.2
            eye_radius = int(radius * 0.15)
            pupil_offset_x = metrics['yaw'] / (math.pi/2) * eye_radius * 0.5
            pupil_offset_y = -metrics['pitch'] / (math.pi/2) * eye_radius * 0.5
            for side in (-1,1):
                ex = cx + side * eye_off_x
                ey = cy + eye_off_y
                if metrics.get('eyes_closed'):
                    pygame.draw.line(screen, (255,255,255),
                                     (int(ex - eye_radius), int(ey)),
                                     (int(ex + eye_radius), int(ey)), 4)
                else:
                    pygame.draw.circle(screen, (255,255,255), (int(ex), int(ey)), eye_radius)
                    pygame.draw.circle(screen, (0,0,0),
                                       (int(ex + pupil_offset_x), int(ey + pupil_offset_y)),
                                       int(eye_radius * 0.4))
            # Eyebrows
            brow_len = eye_radius * 2
            brow_off_y = eye_off_y - eye_radius * 1.0
            brow_tilt = metrics['pitch'] / (math.pi/2) * eye_radius * 0.5
            for side in (-1,1):
                ex = cx + side * eye_off_x
                start = (int(ex - brow_len/2), int(cy + brow_off_y + brow_tilt))
                end = (int(ex + brow_len/2), int(cy + brow_off_y - brow_tilt))
                pygame.draw.line(screen, (255,255,255), start, end, 3)
            # Mouth
            mouth_center = (cx, cy + int(radius * 0.6))
            mouth_w = int(radius * 1.0)
            base_h = 4; max_h = int(radius * 0.6)
            mh = base_h + int(metrics['mouth_open_ratio'] * max_h)
            mh = max(base_h, min(mh, max_h))
            mcol = (255,0,0) if amp > vc.threshold else (150,0,0)
            try:
                pygame.draw.ellipse(screen, mcol,
                                    pygame.Rect(mouth_center[0] - mouth_w//2,
                                                mouth_center[1] - mh//2,
                                                mouth_w, mh))
            except ValueError as e:
                print(f"DEBUG: Error drawing mouth - color={mcol}, rect=({mouth_center[0] - mouth_w//2}, {mouth_center[1] - mh//2}, {mouth_w}, {mh})")
                raise
            # Draw health bar instead of hearts
            max_health = 3
            current_health = player_lives[i] if i < len(player_lives) else max_health
            current_health = max(0, current_health)  # Ensure non-negative
            
            # Health bar dimensions
            bar_width = 80
            bar_height = 10
            bar_x = cx - bar_width // 2
            bar_y = cy - radius - 30
            
            # Background (dark red)
            pygame.draw.rect(screen, (80, 0, 0), (bar_x, bar_y, bar_width, bar_height))
            
            # Health amount (bright red to yellow gradient based on health)
            health_percentage = current_health / max_health
            if health_percentage > 0.66:
                health_color = (0, 255, 0)  # Green when healthy
            elif health_percentage > 0.33:
                health_color = (255, 255, 0)  # Yellow when damaged
            else:
                health_color = (255, 0, 0)  # Red when critical
            
            health_width = int(bar_width * health_percentage)
            if health_width > 0:
                pygame.draw.rect(screen, health_color, (bar_x, bar_y, health_width, bar_height))
            
            # Border
            pygame.draw.rect(screen, (255, 255, 255), (bar_x, bar_y, bar_width, bar_height), 2)
            
            # Health text
            health_text = f"{current_health}/{max_health}"
            text_surf = font.render(health_text, True, (255, 255, 255))
            text_rect = text_surf.get_rect(center=(cx, bar_y - 5))
            screen.blit(text_surf, text_rect)
            
            # Invulnerability effect
            if i < len(invul_timers) and invul_timers[i] > 0:
                # Flashing effect
                if int(invul_timers[i] * 10) % 2 == 0:
                    # Draw a flashing outline
                    pygame.draw.circle(screen, (255, 255, 255), (cx, cy), radius + 8, 2)
            
            # Draw mirror shield if active
            if mirror_shield_active and isinstance(boss, SilverBoss):
                # Draw reflective shield around avatar
                shield_color = (200, 200, 255)  # Light blue/silver
                pygame.draw.circle(screen, shield_color, (cx, cy), radius + 15, 3)
                # Inner shield glow
                pygame.draw.circle(screen, shield_color, (cx, cy), radius + 10, 2)
            # Draw cartoon arms and hands
            skin_color = (252, 215, 182)  # Cartoon skin color
            skin_shadow = (226, 180, 140)  # Darker skin for outlines
            face_x, face_y = cx, cy
            
            # Get scaled hand positions
            scaled_hands = []
            for hp in hand_positions:
                # Scale hand position to screen coordinates
                hx = hp[0] * screen_w / frame.shape[1]
                hy = hp[1] * screen_h / frame.shape[0]
                scaled_hands.append((hx, hy))
            
            # Find nearest left/right hands to this face
            l_hand = None
            r_hand = None
            if scaled_hands:
                left_hands = [(h, math.hypot(h[0]-face_x, h[1]-face_y)) for h in scaled_hands if h[0] < face_x]
                right_hands = [(h, math.hypot(h[0]-face_x, h[1]-face_y)) for h in scaled_hands if h[0] >= face_x]
                if left_hands:
                    l_hand = min(left_hands, key=lambda x: x[1])[0]
                if right_hands:
                    r_hand = min(right_hands, key=lambda x: x[1])[0]
            
            # Draw left arm and hand
            if l_hand:
                arm_start = (cx - int(radius * 0.38), cy + int(radius * 0.15))
                # Draw arm as thick line
                pygame.draw.line(screen, skin_color, arm_start, l_hand, 18)
                # Draw hand circle
                pygame.draw.circle(screen, skin_color, (int(l_hand[0]), int(l_hand[1])), 22)
                pygame.draw.circle(screen, skin_shadow, (int(l_hand[0]), int(l_hand[1])), 22, 3)
            
            # Draw right arm and hand
            if r_hand:
                arm_start = (cx + int(radius * 0.38), cy + int(radius * 0.15))
                # Draw arm as thick line
                pygame.draw.line(screen, skin_color, arm_start, r_hand, 18)
                # Draw hand circle
                pygame.draw.circle(screen, skin_color, (int(r_hand[0]), int(r_hand[1])), 22)
                pygame.draw.circle(screen, skin_shadow, (int(r_hand[0]), int(r_hand[1])), 22, 3)
        # ALWAYS draw Silver (the eternal threat) - even in stream mode
        # Draw Silver with special immortal glow
        silver_glow = abs(math.sin(pygame.time.get_ticks() / 1000.0 * 2)) * 0.5 + 0.5
        glow_color = (int(192 + 63 * silver_glow), int(192 + 63 * silver_glow), int(192 + 63 * silver_glow))
        pygame.draw.circle(screen, glow_color, (int(silver_boss.x), int(silver_boss.y)), silver_boss.radius + 5)
        pygame.draw.circle(screen, silver_boss.color, (int(silver_boss.x), int(silver_boss.y)), silver_boss.radius)
        # Draw Silver's deadly eyes
        eye_offset = 15
        pygame.draw.circle(screen, (255, 0, 0), (int(silver_boss.x - eye_offset), int(silver_boss.y - 10)), 5)
        pygame.draw.circle(screen, (255, 0, 0), (int(silver_boss.x + eye_offset), int(silver_boss.y - 10)), 5)
        
        # Draw Silver's special effects
        # Draw gaze effect
        if silver_boss.gaze_active and silver_boss.gaze_targets:
            for target_idx in silver_boss.gaze_targets:
                if target_idx < len(centers):
                    tx, ty = centers[target_idx]
                    # Draw deadly gaze beam
                    pygame.draw.line(screen, (255, 0, 0), 
                                   (int(silver_boss.x), int(silver_boss.y - 20)), 
                                   (int(tx), int(ty)), 5)
                    # Gaze warning circle
                    pygame.draw.circle(screen, (255, 0, 0), 
                                     (int(tx), int(ty)), 60, 3)
        
        # Draw chain effect
        if silver_boss.chain_active and silver_boss.chain_target:
            pygame.draw.line(screen, (192, 192, 192), 
                           (int(silver_boss.x), int(silver_boss.y)), 
                           (int(silver_boss.chain_target.x), int(silver_boss.chain_target.y)), 8)
        
        # Draw word drain effect
        if silver_boss.color_drain_active:
            # Pulsing drain circle
            pulse = abs(math.sin(silver_boss.color_drain_timer * 3))
            drain_radius = silver_boss.radius + 50 + pulse * 30
            pygame.draw.circle(screen, (128, 128, 128), 
                             (int(silver_boss.x), int(silver_boss.y)), 
                             int(drain_radius), 2)
        
        # Creatures (only in normal mode)
        if not stream_mode:
            for c in creatures:
                col = getattr(c, 'color', (0,255,0))
                # Convert string colors to tuples
                if isinstance(col, str):
                    color_map = {
                        'green': (0, 255, 0),
                        'lightblue': (173, 216, 230),
                        'orange': (255, 165, 0),
                        'gray': (128, 128, 128),
                        'grey': (128, 128, 128),
                        'cyan': (0, 255, 255),
                        'magenta': (255, 0, 255),
                        'purple': (128, 0, 128),
                        'yellow': (255, 255, 0),
                        'brown': (139, 69, 19),
                        'lime': (0, 255, 0),
                        'teal': (0, 128, 128),
                        'black': (0, 0, 0),
                        'blue': (0, 0, 255),
                        'red': (255, 0, 0),
                        'white': (255, 255, 255)
                    }
                    col = color_map.get(col.lower(), (0, 255, 0))
                # Special handling for rgba strings
                elif isinstance(col, str) and col.startswith('rgba'):
                    col = (180, 180, 255)  # Default for ghost
                
                # Apply desaturation to creature colors
                col = desaturate_color(col, world_saturation)
                pygame.draw.circle(screen, col, (int(c.x), int(c.y)), c.radius)
                
                # Draw wings for Menchuba
                if isinstance(c, Menchuba):
                    wing_flap = abs(math.sin(c.hover_angle * 2))
                    wing_spread = 15 + wing_flap * 5
                    # Left wing
                    pygame.draw.arc(screen, col, 
                                  (int(c.x - c.radius - wing_spread), int(c.y - c.radius),
                                   int(wing_spread * 2), int(c.radius * 2)), 
                                  math.pi/2, math.pi * 1.5, 3)
                    # Right wing
                    pygame.draw.arc(screen, col,
                                  (int(c.x - wing_spread), int(c.y - c.radius),
                                   int(wing_spread * 2), int(c.radius * 2)),
                                  -math.pi/2, math.pi/2, 3)
            # Regular boss (if any)
            if boss:
                # Draw Madackeda boss with image if available
                if isinstance(boss, MadackedaBoss) and madackeda_img:
                    # Draw solid circle behind
                    pygame.draw.circle(screen, (128, 0, 128), (int(boss.x), int(boss.y)), boss.radius)
                    # Draw image centered on boss position
                    img_rect = madackeda_img.get_rect(center=(int(boss.x), int(boss.y)))
                    screen.blit(madackeda_img, img_rect)
                else:
                    bcol = getattr(boss, 'color', (128,0,128))
                    # Convert string colors to tuples for bosses too
                    if isinstance(bcol, str):
                        color_map = {
                            'purple': (128, 0, 128),
                            'lightblue': (173, 216, 230),
                            'orange': (255, 165, 0),
                            'blue': (0, 0, 255),
                            'yellow': (255, 255, 0),
                            'brown': (139, 69, 19),
                            'lime': (0, 255, 0),
                            'teal': (0, 128, 128),
                            'black': (0, 0, 0)
                        }
                        bcol = color_map.get(bcol.lower(), (128, 0, 128))
                    pygame.draw.circle(screen, bcol, (int(boss.x), int(boss.y)), boss.radius)
                
                # Draw shield if active
                if getattr(boss, 'shield_active', False):
                    # Draw shield without alpha surface for compatibility
                    pygame.draw.circle(screen, (0, 255, 255), 
                                     (int(boss.x), int(boss.y)), 
                                     boss.radius + 10, 3)
                
                # Draw Silver's special effects
                if isinstance(boss, SilverBoss):
                    # Draw gaze effect
                    if boss.gaze_active and boss.gaze_targets:
                        for target_idx in boss.gaze_targets:
                            if target_idx < len(centers):
                                tx, ty = centers[target_idx]
                                # Draw deadly gaze beam
                                pygame.draw.line(screen, (255, 0, 0), 
                                               (int(boss.x), int(boss.y - 20)), 
                                               (int(tx), int(ty)), 5)
                                # Gaze warning circle
                                pygame.draw.circle(screen, (255, 0, 0), 
                                                 (int(tx), int(ty)), 60, 3)
                    
                    # Draw chain effect
                    if boss.chain_active and boss.chain_target:
                        pygame.draw.line(screen, (192, 192, 192), 
                                       (int(boss.x), int(boss.y)), 
                                       (int(boss.chain_target.x), int(boss.chain_target.y)), 8)
                    
                    # Draw word drain effect
                    if boss.color_drain_active:
                        # Pulsing drain circle
                        pulse = abs(math.sin(boss.color_drain_timer * 3))
                        drain_radius = boss.radius + 50 + pulse * 30
                        pygame.draw.circle(screen, (128, 128, 128), 
                                         (int(boss.x), int(boss.y)), 
                                         int(drain_radius), 2)
        # Lasers and projectiles
        for l in lasers:
            col = getattr(l, 'color', (255,0,0))
            pygame.draw.circle(screen, col, (int(l.x), int(l.y)), l.radius)
        for fb in fireballs:
            col = getattr(fb, 'color', (255,0,0))
            pygame.draw.circle(screen, col, (int(fb.x), int(fb.y)), fb.radius)
        # Draw visual effects
        # Update and draw mouth capture effects
        mouth_capture_effects[:] = [e for e in mouth_capture_effects if e['t'] < 0.4]
        for e in mouth_capture_effects:
            e['t'] += dt
            # Use color intensity instead of alpha for compatibility
            intensity = max(0, min(255, int(255 * (1 - e['t']/0.4))))  # Clamp to 0-255
            effect_radius = 30 + e['t'] * 30
            pygame.draw.circle(screen, (0, intensity, intensity), (int(e['x']), int(e['y'])), int(effect_radius), 3)
        
        # Update and draw hand hit effects
        new_hand_effects = []
        for e in hand_hit_effects:
            e['t'] += dt
            if e['t'] < 0.3:
                effect_radius = 25 + e['t'] * 20
                pygame.draw.circle(screen, (255, 255, 0), (int(e['x']), int(e['y'])), int(effect_radius), 4)
                new_hand_effects.append(e)
        hand_hit_effects = new_hand_effects
        
        # HUD
        # Show level and kills
        hud_x = 340 if stream_mode else 10
        level_text = f'Level: {wave_index + 1}'
        screen.blit(font.render(level_text, True, (255,255,255)), (hud_x, 10))
        
        if state == 'minions':
            kt = kill_targets[wave_index] if wave_index < len(kill_targets) else 0
            kills_text = f'Monsters defeated: {wave_kills} / {kt}'
            screen.blit(font.render(kills_text, True, (255,255,255)), (hud_x, 35))
        elif boss:
            boss_name = boss.__class__.__name__.replace('Boss', '')
            screen.blit(font.render(f'Boss: {boss_name}', True, (255,255,255)), (hud_x, 35))
            
            # Draw boss health bar
            if boss_max_health > 0:
                bar_width, bar_height = 220, 22
                bar_x = hud_x
                bar_y = 65
                # Background
                pygame.draw.rect(screen, (40, 40, 40), (bar_x, bar_y, bar_width, bar_height))
                # Health
                health_width = int(bar_width * max(0, boss.health) / boss_max_health)
                pygame.draw.rect(screen, (255, 0, 0), (bar_x, bar_y, health_width, bar_height))
                # Border
                pygame.draw.rect(screen, (255, 255, 255), (bar_x, bar_y, bar_width, bar_height), 3)
                # Text
                health_text = f'{boss.health} / {boss_max_health}'
                text_surf = font.render(health_text, True, (255, 255, 255))
                text_rect = text_surf.get_rect(center=(bar_x + bar_width//2, bar_y + bar_height//2))
                screen.blit(text_surf, text_rect)
        # Victory
        if state == 'victory' and not stream_mode:
            screen.blit(font.render('Victory! You saved the Overworld!', True, (0,255,0)), (150,240))
        
        # Stream mode watermark
        if stream_mode:
            watermark_text = "Streamer HUD Mode - Press ESC to Exit"  # Removed emoji for compatibility
            watermark_surface = watermark_font.render(watermark_text, True, (255, 255, 255))
            screen.blit(watermark_surface, (10, screen.get_height() - 30))
        
        pygame.display.flip()
        # Webcam feed
        cv2.imshow('Webcam', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False
    # Cleanup
    fc.release(); vc.close(); cv2.destroyAllWindows(); pygame.quit(); sys.exit()

def main_avatar():
    fc = FaceController()
    vc = VoiceController()
    pygame.init()
    screen = pygame.display.set_mode((640, 480))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)
    running = True
    # Predefined phrases for avatar speech
    phrases = ["Hello, I'm your avatar.", "How are you today?", "I am your digital friend."]
    phrase_index = 0
    while running:
        metrics, frame = fc.read()
        if metrics is None:
            continue
        amp = vc.read()
        # Avatar drawing parameters
        cx, cy = 320, 240
        radius = 100
        # Normalize head pose to [-1,1]
        yaw = metrics['yaw'] / (3.14159/2)
        pitch = metrics['pitch'] / (3.14159/2)
        yaw = max(-1, min(1, yaw))
        pitch = max(-1, min(1, pitch))
        dx = yaw * radius
        dy = -pitch * radius
        mouth_open = metrics['mouth_open_ratio'] > 0.03
        talking = amp > vc.threshold
        screen.fill((30, 30, 30))
        # Draw head
        pygame.draw.circle(screen, (200, 200, 200), (cx, cy), radius, 2)
        # Draw eyes
        eye_offset_x = radius * 0.4
        eye_offset_y = -radius * 0.2
        eye_radius = int(radius * 0.15)
        pupil_radius = int(eye_radius * 0.4)
        # Positions for left and right eye centers
        eyes = [
            (cx - eye_offset_x, cy + eye_offset_y),
            (cx + eye_offset_x, cy + eye_offset_y),
        ]
        for ex, ey in eyes:
            pygame.draw.circle(screen, (255, 255, 255), (int(ex), int(ey)), eye_radius)
            pupil_dx = yaw * eye_radius * 0.5
            pupil_dy = -pitch * eye_radius * 0.5
            pygame.draw.circle(screen, (0, 0, 0),
                               (int(ex + pupil_dx), int(ey + pupil_dy)),
                               pupil_radius)
        # Draw eyebrows
        brow_length = eye_radius * 2
        brow_offset_y = eye_offset_y - eye_radius * 1.0
        brow_tilt = pitch * eye_radius * 0.5
        for ex, _ in eyes:
            start = (int(ex - brow_length / 2), int(cy + brow_offset_y + brow_tilt))
            end = (int(ex + brow_length / 2), int(cy + brow_offset_y - brow_tilt))
            pygame.draw.line(screen, (255, 255, 255), start, end, 3)
        # Draw mouth
        mouth_center = (cx, cy + int(radius * 0.6))
        mouth_width = int(radius * 1.0)
        baseline = 4
        max_add = int(radius * 0.6)
        mouth_height = baseline + int(metrics['mouth_open_ratio'] * max_add)
        mouth_height = max(baseline, min(mouth_height, max_add))
        mouth_color = (255, 0, 0) if talking else (150, 0, 0)
        pygame.draw.ellipse(screen, mouth_color,
                            pygame.Rect(mouth_center[0] - mouth_width // 2,
                                        mouth_center[1] - mouth_height // 2,
                                        mouth_width, mouth_height))
        # Draw talking text
        if talking:
            text = font.render("Talking", True, (255, 255, 255))
            screen.blit(text, (cx - text.get_width()//2, cy - radius - 30))
        pygame.display.flip()
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN and event.key == pygame.K_v:
                # Trigger avatar speech
                vc.speak(phrases[phrase_index])
                phrase_index = (phrase_index + 1) % len(phrases)
        # Show webcam feed
        cv2.imshow("Webcam", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            running = False
        clock.tick(30)
    fc.release()
    vc.close()
    cv2.destroyAllWindows()
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Face Controls - Interactive Face Game')
    parser.add_argument('--stream-mode', action='store_true', 
                        help='Enable streamer HUD mode for OBS overlay')
    parser.add_argument('--bg-color', type=str, default=None,
                        help='Background color for stream mode (e.g., "black", "green")')
    
    args = parser.parse_args()
    
    # Parse background color if provided
    bg_color = None
    if args.bg_color:
        color_map = {
            'black': (0, 0, 0),
            'green': (0, 255, 0),
            'blue': (0, 0, 255),
            'white': (255, 255, 255),
            'transparent': None
        }
        bg_color = color_map.get(args.bg_color.lower(), (0, 0, 0))
    
    try:
        main(stream_mode=args.stream_mode, bg_color=bg_color)
    except Exception as e:
        print(f"\nERROR: Game crashed with exception:")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {str(e)}")
        print(f"Args: stream_mode={args.stream_mode}, bg_color={bg_color}")
        import traceback
        traceback.print_exc()
        
        # Try to clean up
        try:
            pygame.quit()
            cv2.destroyAllWindows()
        except:
            pass
        sys.exit(1)