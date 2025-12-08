# 파일명: server.py
# ============================================================
# Personal Healthcare Assistant - Backend Server
# - Gemini AI 연동 (버튼 클릭 시에만 호출)
# - Water/Study 로그 API (날짜별 여러 CSV 병합)
# ============================================================

import os
from dotenv import load_dotenv
import glob
import pandas as pd
from typing import Optional, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import google.generativeai as genai
import uvicorn
from datetime import datetime

# ==========================================
# Gemini API 설정
# ==========================================
# Load environment from a .env file (if present) so local development works
load_dotenv()

# 사용자 제공 키 (환경변수로 관리). 에러 메시지는 명확하게 전달.
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("Missing required environment variable: GOOGLE_API_KEY. Set it in your environment or in a local .env file.")
genai.configure(api_key=GOOGLE_API_KEY)

# ==========================================
# 데이터 경로 설정
# ==========================================
DATA_DIR = os.environ.get("DATA_DIR", r"C:\Users\gaeun\Desktop")
LOGS_DIR = os.path.join(DATA_DIR, "logs")
CAPTURES_DIR = os.path.join(DATA_DIR, "captures")

print(f"--- 서버 설정 확인 ---")
print(f"데이터 경로: {DATA_DIR}")
print(f"로그 폴더 존재 여부: {os.path.exists(LOGS_DIR)}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.path.exists(CAPTURES_DIR):
    app.mount("/captures", StaticFiles(directory=CAPTURES_DIR), name="captures")


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
    durationMin: int = 0
    description: str = ""
    purpose: str = "study"  # study | etc

class LaptopInfo(BaseModel):
    category: str = "lecture"
    durationMin: int = 0
    isStudy: bool = True

class SummaryRequest(BaseModel):
    date: str
    waterMl: int
    waterGoal: int
    studyMin: int
    studyGoal: int
    bookInfo: Optional[BookInfo] = None
    laptopInfo: Optional[LaptopInfo] = None


def get_csv_files_for_date(prefix: str, date_str: str) -> list:
    """
    prefix(water/study) + 날짜가 파일명에 포함된 모든 CSV 파일 검색
    예:
    - water_log_2025-12-04-20-44.csv
    - study_2025-12-04_09-12-30.csv
    """
    pattern = os.path.join(LOGS_DIR, f"{prefix}*{date_str}*.csv")
    files = glob.glob(pattern)

    print(f"[DEBUG] glob pattern: {pattern}")
    print(f"[DEBUG] found files: {files}")

    return list(set(files))



def parse_timestamp_from_filename(filename: str) -> str:
    """
    파일명에서 타임스탬프 추출
    
    지원하는 형식:
    1. study_log_2025-12-04-21-30.csv -> 2025-12-04T21:30:00
    2. study_2025-12-06_09-12-30.csv -> 2025-12-06T09:12:30
    """
    import re
    basename = os.path.basename(filename).replace('.csv', '')
    
    # 형식 1: prefix_log_2025-12-04-21-30 (날짜-시간 연결)
    match1 = re.search(r'(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})', basename)
    if match1:
        date_part = match1.group(1)  # 2025-12-04
        hour = match1.group(2)        # 21
        minute = match1.group(3)      # 30
        return f"{date_part}T{hour}:{minute}:00"
    
    # 형식 2: prefix_2025-12-06_09-12-30 (언더스코어 구분)
    match2 = re.search(r'(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})', basename)
    if match2:
        date_part = match2.group(1)
        time_part = match2.group(2).replace('-', ':')
        return f"{date_part}T{time_part}"
    
    return None


def merge_csv_files(files: list) -> pd.DataFrame:
    """여러 CSV 파일을 하나의 DataFrame으로 병합"""
    if not files:
        return pd.DataFrame()
    
    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f)
            if not df.empty:
                # 파일명에서 기본 타임스탬프 추출
                file_ts = parse_timestamp_from_filename(f)
                if file_ts and 'timestamp' not in df.columns:
                    df['timestamp'] = file_ts
                df['source_file'] = os.path.basename(f)
                dfs.append(df)
        except Exception as e:
            print(f"Error reading {f}: {e}")
    
    if not dfs:
        return pd.DataFrame()
    
    merged = pd.concat(dfs, ignore_index=True)
    
    # timestamp 기준 정렬
    if 'timestamp' in merged.columns:
        merged = merged.sort_values('timestamp').reset_index(drop=True)
    
    return merged


def format_capture_url(path):
    """캡처 이미지 URL 생성"""
    if pd.isna(path) or str(path).lower() == 'nan' or 'Started' in str(path):
        return None
    filename = os.path.basename(str(path))
    return f"http://localhost:8000/captures/{filename}"


