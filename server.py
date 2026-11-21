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
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        # Table 0: Employees
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                dept TEXT,
                card_id TEXT,
                start_date TEXT,
                probation_end_date TEXT,
                annual_leave_total REAL DEFAULT 10,
                created_at TEXT,
                updated_at TEXT
            )
        """)
        cursor.execute("""
            INSERT OR IGNORE INTO employees (id, name, dept, card_id, start_date, probation_end_date, annual_leave_total)
            VALUES ('emp_default', 'Nguyễn Công Thịnh', '工程部 (Bộ phận Kỹ thuật)', '1028', '21/7/2025', '20/9/2025', 10)
        """)

        # Table 1: Attendance days with foreign key to employees
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                emp_id TEXT NOT NULL DEFAULT 'emp_default',
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
                leave_type TEXT,
                leave_paid REAL,
                leave_unpaid REAL,
                updated_at TEXT,
                PRIMARY KEY (emp_id, year, month, day),
                FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE
            )
        """)
        
        # Table 2: Salary Configuration with foreign key to employees & all bonus fields
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS salary_config (
                emp_id TEXT NOT NULL DEFAULT 'emp_default',
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
                bonus_full_attendance REAL DEFAULT 0,
                bonus_efficiency REAL DEFAULT 0,
                bonus_quality_star REAL DEFAULT 0,
                bonus_performance REAL DEFAULT 0,
                bonus_kpi REAL DEFAULT 3050000,
                bonus_recruitment REAL DEFAULT 0,
                is_tax_exempt INTEGER DEFAULT 1,
                bank_account TEXT DEFAULT 'STK: 102884878810',
                bank_name TEXT DEFAULT 'VietinBank',
                updated_at TEXT,
                PRIMARY KEY (emp_id, year, month),
                FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE
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
    leave_type: Optional[str] = ""
    leave_paid: Optional[float] = 0
    leave_unpaid: Optional[float] = 0

class MonthAttendancePayload(BaseModel):
    emp_id: Optional[str] = "emp_default"
    year: int
    month: int
    days: Dict[int, DayAttendance]

class SalaryConfigPayload(BaseModel):
    emp_id: Optional[str] = "emp_default"
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
    bonus_full_attendance: Optional[float] = 0
    bonus_efficiency: Optional[float] = 0
    bonus_quality_star: Optional[float] = 0
    bonus_performance: Optional[float] = 0
    bonus_kpi: Optional[float] = 3050000
    bonus_recruitment: Optional[float] = 0
    is_tax_exempt: Optional[int] = 1
    bank_account: Optional[str] = "STK: 102884878810"
    bank_name: Optional[str] = "VietinBank"

class EmployeePayload(BaseModel):
    id: str
    name: str
    dept: Optional[str] = ""
    card_id: Optional[str] = ""
    start_date: Optional[str] = ""
    probation_end_date: Optional[str] = ""
    annual_leave_total: Optional[float] = 10

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
        cursor.execute("SELECT COUNT(*) as count FROM attendance WHERE emp_id = 'emp_default'")
        cnt = cursor.fetchone()["count"]
        if cnt == 0:
            # Seed Month 12 (Day Shift sample) and Month 11 (Night Shift sample) for 2026 for emp_default
            year = 2026
            emp_id = "emp_default"
            now_iso = datetime.now().isoformat()
            
            # Ensure emp_default exists in employees table
            cursor.execute("""
                INSERT OR IGNORE INTO employees (id, name, dept, card_id, start_date, probation_end_date, annual_leave_total)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (emp_id, "Nguyễn Công Thịnh", "工程部 (Bộ phận Kỹ thuật)", "1028", "21/7/2025", "20/9/2025", 10))

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
                    (emp_id, year, month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, leave_type, leave_paid, leave_unpaid, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, 0, ?)
                """, (emp_id, year, 12, d, shift, std, act, None, ot150, ot200, None, None, None, None, now_iso))
            
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
                    (emp_id, year, month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, leave_type, leave_paid, leave_unpaid, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, 0, ?)
                """, (emp_id, year, 11, d, shift, std, act, ot130, ot150, ot200, ot210, ot270, None, None, now_iso))
            
            # Default Configs for emp_default
            cursor.execute("""
                INSERT OR REPLACE INTO salary_config 
                (emp_id, year, month, base_salary, pos_allowance, sen_allowance, kpi_coeff, allowance_gas, allowance_house, 
                 allowance_night, allowance_meal_night, bonus_attendance, bonus_full_attendance, bonus_efficiency,
                 bonus_quality_star, bonus_performance, bonus_kpi, bonus_recruitment, is_tax_exempt, updated_at)
                VALUES (?, 2026, 12, 6300000, 2450000, 100000, 1.0, 500000, 500000, 0, 0, 600000, 0, 0, 0, 0, 3050000, 0, 1, ?)
            """, (emp_id, now_iso))
            
            cursor.execute("""
                INSERT OR REPLACE INTO salary_config 
                (emp_id, year, month, base_salary, pos_allowance, sen_allowance, kpi_coeff, allowance_gas, allowance_house, 
                 allowance_night, allowance_meal_night, bonus_attendance, bonus_full_attendance, bonus_efficiency,
                 bonus_quality_star, bonus_performance, bonus_kpi, bonus_recruitment, is_tax_exempt, updated_at)
                VALUES (?, 2026, 11, 6300000, 2450000, 100000, 1.0, 500000, 500000, 780000, 650000, 600000, 0, 0, 0, 0, 3050000, 0, 1, ?)
            """, (emp_id, now_iso))
            
            conn.commit()

# ----------------- API ROUTES -----------------
@app.get("/api/status")
def get_status():
    return {
        "status": "online",
        "message": "Backend Chấm Công & Tính Lương đang hoạt động (Đa nhân viên)",
        "database": "SQLite (Foreign Key: emp_id)",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/employees")
def list_employees():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM employees ORDER BY rowid ASC")
        rows = cursor.fetchall()
        return {"employees": [dict(r) for r in rows]}

@app.post("/api/employees")
def save_employee(payload: EmployeePayload):
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO employees (id, name, dept, card_id, start_date, probation_end_date, annual_leave_total, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                dept = excluded.dept,
                card_id = excluded.card_id,
                start_date = excluded.start_date,
                probation_end_date = excluded.probation_end_date,
                annual_leave_total = excluded.annual_leave_total,
                updated_at = excluded.updated_at
        """, (payload.id, payload.name, payload.dept, payload.card_id, payload.start_date, payload.probation_end_date, payload.annual_leave_total, now_iso, now_iso))
        conn.commit()
    return {"success": True, "message": f"Đã lưu hồ sơ nhân viên {payload.name}"}

