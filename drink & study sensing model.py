import cv2
from ultralytics import YOLO
import mediapipe as mp
import numpy as np
import pandas as pd
from datetime import datetime
import os
from collections import deque
import math
import uuid  # 파일명 중복 방지를 위한 UUID

# YOLO 모델 로드
yolo_model = YOLO("yolov8n.pt")

# MediaPipe 설정
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# ------------------ [설정] 물 마시기 ------------------
CUP_CLASS_ID = 41
BOTTLE_CLASS_ID = 39
DRINKING_OBJECTS = [CUP_CLASS_ID, BOTTLE_CLASS_ID]

CONTACT_FRAMES = 6
DRINKING_FRAMES = 10
MOVE_THRESHOLD = 4.0

MIN_TOTAL_MOVEMENT = 60
MOVEMENT_CONSISTENCY_THRESHOLD = 0.65

MISSING_CUP_TOLERANCE = 40
MISSING_HAND_TOLERANCE = 15
PROXIMITY_DISTANCE = 120
MIN_CUP_SIZE_RATIO = 0.03
DRINKING_MIN_CONFIDENCE = 0.50
DRINKING_MIN_ASPECT_RATIO = 1.2

# ------------------ [설정] 공부 감지 ------------------
BOOK_CLASS_ID = 84
LAPTOP_CLASS_ID = 73
KEYBOARD_CLASS_ID = 76
STUDY_OBJECTS = [BOOK_CLASS_ID, LAPTOP_CLASS_ID, KEYBOARD_CLASS_ID]

STUDY_MIN_CONFIDENCE = 0.40
STUDY_PROXIMITY_DISTANCE = 150

STUDY_MIN_START_FRAMES = 90  # 약 3초 유지 시 시작
STUDY_MIN_SESSION_FRAMES = 150  # 최소 공부 시간 (약 5초)
STUDY_TIMEOUT_FRAMES = 150  # 세션 유지 쿨타임 (약 5초)

STUDY_MISSING_OBJECT_TOLERANCE = 60
STUDY_MISSING_HAND_TOLERANCE = 30

# 공부 상태 관리 변수
study_state = "idle"
study_start_counter = 0
study_total_frames = 0
study_cooldown_counter = 0
study_last_object = "unknown"

last_study_box = None
last_study_class = None
study_object_missing_frames = 0

# ----------------------------------------------------------

# 디렉토리 생성
os.makedirs("logs", exist_ok=True)
os.makedirs("captures", exist_ok=True)

cap = cv2.VideoCapture(0)

# 물 마시기 변수들
contact_counter = 0
drinking_counter = 0
state = "idle"
initial_palm_y = None
initial_palm_x = None
upward_movement_count = 0
total_movement_frames = 0
last_cup_box = None
last_cup_class = None
cup_missing_frames = 0
hand_missing_frames = 0
palm_y_buffer = deque(maxlen=5)
palm_x_buffer = deque(maxlen=5)

# [신규] 제스처 유효성 검사 카운터
cup_gesture_valid_frames = 0  # 물 마시는 동작 중 실제 컵 쥐는 자세가 유지된 프레임 수


def get_today_log_path():
    today = datetime.now().strftime("%Y-%m-%d")
    return os.path.join("logs", f"water_log_{today}.csv")


def get_today_study_log_path():
    today = datetime.now().strftime("%Y-%m-%d")
    return os.path.join("logs", f"study_log_{today}.csv")


def save_capture_image(frame, timestamp_str, prefix="capture"):
    # 파일명 중복 방지 (UUID 사용)
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{prefix}_{timestamp_str.replace(':', '-').replace(' ', '_')}_{unique_id}.jpg"
    filepath = os.path.join("captures", filename)
    cv2.imwrite(filepath, frame)
    print(f"[캡처 저장] {filepath}")
    return filepath


