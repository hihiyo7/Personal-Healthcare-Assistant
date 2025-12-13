# 파일명: server.py
# ============================================================
# Personal Healthcare Assistant - Backend Server (Final Fixed)
# ============================================================

import os
from pathlib import Path
from dotenv import load_dotenv
import glob
import pandas as pd
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import google.generativeai as genai
import uvicorn
import traceback
import re

# ==========================================
# .env 로드 (경로 고정)
# ==========================================
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
ENV_PATH = ROOT_DIR / ".env"

load_dotenv(dotenv_path=ENV_PATH, override=True)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("GOOGLE_API_KEY 로드 실패")

# ==========================================
# Gemini 모델 설정
# ==========================================
genai.configure(api_key=GOOGLE_API_KEY)

try:
    TEXT_MODEL = genai.GenerativeModel("models/gemini-2.5-flash")
    VISION_MODEL = genai.GenerativeModel("models/gemini-2.5-flash-image")
    print("✅ Gemini 모델 초기화 완료 (2.5-flash)")
except Exception as e:
    print("❌ Gemini 모델 초기화 실패")
    traceback.print_exc()
    TEXT_MODEL = None
    VISION_MODEL = None


# ==========================================
# 데이터 경로 설정
# ==========================================
DATA_DIR = os.environ.get("DATA_DIR", r"C:/Users/gaeun/Desktop")
LOGS_DIR = os.path.join(DATA_DIR, "logs")
CAPTURES_DIR = os.path.join(DATA_DIR, "captures")

app = FastAPI()

# 422 에러 상세 출력을 위한 핸들러
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"❌ 데이터 검증 에러 발생: {exc}")
    return JSONResponse(status_code=422, content={"detail": exc.errors()})

app.add_middleware(
    CORSMIDDLEWARE := CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists(CAPTURES_DIR):
    app.mount("/captures", StaticFiles(directory=CAPTURES_DIR), name="captures")


@app.get("/")
def read_root():
    return {"status": "Server running", "data_path": DATA_DIR}


# ==========================================
# Pydantic 모델
# ==========================================
class AnalysisRequest(BaseModel):
    image_filename: str
    log_id: int

class BookInfo(BaseModel):
    title: str = ""
    authors: List[str] = []
    readPages: int = 0
    totalPages: int = 0
    durationMin: float = 0.0
    description: str = ""
    purpose: str = "study"

class LaptopInfo(BaseModel):
    category: str = "lecture"
    durationMin: float = 0.0
    isStudy: bool = True

class SummaryRequest(BaseModel):
    date: str
    waterMl: float
    waterGoal: float
    studyMin: float
    studyGoal: float
    bookInfo: Optional[BookInfo] = None
    laptopInfo: Optional[LaptopInfo] = None

# 프론트엔드 useStudyLogs.js와 일치하는 모델
class LogUpdateRequest(BaseModel):
    source_file: str            # 프론트엔드가 보내는 파일명
    log_id: int | str           # 로그 ID (0이면 전체 수정)
    updates: Dict[str, Any]     # 변경할 데이터 { "book_title": "...", ... }

# ==========================================
# 유틸리티 함수들
# ==========================================
def get_csv_files_for_date(prefix: str, date_str: str) -> list:
    pattern = os.path.join(LOGS_DIR, f"{prefix}*{date_str}*.csv")
    return list(set(glob.glob(pattern)))

def parse_timestamp_from_filename(filename: str) -> Optional[str]:
    basename = os.path.basename(filename).replace('.csv', '')
    match1 = re.search(r'(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})', basename)
    if match1:
        return f"{match1.group(1)}T{match1.group(2)}:{match1.group(3)}:00"
    match2 = re.search(r'(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})', basename)
    if match2:
        return f"{match2.group(1)}T{match2.group(2).replace('-', ':')}"
    return None

def merge_csv_files(files: list) -> pd.DataFrame:
    if not files:
        return pd.DataFrame()
    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f)
            if not df.empty:
                # 각 원본 CSV 안에서의 로우 인덱스를 별도 컬럼으로 유지
                # 여러 파일을 머지한 뒤에도 파일 내부 행 위치를 알기 위해 사용
                if 'row_index' not in df.columns:
                    df['row_index'] = range(len(df))

                file_ts = parse_timestamp_from_filename(f)
                if file_ts and 'timestamp' not in df.columns:
                    df['timestamp'] = file_ts
                df['source_file'] = os.path.basename(f)
                dfs.append(df)
        except Exception as e:
            print(f"❌ CSV 로드 실패: {f} / {e}")
            traceback.print_exc()
            continue
    if not dfs:
        return pd.DataFrame()
    
    merged = pd.concat(dfs, ignore_index=True)
    if 'timestamp' in merged.columns:
        merged = merged.sort_values('timestamp').reset_index(drop=True)
    return merged