def calculate_study_duration_per_file(df: pd.DataFrame, obj_type: str) -> tuple:
    """
    CSV 파일별로 공부 시간 계산
    반환: (총 시간(분), 활동 개수, 세션 정보 리스트)
    
    중요: 한 CSV = 한 활동 (첫 로그 ~ 마지막 로그)
    """
    if 'object' not in df.columns or 'source_file' not in df.columns:
        return 0, 0, []
    
    type_df = df[df['object'].str.lower() == obj_type.lower()]
    
    if type_df.empty or 'timestamp' not in type_df.columns:
        return 0, 0, []
    
    total_min = 0
    sessions = []
    
    # source_file별로 그룹핑 (각 CSV = 하나의 활동)
    for source_file, group in type_df.groupby('source_file'):
        try:
            timestamps = group['timestamp'].dropna().tolist()
            if len(timestamps) < 1:
                continue
            
            first_ts = pd.to_datetime(timestamps[0])
            last_ts = pd.to_datetime(timestamps[-1])
            diff_min = int((last_ts - first_ts).total_seconds() / 60)
            duration = max(diff_min, 1)  # 최소 1분
            
            total_min += duration
            sessions.append({
                'source_file': source_file,
                'start_time': first_ts.strftime('%H:%M'),
                'end_time': last_ts.strftime('%H:%M'),
                'duration_min': duration,
                'log_count': len(timestamps)
            })
        except Exception as e:
            print(f"Error calculating duration for {source_file}: {e}")
            continue
    
    return total_min, len(sessions), sessions


# ==========================================
# API 엔드포인트
# ==========================================

@app.get("/")
def read_root():
    return {"status": "Server running", "data_path": DATA_DIR}


@app.get("/api/logs/water/{date_str}")
def get_water_logs(date_str: str):
    """날짜별 모든 Water CSV 파일 병합 후 반환"""
    files = get_csv_files_for_date("water", date_str)
    
    print(f"[Water] 날짜 {date_str}: 발견된 파일 {files}")
    
    if not files:
        return []
    
    try:
        df = merge_csv_files(files)
        
        if df.empty:
            return []
        
        df['id'] = df.index
        
        # amount 계산: duration_frames를 사용 (없으면 기본값 200ml)
        if 'duration_frames' in df.columns:
            # duration_frames가 물 섭취량(ml)
            df['amount'] = pd.to_numeric(df['duration_frames'], errors='coerce').fillna(200).astype(int)
        elif 'amount' not in df.columns:
            df['amount'] = 200  # 기본 200ml per drink
        
        if 'capture_path' in df.columns:
            df['imageUrl'] = df['capture_path'].apply(format_capture_url)
            df['imageFile'] = df['capture_path'].apply(
                lambda x: os.path.basename(str(x)) if isinstance(x, str) else None
            )
        
        if 'ai_result' not in df.columns:
            df['ai_result'] = "Not Analyzed"
        
        df = df.replace([float('inf'), float('-inf')], None)
        df = df.astype(object).where(pd.notnull(df), None)
        
        print(f"[Water] 총 {len(df)}개 로그, 총량: {df['amount'].sum()}ml")
        
        return df.to_dict(orient="records")
        
    except Exception as e:
        print(f"Error: {e}")
        return []


@app.get("/api/logs/study/{date_str}")
def get_study_logs(date_str: str):
    """
    날짜별 모든 Study CSV 파일 병합 후 반환
    
    핵심: 한 CSV 파일 = 한 활동 (세션)
    각 CSV 파일 내에서 첫 로그 ~ 마지막 로그 시간 차이 = 해당 활동의 duration
    """
    files = get_csv_files_for_date("study", date_str)
    
    if not files:
        return {"logs": [], "totalBookMin": 0, "totalLaptopMin": 0, "sessions": []}
    
    try:
        df = merge_csv_files(files)
        
        if df.empty:
            return {"logs": [], "totalBookMin": 0, "totalLaptopMin": 0, "sessions": []}
        
        # CSV 파일별로 공부 시간 계산 (핵심!)
        book_min, book_count, book_sessions = calculate_study_duration_per_file(df, 'book')
        laptop_min, laptop_count, laptop_sessions = calculate_study_duration_per_file(df, 'laptop')
        
        # 로그 데이터 가공
        df['id'] = df.index
        
        if 'capture_path' in df.columns:
            df['imageUrl'] = df['capture_path'].apply(format_capture_url)
            df['imageFile'] = df['capture_path'].apply(
                lambda x: os.path.basename(str(x)) if isinstance(x, str) else None
            )
        
        if 'object' in df.columns:
            df['type'] = df['object'].apply(lambda x: str(x).lower() if pd.notna(x) else 'laptop')
        
        if 'timestamp' in df.columns:
            df['time'] = df['timestamp'].apply(
                lambda x: str(x).split('T')[1][:5] if pd.notna(x) and 'T' in str(x) 
                else (str(x).split(' ')[1][:5] if pd.notna(x) and ' ' in str(x) else None)
            )
        
        df = df.replace([float('inf'), float('-inf')], None)
        df = df.astype(object).where(pd.notnull(df), None)
        
        # 전체 세션 정보 (Book + Laptop)
        all_sessions = book_sessions + laptop_sessions
        
        return {
            "logs": df.to_dict(orient="records"),
            "totalBookMin": book_min,
            "totalLaptopMin": laptop_min,
            "sessions": all_sessions,
            "activityCount": book_count + laptop_count
        }
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return {"logs": [], "totalBookMin": 0, "totalLaptopMin": 0, "sessions": []}


