import pygame
from face_controls.face import FaceController
from face_controls.voice import VoiceController
import cv2
import sys

def main():
    fc = FaceController()
    vc = VoiceController()
    pygame.init()
    screen = pygame.display.set_mode((640, 480))
    clock = pygame.time.Clock()
    font = pygame.font.SysFont(None, 24)
    running = True
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
        # Draw direction arrow
        pygame.draw.line(screen, (0, 255, 0), (cx, cy), (cx + dx, cy + dy), 3)
        # Draw mouth
        if mouth_open or talking:
            pygame.draw.circle(screen, (255, 0, 0), (cx, cy + radius//2), radius//6)
        else:
            pygame.draw.line(screen, (255, 0, 0), (cx - radius//6, cy + radius//2), (cx + radius//6, cy + radius//2), 4)
        # Draw talking text
        if talking:
            text = font.render("Talking", True, (255, 255, 255))
            screen.blit(text, (cx - text.get_width()//2, cy - radius - 30))
        pygame.display.flip()
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
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