def format_capture_url(path):
    if pd.isna(path) or str(path).lower() == 'nan' or 'Started' in str(path):
        return None
    return f"http://localhost:8000/captures/{os.path.basename(str(path))}"

def calculate_study_duration_per_file(df: pd.DataFrame, obj_type: str):
    if 'object' not in df.columns or 'source_file' not in df.columns:
        return 0, 0, []

    type_df = df[df['object'].astype(str).str.lower() == obj_type.lower()]
    if type_df.empty or 'timestamp' not in type_df.columns:
        return 0, 0, []

    total_min = 0
    sessions = []

    for source_file, group in type_df.groupby('source_file'):
        try:
            timestamps = group['timestamp'].dropna().tolist()
            if len(timestamps) < 1:
                continue
            first = pd.to_datetime(timestamps[0])
            last = pd.to_datetime(timestamps[-1])
            duration = max(int((last - first).total_seconds() / 60), 1)
            total_min += duration

            sessions.append({
                'source_file': source_file,
                'start_time': first.strftime('%H:%M'),
                'end_time': last.strftime('%H:%M'),
                'duration_min': duration,
                'log_count': len(timestamps),
            })
        except Exception as e:
            print(f"❌ duration 계산 실패 ({source_file}): {e}")
            traceback.print_exc()
            continue

    return total_min, len(sessions), sessions


# ==========================================
# API 엔드포인트
# ==========================================

@app.get("/api/logs/water/{date_str}")
def get_water_logs(date_str: str):
    files = get_csv_files_for_date("water", date_str)
    if not files:
        return []
    try:
        df = merge_csv_files(files)
        if df.empty:
            return []

        df['id'] = df.index

        # amount: duration_frames 기반으로 (이미 있으면 스킵)
        if 'duration_frames' in df.columns and 'amount' not in df.columns:
            df['amount'] = pd.to_numeric(df['duration_frames'], errors='coerce').fillna(0).astype(int)
        elif 'amount' not in df.columns:
            df['amount'] = 0

        # ★ timestamp 기준으로 captures 이미지 찾기 (capture_path는 무시)
        if 'timestamp' in df.columns:
            df['imageUrl'] = df['timestamp'].apply(
                lambda ts: find_capture_by_timestamp('water_drinking', ts)
            )
        else:
            df['imageUrl'] = None

        df['imageFile'] = df['imageUrl'].apply(
            lambda url: os.path.basename(str(url)) if isinstance(url, str) else None
        )

        if 'ai_result' not in df.columns:
            df['ai_result'] = "Not Analyzed"

        df = df.replace([float('inf'), float('-inf')], None)
        df = df.astype(object).where(pd.notnull(df), None)
        return df.to_dict(orient="records")
    except Exception as e:
        print("water 로그 로드 실패:", e)
        traceback.print_exc()
        return []



@app.get("/api/logs/study/{date_str}")
def get_study_logs(date_str: str):
    files = get_csv_files_for_date("study", date_str)
    if not files:
        return {"logs": [], "totalBookMin": 0, "totalLaptopMin": 0, "sessions": []}
    try:
        df = merge_csv_files(files)
        if df.empty:
            return {"logs": [], "totalBookMin": 0, "totalLaptopMin": 0, "sessions": []}

        # duration_sec → duration_min (없으면 생성)
        # duration_sec → duration_min 동기화
        # - CSV에서 duration_sec를 수정하면 항상 duration_min도 함께 업데이트되도록 처리
        if 'duration_sec' in df.columns:
            df['duration_min'] = pd.to_numeric(df['duration_sec'], errors='coerce').fillna(0) / 60.0

        book_min, book_count, book_sessions = calculate_study_duration_per_file(df, 'book')
        laptop_min, laptop_count, laptop_sessions = calculate_study_duration_per_file(df, 'laptop')

        df['id'] = df.index

        # 1) 우선 CSV의 capture_path로부터 laptop/book 캡처 사용
        df['imageUrl'] = None
        if 'capture_path' in df.columns:
            df['imageUrl'] = df['capture_path'].apply(format_capture_url)

        # 2) 없는 것만 timestamp 기반 study_start / study_end / study_* 에서 찾아오기
        if 'timestamp' in df.columns:
            mask = df['imageUrl'].isna()
            df.loc[mask, 'imageUrl'] = df.loc[mask, 'timestamp'].apply(
                lambda ts: find_capture_by_timestamp(['study_start', 'study_end', 'study'], ts)
            )

        df['imageFile'] = df['imageUrl'].apply(
            lambda url: os.path.basename(str(url)) if isinstance(url, str) else None
        )

        if 'object' in df.columns:
            df['type'] = df['object'].apply(
                lambda x: str(x).lower() if pd.notna(x) else 'laptop'
            )

        if 'timestamp' in df.columns:
            df['time'] = df['timestamp'].apply(
                lambda x: str(x).split('T')[1][:5]
                if pd.notna(x) and 'T' in str(x)
                else (str(x).split(' ')[1][:5]
                      if pd.notna(x) and ' ' in str(x)
                      else None)
            )

        df = df.replace([float('inf'), float('-inf')], None)
        df = df.astype(object).where(pd.notnull(df), None)

        return {
            "logs": df.to_dict(orient="records"),
            "totalBookMin": book_min,
            "totalLaptopMin": laptop_min,
            "sessions": book_sessions + laptop_sessions,
            "activityCount": book_count + laptop_count,
        }
    except Exception as e:
        print("study 로그 로드 실패:", e)
        traceback.print_exc()
        return {"logs": [], "totalBookMin": 0, "totalLaptopMin": 0, "sessions": []}


