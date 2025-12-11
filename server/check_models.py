from pathlib import Path
from dotenv import load_dotenv
import os
import google.generativeai as genai

BASE_DIR = Path(__file__).resolve().parent      # server/
ROOT_DIR = BASE_DIR.parent                     # 프로젝트 루트
ENV_PATH = ROOT_DIR / ".env"

print("[DEBUG] ENV_PATH =", ENV_PATH)
print("[DEBUG] exists =", ENV_PATH.exists())

# ✅ 무조건 이 파일만 로드
load_dotenv(dotenv_path=ENV_PATH, override=True)

print("[DEBUG] GOOGLE_API_KEY =", os.environ.get("GOOGLE_API_KEY"))

if not os.environ.get("GOOGLE_API_KEY"):
    raise SystemExit("❌ GOOGLE_API_KEY still None")

genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

print("=== AVAILABLE MODELS ===")
for m in genai.list_models():
    print(m.name, getattr(m, "supported_generation_methods", []))
