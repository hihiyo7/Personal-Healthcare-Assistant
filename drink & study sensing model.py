import cv2
from ultralytics import YOLOWorld
import mediapipe as mp
import numpy as np
import pandas as pd
from datetime import datetime
import os
from collections import deque
import math
import uuid
import sys

# =========================================================
# [설정] 카메라 및 모델
# =========================================================
CAMERA_SOURCE = 1

print("YOLO-World 모델 로딩 중...")
yolo_model = YOLOWorld("yolov8s-worldv2.pt")

CUSTOM_CLASSES = [
    "cup", "mug", "water bottle", "glass", "coffee cup",
    "open book", "closed book", "textbook", "notebook", "journal",
    "laptop", "keyboard", "computer mouse", "tablet", "monitor",
    "pen", "pencil", "marker", "highlighter",
    "paper", "document", "notepad", "calculator"
]

yolo_model.set_classes(CUSTOM_CLASSES)
print(f"✓ {len(CUSTOM_CLASSES)}개 클래스 로드 완료")

# MediaPipe 설정
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# =========================================================
# [클래스 매핑]
# =========================================================
DRINKING_CLASSES = ["cup", "mug", "water bottle", "glass", "coffee cup"]

STUDY_BOOK_CLASSES = ["open book", "closed book", "textbook", "notebook", "journal"]
STUDY_DEVICE_CLASSES = ["laptop", "keyboard", "tablet", "monitor"]
STUDY_TOOL_CLASSES = ["pen", "pencil", "marker", "paper", "document", "notepad", "calculator"]

ALL_STUDY_CLASSES = STUDY_BOOK_CLASSES + STUDY_DEVICE_CLASSES + STUDY_TOOL_CLASSES

# ------------------ [파라미터] 물 마시기 ------------------
WATER_CONTACT_FRAMES = 8
WATER_TRACKING_FRAMES = 40
MIN_TOTAL_RISE = 40
MOVEMENT_CONSISTENCY = 0.50
GESTURE_CONFIDENCE = 0.10

WATER_PROXIMITY_DISTANCE = 20
MISSING_HAND_TOLERANCE = 20  # ★ 이 프레임만큼 손 복원 시도
MIN_OBJECT_SIZE_RATIO = 0.02
DRINKING_MIN_CONFIDENCE = 0.35
DRINKING_MIN_ASPECT_RATIO = 1.0

DRINKING_COOLDOWN = 90

IOU_THRESHOLD = 0.5
MAX_TRACKING_FRAMES = 30

# ------------------ [파라미터] 공부 감지 ------------------
STUDY_MIN_CONFIDENCE = 0.30
STUDY_PROXIMITY_DISTANCE = 20
STUDY_MIN_START_FRAMES = 90
STUDY_AWAY_FRAMES = 120
STUDY_MIN_SESSION_FRAMES = 150


# =========================================================
# [Kalman Filter 클래스]
# =========================================================

class KalmanFilter2D:
    """2D 위치 추적을 위한 Kalman Filter"""

    def __init__(self):
        # 상태 벡터: [x, y, vx, vy] (위치 + 속도)
        self.kalman = cv2.KalmanFilter(4, 2)

        # 상태 전이 행렬 (등속도 모델)
        self.kalman.transitionMatrix = np.array([
            [1, 0, 1, 0],  # x = x + vx
            [0, 1, 0, 1],  # y = y + vy
            [0, 0, 1, 0],  # vx = vx
            [0, 0, 0, 1]  # vy = vy
        ], dtype=np.float32)

        # 측정 행렬 (x, y만 측정)
        self.kalman.measurementMatrix = np.array([
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ], dtype=np.float32)

        # 프로세스 노이즈
        self.kalman.processNoiseCov = np.eye(4, dtype=np.float32) * 0.03

        # 측정 노이즈
        self.kalman.measurementNoiseCov = np.eye(2, dtype=np.float32) * 0.1

        # 초기화 플래그
        self.initialized = False

    def update(self, x, y):
        """실제 측정값으로 업데이트"""
        measurement = np.array([[x], [y]], dtype=np.float32)

        if not self.initialized:
            # 첫 프레임: 상태 초기화
            self.kalman.statePre = np.array([[x], [y], [0], [0]], dtype=np.float32)
            self.kalman.statePost = np.array([[x], [y], [0], [0]], dtype=np.float32)
            self.initialized = True
            return x, y

        # 예측 + 보정
        self.kalman.correct(measurement)
        prediction = self.kalman.predict()

        return float(prediction[0]), float(prediction[1])

    def predict(self):
        """측정값 없이 예측만 수행 (손 사라졌을 때)"""
        if not self.initialized:
            return None, None

        prediction = self.kalman.predict()
        return float(prediction[0]), float(prediction[1])

    def reset(self):
        """필터 리셋"""
        self.initialized = False


