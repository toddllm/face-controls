import pygame
from face_controls.face import FaceController
from face_controls.voice import VoiceController
import mediapipe as mp
import cv2
import sys
import random
import math
 
# Global entity lists for boss abilities
creatures = []
lasers = []
fireballs = []
snakes = []  # XYZ's snake attacks
portals = []  # Elder dimension portals
gary_boss = None  # Global Gary instance that ignores pause
elder_dimension_active = False

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
                # Charge at the current target position
                dx = cx-self.x; dy = cy-self.y; dist=math.hypot(dx,dy) or 1e-6
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
            # Track current target
            dx = cx-self.x; dy = cy-self.y; dist=math.hypot(dx,dy) or 1e-6
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
            # Teleport to random position near target
            angle = random.uniform(0, 2*math.pi)
            dist = random.uniform(100, 200)
            self.x = cx + math.cos(angle) * dist
            self.y = cy + math.sin(angle) * dist
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

# Snake projectile for XYZ
class Snake(Laser):
    def __init__(self, x, y, target_x, target_y):
        dx = target_x - x
        dy = target_y - y
        dist = math.hypot(dx, dy) or 1e-6
        super().__init__(x, y, dx/dist * 250, dy/dist * 250)
        self.radius = 10
        self.color = (50, 200, 50)
        self.wiggle_angle = 0.0
    def update(self, dt):
        self.wiggle_angle += dt * 10
        offset = math.sin(self.wiggle_angle) * 30
        perp_x = -self.vy / math.hypot(self.vx, self.vy)
        perp_y = self.vx / math.hypot(self.vx, self.vy)
        self.x += self.vx * dt + perp_x * offset * dt
        self.y += self.vy * dt + perp_y * offset * dt
        if not (0 <= self.x <= 640 and 0 <= self.y <= 480):
            self.active = False

# XYZ creature (honsil) that Gary rides
class XYZ(BaseBoss):
    def __init__(self, cx, cy):
        super().__init__(cx, cy)
        self.radius = 60
        self.health = 100
        self.color = (100, 50, 150)
        self.snake_interval = 2.0
        self.snake_timer = 0.0
        self.dash_interval = 5.0
        self.dash_timer = 0.0
        self.dashing = False
        self.dash_duration = 0.8
        self.dash_time = 0.0
        self.dash_vx = 0
        self.dash_vy = 0
    def update(self, dt, cx, cy):
        if not self.dashing:
            super().update(dt, cx, cy)
            self.dash_timer += dt
            if self.dash_timer >= self.dash_interval:
                self.dashing = True
                self.dash_time = 0.0
                self.dash_timer = 0.0
                dx = cx - self.x
                dy = cy - self.y
                dist = math.hypot(dx, dy) or 1e-6
                self.dash_vx = dx/dist * 500
                self.dash_vy = dy/dist * 500
        else:
            self.dash_time += dt
            self.x += self.dash_vx * dt
            self.y += self.dash_vy * dt
            if self.dash_time >= self.dash_duration:
                self.dashing = False
        # Snake attacks
        self.snake_timer += dt
        if self.snake_timer >= self.snake_interval:
            snakes.append(Snake(self.x, self.y, cx, cy))
            self.snake_timer = 0.0

