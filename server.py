import os
import sqlite3
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

DB_PATH = os.path.join(os.path.dirname(__file__), "database.sqlite")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        # Table 1: Attendance days
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                day INTEGER NOT NULL,
                shift TEXT NOT NULL,
                std REAL,
                actual REAL,
                ot130 REAL,
                ot150 REAL,
                ot200 REAL,
                ot210 REAL,
                ot270 REAL,
                ot300 REAL,
                ot390 REAL,
                updated_at TEXT,
                PRIMARY KEY (year, month, day)
            )
        """)
        
        # Table 2: Salary Configuration & Allowances
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS salary_config (
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                base_salary REAL DEFAULT 6300000,
                pos_allowance REAL DEFAULT 2450000,
                sen_allowance REAL DEFAULT 100000,
                kpi_coeff REAL DEFAULT 1.0,
                allowance_gas REAL DEFAULT 500000,
                allowance_house REAL DEFAULT 500000,
                allowance_child REAL DEFAULT 0,
                allowance_safety REAL DEFAULT 0,
                allowance_night REAL DEFAULT 0,
                allowance_meal_night REAL DEFAULT 0,
                allowance_period REAL DEFAULT 0,
                allowance_other REAL DEFAULT 0,
                bonus_attendance REAL DEFAULT 600000,
                bonus_kpi REAL DEFAULT 3050000,
                is_tax_exempt INTEGER DEFAULT 1,
                bank_account TEXT DEFAULT 'STK: 102884878810',
                bank_name TEXT DEFAULT 'VietinBank',
                updated_at TEXT,
                PRIMARY KEY (year, month)
            )
        """)

        # Table 3: App Settings (Google Drive Webhook, etc.)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT
            )
        """)
        conn.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_sample_if_empty()
    yield

app = FastAPI(title="Hệ Thống Chấm Công & Tính Lương", lifespan=lifespan)

# Allow CORS for any origin so user can run from anywhere
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- PYDANTIC SCHEMAS -----------------
class DayAttendance(BaseModel):
    shift: Optional[str] = "day"
    std: Optional[Any] = None
    actual: Optional[Any] = None
    ot130: Optional[Any] = None
    ot150: Optional[Any] = None
    ot200: Optional[Any] = None
    ot210: Optional[Any] = None
    ot270: Optional[Any] = None
    ot300: Optional[Any] = None
    ot390: Optional[Any] = None

class MonthAttendancePayload(BaseModel):
    year: int
    month: int
    days: Dict[int, DayAttendance]

class SalaryConfigPayload(BaseModel):
    year: int
    month: int
    base_salary: Optional[float] = 6300000
    pos_allowance: Optional[float] = 2450000
    sen_allowance: Optional[float] = 100000
    kpi_coeff: Optional[float] = 1.0
    allowance_gas: Optional[float] = 500000
    allowance_house: Optional[float] = 500000
    allowance_child: Optional[float] = 0
    allowance_safety: Optional[float] = 0
    allowance_night: Optional[float] = 0
    allowance_meal_night: Optional[float] = 0
    allowance_period: Optional[float] = 0
    allowance_other: Optional[float] = 0
    bonus_attendance: Optional[float] = 600000
    bonus_kpi: Optional[float] = 3050000
    is_tax_exempt: Optional[int] = 1
    bank_account: Optional[str] = "STK: 102884878810"
    bank_name: Optional[str] = "VietinBank"

def to_num(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except:
        return None

def seed_sample_if_empty():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM attendance")
        cnt = cursor.fetchone()["count"]
        if cnt == 0:
            # Seed Month 12 (Day Shift sample) and Month 11 (Night Shift sample) for 2026
            year = 2026
            now_iso = datetime.now().isoformat()
            
            # Month 12
            for d in range(1, 32):
                dt = datetime(year, 12, d)
                is_sun = (dt.weekday() == 6)
                if is_sun:
                    shift, std, act, ot150, ot200 = "off", None, None, 3, None
                elif d in [3, 10, 17]:
                    shift, std, act, ot150, ot200 = "day", 8, 8, None, 11
                elif d == 24:
                    shift, std, act, ot150, ot200 = "day", 8, 8, None, None
                else:
                    shift, std, act, ot150, ot200 = "day", 8, 8, 3, None
                
                cursor.execute("""
                    INSERT OR REPLACE INTO attendance 
                    (year, month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (year, 12, d, shift, std, act, None, ot150, ot200, None, None, None, None, now_iso))
            
            # Month 11
            for d in range(1, 31):
                dt = datetime(year, 11, d)
                is_sun = (dt.weekday() == 6)
                if is_sun:
                    if d == 1:
                        shift, std, act, ot130, ot150, ot200, ot210, ot270 = "off", None, None, None, None, None, None, None
                    else:
                        shift, std, act, ot130, ot150, ot200, ot210, ot270 = "night", None, None, None, None, 4.5 if d in [8, 15] else 4, None, 7.75
                elif d == 24:
                    shift, std, act, ot130, ot150, ot200, ot210, ot270 = "day", 8, 8, None, None, None, None, None
                elif d in [6, 9, 12, 21, 28]:
                    shift, std, act, ot130, ot150, ot200, ot210, ot270 = "night", 8, 2, 6, 2.5, None, 1.75, None
                elif d == 10:
                    shift, std, act, ot130, ot150, ot200, ot210, ot270 = "night", 8, 2, 6, 3, None, 1.75, None
                elif d == 20:
                    shift, std, act, ot130, ot150, ot200, ot210, ot270 = "night", 8, 2, 6, 2, None, 6.05, None
                elif d in [7, 14]:
                    shift, std, act, ot130, ot150, ot200, ot210, ot270 = "night", 8, 2, 6, 1.5, None, 1.75, None
                else:
                    shift, std, act, ot130, ot150, ot200, ot210, ot270 = "night", 8, 2, 6, 2, None, 1.75, None
                
                cursor.execute("""
                    INSERT OR REPLACE INTO attendance 
                    (year, month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (year, 11, d, shift, std, act, ot130, ot150, ot200, ot210, ot270, None, None, now_iso))
            
            # Default Configs
            cursor.execute("""
                INSERT OR REPLACE INTO salary_config 
                (year, month, base_salary, pos_allowance, sen_allowance, kpi_coeff, allowance_gas, allowance_house, 
                 allowance_night, allowance_meal_night, bonus_attendance, bonus_kpi, is_tax_exempt, updated_at)
                VALUES (2026, 12, 6300000, 2450000, 100000, 1.0, 500000, 500000, 0, 0, 600000, 3050000, 1, ?)
            """, (now_iso,))
            
            cursor.execute("""
                INSERT OR REPLACE INTO salary_config 
                (year, month, base_salary, pos_allowance, sen_allowance, kpi_coeff, allowance_gas, allowance_house, 
                 allowance_night, allowance_meal_night, bonus_attendance, bonus_kpi, is_tax_exempt, updated_at)
                VALUES (2026, 11, 6300000, 2450000, 100000, 1.0, 500000, 500000, 780000, 650000, 600000, 3050000, 1, ?)
            """, (now_iso,))
            
            conn.commit()

# ----------------- API ROUTES -----------------
@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "message": "Backend Chấm Công & Tính Lương đang hoạt động",
        "database": "SQLite",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/attendance/{year}/{month}")
def get_attendance(year: int, month: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390 
            FROM attendance 
            WHERE year = ? AND month = ?
            ORDER BY day ASC
        """, (year, month))
        rows = cursor.fetchall()
        
        days_dict = {}
        for r in rows:
            days_dict[r["day"]] = {
                "shift": r["shift"],
                "std": r["std"] if r["std"] is not None else "",
                "actual": r["actual"] if r["actual"] is not None else "",
                "ot130": r["ot130"] if r["ot130"] is not None else "",
                "ot150": r["ot150"] if r["ot150"] is not None else "",
                "ot200": r["ot200"] if r["ot200"] is not None else "",
                "ot210": r["ot210"] if r["ot210"] is not None else "",
                "ot270": r["ot270"] if r["ot270"] is not None else "",
                "ot300": r["ot300"] if r["ot300"] is not None else "",
                "ot390": r["ot390"] if r["ot390"] is not None else "",
            }
        return {"year": year, "month": month, "days": days_dict}

