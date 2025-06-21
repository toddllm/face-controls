# Suppress MediaPipe verbose logging
import os
os.environ['GLOG_minloglevel'] = '3'

import cv2
import mediapipe as mp
import numpy as np
import math

class FaceController:
    def __init__(self, camera_index=0, detection_confidence=0.5, tracking_confidence=0.5):
        self.cap = cv2.VideoCapture(camera_index)
        self.mp_face_mesh = mp.solutions.face_mesh
        # Allow up to 4 faces for multiplayer
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=4,
            refine_landmarks=True,
            min_detection_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence
        )
        # Store max faces for iteration
        self.max_num_faces = 4
        self.drawing_utils = mp.solutions.drawing_utils
        self.drawing_specs = self.drawing_utils.DrawingSpec(thickness=1, circle_radius=1)
        # Blink detection state for each face
        self.prev_eyes_closed = []
        self.blink_threshold = 0.2

    def read(self):
        ret, frame = self.cap.read()
        if not ret:
            return [], None
        frame = cv2.flip(frame, 1)
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(img_rgb)
        h, w, _ = frame.shape
        metrics_list = []
        if results.multi_face_landmarks:
            for i, face_landmarks in enumerate(results.multi_face_landmarks):
                # Limit to configured number of faces
                if i >= self.max_num_faces:
                    break
                # Draw mesh
                self.drawing_utils.draw_landmarks(
                    frame, face_landmarks, self.mp_face_mesh.FACEMESH_TESSELATION,
                    landmark_drawing_spec=self.drawing_specs,
                    connection_drawing_spec=self.drawing_specs
                )
                lm = face_landmarks.landmark
                # Head pose estimation
                image_points = np.array([
                    (lm[1].x * w, lm[1].y * h),
                    (lm[152].x * w, lm[152].y * h),
                    (lm[33].x * w, lm[33].y * h),
                    (lm[263].x * w, lm[263].y * h),
                    (lm[61].x * w, lm[61].y * h),
                    (lm[291].x * w, lm[291].y * h),
                ], dtype='double')
                model_points = np.array([
                    (0.0, 0.0, 0.0),
                    (0.0, -63.6, -12.5),
                    (-43.3, 32.7, -26.0),
                    (43.3, 32.7, -26.0),
                    (-28.9, -28.9, -24.1),
                    (28.9, -28.9, -24.1),
                ])
                focal_length = w
                center = (w / 2, h / 2)
                camera_matrix = np.array([
                    [focal_length, 0, center[0]],
                    [0, focal_length, center[1]],
                    [0, 0, 1]
                ], dtype='double')
                dist_coeffs = np.zeros((4, 1))
                metrics = {'yaw': 0.0, 'pitch': 0.0, 'roll': 0.0, 'mouth_open_ratio': 0.0}
                success, rvec, tvec = cv2.solvePnP(
                    model_points, image_points, camera_matrix, dist_coeffs,
                    flags=cv2.SOLVEPNP_ITERATIVE
                )
                if success:
                    R, _ = cv2.Rodrigues(rvec)
                    sy = math.sqrt(R[0, 0]**2 + R[1, 0]**2)
                    if sy < 1e-6:
                        x = math.atan2(-R[1, 2], R[1, 1])
                        y = math.atan2(-R[2, 0], sy)
                        z = 0
                    else:
                        x = math.atan2(R[2, 1], R[2, 2])
                        y = math.atan2(-R[2, 0], sy)
                        z = math.atan2(R[1, 0], R[0, 0])
                    metrics.update({'pitch': x, 'yaw': y, 'roll': z})
                # Mouth open ratio
                ul = np.array([lm[13].x * w, lm[13].y * h])
                ll = np.array([lm[14].x * w, lm[14].y * h])
                ml = np.array([lm[61].x * w, lm[61].y * h])
                mr = np.array([lm[291].x * w, lm[291].y * h])
                vd = np.linalg.norm(ul - ll)
                hd = np.linalg.norm(ml - mr)
                if hd > 0:
                    metrics['mouth_open_ratio'] = vd / hd
                # Blink detection
                left_idxs = [33, 160, 158, 133, 153, 144]
                right_idxs = [362, 385, 387, 263, 373, 380]
                def ear(idxs):
                    pts = [(lm[i].x * w, lm[i].y * h) for i in idxs]
                    p1, p2, p3, p4, p5, p6 = pts
                    v1 = math.hypot(p2[0] - p6[0], p2[1] - p6[1])
                    v2 = math.hypot(p3[0] - p5[0], p3[1] - p5[1])
                    hd = math.hypot(p1[0] - p4[0], p1[1] - p4[1]) or 1e-6
                    return (v1 + v2) / (2.0 * hd)
                le = ear(left_idxs)
                re = ear(right_idxs)
                ear_avg = (le + re) / 2.0
                closed = ear_avg < self.blink_threshold
                # Ensure prev_eyes_closed list is long enough
                if i >= len(self.prev_eyes_closed):
                    self.prev_eyes_closed.append(False)
                blink = self.prev_eyes_closed[i] and not closed
                self.prev_eyes_closed[i] = closed
                metrics['eyes_closed'] = closed
                metrics['blink'] = blink
                # Record face pixel coordinates (landmark 1 ~ nose tip)
                coords = (lm[1].x * w, lm[1].y * h)
                metrics['face_coords'] = coords
                metrics_list.append(metrics)
        return metrics_list, frame

    def release(self):
        self.cap.release()