@app.post("/api/analyze")
async def analyze_image(request: AnalysisRequest):
    """이미지 분석 (음료 감지)"""
    image_path = os.path.join(CAPTURES_DIR, request.image_filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image not found")
    
    try:
        # gemini-pro-vision은 이미지 분석용
        model = genai.GenerativeModel('models/gemini-2.5-flash')
        img = genai.upload_file(image_path)
        prompt = "이 사진 속 음료가 무엇인지 한 단어로 말해줘(예: 콜라, 물, 커피). 컵만 보이면 물."
        response = model.generate_content([prompt, img])
        return {"result": response.text.strip()}
    except Exception as e:
        print(f"Image analysis error: {e}")
        return {"result": "Analysis Failed"}


@app.post("/api/summary")
async def generate_summary(request: SummaryRequest):
    """
    AI Daily Summary 생성 (버튼 클릭 시에만 호출)
    - 물, 공부 시간 요약
    - 책 읽은 경우: 책 제목, 읽은 페이지, 줄거리 기반 독서 조언
    """
    try:
        model = genai.GenerativeModel("models/gemini-2.5-flash")
        
        water_achieved = "달성" if request.waterMl >= request.waterGoal else "부족"
        study_achieved = "달성" if request.studyMin >= request.studyGoal else "부족"
        
        # 기본 정보
        base_info = f"""
- 물: {request.waterMl}ml / 목표 {request.waterGoal}ml ({water_achieved})
- 공부: {request.studyMin}분 / 목표 {request.studyGoal}분 ({study_achieved})
"""
        
        # 책 정보 추가
        book_section = ""
        if request.bookInfo and request.bookInfo.title:
            book = request.bookInfo
            purpose_text = "학습 목적" if book.purpose == "study" else "취미 독서"
            book_section = f"""
- 오늘 읽은 책: "{book.title}"
- 저자: {', '.join(book.authors) if book.authors else '미상'}
- 읽은 페이지: {book.readPages}p / {book.totalPages}p
- 독서 시간: {book.durationMin}분
- 독서 목적: {purpose_text}
- 책 설명: {book.description[:200] if book.description else '설명 없음'}
"""
        
        # 노트북 정보 추가
        laptop_section = ""
        if request.laptopInfo and request.laptopInfo.durationMin > 0:
            laptop = request.laptopInfo
            category_names = {
                'lecture': '강의 시청',
                'assignment': '과제',
                'coding': '코딩',
                'youtube': 'YouTube',
                'game': '게임'
            }
            cat_name = category_names.get(laptop.category, laptop.category)
            laptop_section = f"""
- 노트북 활동: {cat_name} ({laptop.durationMin}분)
"""
        
        # 프롬프트 구성
        if book_section:
            prompt = f"""
당신은 따뜻하고 지적인 독서 코치입니다. 오늘 기록:
{base_info}
{book_section}
{laptop_section}

요구사항:
1. 첫 문단: "오늘은 ~한 하루였어요"로 시작하여 물과 공부 달성도를 간단히 언급 (2문장)
2. 두번째 문단: 읽은 책에 대해 구체적으로 언급하고, 책의 내용/주제를 바탕으로 독서 시 생각해볼 만한 포인트나 조언을 1-2문장으로 제시
3. 부드러운 격려로 마무리 (1문장)
4. 전체 4-5문장, 자연스러운 단락으로 작성
5. 목록/선택지/이모지/예시/불릿 금지
"""
        else:
            prompt = f"""
당신은 하루 요약 코치입니다. 오늘 기록:
{base_info}
{laptop_section}

요구사항:
- 2~3문장, 한 단락
- 따뜻한 어조로 "오늘은 ~한 하루였어요"로 시작
- 물과 공부를 모두 언급, 목표 대비 달성/부족을 간단히 언급
- 부드러운 격려와 가벼운 조언을 포함
- 목록/선택지/이모지/예시/불릿 금지
"""

        response = model.generate_content(prompt)
        summary = ' '.join(response.text.strip().split())
        
        return {"summary": summary}
        
    except Exception as e:
        print(f"Gemini API error: {e}")
        # Fallback
        return {"summary": "오늘은 물과 공부 기록을 천천히 쌓아가는 하루였어요. 내일도 건강한 습관을 이어가봐요."}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)