@app.post("/api/attendance/{year}/{month}")
def save_month_attendance(year: int, month: int, payload: MonthAttendancePayload, background_tasks: BackgroundTasks):
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        for day, item in payload.days.items():
            cursor.execute("""
                INSERT OR REPLACE INTO attendance 
                (year, month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                year, month, int(day), item.shift or "day",
                to_num(item.std), to_num(item.actual),
                to_num(item.ot130), to_num(item.ot150), to_num(item.ot200),
                to_num(item.ot210), to_num(item.ot270), to_num(item.ot300), to_num(item.ot390),
                now_iso
            ))
        conn.commit()
    
    # Auto-sync to Google Drive in background if configured
    background_tasks.add_task(trigger_gdrive_sync)
    return {"success": True, "message": f"Đã lưu chấm công Tháng {month}/{year} thành công."}

@app.get("/api/config/{year}/{month}")
def get_salary_config(year: int, month: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM salary_config WHERE year = ? AND month = ?", (year, month))
        row = cursor.fetchone()
        if not row:
            # Fallback to general default
            return {
                "year": year,
                "month": month,
                "base_salary": 6300000,
                "pos_allowance": 2450000,
                "sen_allowance": 100000,
                "kpi_coeff": 1.0,
                "allowance_gas": 500000,
                "allowance_house": 500000,
                "allowance_child": 0,
                "allowance_safety": 0,
                "allowance_night": 780000 if month == 11 else 0,
                "allowance_meal_night": 650000 if month == 11 else 0,
                "allowance_period": 0,
                "allowance_other": 0,
                "bonus_attendance": 600000,
                "bonus_kpi": 3050000,
                "is_tax_exempt": 1,
                "bank_account": "STK: 102884878810",
                "bank_name": "VietinBank"
            }
        return dict(row)

@app.post("/api/config/{year}/{month}")
def save_salary_config(year: int, month: int, payload: SalaryConfigPayload, background_tasks: BackgroundTasks):
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO salary_config 
            (year, month, base_salary, pos_allowance, sen_allowance, kpi_coeff, 
             allowance_gas, allowance_house, allowance_child, allowance_safety, 
             allowance_night, allowance_meal_night, allowance_period, allowance_other, 
             bonus_attendance, bonus_kpi, is_tax_exempt, bank_account, bank_name, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            year, month,
            payload.base_salary, payload.pos_allowance, payload.sen_allowance, payload.kpi_coeff,
            payload.allowance_gas, payload.allowance_house, payload.allowance_child, payload.allowance_safety,
            payload.allowance_night, payload.allowance_meal_night, payload.allowance_period, payload.allowance_other,
            payload.bonus_attendance, payload.bonus_kpi, payload.is_tax_exempt, payload.bank_account, payload.bank_name,
            now_iso
        ))
        conn.commit()
    
    # Auto-sync to Google Drive in background if configured
    background_tasks.add_task(trigger_gdrive_sync)
    return {"success": True, "message": f"Đã lưu cấu hình lương Tháng {month}/{year} thành công."}

# ----------------- GOOGLE DRIVE SYNC ENGINE -----------------
class GDriveSettingsPayload(BaseModel):
    webhook_url: str

def get_excel_base64():
    """Lấy nội dung file Excel Bang_Cham_Cong_Tu_Dong.xlsx dưới dạng base64."""
    import base64
    excel_path = os.path.join(os.path.dirname(__file__), "Bang_Cham_Cong_Tu_Dong.xlsx")
    if os.path.exists(excel_path):
        with open(excel_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    return None

def trigger_gdrive_sync():
    """Tự động đồng bộ file Excel (.xlsx) lên Google Drive (ghi đè vào 1 file duy nhất)."""
    import urllib.request
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value FROM settings WHERE key = 'gdrive_webhook_url'")
            row = cursor.fetchone()
            if not row or not row["value"]:
                return
            webhook_url = row["value"].strip()
            if not webhook_url.startswith("http"):
                return
            
            cursor.execute("SELECT * FROM attendance ORDER BY year, month, day")
            att_rows = [dict(r) for r in cursor.fetchall()]
            cursor.execute("SELECT * FROM salary_config ORDER BY year, month")
            cfg_rows = [dict(r) for r in cursor.fetchall()]

            excel_b64 = get_excel_base64()
            payload = {
                "source": "BangCongAutoBackup",
                "export_time": datetime.now().isoformat(),
                "file_name": "Bang_Cham_Cong_Tu_Dong.xlsx",
                "excel_base64": excel_b64,
                "total_records": len(att_rows),
                "attendance": att_rows,
                "salary_config": cfg_rows
            }

            req = urllib.request.Request(
                webhook_url,
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "BangCongApp/1.0"}
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                now_iso = datetime.now().isoformat()
                cursor.execute("""
                    INSERT OR REPLACE INTO settings (key, value, updated_at)
                    VALUES ('last_gdrive_sync', ?, ?)
                """, (now_iso, now_iso))
                conn.commit()
                print(f"[GDrive Sync] Auto-synced Excel file (.xlsx) to Google Drive successfully at {now_iso}")
    except Exception as e:
        print(f"[GDrive Sync Warning]: {e}")

@app.get("/api/settings/gdrive")
def get_gdrive_settings():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM settings WHERE key = 'gdrive_webhook_url'")
        url_row = cursor.fetchone()
        cursor.execute("SELECT value FROM settings WHERE key = 'last_gdrive_sync'")
        sync_row = cursor.fetchone()
        return {
            "webhook_url": url_row["value"] if url_row else "",
            "last_sync": sync_row["value"] if sync_row else None
        }

@app.post("/api/settings/gdrive")
def save_gdrive_settings(payload: GDriveSettingsPayload, background_tasks: BackgroundTasks):
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO settings (key, value, updated_at)
            VALUES ('gdrive_webhook_url', ?, ?)
        """, (payload.webhook_url.strip(), now_iso))
        conn.commit()
    
    if payload.webhook_url.strip():
        background_tasks.add_task(trigger_gdrive_sync)
    
    return {"success": True, "message": "Đã lưu cấu hình Google Drive Webhook thành công."}