def calculate_distance_to_bbox(bbox, hand_landmarks, img_w, img_h):
    x1, y1, x2, y2 = bbox
    key_landmarks = [0, 4, 8, 12, 16, 20, 9]

    min_distance = float('inf')
    palm_y = None
    palm_x = None

    for idx in key_landmarks:
        lm = hand_landmarks.landmark[idx]
        lm_x = lm.x * img_w
        lm_y = lm.y * img_h

        if x1 <= lm_x <= x2 and y1 <= lm_y <= y2:
            dist = 0
        else:
            closest_x = max(x1, min(lm_x, x2))
            closest_y = max(y1, min(lm_y, y2))
            dist = np.sqrt((lm_x - closest_x) ** 2 + (lm_y - closest_y) ** 2)

        min_distance = min(min_distance, dist)

        if idx == 9:  # Wrist/Palm center
            palm_y = lm_y
            palm_x = lm_x

    return min_distance, palm_y, palm_x


# ------------------ [신규] 제스처 감지 함수들 ------------------

def calculate_lm_distance(lm1, lm2):
    return math.sqrt((lm1.x - lm2.x) ** 2 + (lm1.y - lm2.y) ** 2)


def is_holding_pen(landmarks):
    """
    펜 쥐기 감지 (Writing Gesture)
    - 엄지(4)와 검지(8)가 매우 가깝고(집게),
    - 중지(12)가 그 근처에서 받쳐주는 형태
    """
    thumb_tip = landmarks.landmark[4]
    index_tip = landmarks.landmark[8]
    middle_tip = landmarks.landmark[12]

    pinch_dist = calculate_lm_distance(thumb_tip, index_tip)  # 엄지-검지 거리
    support_dist = calculate_lm_distance(thumb_tip, middle_tip)  # 엄지-중지 거리

    # 펜 쥐는 모양은 손가락 끝이 모여있음 (임계값 0.06 ~ 0.08)
    if pinch_dist < 0.06 and support_dist < 0.08:
        return True
    return False


def is_holding_cup(landmarks):
    """
    컵 쥐기 감지 (Holding Cup Gesture)
    - 엄지(4)와 검지(8)가 적당히 벌어져 있어야 함 (너무 붙으면 펜/주먹, 너무 멀면 보자기)
    - 나머지 손가락(12, 16, 20) 끝이 손바닥 쪽으로 굽혀져 있어야 함(Grip)
    """
    thumb_tip = landmarks.landmark[4]
    index_tip = landmarks.landmark[8]
    wrist = landmarks.landmark[0]

    # 1. 엄지-검지 거리 체크 (C-Shape)
    # 펜 잡기(0.06 미만)보다는 크고, 완전히 펼친 손(0.2 이상)보다는 작아야 함
    c_shape_dist = calculate_lm_distance(thumb_tip, index_tip)

    # 2. 나머지 손가락 굽힘 체크
    # 중지(12), 약지(16), 소지(20)의 끝(TIP)이 시작점(MCP)보다 손목에 가까우면 굽힌 것
    # (단순화를 위해 TIP과 WRIST 거리 vs MCP와 WRIST 거리 비교)
    is_curled = True
    for tip_idx, mcp_idx in [(12, 9), (16, 13), (20, 17)]:
        tip_dist = calculate_lm_distance(landmarks.landmark[tip_idx], wrist)
        mcp_dist = calculate_lm_distance(landmarks.landmark[mcp_idx], wrist)
        # 손가락을 펴면 Tip이 MCP보다 멈. 굽히면 비슷하거나 Tip이 더 가까워짐.
        # 컵을 잡으면 완전히 굽히진 않지만(주먹), 완전히 펴지도 않음.
        # 여기서는 "완전히 펴지진 않음"을 체크하기보다 C-Shape에 집중하되
        # 엄지-검지 거리가 핵심

    if 0.07 <= c_shape_dist <= 0.25:
        return True

    return False

def save_study_log(record):
    log_path = get_today_study_log_path()
    if os.path.exists(log_path):
        df_existing = pd.read_csv(log_path)
        df_new = pd.DataFrame([record])
        df = pd.concat([df_existing, df_new], ignore_index=True)
    else:
        df = pd.DataFrame([record])
    df.to_csv(log_path, index=False)
    print(f"[공부 세션 기록] {log_path} 저장 완료 (시간: {record['duration_sec']}초)")

# -------------------------------------------------------------