def find_capture_by_timestamp(prefixes, timestamp: str) -> Optional[str]:
    """
    prefixes: 'water_drinking' 또는 ['study_start', 'study_end', 'study']처럼 리스트
    timestamp: '2025-12-04T20:44:23' 또는 '2025-12-04 20:44:23'
    → Desktop/captures/{prefix}_{YYYY-MM-DD}_{HH-MM}* 를 찾아서 첫 파일을 반환
    """
    if not timestamp:
        return None
    try:
        dt = pd.to_datetime(str(timestamp))
    except Exception:
        return None

    date_str = dt.strftime('%Y-%m-%d')   # 2025-12-04
    time_key = dt.strftime('%H-%M')      # 20-44

    if isinstance(prefixes, str):
        prefixes = [prefixes]

    for p in prefixes:
        pattern = os.path.join(CAPTURES_DIR, f"{p}_{date_str}_{time_key}*")
        matches = glob.glob(pattern)
        if matches:
            return format_capture_url(matches[0])

    return None




# ======================================================================
# ✅ [최종 수정] 프론트엔드 요청(/api/logs/update)을 처리하는 범용 수정 API
# ======================================================================
@app.post("/api/logs/update")
def update_log_generic(payload: LogUpdateRequest):
    """
    프론트엔드 useStudyLogs.js가 보내는 요청을 처리합니다.
    URL: /api/logs/update
    Payload: { source_file, log_id, updates: { key: value } }
    """
    print(f"📥 로그 업데이트 요청: {payload.source_file} / log_id={payload.log_id}")
    
    try:
        # 1. 파일 찾기
        file_path = os.path.join(LOGS_DIR, payload.source_file)
        if not os.path.exists(file_path):
            search_pattern = os.path.join(LOGS_DIR, f"*{payload.source_file}*")
            candidates = glob.glob(search_pattern)
            if candidates:
                file_path = candidates[0]
            else:
                print(f"❌ 파일 찾기 실패: {payload.source_file}")
                raise HTTPException(status_code=404, detail="File not found")

        # 2. CSV 읽기
        df = pd.read_csv(file_path)

        # 3. 키 매핑
        #    - 프론트는 보통 snake_case(book_title, read_pages)를 보냄
        #    - 혹시 camelCase(bookTitle, readPages)가 와도 snake_case로 매핑
        key_map = {
            "bookTitle": "book_title",
            "bookAuthors": "book_authors",
            "bookThumbnail": "book_thumbnail",
            "readPages": "read_pages",
            "totalPages": "total_pages",
            "durationMin": "duration_min",
        }

        updates = payload.updates or {}
        # 파일 전체 업데이트는 명시적으로 "all" 또는 빈 값일 때만 처리
        # (0 은 실제 첫 번째 로그 인덱스로 사용)
        is_file_wide_update = str(payload.log_id) in ("all", "")

        # 4. 업데이트 적용
        for key, value in updates.items():
            # 4-1. 컬럼명 결정 (우선: snake_case / 보조: key_map)
            col_name = key
            if col_name not in df.columns and key in key_map:
                col_name = key_map[key]

            if col_name not in df.columns:
                # 컬럼이 없으면 새로 만들 수도 있지만, 일단 경고만 찍고 스킵
                print(f"⚠️ CSV에 '{col_name}' 컬럼이 없어 스킵됨. (원래 키: {key})")
                continue

            if is_file_wide_update:
                # 파일 내 모든 행 업데이트 (책 정보 수정 시)
                df.loc[:, col_name] = value
            else:
                # 개별 로그 수정 (manual update)
                try:
                    idx = int(payload.log_id)
                    if 0 <= idx < len(df):
                        df.at[idx, col_name] = value
                except ValueError:
                    print(f"⚠️ log_id가 숫자가 아님: {payload.log_id}")
                    continue

        # 5. 저장
        df.to_csv(file_path, index=False, encoding="utf-8-sig")
        print("✅ 로그 업데이트 저장 완료:", file_path)
        
        return {"status": "success"}

    except HTTPException:
        raise
    except Exception as e:
        print("❌ 저장 중 오류 발생:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze")
