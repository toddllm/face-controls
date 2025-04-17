import pygame
from face_controls.face import FaceController
from face_controls.voice import VoiceController
import cv2
import sys
import random
import math

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

def main():
    # New game loop replacing facial demo
    fc = FaceController()
    vc = VoiceController()
    pygame.init()
    screen = pygame.display.set_mode((640, 480))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)
    # Speech phrases
    phrases = ["Hello, I'm your avatar.", "How are you today?", "I am your digital friend."]
    phrase_index = 0
    # Game state
    creatures = []
    lasers = []
    fireballs = []  # for boss ranged attacks
    # Player lives and invulnerability timers
    player_lives = []
    invul_timers = []
    # Wave and boss sequencing
    kill_targets = [20, 30, 40]
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
        # Fire lasers on blink per avatar
        for i, metrics in enumerate(metrics_list):
            if metrics.get('blink') and state in ('minions','boss'):
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
        # Transition to boss when wave_kills reaches target
        if state == 'minions' and wave_kills >= kill_targets[wave_index]:
            # Initialize appropriate boss
            if wave_index == 0:
                boss = SnowKing(centers[0][0], centers[0][1])
                state = 'boss_snow'
            elif wave_index == 1:
                boss = FlameWarden(centers[0][0], centers[0][1])
                state = 'boss_fire'
            elif wave_index == 2:
                boss = MadackedaBoss(centers[0][0], centers[0][1])
                state = 'boss_madackeda'
            # Reset wave_kills for boss phase
            wave_kills = 0
            # Clear minions and lasers
            creatures.clear(); lasers.clear()
        # Update boss phases
        if boss is not None:
            # Determine nearest avatar for targeting
            dcs_b = [(math.hypot(boss.x - cx, boss.y - cy), (cx, cy)) for cx, cy in centers]
            _, tgt = min(dcs_b, key=lambda x: x[0])
            # Phase-specific boss behavior
            if state == 'boss_snow':
                # Snow King logic
                boss.update(dt, tgt[0], tgt[1])
                boss.spawn_timer += dt
                if boss.spawn_timer >= boss.spawn_interval:
                    creatures.append(Snowie(boss.x, boss.y, screen_w, screen_h))
                    boss.spawn_timer = 0
            elif state == 'boss_fire':
                # Flame Warden logic
                boss.update(dt, tgt[0], tgt[1])
                boss.spawn_timer += dt
                if boss.spawn_timer >= boss.spawn_interval:
                    creatures.append(FireSpinner(boss.x, boss.y, screen_w, screen_h))
                    boss.spawn_timer = 0
            elif state == 'boss_madackeda':
                # Madackeda special powers: teleport, shield, spawn both types
                boss.update(dt, tgt[0], tgt[1])
                # Teleportation
                boss.teleport_timer += dt
                if boss.teleport_timer >= boss.teleport_interval:
                    boss.x, boss.y = random.choice(centers)
                    boss.teleport_timer = 0
                # Shield
                boss.shield_timer += dt
                if not boss.shield_active and boss.shield_timer >= boss.shield_interval:
                    boss.shield_active = True
                    boss.shield_timer = 0
                    boss.shield_duration = boss.shield_duration_default
                if boss.shield_active:
                    boss.shield_duration -= dt
                    if boss.shield_duration <= 0:
                        boss.shield_active = False
                # Spawn minions
                boss.spawn_timer += dt
                if boss.spawn_timer >= boss.spawn_interval:
                    creatures.append(Snowie(boss.x, boss.y, screen_w, screen_h))
                    creatures.append(FireSpinner(boss.x, boss.y, screen_w, screen_h))
                    boss.spawn_timer = 0
                # Purple V-shaped laser attack
                boss.laser_timer += dt
                if boss.laser_timer >= boss.laser_interval:
                    # angles for V shape: 240° and 300° (down-left, down-right)
                    for ang in (math.radians(240), math.radians(300)):
                        vx = math.cos(ang) * 400
                        vy = math.sin(ang) * 400
                        lasers.append(PurpleLaser(boss.x, boss.y, vx, vy))
                    boss.laser_timer = 0
            # Boss collision damage to players
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
                        boss.health -= 1; l.active = False
            # Check for boss defeat
            if boss.health <= 0:
                wave_index += 1
                # Advance to next phase or victory
                if wave_index < len(kill_targets):
                    state = 'minions'
                else:
                    state = 'victory'
                    # clear any remaining entities
                    creatures.clear(); lasers.clear(); fireballs.clear()
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
        # Creatures
        for c in creatures:
            col = getattr(c, 'color', (0,255,0))
            pygame.draw.circle(screen, col, (int(c.x), int(c.y)), c.radius)
        # Boss (any phase)
        if boss:
            bcol = getattr(boss, 'color', (128,0,128))
            pygame.draw.circle(screen, bcol, (int(boss.x), int(boss.y)), boss.radius)
            # Health bar
            hb_w, hb_h = 80, 8; bx, by = cx, cy - 150 - boss.radius - 20
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
        # HUD
        # Show kills in this wave
        kt = kill_targets[wave_index] if wave_index < len(kill_targets) else 0
        screen.blit(font.render(f'Kills: {wave_kills}/{kt}', True, (255,255,255)), (10,10))
        # Show boss fight label
        if boss:
            name = boss.__class__.__name__
            screen.blit(font.render(f'{name} Fight!', True, (255,255,255)), (10,30))
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