@app.post("/api/sync-gdrive")
def manual_sync_gdrive(background_tasks: BackgroundTasks):
    background_tasks.add_task(trigger_gdrive_sync)
    return {"success": True, "message": "Đang đồng bộ dữ liệu lên Google Drive trong nền."}

@app.get("/api/backup")
def export_backup():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attendance")
        att_rows = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT * FROM salary_config")
        cfg_rows = [dict(r) for r in cursor.fetchall()]
    return {
        "export_time": datetime.now().isoformat(),
        "attendance": att_rows,
        "salary_config": cfg_rows
    }

# ----------------- STATIC FRONTEND SERVING -----------------
# Serve current directory static files so frontend and backend run seamlessly on same port
app.mount("/static", StaticFiles(directory=os.path.dirname(__file__)), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(os.path.dirname(__file__), "index.html"))

@app.get("/{filename}")
def read_static(filename: str):
    file_path = os.path.join(os.path.dirname(__file__), filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("\n" + "="*60)
    print("  🚀 HỆ THỐNG CHẤM CÔNG & TÍNH LƯƠNG - BACKEND ĐANG KHỞI CHẠY")
    print(f"  🌐 Truy cập trang chủ: http://localhost:{port}")
    print(f"  📑 Tài liệu API Swagger: http://localhost:{port}/docs")
    print("  🗄️ CSDL SQLite: database.sqlite")
    print("="*60 + "\n")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