@app.delete("/api/employees/{emp_id}")
def delete_employee(emp_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM employees WHERE id = ?", (emp_id,))
        cursor.execute("DELETE FROM attendance WHERE emp_id = ?", (emp_id,))
        cursor.execute("DELETE FROM salary_config WHERE emp_id = ?", (emp_id,))
        conn.commit()
    return {"success": True, "message": f"Đã xóa nhân viên {emp_id}"}

@app.get("/api/attendance/{year}")
def get_year_attendance(year: int, emp_id: str = Query("emp_default")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, leave_type, leave_paid, leave_unpaid 
            FROM attendance 
            WHERE emp_id = ? AND year = ?
            ORDER BY month ASC, day ASC
        """, (emp_id, year))
        rows = cursor.fetchall()
        months_dict = {}
        for r in rows:
            m = r["month"]
            if m not in months_dict:
                months_dict[m] = {}
            months_dict[m][r["day"]] = {
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
                "leave_type": r["leave_type"] if "leave_type" in r.keys() and r["leave_type"] is not None else "",
                "leave_paid": r["leave_paid"] if "leave_paid" in r.keys() and r["leave_paid"] is not None else 0,
                "leave_unpaid": r["leave_unpaid"] if "leave_unpaid" in r.keys() and r["leave_unpaid"] is not None else 0
            }
        return {"emp_id": emp_id, "year": year, "months": months_dict}

@app.get("/api/attendance/{year}/{month}")
def get_attendance(year: int, month: int, emp_id: str = Query("emp_default")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, leave_type, leave_paid, leave_unpaid 
            FROM attendance 
            WHERE emp_id = ? AND year = ? AND month = ?
            ORDER BY day ASC
        """, (emp_id, year, month))
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
                "leave_type": r["leave_type"] if "leave_type" in r.keys() and r["leave_type"] is not None else "",
                "leave_paid": r["leave_paid"] if "leave_paid" in r.keys() and r["leave_paid"] is not None else 0,
                "leave_unpaid": r["leave_unpaid"] if "leave_unpaid" in r.keys() and r["leave_unpaid"] is not None else 0
            }
        return {"emp_id": emp_id, "year": year, "month": month, "days": days_dict}