# Gary boss with eye-contact mechanic
class GaryBoss(BaseBoss):
    def __init__(self, cx, cy, is_shadow=False):
        super().__init__(cx, cy)
        self.is_shadow = is_shadow
        self.radius = 45
        self.health = 80 if is_shadow else 60
        self.color = (50, 0, 50) if is_shadow else (255, 105, 180)
        self.riding_xyz = None
        self.attack_interval = 1.5
        self.attack_timer = 0.0
        self.being_looked_at = False
        self.anger_level = 0.0
        self.provoked = False
        self.teleport_interval = 4.0 if is_shadow else 6.0
        self.teleport_timer = 0.0
        # Crystal throw attack
        self.crystal_interval = 2.5
        self.crystal_timer = 0.0
        # Global update flag
        self.ignores_pause = True
    def check_eye_contact(self, metrics_list, centers):
        self.being_looked_at = False
        for i, metrics in enumerate(metrics_list):
            cx_i, cy_i = centers[i]
            # Check if player is looking at Gary
            yaw = metrics.get('yaw', 0)
            pitch = metrics.get('pitch', 0)
            # Calculate if player's gaze direction points at Gary
            dx = self.x - cx_i
            dy = self.y - cy_i
            dist = math.hypot(dx, dy)
            if dist < 300:  # Close enough to make eye contact
                gaze_x = math.sin(yaw)
                gaze_y = -math.sin(pitch)
                dot = (dx * gaze_x + dy * gaze_y) / (dist or 1e-6)
                if dot > 0.7:  # Looking roughly at Gary
                    self.being_looked_at = True
                    if not self.provoked:
                        self.anger_level = min(self.anger_level + 0.02, 1.0)
                        if self.anger_level >= 1.0:
                            self.provoked = True
                    break
    def update(self, dt, cx, cy, metrics_list=None, centers=None):
        # Always update even during pause
        if self.riding_xyz and self.riding_xyz.health > 0:
            # Ride on top of XYZ
            self.x = self.riding_xyz.x
            self.y = self.riding_xyz.y - 50
        else:
            super().update(dt, cx, cy)
        # Check eye contact
        if metrics_list and centers:
            self.check_eye_contact(metrics_list, centers)
        # Attacks only if not being looked at (or if provoked)
        if not self.being_looked_at or self.provoked:
            self.attack_timer += dt
            if self.attack_timer >= self.attack_interval:
                # Melee or crystal throw
                if math.hypot(self.x - cx, self.y - cy) < 150:
                    # Close range melee - damage handled elsewhere
                    pass
                else:
                    # Throw crystal
                    dx = cx - self.x
                    dy = cy - self.y
                    dist = math.hypot(dx, dy) or 1e-6
                    vx = dx/dist * 300
                    vy = dy/dist * 300
                    crystal = PurpleLaser(self.x, self.y, vx, vy)
                    crystal.color = (255, 0, 255) if self.is_shadow else (255, 192, 203)
                    lasers.append(crystal)
                self.attack_timer = 0.0
        # Teleportation
        self.teleport_timer += dt
        if self.teleport_timer >= self.teleport_interval:
            if self.is_shadow:
                # Shadow Gary teleports to dark corners
                corners = [(50, 50), (590, 50), (50, 430), (590, 430)]
                self.x, self.y = random.choice(corners)
            else:
                # Normal Gary random teleport
                self.x = random.randint(50, 590)
                self.y = random.randint(50, 430)
            self.teleport_timer = 0.0

# Elder Dimension Portal
class ElderPortal:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.radius = 40
        self.active = True
        self.pulse = 0.0
        self.spawn_timer = 0.0
        self.gary_spawned = False
    def update(self, dt):
        self.pulse += dt * 2
        self.spawn_timer += dt
        if self.spawn_timer >= 5.0 and not self.gary_spawned:
            # Spawn Gary from portal
            global gary_boss
            is_shadow = random.random() < 0.01  # 1% chance for Shadow Gary
            gary_boss = GaryBoss(self.x, self.y, is_shadow)
            # Also spawn XYZ for Gary to ride
            xyz = XYZ(self.x, self.y + 100)
            gary_boss.riding_xyz = xyz
            creatures.append(xyz)
            self.gary_spawned = True
            global elder_dimension_active
            elder_dimension_active = True

