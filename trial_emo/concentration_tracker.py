# concentration_tracker.py
import cv2
import mediapipe as mp
import numpy as np
import time
from flask import Response

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(refine_landmarks=True)

LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]

def eye_aspect_ratio(landmarks, eye_points, image_w, image_h):
    p = []
    for idx in eye_points:
        lm = landmarks[idx]
        x, y = int(lm.x * image_w), int(lm.y * image_h)
        p.append((x, y))
    A = np.linalg.norm(np.array(p[1]) - np.array(p[5]))
    B = np.linalg.norm(np.array(p[2]) - np.array(p[4]))
    C = np.linalg.norm(np.array(p[0]) - np.array(p[3]))
    return (A + B) / (2.0 * C)

def is_blinking(ear, threshold=0.2):
    return ear < threshold

def get_head_pose_score(landmarks, image_w, image_h):
    nose = landmarks[1]
    x = nose.x * image_w
    y=nose.y * image_h
    return 1.0 if 0.3 * image_w < x < 0.7 * image_w and 0.3 * image_h < y < 0.7 * image_h else 0.0

def get_gaze_score(landmarks):
    left_iris = landmarks[468]
    right_iris = landmarks[473]
    avg_x = (left_iris.x + right_iris.x) / 2.0
    return 1.0 if 0.5 < avg_x < 0.7 else 0.0

def compute_concentration_score(gaze, head_pose, blink):
    return round((0.4 * gaze + 0.4 * head_pose + 0.2 * (0 if blink else 1)) * 100, 2)

def track_concentration(score_container,frame_container):
    cap = cv2.VideoCapture(0)
    distraction = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image_h, image_w, _ = frame.shape
        results = face_mesh.process(frame_rgb)

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                landmarks = face_landmarks.landmark
                left_ear = eye_aspect_ratio(landmarks, LEFT_EYE, image_w, image_h)
                right_ear = eye_aspect_ratio(landmarks, RIGHT_EYE, image_w, image_h)
                avg_ear = (left_ear + right_ear) / 2
                blink = is_blinking(avg_ear)
                gaze_score = get_gaze_score(landmarks)
                head_score = get_head_pose_score(landmarks, image_w, image_h)
                smooth_score = compute_concentration_score(gaze_score, head_score, blink)
                score_container['value']=distraction
                color = (0, 255, 0) if smooth_score >= 40 else (0, 0, 255)
                cv2.putText(frame, f'Concentration: {smooth_score}%', 
                           (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
                
                status = "Focused" if smooth_score >= 40 else "Distracted"
                cv2.putText(frame, f'Status: {status}', 
                           (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)

                if smooth_score < 40:
                    distraction += 1
                    if distraction > 100:
                        distraction = 0
                        cap.release()
                        cv2.destroyAllWindows()
                        return True  # Trigger summary
        
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_container['frame'] = buffer.tobytes()
        
        cv2.imshow("Monitoring", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break


    cap.release()
    cv2.destroyAllWindows()
    return False