@app.post("/api/attendance/{year}/{month}")
def save_month_attendance(year: int, month: int, payload: MonthAttendancePayload, background_tasks: BackgroundTasks, emp_id: Optional[str] = Query(None)):
    target_emp_id = payload.emp_id or emp_id or "emp_default"
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        # Ensure employee row exists
        cursor.execute("INSERT OR IGNORE INTO employees (id, name) VALUES (?, ?)", (target_emp_id, target_emp_id))
        
        for day, item in payload.days.items():
            cursor.execute("""
                INSERT OR REPLACE INTO attendance 
                (emp_id, year, month, day, shift, std, actual, ot130, ot150, ot200, ot210, ot270, ot300, ot390, leave_type, leave_paid, leave_unpaid, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                target_emp_id, year, month, int(day), item.shift or "day",
                to_num(item.std), to_num(item.actual),
                to_num(item.ot130), to_num(item.ot150), to_num(item.ot200),
                to_num(item.ot210), to_num(item.ot270), to_num(item.ot300), to_num(item.ot390),
                item.leave_type or "", to_num(item.leave_paid) or 0, to_num(item.leave_unpaid) or 0,
                now_iso
            ))
        conn.commit()
    
    # Auto-sync to Google Drive in background if configured
    background_tasks.add_task(trigger_gdrive_sync)
    return {"success": True, "emp_id": target_emp_id, "message": f"Đã lưu chấm công Tháng {month}/{year} của nhân viên {target_emp_id} thành công."}

@app.get("/api/config/{year}")
def get_year_config(year: int, emp_id: str = Query("emp_default")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM salary_config WHERE emp_id = ? AND year = ?", (emp_id, year))
        rows = cursor.fetchall()
        return {"emp_id": emp_id, "year": year, "configs": {r["month"]: dict(r) for r in rows}}

@app.get("/api/config/{year}/{month}")
def get_salary_config(year: int, month: int, emp_id: str = Query("emp_default")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM salary_config WHERE emp_id = ? AND year = ? AND month = ?", (emp_id, year, month))
        row = cursor.fetchone()
        if not row:
            # Fallback to general default for this employee
            return {
                "emp_id": emp_id,
                "year": year,
                "month": month,
                "base_salary": 6300000,
                "pos_allowance": 2450000 if emp_id == "emp_default" else 0,
                "sen_allowance": 100000 if emp_id == "emp_default" else 0,
                "kpi_coeff": 1.0,
                "allowance_gas": 500000,
                "allowance_house": 500000,
                "allowance_child": 0,
                "allowance_safety": 0,
                "allowance_night": 780000 if (month == 11 and emp_id == "emp_default") else 0,
                "allowance_meal_night": 650000 if (month == 11 and emp_id == "emp_default") else 0,
                "allowance_period": 0,
                "allowance_other": 0,
                "bonus_attendance": 600000,
                "bonus_full_attendance": 0,
                "bonus_efficiency": 0,
                "bonus_quality_star": 0,
                "bonus_performance": 0,
                "bonus_kpi": 3050000,
                "bonus_recruitment": 0,
                "is_tax_exempt": 1,
                "bank_account": "STK: 102884878810" if emp_id == "emp_default" else "",
                "bank_name": "VietinBank" if emp_id == "emp_default" else ""
            }
        return dict(row)

@app.post("/api/config/{year}/{month}")
def save_salary_config(year: int, month: int, payload: SalaryConfigPayload, background_tasks: BackgroundTasks, emp_id: Optional[str] = Query(None)):
    target_emp_id = payload.emp_id or emp_id or "emp_default"
    now_iso = datetime.now().isoformat()
    with get_db() as conn:
        cursor = conn.cursor()
        # Ensure employee exists
        cursor.execute("INSERT OR IGNORE INTO employees (id, name) VALUES (?, ?)", (target_emp_id, target_emp_id))
        
        cursor.execute("""
            INSERT OR REPLACE INTO salary_config 
            (emp_id, year, month, base_salary, pos_allowance, sen_allowance, kpi_coeff, 
             allowance_gas, allowance_house, allowance_child, allowance_safety, 
             allowance_night, allowance_meal_night, allowance_period, allowance_other, 
             bonus_attendance, bonus_full_attendance, bonus_efficiency, bonus_quality_star,
             bonus_performance, bonus_kpi, bonus_recruitment, is_tax_exempt, bank_account, bank_name, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            target_emp_id, year, month,
            payload.base_salary, payload.pos_allowance, payload.sen_allowance, payload.kpi_coeff,
            payload.allowance_gas, payload.allowance_house, payload.allowance_child, payload.allowance_safety,
            payload.allowance_night, payload.allowance_meal_night, payload.allowance_period, payload.allowance_other,
            payload.bonus_attendance, payload.bonus_full_attendance, payload.bonus_efficiency, payload.bonus_quality_star,
            payload.bonus_performance, payload.bonus_kpi, payload.bonus_recruitment,
            payload.is_tax_exempt, payload.bank_account, payload.bank_name,
            now_iso
        ))
        conn.commit()
    
    # Auto-sync to Google Drive in background if configured
    background_tasks.add_task(trigger_gdrive_sync)
    return {"success": True, "emp_id": target_emp_id, "message": f"Đã lưu cấu hình lương Tháng {month}/{year} cho nhân viên {target_emp_id} thành công."}

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
