import cv2
import mediapipe as mp
import numpy as np
import math

class FaceController:
    def __init__(self, camera_index=0, detection_confidence=0.5, tracking_confidence=0.5):
        self.cap = cv2.VideoCapture(camera_index)
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=detection_confidence,
            min_tracking_confidence=tracking_confidence
        )
        self.drawing_utils = mp.solutions.drawing_utils
        self.drawing_specs = self.drawing_utils.DrawingSpec(thickness=1, circle_radius=1)

    def read(self):
        ret, frame = self.cap.read()
        if not ret:
            return None, None
        frame = cv2.flip(frame, 1)
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(img_rgb)
        h, w, _ = frame.shape
        metrics = {'yaw': 0.0, 'pitch': 0.0, 'roll': 0.0, 'mouth_open_ratio': 0.0}
        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0].landmark
            self.drawing_utils.draw_landmarks(
                frame, results.multi_face_landmarks[0], self.mp_face_mesh.FACE_CONNECTIONS,
                landmark_drawing_spec=self.drawing_specs,
                connection_drawing_spec=self.drawing_specs
            )
            image_points = np.array([
                (landmarks[1].x * w, landmarks[1].y * h),
                (landmarks[152].x * w, landmarks[152].y * h),
                (landmarks[33].x * w, landmarks[33].y * h),
                (landmarks[263].x * w, landmarks[263].y * h),
                (landmarks[61].x * w, landmarks[61].y * h),
                (landmarks[291].x * w, landmarks[291].y * h),
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
            success, rotation_vector, translation_vector = cv2.solvePnP(
                model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
            )
            if success:
                rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
                sy = math.sqrt(rotation_matrix[0, 0]**2 + rotation_matrix[1, 0]**2)
                singular = sy < 1e-6
                if not singular:
                    x = math.atan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
                    y = math.atan2(-rotation_matrix[2, 0], sy)
                    z = math.atan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
                else:
                    x = math.atan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
                    y = math.atan2(-rotation_matrix[2, 0], sy)
                    z = 0
                metrics['pitch'] = x
                metrics['yaw'] = y
                metrics['roll'] = z
            upper_lip = np.array([landmarks[13].x * w, landmarks[13].y * h])
            lower_lip = np.array([landmarks[14].x * w, landmarks[14].y * h])
            mouth_left = np.array([landmarks[61].x * w, landmarks[61].y * h])
            mouth_right = np.array([landmarks[291].x * w, landmarks[291].y * h])
            vertical_dist = np.linalg.norm(upper_lip - lower_lip)
            horizontal_dist = np.linalg.norm(mouth_left - mouth_right)
            if horizontal_dist > 0:
                metrics['mouth_open_ratio'] = vertical_dist / horizontal_dist
        return metrics, frame

    def release(self):
        self.cap.release()