def main():
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
    screen = pygame.display.set_mode((640, 480))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)
    # Speech phrases
    phrases = ["Hello, I'm your avatar.", "How are you today?", "I am your digital friend."]
    phrase_index = 0
    # Game state
    global creatures, lasers, fireballs, snakes, portals, gary_boss, elder_dimension_active
    creatures = []
    lasers = []
    fireballs = []  # for boss ranged attacks
    snakes = []  # XYZ snake attacks
    portals = []  # Elder dimension portals
    gary_boss = None
    elder_dimension_active = False
    # Player lives and invulnerability timers
    player_lives = []
    invul_timers = []
    # Wave and boss sequencing: kills before each boss
    kill_targets = [20, 30, 40, 50, 60, 70, 80, 90, 100, 120]
    wave_kills = 0
    wave_index = 0
    boss = None
    last_spawn = 0
    spawn_interval = 1.5
    state = 'minions'
    running = True
    while running:
        dt = clock.tick(60) / 1000.0
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
                elif event.key == pygame.K_p and not elder_dimension_active:
                    # Create Elder Dimension portal with P key
                    portal_x = random.randint(100, screen_w - 100)
                    portal_y = random.randint(100, screen_h - 100)
                    portals.append(ElderPortal(portal_x, portal_y))
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
        # Fire lasers on blink per avatar (always enabled)
        for i, metrics in enumerate(metrics_list):
            if metrics.get('blink'):
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
                # Fire from both eyes of avatar i
                cx_i, cy_i = centers[i]
                eye_off_x = 100 * 0.4; eye_off_y = -100 * 0.2
                eyes = [
                    (cx_i - eye_off_x, cy_i + eye_off_y),
                    (cx_i + eye_off_x, cy_i + eye_off_y)
                ]
                for ex, ey in eyes:
                    lasers.append(Laser(ex, ey, vx, vy))
        # Update lasers
        for l in lasers:
            l.update(dt)
        lasers = [l for l in lasers if l.active]
        
        # Update snakes
        for s in snakes:
            s.update(dt)
        snakes = [s for s in snakes if s.active]
        
        # Update portals
        for p in portals:
            p.update(dt)
        
        # Update Gary (always, even during pause)
        if gary_boss:
            nearest_center = centers[0] if centers else (320, 240)
            gary_boss.update(dt, nearest_center[0], nearest_center[1], metrics_list, centers)
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
        
        # Snake collisions with players
        for s in snakes:
            for i, (cx_i, cy_i) in enumerate(centers):
                if invul_timers[i] <= 0 and math.hypot(s.x - cx_i, s.y - cy_i) < (s.radius + 100):
                    player_lives[i] -= 1
                    invul_timers[i] = 2.0
                    if player_lives[i] <= 0:
                        player_lives[i] = 3
                        invul_timers[i] = 2.0
                    s.active = False
                    break
        
        # Gary attacks (melee damage)
        if gary_boss and (not gary_boss.being_looked_at or gary_boss.provoked):
            for i, (cx_i, cy_i) in enumerate(centers):
                if invul_timers[i] <= 0 and math.hypot(gary_boss.x - cx_i, gary_boss.y - cy_i) < (gary_boss.radius + 100):
                    player_lives[i] -= 2  # Gary does double damage
                    invul_timers[i] = 2.0
                    if player_lives[i] <= 0:
                        player_lives[i] = 3
                        invul_timers[i] = 2.0
        
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
            # Reset wave_kills and clear minions/lasers for boss phase
            wave_kills = 0
            creatures.clear(); lasers.clear(); snakes.clear()
        # Update boss phases (all bosses)
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
            # Laser hits on boss (unless shielded)
            if not getattr(boss, 'shield_active', False):
                for l in lasers:
                    if l.active and math.hypot(boss.x - l.x, boss.y - l.y) < (boss.radius + l.radius):
                        boss.health -= 1
                        l.active = False
        
        # Gary boss takes damage (when not being looked at)
        if gary_boss and not gary_boss.being_looked_at:
            for l in lasers:
                if l.active and math.hypot(gary_boss.x - l.x, gary_boss.y - l.y) < (gary_boss.radius + l.radius):
                    gary_boss.health -= 1
                    l.active = False
                    if gary_boss.health <= 0:
                        gary_boss = None
                        elder_dimension_active = False
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
        screen.fill((30, 30, 30))
        # Draw each avatar
        for i, metrics in enumerate(metrics_list):
            cx, cy = centers[i]
            radius = 100
            # Head outline
            pygame.draw.circle(screen, (200,200,200), (cx,cy), radius, 2)
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
            pygame.draw.ellipse(screen, mcol,
                                pygame.Rect(mouth_center[0] - mouth_w//2,
                                            mouth_center[1] - mh//2,
                                            mouth_w, mh))
            # Draw hearts (lives)
            hl = player_lives[i]
            heart_r = 6; spacing = heart_r*2 + 4
            heart_y = cy - radius - 20
            start_x = cx - ((hl-1) * spacing)//2
            for j in range(hl):
                pygame.draw.circle(screen, (255,0,0), (start_x + j*spacing, heart_y), heart_r)
            # Draw dynamic arms based on hand detection
            arm_color = (200, 200, 200)
            face_x, face_y = metrics.get('face_coords', (cx, cy))
            # Shoulder positions
            shoulder_y = cy + int(radius * 0.3)
            shoulder_left = (cx - int(radius * 0.6), shoulder_y)
            shoulder_right = (cx + int(radius * 0.6), shoulder_y)
            # Assign nearest left/right hand
            l_hand = None; r_hand = None
            left_cands = [( (hp[0]-face_x)**2 + (hp[1]-face_y)**2, hp) for hp in hand_positions if hp[0] < face_x]
            right_cands = [( (hp[0]-face_x)**2 + (hp[1]-face_y)**2, hp) for hp in hand_positions if hp[0] >= face_x]
            if left_cands:
                l_hand = min(left_cands)[1]
            if right_cands:
                r_hand = min(right_cands)[1]
            # Draw left arm
            max_len = radius * 1.2
            if l_hand:
                dx, dy = l_hand[0] - face_x, l_hand[1] - face_y
                mag = math.hypot(dx, dy) or 1e-6
                factor = min(mag, max_len) / mag
                end_l = (shoulder_left[0] + dx * factor, shoulder_left[1] + dy * factor)
                pygame.draw.line(screen, arm_color, shoulder_left, (int(end_l[0]), int(end_l[1])), 4)
            # Draw right arm
            if r_hand:
                dx, dy = r_hand[0] - face_x, r_hand[1] - face_y
                mag = math.hypot(dx, dy) or 1e-6
                factor = min(mag, max_len) / mag
                end_r = (shoulder_right[0] + dx * factor, shoulder_right[1] + dy * factor)
                pygame.draw.line(screen, arm_color, shoulder_right, (int(end_r[0]), int(end_r[1])), 4)
        # Creatures
        for c in creatures:
            col = getattr(c, 'color', (0,255,0))
            pygame.draw.circle(screen, col, (int(c.x), int(c.y)), c.radius)
        # Boss (any phase)
        if boss:
            bcol = getattr(boss, 'color', (128,0,128))
            pygame.draw.circle(screen, bcol, (int(boss.x), int(boss.y)), boss.radius)
            # Health bar
            hb_w, hb_h = 80, 8
            bx = int(boss.x)
            by = int(boss.y) - boss.radius - 20
            pygame.draw.rect(screen, (255,0,0), pygame.Rect(bx - hb_w//2, by, hb_w, hb_h))
            hp_w = int(hb_w * max(boss.health,0) / 20)
            pygame.draw.rect(screen, (0,255,0), pygame.Rect(bx - hb_w//2, by, hp_w, hb_h))
        # Lasers and projectiles
        for l in lasers:
            col = getattr(l, 'color', (255,0,0))
            pygame.draw.circle(screen, col, (int(l.x), int(l.y)), l.radius)
        for fb in fireballs:
            col = getattr(fb, 'color', (255,0,0))
            pygame.draw.circle(screen, col, (int(fb.x), int(fb.y)), fb.radius)
        
        # Draw snakes
        for s in snakes:
            col = getattr(s, 'color', (50,200,50))
            pygame.draw.circle(screen, col, (int(s.x), int(s.y)), s.radius)
        
        # Draw portals
        for p in portals:
            pulse_r = int(p.radius + math.sin(p.pulse) * 10)
            # Portal outer ring
            pygame.draw.circle(screen, (128, 0, 128), (int(p.x), int(p.y)), pulse_r, 3)
            # Portal inner swirl
            for angle in range(0, 360, 30):
                rad = math.radians(angle + p.pulse * 50)
                inner_x = p.x + math.cos(rad) * (pulse_r - 10)
                inner_y = p.y + math.sin(rad) * (pulse_r - 10)
                pygame.draw.circle(screen, (200, 100, 200), (int(inner_x), int(inner_y)), 5)
        
        # Draw Gary boss
        if gary_boss:
            # Draw XYZ if Gary is riding it
            if gary_boss.riding_xyz and gary_boss.riding_xyz.health > 0:
                xyz = gary_boss.riding_xyz
                # XYZ body
                pygame.draw.circle(screen, xyz.color, (int(xyz.x), int(xyz.y)), xyz.radius)
                # XYZ features (scales, spikes)
                for angle in range(0, 360, 45):
                    rad = math.radians(angle)
                    spike_x = xyz.x + math.cos(rad) * xyz.radius
                    spike_y = xyz.y + math.sin(rad) * xyz.radius
                    end_x = xyz.x + math.cos(rad) * (xyz.radius + 15)
                    end_y = xyz.y + math.sin(rad) * (xyz.radius + 15)
                    pygame.draw.line(screen, (75, 25, 125), 
                                   (int(spike_x), int(spike_y)), 
                                   (int(end_x), int(end_y)), 3)
            
            # Draw Gary
            gary_col = gary_boss.color
            if gary_boss.being_looked_at and not gary_boss.provoked:
                # Peaceful pink when being looked at
                gary_col = (255, 192, 203)
            elif gary_boss.provoked:
                # Angry red when provoked
                gary_col = (255, 50, 50)
            
            pygame.draw.circle(screen, gary_col, (int(gary_boss.x), int(gary_boss.y)), gary_boss.radius)
            
            # Gary's crystal crown
            for i in range(5):
                angle = i * 72 - 90
                rad = math.radians(angle)
                crown_x = gary_boss.x + math.cos(rad) * (gary_boss.radius - 10)
                crown_y = gary_boss.y - gary_boss.radius + math.sin(rad) * 10
                pygame.draw.polygon(screen, (255, 0, 255), 
                                  [(int(crown_x), int(crown_y - 10)),
                                   (int(crown_x - 5), int(crown_y)),
                                   (int(crown_x + 5), int(crown_y))])
            
            # Gary's eyes (red when angry)
            eye_col = (255, 0, 0) if gary_boss.provoked else (200, 50, 200)
            pygame.draw.circle(screen, eye_col, 
                             (int(gary_boss.x - 10), int(gary_boss.y - 5)), 5)
            pygame.draw.circle(screen, eye_col, 
                             (int(gary_boss.x + 10), int(gary_boss.y - 5)), 5)
            
            # Health bar for Gary
            hb_w, hb_h = 100, 10
            hb_x = gary_boss.x - hb_w//2
            hb_y = gary_boss.y - gary_boss.radius - 30
            pygame.draw.rect(screen, (100, 0, 0), 
                           pygame.Rect(int(hb_x), int(hb_y), hb_w, hb_h))
            hp_ratio = max(0, gary_boss.health / (80 if gary_boss.is_shadow else 60))
            hp_w = int(hb_w * hp_ratio)
            pygame.draw.rect(screen, (255, 0, 255) if gary_boss.is_shadow else (255, 105, 180), 
                           pygame.Rect(int(hb_x), int(hb_y), hp_w, hb_h))
            
            # Label for Gary
            label = "Shadow Gary" if gary_boss.is_shadow else "Gary"
            if gary_boss.riding_xyz:
                label += " riding XYZ"
            text_surf = font.render(label, True, (255, 255, 255))
            text_x = gary_boss.x - text_surf.get_width()//2
            text_y = gary_boss.y - gary_boss.radius - 50
            screen.blit(text_surf, (int(text_x), int(text_y)))
        
        # HUD
        # Show kills in this wave
        kt = kill_targets[wave_index] if wave_index < len(kill_targets) else 0
        screen.blit(font.render(f'Kills: {wave_kills}/{kt}', True, (255,255,255)), (10,10))
        # Show boss fight label
        if boss:
            name = boss.__class__.__name__
            screen.blit(font.render(f'{name} Fight!', True, (255,255,255)), (10,30))
        # Show Elder Dimension status
        if elder_dimension_active:
            screen.blit(font.render('Elder Dimension Active!', True, (200,0,200)), (10,50))
            screen.blit(font.render('Press P to create portal', True, (150,150,150)), (10,70))
        elif not portals and wave_index >= 5:  # Allow portals after wave 5
            screen.blit(font.render('Press P to open Elder Portal', True, (150,150,150)), (10,50))
        # Victory
        if state == 'victory':
            screen.blit(font.render('Victory! You saved the Overworld!', True, (0,255,0)), (150,240))
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
    main()