# =========================================================
# 초기화
# =========================================================
os.makedirs("logs", exist_ok=True)
os.makedirs("captures", exist_ok=True)

cap = cv2.VideoCapture(CAMERA_SOURCE)

# --- 전역 상태 ---
active_interaction = None
last_water_detected_frame = 0
frame_count = 0

# --- 물 마시기 상태 ---
water_state = "idle"
water_contact_counter = 0
water_tracking_counter = 0

initial_palm_y = None
initial_palm_x = None
palm_y_history = []
upward_count = 0
cup_gesture_count = 0
hand_missing_frames = 0

detected_cup_name = None
detected_cup_box = None

tracked_cup_box = None
tracked_cup_name = None
tracked_cup_missing = 0

# ★ Kalman Filter 초기화
palm_kalman = KalmanFilter2D()
palm_position_history = deque(maxlen=10)  # 최근 10개 위치 저장

# ★ 손 복원 관련 변수
hand_last_seen_x = None
hand_last_seen_y = None
hand_velocity_x = 0
hand_velocity_y = 0

# --- 공부 상태 ---
study_state = "idle"
study_start_counter = 0
study_total_frames = 0
study_away_counter = 0
study_start_time = None
study_end_time = None
study_object_name = "unknown"
study_object_detail = "unknown"
study_start_capture_path = None
last_study_box = None
last_study_class_name = None

tracked_study_box = None
tracked_study_name = None
tracked_study_missing = 0


# =========================================================
# [유틸리티 함수]
# =========================================================

def calculate_iou(box1, box2):
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2

    xi1 = max(x1_1, x1_2)
    yi1 = max(y1_1, y1_2)
    xi2 = min(x2_1, x2_2)
    yi2 = min(y2_1, y2_2)

    inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)

    box1_area = (x2_1 - x1_1) * (y2_1 - y1_1)
    box2_area = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = box1_area + box2_area - inter_area

    return inter_area / union_area if union_area > 0 else 0


def get_log_path(prefix):
    today = datetime.now().strftime("%Y-%m-%d")
    return os.path.join("logs", f"{prefix}_log_{today}.csv")


def save_log(prefix, record):
    path = get_log_path(prefix)
    df = pd.DataFrame([record])

    if os.path.exists(path):
        df.to_csv(path, mode='a', header=False, index=False)
    else:
        df.to_csv(path, index=False)

    if prefix == "water":
        print(f"\n{'=' * 60}")
        print(f"[물 마시기 감지] {record.get('timestamp')}")
        print(f"  - 물체: {record.get('object')}")
        print(f"  - 상승: {record.get('rise')}px")
        print(f"  - 제스처: {record.get('gesture_conf')}")
        print(f"  - 일관성: {record.get('consistency')}")
        print(f"  - 저장: {path}")
        print(f"{'=' * 60}\n")
        sys.stdout.flush()
    elif prefix == "study":
        print(f"\n{'=' * 60}")
        print(f"[공부 세션 종료]")
        print(f"  - 시작: {record.get('start_time')}")
        print(f"  - 종료: {record.get('end_time')}")
        print(f"  - 시간: {record.get('duration_sec')}초")
        print(f"  - 물체: {record.get('object')} ({record.get('object_detail')})")
        print(f"  - 저장: {path}")
        print(f"{'=' * 60}\n")
        sys.stdout.flush()