try:
    print("=" * 60)
    print("제스처 기반 행동 감지 시스템 (Pen & Cup Gesture Integrated)")
    print("=" * 60)
    print("ESC 키로 종료하세요.\n")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        if frame is None or frame.size == 0:
            continue

        img_h, img_w = frame.shape[:2]

        # YOLO Detection (매 프레임 수행 - 최적화 필요 시 건너뛰기 가능)
        try:
            results = yolo_model.predict(source=frame, imgsz=640, conf=0.25, verbose=False)
        except:
            continue

        boxes = results[0].boxes

        # ------------------- 객체 탐지 및 추적 -------------------
        cup_detected_this_frame = False
        current_cup_box = None
        current_cup_class = None

        study_detected_this_frame = False
        current_study_box = None
        current_study_class = None

        for box in boxes:
            cls_id = int(box.cls[0])
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            # [물체 필터링] 물 마시기
            if cls_id in DRINKING_OBJECTS:
                box_w, box_h = x2 - x1, y2 - y1
                ratio = (box_w * box_h) / (img_w * img_h)
                aspect_ratio = box_h / box_w if box_w > 0 else 0

                if (confidence >= DRINKING_MIN_CONFIDENCE and
                        ratio >= MIN_CUP_SIZE_RATIO and
                        aspect_ratio >= DRINKING_MIN_ASPECT_RATIO and
                        ((y1 + y2) / 2) <= img_h * 0.85):

                    if not cup_detected_this_frame:
                        current_cup_box = (x1, y1, x2, y2)
                        current_cup_class = cls_id
                        last_cup_box = current_cup_box
                        last_cup_class = cls_id
                        cup_detected_this_frame = True
                        cup_missing_frames = 0
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # [물체 필터링] 공부
            if cls_id in STUDY_OBJECTS:
                box_w, box_h = x2 - x1, y2 - y1
                ratio = (box_w * box_h) / (img_w * img_h)

                if confidence >= STUDY_MIN_CONFIDENCE and ratio >= 0.03:
                    if not study_detected_this_frame:
                        current_study_box = (x1, y1, x2, y2)
                        current_study_class = cls_id
                        last_study_box = current_study_box
                        last_study_class = cls_id
                        study_detected_this_frame = True
                        study_object_missing_frames = 0

                        label = "Book" if cls_id == BOOK_CLASS_ID else (
                            "Laptop" if cls_id == LAPTOP_CLASS_ID else "Keyboard")
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 140, 255), 2)
                        cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 140, 255), 1)

        # 추적 보정
        if not cup_detected_this_frame:
            cup_missing_frames += 1
            if cup_missing_frames <= MISSING_CUP_TOLERANCE and last_cup_box:
                current_cup_box = last_cup_box
                current_cup_class = last_cup_class

        if not study_detected_this_frame:
            study_object_missing_frames += 1
            if study_object_missing_frames <= STUDY_MISSING_OBJECT_TOLERANCE and last_study_box:
                current_study_box = last_study_box
                current_study_class = last_study_class
            else:
                current_study_box = None

        # ------------------- 손 검출 및 제스처 분석 -------------------
        hand_contact_cup = False
        hand_contact_study = False

        # 제스처 플래그
        gesture_holding_pen = False
        gesture_holding_cup = False

        current_palm_y, current_palm_x = None, None

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        hand_results = hands.process(rgb)

        if hand_results.multi_hand_landmarks:
            hand_landmarks = hand_results.multi_hand_landmarks[0]
            mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
            hand_missing_frames = 0

            # 1. 제스처 인식 실행
            gesture_holding_pen = is_holding_pen(hand_landmarks)
            gesture_holding_cup = is_holding_cup(hand_landmarks)

            # 2. 물체(컵)와 거리
            if current_cup_box:
                dist, py, px = calculate_distance_to_bbox(current_cup_box, hand_landmarks, img_w, img_h)
                if dist <= PROXIMITY_DISTANCE:
                    hand_contact_cup = True
                    current_palm_y, current_palm_x = py, px
                    cv2.rectangle(frame, (current_cup_box[0], current_cup_box[1]),
                                  (current_cup_box[2], current_cup_box[3]), (255, 0, 0), 3)

            # 3. 물체(공부)와 거리
            if current_study_box:
                s_dist, _, _ = calculate_distance_to_bbox(current_study_box, hand_landmarks, img_w, img_h)
                if s_dist <= STUDY_PROXIMITY_DISTANCE:
                    hand_contact_study = True
                    cv2.rectangle(frame, (current_study_box[0], current_study_box[1]),
                                  (current_study_box[2], current_study_box[3]), (0, 255, 255), 3)

            # [UI] 현재 감지된 제스처 표시
            if current_palm_x:
                if gesture_holding_pen:
                    cv2.putText(frame, "PEN GRIP", (int(current_palm_x), int(current_palm_y) - 20),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2)
                elif gesture_holding_cup:
                    cv2.putText(frame, "CUP GRIP", (int(current_palm_x), int(current_palm_y) - 20),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 100, 0), 2)

        else:
            hand_missing_frames += 1

        # ==========================================================
        # 1. 물 마시기 로직 (보완됨: 제스처 결합)
        # ==========================================================
        if hand_contact_cup:
            contact_counter += 1
            if contact_counter == 1:
                initial_palm_y = current_palm_y
                initial_palm_x = current_palm_x
                upward_movement_count = 0
                total_movement_frames = 0
                cup_gesture_valid_frames = 0  # 리셋
        else:
            if hand_missing_frames > MISSING_HAND_TOLERANCE or cup_missing_frames > MISSING_CUP_TOLERANCE:
                if state != "drinking":
                    contact_counter = 0
                    drinking_counter = 0
                    state = "idle"
                    initial_palm_y = None
                    palm_y_buffer.clear()

        if contact_counter >= CONTACT_FRAMES and state == "idle":
            state = "interacting"

        if state == "interacting" and current_palm_y is not None:
            palm_y_buffer.append(current_palm_y)
            palm_x_buffer.append(current_palm_x)

            # [보완] 이동 중 '컵 쥐기 제스처'가 맞는지 카운트
            if gesture_holding_cup:
                cup_gesture_valid_frames += 1

            if len(palm_y_buffer) >= 2 and initial_palm_y is not None:
                smoothed_y = np.mean(list(palm_y_buffer)[-3:])
                delta_y = (initial_palm_y - smoothed_y)

                if delta_y > MOVE_THRESHOLD:
                    drinking_counter += 1

                total_movement_frames += 1
                curr_y_diff = (palm_y_buffer[-2] - palm_y_buffer[-1])
                if curr_y_diff > 0.5:
                    upward_movement_count += 1

        if state == "interacting" and drinking_counter >= DRINKING_FRAMES:
            if initial_palm_y is not None and current_palm_y is not None:
                total_rise = initial_palm_y - current_palm_y
                consistency = upward_movement_count / total_movement_frames if total_movement_frames > 0 else 0

                # [보완] 제스처 신뢰도 계산 (이동 기간 중 30% 이상은 컵 쥐는 모양이었는가?)
                gesture_confidence = cup_gesture_valid_frames / total_movement_frames if total_movement_frames > 0 else 0

                # 기존 조건 + 제스처 조건 추가
                if total_rise >= MIN_TOTAL_MOVEMENT and consistency >= MOVEMENT_CONSISTENCY_THRESHOLD:
                    # 제스처가 너무 아니면(0.2 미만) 기각, 맞으면 통과
                    if gesture_confidence >= 0.2:
                        state = "drinking"
                        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        obj_name = "Cup" if current_cup_class == CUP_CLASS_ID else "Bottle"

                        cap_path = save_capture_image(frame.copy(), ts, "water_drinking")
                        save_single_log({
                            "timestamp": ts, "action": "water_drinking",
                            "object": obj_name, "duration_frames": drinking_counter,
                            "gesture_conf": round(gesture_confidence, 2),
                            "capture_path": cap_path
                        })
                        print(f"★★★ 물 마시기 감지! (Rise: {total_rise:.0f}, GestureConf: {gesture_confidence:.2f}) ★★★")
                    else:
                        print(f"[기각] 상승 감지됐으나 컵 쥐는 손 모양이 아님 ({gesture_confidence:.2f})")
                        state = "idle"  # 상태 초기화

                    contact_counter = 0
                    drinking_counter = 0
                    if state != "drinking": state = "idle"
                    initial_palm_y = None

        # ==========================================================
        # 2. 공부 감지 로직 (보완됨: 펜 쥐기 결합)
        # ==========================================================

        # [핵심 변경] '공부 접촉'의 정의를 확장:
        # 1. 손이 책 영역 안에 있을 때 (기존)
        # 2. 손이 책 영역 안에 있고 + 펜을 쥐고 있을 때 (강력한 신호)
        is_effectively_studying = False

        if hand_contact_study:
            is_effectively_studying = True

        # [추가] 공부 세션 중이라면, 책 박스에서 손이 살짝 벗어나도 '펜을 쥐고 있으면' 공부로 인정
        # (책상 위에서 필기하다가 손이 책 영역 밖으로 나가는 경우 방지)
        if study_state == "studying" and gesture_holding_pen:
            # 마지막 책 위치 근처라면 인정 (너무 멀리 가면 안됨)
            if current_palm_x and last_study_box:
                # 간단히 화면 하단부(책상)에 손이 있다면 인정
                if current_palm_y > img_h * 0.4:
                    is_effectively_studying = True

        if is_effectively_studying:
            # 공부 중에는 쿨타임 리셋
            if study_state == "studying":
                study_cooldown_counter = 0
                study_total_frames += 1

                # 펜 쥐고 있으면 보너스 점수 혹은 확실한 상태 표시
                if gesture_holding_pen:
                    cv2.putText(frame, "WRITING...", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 255), 2)

                if current_study_class:
                    study_last_object = "book" if current_study_class == BOOK_CLASS_ID else (
                        "laptop" if current_study_class == LAPTOP_CLASS_ID else "keyboard")

            # 공부 시작 전 (Idle)
            elif study_state == "idle":
                study_start_counter += 1

                # [UI] 게이지 바 그리기
                if current_study_box:
                    bx1, by1, bx2, by2 = current_study_box
                    bar_y = by1 - 15
                    progress = min(study_start_counter / STUDY_MIN_START_FRAMES, 1.0)
                    cv2.rectangle(frame, (bx1, bar_y), (bx2, bar_y + 10), (200, 200, 200), -1)
                    cv2.rectangle(frame, (bx1, bar_y), (bx1 + int((bx2 - bx1) * progress), bar_y + 10), (0, 165, 255),
                                  -1)

                    msg = "Hold Hand"
                    if gesture_holding_pen: msg = "Pen Detected!"
                    cv2.putText(frame, msg, (bx1, bar_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 2)

                if study_start_counter >= STUDY_MIN_START_FRAMES:
                    study_state = "studying"
                    study_total_frames = 0
                    print(f"[STUDY] 공부 세션 시작! (조건 충족)")
                    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    save_capture_image(frame.copy(), ts, "study_start")

        else:
            # 손이 떨어짐
            if study_state == "idle":
                study_start_counter = 0
            elif study_state == "studying":
                study_cooldown_counter += 1
                study_total_frames += 1

                if study_cooldown_counter > STUDY_TIMEOUT_FRAMES:
                    print(f"[STUDY] 세션 종료. 총 프레임: {study_total_frames}")
                    if study_total_frames >= STUDY_MIN_SESSION_FRAMES:
                        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        save_study_log({
                            "timestamp": ts,
                            "action": "study_session",
                            "object": study_last_object,
                            "duration_frames": study_total_frames,
                            "duration_sec": round(study_total_frames / 30, 1),
                            "capture_path": "Started_Captured_Only"
                        })
                    study_state = "idle"
                    study_total_frames = 0
                    study_cooldown_counter = 0

        # ==========================================================
        # 화면 표시 (UI)
        # ==========================================================

        # 물 상태
        cv2.putText(frame, f"Water: {state}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)

        # 공부 상태
        study_color = (0, 200, 255) if study_state == "studying" else (200, 200, 200)
        cv2.putText(frame, f"Study: {study_state}", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, study_color, 2)

        if study_state == "studying":
            seconds = study_total_frames / 30
            cv2.putText(frame, f"Time: {seconds:.1f}s", (10, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.6, study_color, 2)
            if study_cooldown_counter > 0:
                cv2.putText(frame, f"Timeout in: {(STUDY_TIMEOUT_FRAMES - study_cooldown_counter) / 30:.1f}s",
                            (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

        cv2.imshow("Water + Study Tracker (Gesture Enhanced)", frame)

        if cv2.waitKey(1) & 0xFF == 27:
            break

except Exception as e:
    print(f"오류 발생: {e}")
    import traceback

    traceback.print_exc()
finally:
    cap.release()
    cv2.destroyAllWindows()