async def analyze_image(request: AnalysisRequest):
    if VISION_MODEL is None:
        print("⚠️ VISION_MODEL 미초기화")
        return {"result": "Analysis Failed"}

    image_path = os.path.join(CAPTURES_DIR, request.image_filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        img = genai.upload_file(path=image_path)
        prompt = "이 사진 속 음료가 무엇인지 한 단어로 말해줘(예: 콜라, 물, 커피). 컵만 보이면 물."
        response = VISION_MODEL.generate_content([prompt, img])
        return {"result": response.text.strip()}
    except Exception as e:
        print("❌ Image analysis error:", e)
        traceback.print_exc()
        return {"result": "Analysis Failed"}


@app.post("/api/summary")
async def generate_summary(request: SummaryRequest):
    if TEXT_MODEL is None:
        return {
            "summary": (
                "오늘은 물과 공부 기록을 차분히 쌓아가는 하루였어요. "
                "내일도 너무 무리하지 말고 꾸준한 페이스를 이어가면 좋겠어요."
            )
        }

    try:
        # 물/공부 달성 여부
        water_achieved = "달성" if request.waterMl >= request.waterGoal else "부족"
        study_achieved = "달성" if request.studyMin >= request.studyGoal else "부족"

        # 기본 정보 정리
        base_info = f"""
- 물 섭취: {request.waterMl}ml / 목표 {request.waterGoal}ml ({water_achieved})
- 공부: {request.studyMin}분 / 목표 {request.studyGoal}분 ({study_achieved})
"""

        # 💻 노트북 활동 요약
        laptop_section = ""
        if request.laptopInfo and request.laptopInfo.durationMin > 0:
            laptop = request.laptopInfo
            category_names = {
                "lecture": "강의 시청",
                "assignment": "과제",
                "coding": "코딩",
                "youtube": "YouTube",
                "game": "게임",
            }
            cat_name = category_names.get(laptop.category, laptop.category)
            laptop_section = f"- 노트북 활동: {cat_name} {laptop.durationMin}분\n"

        # 📚 책 정보
        book_section = ""
        if request.bookInfo and (request.bookInfo.title or request.bookInfo.description):
            book = request.bookInfo
            purpose_text = "학습 목적" if book.purpose == "study" else "취미 독서"
            book_section = f"""
- 오늘 읽은 책: "{book.title or '제목 미기록'}"
- 저자: {', '.join(book.authors) if book.authors else '미상'}
- 읽은 페이지: {book.readPages}p / {book.totalPages}p
- 독서 시간: {book.durationMin}분
- 독서 목적: {purpose_text}
- 책 설명: {book.description[:200] if book.description else '설명 없음'}
"""

        # 📌 통합 프롬프트 — 하루 요약 + 물 + 공부 + 노트북 + 독서(있으면)
        prompt = f"""
당신은 차분하고 따뜻한 하루 리포트 코치입니다.

[오늘의 기록]
{base_info}{laptop_section}{book_section}

[작성 규칙]
1) 첫 1~2문장은 물 섭취와 공부 목표 달성 정도를 중심으로,
   "오늘은 ~한 하루였어요" 형태로 하루 전체를 자연스럽게 요약하세요.

2) 다음 1~2문장은 물 섭취 습관에 대한 구체적인 피드백과
   내일을 위한 한두 가지 현실적인 제안을 적어 주세요
   (너무 과장되거나 명령조인 표현은 피하기).

3) 그 다음 1~2문장은 공부/집중 패턴에 대한 피드백과
   목표 달성에 도움이 될 차분한 조언을 적어 주세요.

4) 마지막 1~2문장은 오늘 읽은 책이 마음과 하루에
   어떤 여운이나 작은 변화를 남겼는지 요약해 주세요.
   줄거리 설명은 최소화하고 감정·성장 중심으로 작성하세요.
   (만약 독서 기록이 없다면 이 항목은 자연스럽게 생략하세요.)

5) 전체는 5~7문장, 존댓말, 차분하지만 따뜻한 톤.
   지나치게 극적인 표현이나 과장된 격려는 피하세요.
"""

        # 🔥 AI 실행
        response = TEXT_MODEL.generate_content(prompt)
        summary = ' '.join(response.text.strip().split())

        return {"summary": summary}

    except Exception as e:
        print("❌ AI summary error:", e)
        traceback.print_exc()
        return {
            "summary": "오늘은 물과 공부 기록을 차분히 쌓아가는 하루였어요. 내일도 무리하지 말고 편안하게 이어가보세요."
        }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