def save_capture_image(frame, timestamp_str, prefix="capture"):
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{prefix}_{timestamp_str.replace(':', '-').replace(' ', '_')}_{unique_id}.jpg"
    filepath = os.path.join("captures", filename)
    cv2.imwrite(filepath, frame)
    print(f"[캡처 저장] {filepath}")
    return filepath


def reset_water_state():
    global water_state, water_contact_counter, water_tracking_counter
    global initial_palm_y, initial_palm_x, palm_y_history
    global upward_count, cup_gesture_count, hand_missing_frames
    global detected_cup_name, detected_cup_box
    global tracked_cup_box, tracked_cup_name, tracked_cup_missing
    global palm_kalman, palm_position_history
    global hand_last_seen_x, hand_last_seen_y, hand_velocity_x, hand_velocity_y

    water_state = "idle"
    water_contact_counter = 0
    water_tracking_counter = 0
    initial_palm_y = None
    initial_palm_x = None
    palm_y_history = []
    upward_count = 0
    cup_gesture_count = 0
    hand_missing_frames = 0
    detected_cup_name = None
    detected_cup_box = None
    tracked_cup_box = None
    tracked_cup_name = None
    tracked_cup_missing = 0

    # Kalman Filter 리셋
    palm_kalman.reset()
    palm_position_history.clear()
    hand_last_seen_x = None
    hand_last_seen_y = None
    hand_velocity_x = 0
    hand_velocity_y = 0


# =========================================================
# [제스처 감지 함수]
# =========================================================

def calculate_lm_distance(lm1, lm2):
    return math.sqrt((lm1.x - lm2.x) ** 2 + (lm1.y - lm2.y) ** 2)


def is_holding_pen(landmarks):
    pinch_dist = calculate_lm_distance(landmarks.landmark[4], landmarks.landmark[8])
    support_dist = calculate_lm_distance(landmarks.landmark[4], landmarks.landmark[12])
    return pinch_dist < 0.08 and support_dist < 0.10


def is_holding_cup(landmarks):
    c_shape_dist = calculate_lm_distance(landmarks.landmark[4], landmarks.landmark[8])
    return 0.05 <= c_shape_dist <= 0.30


def get_palm_position(hand_landmarks, img_w, img_h):
    palm = hand_landmarks.landmark[9]
    return palm.x * img_w, palm.y * img_h


def calculate_distance_to_bbox(bbox, hand_landmarks, img_w, img_h):
    x1, y1, x2, y2 = bbox
    key_landmarks = [0, 4, 8, 12, 16, 20, 9]

    min_distance = float('inf')

    for idx in key_landmarks:
        lm = hand_landmarks.landmark[idx]
        lm_x = lm.x * img_w
        lm_y = lm.y * img_h

        if x1 <= lm_x <= x2 and y1 <= lm_y <= y2:
            return 0

        closest_x = max(x1, min(lm_x, x2))
        closest_y = max(y1, min(lm_y, y2))
        dist = np.sqrt((lm_x - closest_x) ** 2 + (lm_y - closest_y) ** 2)
        min_distance = min(min_distance, dist)

    return min_distance


def get_category_from_class(class_name):
    if class_name in STUDY_BOOK_CLASSES:
        return "book"
    elif class_name in STUDY_DEVICE_CLASSES:
        return "device"
    elif class_name in STUDY_TOOL_CLASSES:
        return "tool"
    else:
        return "unknown"


# =========================================================
# 메인 루프
# =========================================================

try:
    print("=" * 60)
    print("YOLO-World + Kalman Filter Hand Tracking")
    print("=" * 60)
    print("ESC 키로 종료하세요.\n")
    sys.stdout.flush()

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret or frame is None or frame.size == 0:
            continue

        frame_count += 1
        img_h, img_w = frame.shape[:2]

        # YOLO-World 객체 탐지
        try:
            results = yolo_model.predict(source=frame, conf=0.25, verbose=False)
        except Exception as e:
            print(f"[Warning] YOLO 탐지 오류: {e}")
            continue

        # ------------------- 객체 탐지 및 필터링 -------------------
        detected_cups = []
        detected_study = []

        if len(results) > 0 and results[0].boxes is not None:
            boxes = results[0].boxes

            for box in boxes:
                confidence = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                class_id = int(box.cls[0])
                class_name = yolo_model.names[class_id]

                box_w, box_h = x2 - x1, y2 - y1
                ratio = (box_w * box_h) / (img_w * img_h)
                bbox = (x1, y1, x2, y2)

                if class_name in DRINKING_CLASSES:
                    aspect_ratio = box_h / box_w if box_w > 0 else 0

                    if (confidence >= DRINKING_MIN_CONFIDENCE and
                            ratio >= MIN_OBJECT_SIZE_RATIO and
                            aspect_ratio >= DRINKING_MIN_ASPECT_RATIO):
                        detected_cups.append((bbox, class_name, confidence))

                if class_name in ALL_STUDY_CLASSES:
                    if confidence >= STUDY_MIN_CONFIDENCE and ratio >= 0.02:
                        detected_study.append((bbox, class_name, confidence))

        # ===============================================================
        # IoU 기반 물체 추적
        # ===============================================================

        if tracked_cup_box is not None:
            matched = False
            best_iou = 0
            best_match_box = None
            best_match_name = None

            for cup_box, cup_name, cup_conf in detected_cups:
                iou = calculate_iou(tracked_cup_box, cup_box)
                if iou > IOU_THRESHOLD and iou > best_iou:
                    best_iou = iou
                    best_match_box = cup_box
                    best_match_name = cup_name
                    matched = True

            if matched:
                tracked_cup_box = best_match_box
                tracked_cup_missing = 0
            else:
                tracked_cup_missing += 1
                if tracked_cup_missing > MAX_TRACKING_FRAMES:
                    print(f"[Track] 컵 추적 중단 (사라짐)")
                    sys.stdout.flush()
                    tracked_cup_box = None
                    tracked_cup_name = None
                    tracked_cup_missing = 0

        if tracked_study_box is not None:
            matched = False
            best_iou = 0
            best_match_box = None
            best_match_name = None

            for study_box, study_name, study_conf in detected_study:
                iou = calculate_iou(tracked_study_box, study_box)
                if iou > IOU_THRESHOLD and iou > best_iou:
                    best_iou = iou
                    best_match_box = study_box
                    best_match_name = study_name
                    matched = True

            if matched:
                tracked_study_box = best_match_box
                tracked_study_missing = 0
            else:
                tracked_study_missing += 1
                if tracked_study_missing > MAX_TRACKING_FRAMES:
                    tracked_study_box = None
                    tracked_study_name = None
                    tracked_study_missing = 0

        # ===============================================================
        # ★★★ 손 검출 + Kalman Filter 복원 ★★★
        # ===============================================================

        hand_detected = False
        hand_landmarks = None
        gesture_holding_pen = False
        gesture_holding_cup = False
        current_palm_x, current_palm_y = None, None
        hand_restored = False  # 복원 플래그

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        hand_results = hands.process(rgb)

        if hand_results.multi_hand_landmarks:
            # ★ 실제 손 감지됨
            hand_landmarks = hand_results.multi_hand_landmarks[0]
            mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            hand_detected = True
            hand_missing_frames = 0

            raw_x, raw_y = get_palm_position(hand_landmarks, img_w, img_h)

            # Kalman Filter 업데이트
            filtered_x, filtered_y = palm_kalman.update(raw_x, raw_y)
            current_palm_x, current_palm_y = filtered_x, filtered_y

            # 위치 히스토리 저장
            palm_position_history.append((current_palm_x, current_palm_y))

            # 속도 계산 (최근 2개 위치)
            if len(palm_position_history) >= 2:
                hand_velocity_x = palm_position_history[-1][0] - palm_position_history[-2][0]
                hand_velocity_y = palm_position_history[-1][1] - palm_position_history[-2][1]

            hand_last_seen_x = current_palm_x
            hand_last_seen_y = current_palm_y

            gesture_holding_cup = is_holding_cup(hand_landmarks)
            gesture_holding_pen = is_holding_pen(hand_landmarks)

        else:
            # ★ 손이 안 보임 → 복원 시도
            hand_missing_frames += 1

            if hand_missing_frames <= MISSING_HAND_TOLERANCE and water_state == "tracking":
                # ★★★ 복원 모드 ★★★

                # 방법 1: Kalman Filter 예측
                pred_x, pred_y = palm_kalman.predict()

                if pred_x is not None and pred_y is not None:
                    # 화면 경계 체크
                    pred_x = max(0, min(pred_x, img_w))
                    pred_y = max(0, min(pred_y, img_h))

                    current_palm_x = pred_x
                    current_palm_y = pred_y
                    hand_restored = True
                    hand_detected = True  # ★ 복원된 손도 "감지됨"으로 처리

                    # 복원된 위치 표시
                    cv2.circle(frame, (int(current_palm_x), int(current_palm_y)), 15, (0, 255, 255), 3)
                    cv2.putText(frame, "RESTORED", (int(current_palm_x) - 40, int(current_palm_y) - 20),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 2)

                    print(f"[Hand] 복원 {hand_missing_frames}/{MISSING_HAND_TOLERANCE} (Kalman)")

                # 방법 2: 선형 예측 (백업)
                elif hand_last_seen_x is not None and len(palm_position_history) >= 2:
                    # 등속도 가정
                    current_palm_x = hand_last_seen_x + hand_velocity_x * hand_missing_frames
                    current_palm_y = hand_last_seen_y + hand_velocity_y * hand_missing_frames

                    # 화면 경계 체크
                    current_palm_x = max(0, min(current_palm_x, img_w))
                    current_palm_y = max(0, min(current_palm_y, img_h))

                    hand_restored = True
                    hand_detected = True

                    cv2.circle(frame, (int(current_palm_x), int(current_palm_y)), 12, (255, 0, 255), 2)
                    cv2.putText(frame, "LINEAR", (int(current_palm_x) - 30, int(current_palm_y) - 20),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 0, 255), 1)

                    print(f"[Hand] 복원 {hand_missing_frames}/{MISSING_HAND_TOLERANCE} (Linear)")

        # ===============================================================
        # 거리 기반 상호작용 판단
        # ===============================================================

        closest_cup_box = None
        closest_cup_name = None
        closest_cup_distance = float('inf')
        hand_contact_cup = False

        if hand_detected and active_interaction != "study":
            if tracked_cup_box is not None:
                # ★ 복원된 손이어도 거리 계산 가능 (손바닥 위치만 있으면 됨)
                if not hand_restored and hand_landmarks:
                    dist = calculate_distance_to_bbox(tracked_cup_box, hand_landmarks, img_w, img_h)
                else:
                    # 복원된 경우: 손바닥 중심과 박스 중심 거리
                    bx1, by1, bx2, by2 = tracked_cup_box
                    box_cx = (bx1 + bx2) / 2
                    box_cy = (by1 + by2) / 2
                    dist = np.sqrt((current_palm_x - box_cx) ** 2 + (current_palm_y - box_cy) ** 2)

                if dist <= WATER_PROXIMITY_DISTANCE:
                    closest_cup_box = tracked_cup_box
                    closest_cup_name = tracked_cup_name
                    closest_cup_distance = dist
                    hand_contact_cup = True

            if not hand_contact_cup and len(detected_cups) > 0:
                for cup_box, cup_name, cup_conf in detected_cups:
                    if not hand_restored and hand_landmarks:
                        dist = calculate_distance_to_bbox(cup_box, hand_landmarks, img_w, img_h)
                    else:
                        bx1, by1, bx2, by2 = cup_box
                        box_cx = (bx1 + bx2) / 2
                        box_cy = (by1 + by2) / 2
                        dist = np.sqrt((current_palm_x - box_cx) ** 2 + (current_palm_y - box_cy) ** 2)

                    if dist <= WATER_PROXIMITY_DISTANCE and dist < closest_cup_distance:
                        closest_cup_distance = dist
                        closest_cup_box = cup_box
                        closest_cup_name = cup_name
                        hand_contact_cup = True

            if closest_cup_box:
                x1, y1, x2, y2 = closest_cup_box
                color = (255, 0, 0) if tracked_cup_box is not None else (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                cv2.putText(frame, f"{closest_cup_name} {int(closest_cup_distance)}px",
                            (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        for cup_box, cup_name, cup_conf in detected_cups:
            if cup_box != closest_cup_box:
                x1, y1, x2, y2 = cup_box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 1)
                cv2.putText(frame, f"{cup_name}", (x1, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)

        # --- [B] 공부 (기존 로직 유지) ---
        closest_study_box = None
        closest_study_name = None
        closest_study_distance = float('inf')
        hand_contact_study = False

        if hand_detected and active_interaction != "water" and not hand_restored:
            if tracked_study_box is not None and hand_landmarks:
                dist = calculate_distance_to_bbox(tracked_study_box, hand_landmarks, img_w, img_h)
                if dist <= STUDY_PROXIMITY_DISTANCE:
                    closest_study_box = tracked_study_box
                    closest_study_name = tracked_study_name
                    closest_study_distance = dist
                    hand_contact_study = True

            if not hand_contact_study and len(detected_study) > 0:
                for study_box, study_name, study_conf in detected_study:
                    dist = calculate_distance_to_bbox(study_box, hand_landmarks, img_w, img_h)

                    if dist <= STUDY_PROXIMITY_DISTANCE and dist < closest_study_distance:
                        closest_study_distance = dist
                        closest_study_box = study_box
                        closest_study_name = study_name
                        hand_contact_study = True

            if closest_study_box:
                x1, y1, x2, y2 = closest_study_box

                if closest_study_name in STUDY_BOOK_CLASSES:
                    color = (0, 140, 255)
                elif closest_study_name in STUDY_DEVICE_CLASSES:
                    color = (255, 140, 0)
                else:
                    color = (0, 255, 140)

                line_width = 3 if tracked_study_box is not None else 2
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, line_width)
                cv2.putText(frame, f"{closest_study_name} {int(closest_study_distance)}px",
                            (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

                last_study_box = closest_study_box
                last_study_class_name = closest_study_name

        for study_box, study_name, study_conf in detected_study:
            if study_box != closest_study_box:
                x1, y1, x2, y2 = study_box
                cv2.rectangle(frame, (x1, y1), (x2, y2), (200, 200, 200), 1)
                cv2.putText(frame, f"{study_name}", (x1, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)

        # ==========================================================
        # [로직 A] 물 마시기
        # ==========================================================

        in_cooldown = (frame_count - last_water_detected_frame) < DRINKING_COOLDOWN

        if water_state == "idle" and not in_cooldown:
            if hand_detected and hand_contact_cup and active_interaction != "study":
                water_contact_counter += 1

                if water_contact_counter == 1:
                    tracked_cup_box = closest_cup_box
                    tracked_cup_name = closest_cup_name
                    tracked_cup_missing = 0
                    print(f"[Water] 접촉 감지 시작 ({tracked_cup_name}, 거리: {int(closest_cup_distance)}px)")
                    print(f"[Track] 컵 추적 시작 → 클래스 고정!")
                    sys.stdout.flush()

                if water_contact_counter >= WATER_CONTACT_FRAMES:
                    water_state = "tracking"
                    active_interaction = "water"
                    detected_cup_name = tracked_cup_name
                    detected_cup_box = tracked_cup_box

                    initial_palm_y = current_palm_y
                    initial_palm_x = current_palm_x
                    palm_y_history = [current_palm_y]
                    water_tracking_counter = 0
                    upward_count = 0
                    cup_gesture_count = 0

                    print(f"[Water] 잠금 모드 진입! (물체: {detected_cup_name})")
                    print(f"→ 이제 손 움직임만 추적합니다 (복원 가능)")
                    sys.stdout.flush()
            else:
                if water_contact_counter > 0:
                    print(f"[Water] 접촉 중단 (카운터 리셋)")
                    sys.stdout.flush()
                water_contact_counter = 0
                tracked_cup_box = None
                tracked_cup_name = None
                tracked_cup_missing = 0

        elif water_state == "tracking":
            if hand_detected:
                water_tracking_counter += 1
                palm_y_history.append(current_palm_y)

                if not hand_restored and gesture_holding_cup:
                    cup_gesture_count += 1

                if len(palm_y_history) >= 2:
                    if palm_y_history[-2] - palm_y_history[-1] > 0.5:
                        upward_count += 1

                # ★ 복원된 손이어도 카운터는 리셋하지 않음
                if not hand_restored:
                    hand_missing_frames = 0

            else:
                # ★ 복원 실패 시에만 중단
                if hand_missing_frames > MISSING_HAND_TOLERANCE:
                    print(f"[Water] 손 완전 사라짐 → 중단")
                    sys.stdout.flush()
                    reset_water_state()
                    active_interaction = None

            if water_tracking_counter >= WATER_TRACKING_FRAMES:
                total_rise = initial_palm_y - palm_y_history[-1]
                consistency = upward_count / water_tracking_counter if water_tracking_counter > 0 else 0
                gesture_conf = cup_gesture_count / water_tracking_counter if water_tracking_counter > 0 else 0

                print(f"\n[Water 판단]")
                print(f"  상승: {total_rise:.1f}px (>= {MIN_TOTAL_RISE})")
                print(f"  일관성: {consistency:.2f} (>= {MOVEMENT_CONSISTENCY})")
                print(f"  제스처: {gesture_conf:.2f} (>= {GESTURE_CONFIDENCE})")
                sys.stdout.flush()

                if (total_rise >= MIN_TOTAL_RISE and
                        consistency >= MOVEMENT_CONSISTENCY and
                        gesture_conf >= GESTURE_CONFIDENCE):

                    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    cap_path = save_capture_image(frame.copy(), ts, "water_drinking")

                    save_log("water", {
                        "timestamp": ts,
                        "action": "water_drinking",
                        "object": detected_cup_name,
                        "duration_frames": water_tracking_counter,
                        "rise": int(total_rise),
                        "consistency": round(consistency, 2),
                        "gesture_conf": round(gesture_conf, 2),
                        "capture_path": cap_path
                    })

                    last_water_detected_frame = frame_count
                    reset_water_state()
                    active_interaction = None
                    print(f"★★★ 물 마시기 확정! ★★★\n")
                    sys.stdout.flush()
                else:
                    print(f"[Water] 조건 미달 → 기각\n")
                    sys.stdout.flush()
                    reset_water_state()
                    active_interaction = None

        # ==========================================================
        # [로직 B] 공부 감지 (기존 유지)
        # ==========================================================

        if study_state == "idle" and active_interaction != "water":
            if hand_detected and hand_contact_study:
                study_start_counter += 1

                if study_start_counter == 1:
                    tracked_study_box = closest_study_box
                    tracked_study_name = closest_study_name
                    tracked_study_missing = 0

                if closest_study_box:
                    bx1, by1, bx2, by2 = closest_study_box
                    bar_y = by1 - 15
                    progress = min(study_start_counter / STUDY_MIN_START_FRAMES, 1.0)
                    cv2.rectangle(frame, (bx1, bar_y), (bx1 + int((bx2 - bx1) * progress), bar_y + 10),
                                  (0, 165, 255), -1)

                    msg = "Pen!" if gesture_holding_pen else "Hand"
                    cv2.putText(frame, msg, (bx1, bar_y - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 2)

                if study_start_counter >= STUDY_MIN_START_FRAMES:
                    study_state = "studying"
                    active_interaction = "study"
                    study_total_frames = 0
                    study_away_counter = 0

                    study_start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    study_start_capture_path = save_capture_image(frame.copy(), study_start_time, "study_start")

                    study_object_name = get_category_from_class(tracked_study_name)
                    study_object_detail = tracked_study_name

                    print(f"\n[Study] 세션 시작!")
                    print(f"  시작 시간: {study_start_time}")
                    print(f"  물체: {study_object_name} ({study_object_detail})")
                    sys.stdout.flush()
            else:
                study_start_counter = 0
                tracked_study_box = None
                tracked_study_name = None

        elif study_state == "studying":
            study_total_frames += 1

            if hand_detected and hand_contact_study:
                study_away_counter = 0

                if gesture_holding_pen:
                    cv2.putText(frame, "WRITING...", (50, 200),
                                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 255), 2)
            else:
                study_away_counter += 1

                if study_away_counter >= STUDY_AWAY_FRAMES:
                    study_state = "idle"
                    active_interaction = None

                    study_end_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    study_end_capture_path = save_capture_image(frame.copy(), study_end_time, "study_end")

                    duration_sec = round(study_total_frames / 30, 1)

                    if study_total_frames >= STUDY_MIN_SESSION_FRAMES:
                        save_log("study", {
                            "start_time": study_start_time,
                            "end_time": study_end_time,
                            "duration_sec": duration_sec,
                            "object": study_object_name,
                            "object_detail": study_object_detail,
                            "start_capture": study_start_capture_path,
                            "end_capture": study_end_capture_path
                        })
                        print(f"[Study] 세션 종료 (기록 완료)")
                    else:
                        print(f"[Study] 세션 너무 짧음 (기록 안 함)")

                    study_start_counter = 0
                    study_total_frames = 0
                    study_away_counter = 0
                    tracked_study_box = None
                    tracked_study_name = None
                    sys.stdout.flush()

        # ==========================================================
        # UI 표시
        # ==========================================================

        if current_palm_x and not hand_restored:
            if gesture_holding_pen and active_interaction != "water":
                cv2.putText(frame, "PEN", (int(current_palm_x) - 20, int(current_palm_y) - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)
            elif gesture_holding_cup and active_interaction != "study":
                cv2.putText(frame, "CUP", (int(current_palm_x) - 20, int(current_palm_y) - 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 100, 0), 2)

        if in_cooldown:
            cooldown_sec = (DRINKING_COOLDOWN - (frame_count - last_water_detected_frame)) / 30
            cv2.putText(frame, f"Cooldown: {cooldown_sec:.1f}s", (img_w - 250, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)

        lock_color = (0, 0, 255) if active_interaction else (100, 100, 100)
        lock_text = f"LOCK: {active_interaction.upper() if active_interaction else 'NONE'}"
        cv2.putText(frame, lock_text, (img_w - 250, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, lock_color, 2)

        if tracked_cup_box is not None:
            cv2.putText(frame, f"Tracking: {tracked_cup_name}", (10, 150),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)

        if water_state == "idle":
            water_color = (150, 150, 0)
            status = "IDLE"
            if water_contact_counter > 0:
                status = f"Contact: {water_contact_counter}/{WATER_CONTACT_FRAMES}"
        elif water_state == "tracking":
            water_color = (0, 255, 255)
            status = f"TRACKING {water_tracking_counter}/{WATER_TRACKING_FRAMES}"

            if initial_palm_y and current_palm_y:
                current_rise = initial_palm_y - current_palm_y
                cv2.putText(frame, f"Rise: {current_rise:.1f}px", (10, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, water_color, 2)

        cv2.putText(frame, f"Water: {status}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, water_color, 2)

        # ★ 손 복원 상태 표시
        if hand_restored:
            cv2.putText(frame, f"Hand: RESTORED ({hand_missing_frames}f)", (10, 180),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

        if study_state == "idle":
            study_color = (100, 100, 100)
            study_status = "IDLE"
            if study_start_counter > 0:
                study_status = f"Starting: {study_start_counter}/{STUDY_MIN_START_FRAMES}"
        elif study_state == "studying":
            if active_interaction == "study":
                study_color = (0, 255, 255)
            else:
                study_color = (0, 200, 255)

            sec = study_total_frames / 30
            study_status = f"STUDYING {sec:.1f}s"

            if study_away_counter > 0:
                away_sec = (STUDY_AWAY_FRAMES - study_away_counter) / 30
                cv2.putText(frame, f"Away: {away_sec:.1f}s left", (10, 115),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

        cv2.putText(frame, f"Study: {study_status}", (10, 90),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, study_color, 2)

        cv2.imshow("YOLO-World + Kalman Filter", frame)

        if cv2.waitKey(1) & 0xFF == 27:
            break

except Exception as e:
    print(f"오류 발생: {e}")
    import traceback

    traceback.print_exc()
finally:
    cap.release()
    cv2.destroyAllWindows()
