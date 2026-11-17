// ========================================================
// HỆ THỐNG BẢNG CHẤM CÔNG & TÍNH LƯƠNG TỰ ĐỘNG
// CÔNG THỨC CHUẨN: TIỀN OT = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ OT x % OT
// ========================================================

const VIETNAMESE_WEEKDAYS = [
  "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"
];

// Current State
let currentMonth = 12;
let currentYear = 2026;
let currentView = "unified"; // 'unified' or 'summary'

// All 12 months data store
let monthlyStore = {};

// Helper: Format Money
function formatMoney(num) {
  if (isNaN(num) || num === null || num === undefined) return "0";
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Helper: Format Hours
function formatHours(num) {
  if (isNaN(num) || num === null || num === undefined || num === "") return "";
  const n = parseFloat(num);
  if (isNaN(n) || n === 0) return "0";
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

function parseVal(v) {
  if (v === "" || v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  return parseFloat(v.toString().replace(",", ".")) || 0;
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getStandardWorkDays(year, month) {
  const totalDays = getDaysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek !== 0) count++;
  }
  return count;
}

// ========================================================
// SHIFT LOGIC: TỰ ĐỘNG ĐIỀN GIỜ THEO CA (NHƯNG VẪN SỬA ĐƯỢC)
// ========================================================
function applyShiftToDay(month, day, shiftType) {
  const isSunday = (new Date(currentYear, month - 1, day).getDay() === 0);
  if (!monthlyStore[month]) monthlyStore[month] = {};

  if (shiftType === "day") {
    // CA NGÀY:
    // Ngày thường: 8h làm thực tế, 3h OT 150%
    // Chủ Nhật: Không có giờ thực tế, 4.5h OT 200% (CN)
    monthlyStore[month][day] = {
      shift: "day",
      std: isSunday ? "" : 8,
      actual: isSunday ? "" : 8,
      ot130: "",
      ot150: isSunday ? "" : 3,
      ot200: isSunday ? 4.5 : "",
      ot210: "",
      ot270: "",
      ot300: "",
      ot390: ""
    };
  } else if (shiftType === "night") {
    // CA ĐÊM (Theo chuẩn nhà máy & Ảnh 1):
    // Ngày thường: 2h thực tế (trước 22h), 6h ca đêm 130% (22h - 6h), 2h OT 150%, 1.75h OT đêm 210%
    // Chủ Nhật: 4.5h OT 200%, 7.75h OT đêm CN 270%
    monthlyStore[month][day] = {
      shift: "night",
      std: isSunday ? "" : 8,
      actual: isSunday ? "" : 2,
      ot130: isSunday ? "" : 6,
      ot150: isSunday ? "" : 2,
      ot200: isSunday ? 4.5 : "",
      ot210: isSunday ? "" : 1.75,
      ot270: isSunday ? 7.75 : "",
      ot300: "",
      ot390: ""
    };
  } else if (shiftType === "off") {
    // NGHỈ
    monthlyStore[month][day] = {
      shift: "off",
      std: isSunday ? "" : 8,
      actual: "",
      ot130: "",
      ot150: "",
      ot200: "",
      ot210: "",
      ot270: "",
      ot300: "",
      ot390: ""
    };
  }
}

// Initialize Default Sample Data
function initializeDefaultData() {
  monthlyStore = {};

  for (let m = 1; m <= 12; m++) {
    const totalDays = getDaysInMonth(currentYear, m);
    monthlyStore[m] = {};

    if (m === 12) {
      // Month 12: Day Shift sample (Image 2)
      for (let d = 1; d <= totalDays; d++) {
        const isSun = (new Date(currentYear, 11, d).getDay() === 0);
        if (isSun) {
          monthlyStore[m][d] = { shift: "off", std: "", actual: "", ot130: "", ot150: 3, ot200: "", ot210: "", ot270: "", ot300: "" };
        } else if ([3, 10, 17].includes(d)) {
          monthlyStore[m][d] = { shift: "day", std: 8, actual: 8, ot130: "", ot150: "", ot200: 11, ot210: "", ot270: "", ot300: "" };
        } else if (d === 24) {
          monthlyStore[m][d] = { shift: "day", std: 8, actual: 8, ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "" };
        } else {
          monthlyStore[m][d] = { shift: "day", std: 8, actual: 8, ot130: "", ot150: 3, ot200: "", ot210: "", ot270: "", ot300: "" };
        }
      }
    } else if (m === 11) {
      // Month 11: Night Shift sample (Image 1)
      for (let d = 1; d <= totalDays; d++) {
        const isSun = (new Date(currentYear, 10, d).getDay() === 0);
        if (isSun) {
          applyShiftToDay(m, d, "night");
          if (d === 1) {
            monthlyStore[m][d].ot200 = "";
            monthlyStore[m][d].ot270 = "";
          }
        } else if (d === 24) {
          monthlyStore[m][d] = { shift: "day", std: 8, actual: 8, ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: "" };
        } else {
          applyShiftToDay(m, d, "night");
        }
      }
    } else {
      // Default: Day shift on weekdays
      for (let d = 1; d <= totalDays; d++) {
        const isSun = (new Date(currentYear, m - 1, d).getDay() === 0);
        if (isSun) {
          applyShiftToDay(m, d, "off");
        } else {
          applyShiftToDay(m, d, "day");
        }
      }
    }
  }
}

// ========================================================
// RENDER UNIFIED ATTENDANCE TABLE WITH SHIFT PILLS
// ========================================================
function renderUnifiedTable() {
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  document.getElementById("daysCountBadge").innerText = `${totalDays} ngày`;

  if (!monthlyStore[currentMonth]) {
    monthlyStore[currentMonth] = {};
  }
  const currentMonthData = monthlyStore[currentMonth];

  const tbody = document.getElementById("tbodyAttendanceUnified");
  tbody.innerHTML = "";
  let countSundays = 0;
  let countNightShifts = 0;

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(currentYear, currentMonth - 1, day);
    const dayOfWeek = d.getDay();
    const isSunday = (dayOfWeek === 0);
    if (isSunday) countSundays++;

    const dayName = `${day} - ${VIETNAMESE_WEEKDAYS[dayOfWeek]}`;

    if (!currentMonthData[day]) {
      applyShiftToDay(currentMonth, day, isSunday ? "off" : "day");
    }
    const rData = currentMonthData[day];
    const shift = rData.shift || (parseVal(rData.ot130) > 0 ? "night" : (parseVal(rData.actual) > 0 ? "day" : "off"));
    if (shift === "night" || parseVal(rData.ot130) > 0) countNightShifts++;

    const tr = document.createElement("tr");
    tr.className = `border-b border-black text-center ${isSunday ? "bg-green-highlight" : "hover:bg-blue-50/50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-1 px-1 font-semibold whitespace-nowrap text-left">${dayName}</td>
      <td class="border-r border-black py-1 px-1 no-print whitespace-nowrap">
        <div class="inline-flex gap-1">
          <button type="button" onclick="setDayShift(${day}, 'day')" class="shift-btn ${shift === 'day' ? 'shift-day-active' : 'bg-white hover:bg-yellow-50 text-slate-700 border border-slate-300'}" title="Tự điền Ca Ngày (8h + 3h OT)">☀️ Ngày</button>
          <button type="button" onclick="setDayShift(${day}, 'night')" class="shift-btn ${shift === 'night' ? 'shift-night-active' : 'bg-white hover:bg-indigo-50 text-slate-700 border border-slate-300'}" title="Tự điền Ca Đêm (2h + 6h đêm + OT)">🌙 Đêm</button>
          <button type="button" onclick="setDayShift(${day}, 'off')" class="shift-btn ${shift === 'off' ? 'shift-off-active' : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200'}" title="Nghỉ (Xóa giờ)">⚪</button>
        </div>
      </td>
      <td class="border-r border-black p-0"><input type="text" class="table-input" data-day="${day}" data-field="std" value="${rData.std !== undefined ? rData.std : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-bold" data-day="${day}" data-field="actual" value="${rData.actual !== undefined ? rData.actual : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot130" value="${rData.ot130 !== undefined ? rData.ot130 : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot150" value="${rData.ot150 !== undefined ? rData.ot150 : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot200" value="${rData.ot200 !== undefined ? rData.ot200 : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot210" value="${rData.ot210 !== undefined ? rData.ot210 : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot270" value="${rData.ot270 !== undefined ? rData.ot270 : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot300" value="${rData.ot300 !== undefined ? rData.ot300 : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-medium" data-day="${day}" data-field="ot390" value="${rData.ot390 !== undefined ? rData.ot390 : ""}" placeholder="-"></td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById("nightShiftCountBadge").innerText = `${countNightShifts} ca đêm`;

  const stdWorkDays = totalDays - countSundays;
  document.getElementById("stdWorkDays").innerText = stdWorkDays;
  document.getElementById("stdWorkHours").innerText = stdWorkDays * 8;

  attachTableInputs();

  recalculateMonth(countNightShifts);
  renderYearSummary();
}

window.setDayShift = function(day, shiftType) {
  applyShiftToDay(currentMonth, day, shiftType);
  renderUnifiedTable();
};

function attachTableInputs() {
  document.querySelectorAll("#tbodyAttendanceUnified input").forEach(input => {
    input.addEventListener("input", (e) => {
      const day = e.target.getAttribute("data-day");
      const field = e.target.getAttribute("data-field");
      if (monthlyStore[currentMonth] && monthlyStore[currentMonth][day]) {
        monthlyStore[currentMonth][day][field] = e.target.value;
      }
      recalculateMonth();
      renderYearSummary();
      triggerAutoSave();
    });
  });
}

// ========================================================
// TÍNH LƯƠNG TỰ ĐỘNG CHUẨN XÁC:
// LƯƠNG THỜI GIAN = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ LÀM (100%)
// TIỀN OT = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ OT x % OT
// ========================================================
function calculateSalaryForMonth(monthNum) {
  const totalDays = getDaysInMonth(currentYear, monthNum);
  const mData = monthlyStore[monthNum] || {};

  let totStd = 0, totActual = 0, tot130 = 0, tot150 = 0, tot200 = 0, tot210 = 0, tot270 = 0, tot300 = 0, tot390 = 0;
  let nightShifts = 0;

  for (let day = 1; day <= totalDays; day++) {
    const d = mData[day] || {};
    totStd += parseVal(d.std);
    totActual += parseVal(d.actual);
    tot130 += parseVal(d.ot130);
    tot150 += parseVal(d.ot150);
    tot200 += parseVal(d.ot200);
    tot210 += parseVal(d.ot210);
    tot270 += parseVal(d.ot270);
    tot300 += parseVal(d.ot300);
    tot390 += parseVal(d.ot390);

    if (d.shift === "night" || parseVal(d.ot130) > 0) nightShifts++;
  }

  // 1. Lương cơ bản & các phụ cấp lương
  const baseSalary = parseVal(document.getElementById("baseSalary").value) || 6300000;
  const posAllowance = parseVal(document.getElementById("positionAllowance").value) || 2450000;
  const senAllowance = parseVal(document.getElementById("seniorityAllowance").value) || 100000;
  const kpiCoeff = parseVal(document.getElementById("kpiCoeff").value) || 1;

  // 2. Công chuẩn, Giờ tiêu chuẩn và Đơn giá 1 giờ
  const stdDays = getStandardWorkDays(currentYear, monthNum);
  const stdHours = stdDays * 8;
  const insSalary = baseSalary + posAllowance + senAllowance;
  
  // ĐƠN GIÁ 1 GIỜ = Lương đóng BH / Số giờ tiêu chuẩn
  const exactHourlyRate = stdHours > 0 ? (insSalary / stdHours) : 0;
  const hourlyRate = Math.round(exactHourlyRate);

  // 3. I. LƯƠNG LÀM VIỆC THỜI GIAN (100%)
  // Công thức: Đơn giá 1 giờ x Số giờ làm thực tế
  const amountDay = Math.round(exactHourlyRate * totActual);

  // 4. II. TIỀN LÀM THÊM GIỜ & CA ĐÊM (OT)
  // CÔNG THỨC: TIỀN OT = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ OT x % OT
  // Đơn giá từng mức OT:
  const rate130 = Math.round(exactHourlyRate * 1.30); // 130%
  const rate150 = Math.round(exactHourlyRate * 1.50); // 150%
  const rate200 = Math.round(exactHourlyRate * 2.00); // 200%
  const rate210 = Math.round(exactHourlyRate * 2.10); // 210%
  const rate270 = Math.round(exactHourlyRate * 2.70); // 270%
  const rate300 = Math.round(exactHourlyRate * 3.00); // 300%
  const rate390 = Math.round(exactHourlyRate * 3.90); // 390%

  // Thành tiền từng mức OT (tính theo exactHourlyRate * % OT * số giờ để chuẩn xác từng đồng)
  const amount130 = Math.round(exactHourlyRate * 1.30 * tot130);
  const amount150 = Math.round(exactHourlyRate * 1.50 * tot150);
  const amount200 = Math.round(exactHourlyRate * 2.00 * tot200);
  const amount210 = Math.round(exactHourlyRate * 2.10 * tot210);
  const amount270 = Math.round(exactHourlyRate * 2.70 * tot270);
  const amount300 = Math.round(exactHourlyRate * 3.00 * tot300);
  const amount390 = Math.round(exactHourlyRate * 3.90 * tot390);

  const totalOTHours = tot130 + tot150 + tot200 + tot210 + tot270 + tot300 + tot390;
  const totalOTAmount = amount130 + amount150 + amount200 + amount210 + amount270 + amount300 + amount390;

  // 5. III. CÁC KHOẢN TRỢ CẤP (Đầy đủ theo ảnh mới)
  const gas = parseVal(document.getElementById("allowanceGas").value) || 500000;
  const house = parseVal(document.getElementById("allowanceHouse").value) || 500000;
  const child = parseVal(document.getElementById("allowanceChild").value) || 0;
  const safety = parseVal(document.getElementById("allowanceSafety").value) || 0;
  
  let nightSubsidy = parseVal(document.getElementById("allowanceNight").value);
  let mealNight = parseVal(document.getElementById("allowanceMealNight").value);
  if (monthNum !== currentMonth) {
    nightSubsidy = nightShifts * 30000; // 30k/đêm
    mealNight = nightShifts * 25000;    // 25k/đêm
  }

  const period = parseVal(document.getElementById("allowancePeriod").value) || 0;
  const other = parseVal(document.getElementById("allowanceOther").value) || 0;
  const totalAllowance = gas + house + child + safety + nightSubsidy + mealNight + period + other;

  // 6. IV. CÁC KHOẢN THƯỞNG
  const bonusAtt = (totActual >= stdHours || totActual >= 180) ? (parseVal(document.getElementById("bonusAttendance").value) || 600000) : 0;
  const baseKPI = parseVal(document.getElementById("bonusKPI").value) || 3050000;
  const totalBonus = bonusAtt + Math.round(baseKPI * kpiCoeff);

  // 7. V. TỔNG THU NHẬP (GROSS) = I + II + III + IV
  const grossIncome = amountDay + totalOTAmount + totalAllowance + totalBonus;

  // 8. VI. CÁC KHOẢN GIẢM TRỪ (Bảo hiểm & Thuế)
  const deductBHXH = Math.round(insSalary * 0.08);
  const deductBHYT = Math.round(insSalary * 0.015);
  const deductBHTN = Math.round(insSalary * 0.01);
  const deductKPCĐ = Math.round(insSalary * 0.005);

  // Thuế thu nhập cá nhân (TNCN)
  // Người dùng xác nhận: "Tôi không bị tính thuế" -> Mặc định = 0đ (Miễn thuế)
  const taxToggleEl = document.getElementById("taxExemptToggle");
  const isTaxExempt = taxToggleEl ? taxToggleEl.checked : true;
  let deductTNCN = 0;
  let taxableIncome = 0;

  if (!isTaxExempt) {
    // Phần tiền lương làm thêm giờ cao hơn mức bình thường được miễn thuế TNCN:
    // (0.3 ở OT 130%, 0.5 ở OT 150%, 1.0 ở OT 200%, 1.1 ở OT 210%, 1.7 ở OT 270%, 2.0 ở OT 300%, 2.9 ở OT 390%)
    const otTaxExempt = Math.round(
      (exactHourlyRate * 0.3 * tot130) +
      (exactHourlyRate * 0.5 * tot150) +
      (exactHourlyRate * 1.0 * tot200) +
      (exactHourlyRate * 1.1 * tot210) +
      (exactHourlyRate * 1.7 * tot270) +
      (exactHourlyRate * 2.0 * tot300) +
      (exactHourlyRate * 2.9 * tot390)
    );
    taxableIncome = Math.max(0, grossIncome - otTaxExempt - mealNight - 11000000 - (deductBHXH + deductBHYT + deductBHTN));
    if (taxableIncome > 0) {
      if (taxableIncome <= 5000000) deductTNCN = Math.round(taxableIncome * 0.05);
      else deductTNCN = Math.round(5000000 * 0.05 + (taxableIncome - 5000000) * 0.1);
    }
  }

  const totalDeductions = deductBHXH + deductBHYT + deductBHTN + deductKPCĐ + deductTNCN;
  
  // 9. VII. THỰC LĨNH / THỰC NHẬN = TỔNG THU NHẬP - TỔNG GIẢM TRỪ
  const netSalary = grossIncome - totalDeductions;

  return {
    stdDays, stdHours, exactHourlyRate, hourlyRate, insSalary, nightShifts,
    totStd, totActual, tot130, tot150, tot200, tot210, tot270, tot300, tot390,
    amountDay,
    rate130, rate150, rate200, rate210, rate270, rate300, rate390,
    amount130, amount150, amount200, amount210, amount270, amount300, amount390,
    totalOTHours, totalOTAmount,
    gas, house, child, safety, nightSubsidy, mealNight, period, other, totalAllowance,
    totalBonus,
    grossIncome,
    deductBHXH, deductBHYT, deductBHTN, deductKPCĐ, deductTNCN, taxableIncome, isTaxExempt, totalDeductions,
    netSalary
  };
}

// Recalculate Current Month UI
function recalculateMonth(nightShiftsCount) {
  const calc = calculateSalaryForMonth(currentMonth);

  // Update Attendance footer row
  document.getElementById("totStdUnified").innerText = calc.totStd;
  document.getElementById("totActualUnified").innerText = formatHours(calc.totActual);
  document.getElementById("tot130Unified").innerText = formatHours(calc.tot130);
  document.getElementById("tot150Unified").innerText = formatHours(calc.tot150);
  document.getElementById("tot200Unified").innerText = formatHours(calc.tot200);
  document.getElementById("tot210Unified").innerText = formatHours(calc.tot210);
  document.getElementById("tot270Unified").innerText = formatHours(calc.tot270);
  document.getElementById("tot300Unified").innerText = formatHours(calc.tot300);
  document.getElementById("tot390Unified").innerText = formatHours(calc.tot390);

  // Update Standard & Salary Headers
  document.getElementById("stdWorkDays").innerText = calc.stdDays;
  document.getElementById("stdWorkHours").innerText = calc.stdHours;
  document.getElementById("hourlyRate").innerText = formatMoney(calc.hourlyRate);
  document.getElementById("insuranceSalary").innerText = formatMoney(calc.insSalary);
  document.querySelectorAll(".baseInsLabel").forEach(el => el.innerText = formatMoney(calc.insSalary));

  // Part I: Day shift wages (100%)
  document.getElementById("unitRateDay").innerText = formatMoney(calc.hourlyRate);
  document.getElementById("hoursDay").innerText = formatHours(calc.totActual);
  document.getElementById("amountDay").innerText = formatMoney(calc.amountDay);

  // Part II: OT Calculations (Đơn giá 1 giờ x Số giờ x % OT)
  document.getElementById("totalOTHours").innerText = formatHours(calc.totalOTHours);
  document.getElementById("totalOTAmount").innerText = formatMoney(calc.totalOTAmount);

  // OT 130%
  document.getElementById("rateOT130").innerText = formatMoney(calc.rate130);
  document.getElementById("hoursOT130").innerText = formatHours(calc.tot130);
  document.getElementById("amountOT130").innerText = formatMoney(calc.amount130);

  // OT 150%
  document.getElementById("rateOT150").innerText = formatMoney(calc.rate150);
  document.getElementById("hoursOT150").innerText = formatHours(calc.tot150);
  document.getElementById("amountOT150").innerText = formatMoney(calc.amount150);

  // OT 200%
  document.getElementById("rateOT200").innerText = formatMoney(calc.rate200);
  document.getElementById("hoursOT200").innerText = formatHours(calc.tot200);
  document.getElementById("amountOT200").innerText = formatMoney(calc.amount200);

  // OT 210%
  document.getElementById("rateOT210").innerText = formatMoney(calc.rate210);
  document.getElementById("hoursOT210").innerText = formatHours(calc.tot210);
  document.getElementById("amountOT210").innerText = formatMoney(calc.amount210);

  // OT 270%
  document.getElementById("rateOT270").innerText = formatMoney(calc.rate270);
  document.getElementById("hoursOT270").innerText = formatHours(calc.tot270);
  document.getElementById("amountOT270").innerText = formatMoney(calc.amount270);

  // OT 300%
  document.getElementById("rateOT300").innerText = formatMoney(calc.rate300);
  document.getElementById("hoursOT300").innerText = formatHours(calc.tot300);
  document.getElementById("amountOT300").innerText = formatMoney(calc.amount300);

  // OT 390%
  document.getElementById("rateOT390").innerText = formatMoney(calc.rate390);
  document.getElementById("hoursOT390").innerText = formatHours(calc.tot390);
  document.getElementById("amountOT390").innerText = formatMoney(calc.amount390);

  // Update Night Shift Subsidy auto hints
  const nShifts = (nightShiftsCount !== undefined) ? nightShiftsCount : calc.nightShifts;
  document.getElementById("labelNightSubsidy").innerText = `30k x ${nShifts} đêm`;
  document.getElementById("labelMealSubsidy").innerText = `25k x ${nShifts} đêm`;

  // Part III & IV
  document.getElementById("totalAllowance").innerText = formatMoney(calc.totalAllowance);
  document.getElementById("totalBonus").innerText = formatMoney(calc.totalBonus);
  const kpiVal = parseVal(document.getElementById("kpiCoeff").value) || 1;
  document.getElementById("labelKPIBonus").innerText = `Hệ số: ${kpiVal}`;

  if (calc.totActual >= calc.stdHours) {
    document.getElementById("attBonusStatus").innerText = "Đủ công";
    document.getElementById("badgeAttendanceStatus").innerText = "Đủ công";
    document.getElementById("badgeAttendanceStatus").className = "auto-badge bg-emerald-100 text-emerald-800";
  } else {
    document.getElementById("attBonusStatus").innerText = `Thiếu (${formatHours(calc.totActual)}/${calc.stdHours}h)`;
    document.getElementById("badgeAttendanceStatus").innerText = "Thiếu công";
    document.getElementById("badgeAttendanceStatus").className = "auto-badge bg-amber-100 text-amber-800";
  }

  // Part V: Gross
  document.getElementById("totalGrossIncome").innerText = formatMoney(calc.grossIncome);

  // Part VI: Deductions
  document.getElementById("deductBHXH").innerText = formatMoney(calc.deductBHXH);
  document.getElementById("deductBHYT").innerText = formatMoney(calc.deductBHYT);
  document.getElementById("deductBHTN").innerText = formatMoney(calc.deductBHTN);
  document.getElementById("deductKPCĐ").innerText = formatMoney(calc.deductKPCĐ);
  document.getElementById("deductTNCN").innerText = formatMoney(calc.deductTNCN);

  if (document.getElementById("taxRateLabel")) {
    document.getElementById("taxRateLabel").innerText = calc.isTaxExempt ? "0% (Miễn thuế)" : "5% (>11tr)";
  }
  if (document.getElementById("taxableAmount")) {
    document.getElementById("taxableAmount").innerText = calc.isTaxExempt ? "-" : formatMoney(calc.taxableIncome);
  }

  document.getElementById("headerDeductions").innerText = formatMoney(calc.totalDeductions);
  document.getElementById("totalDeductions").innerText = formatMoney(calc.totalDeductions);

  // Part VII: Net Salary
  document.getElementById("netSalary").innerText = formatMoney(calc.netSalary);

  // Update Formula breakdown card
  document.getElementById("fHourly").innerText = `${formatMoney(calc.hourlyRate)} đ`;
  document.getElementById("fIns").innerText = formatMoney(calc.insSalary);
  document.getElementById("fHours").innerText = calc.stdHours;

  document.getElementById("fWorkOT").innerText = `${formatMoney(calc.amountDay + calc.totalOTAmount)} đ`;
  document.getElementById("fDayAmt").innerText = formatMoney(calc.amountDay);
  document.getElementById("fOTAmt").innerText = formatMoney(calc.totalOTAmount);

  document.getElementById("fAllowBonus").innerText = `${formatMoney(calc.totalAllowance + calc.totalBonus)} đ`;
  document.getElementById("fAllowAmt").innerText = formatMoney(calc.totalAllowance);
  document.getElementById("fBonusAmt").innerText = formatMoney(calc.totalBonus);

  document.getElementById("fNet").innerText = `${formatMoney(calc.netSalary)} đ`;
  document.getElementById("fGross").innerText = formatMoney(calc.grossIncome);
  document.getElementById("fDeduct").innerText = formatMoney(calc.totalDeductions);
}

// ========================================================
// BẢNG THỐNG KÊ TỔNG TIỀN 12 THÁNG TRONG NĂM
// ========================================================
function renderYearSummary() {
  document.getElementById("summaryYearLabel").innerText = currentYear;

  const tbody = document.getElementById("tbodyYearSummary");
  tbody.innerHTML = "";

  let yearStdDays = 0, yearActualHours = 0, yearOTHours = 0;
  let yearDayWages = 0, yearOTWages = 0, yearBonusAllow = 0;
  let yearGross = 0, yearDeductions = 0, yearNet = 0;

  const monthlyNets = [];

  for (let m = 1; m <= 12; m++) {
    const calc = calculateSalaryForMonth(m);
    monthlyNets.push({ month: m, net: calc.netSalary });

    yearStdDays += calc.stdDays;
    yearActualHours += calc.totActual;
    yearOTHours += calc.totalOTHours;
    yearDayWages += calc.amountDay;
    yearOTWages += calc.totalOTAmount;
    yearBonusAllow += (calc.totalAllowance + calc.totalBonus);
    yearGross += calc.grossIncome;
    yearDeductions += calc.totalDeductions;
    yearNet += calc.netSalary;

    const tr = document.createElement("tr");
    tr.className = `border-b border-black text-center ${m === currentMonth ? "bg-amber-100/60 font-semibold" : "hover:bg-slate-50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-2 px-2 font-bold text-slate-900">Tháng ${m} ${m === currentMonth ? "<span class='text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded ml-1'>Hiện tại</span>" : ""}</td>
      <td class="border-r border-black py-2 px-1 num-font">${calc.stdDays} ngày</td>
      <td class="border-r border-black py-2 px-1 num-font text-blue-800 font-semibold">${formatHours(calc.totActual)} h</td>
      <td class="border-r border-black py-2 px-1 num-font text-purple-800 font-semibold">${formatHours(calc.totalOTHours)} h</td>
      <td class="border-r border-black py-2 px-2 num-font text-right">${formatMoney(calc.amountDay)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right text-purple-700">${formatMoney(calc.totalOTAmount)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right text-emerald-700">${formatMoney(calc.totalAllowance + calc.totalBonus)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-bold text-slate-900">${formatMoney(calc.grossIncome)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right text-rose-700">${formatMoney(calc.totalDeductions)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-bold text-emerald-800 text-sm bg-emerald-50/50">${formatMoney(calc.netSalary)}</td>
      <td class="border-r border-black py-1 px-1 no-print">
        <button onclick="goToMonth(${m})" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] rounded shadow-2xs transition">
          <i class="fa-solid fa-pen-to-square"></i> Xem/Sửa
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  document.getElementById("sumStdDays").innerText = `${yearStdDays} ngày`;
  document.getElementById("sumActualHours").innerText = `${formatHours(yearActualHours)} h`;
  document.getElementById("sumOTHours").innerText = `${formatHours(yearOTHours)} h`;
  document.getElementById("sumDayWages").innerText = formatMoney(yearDayWages);
  document.getElementById("sumOTWages").innerText = formatMoney(yearOTWages);
  document.getElementById("sumBonusAllow").innerText = formatMoney(yearBonusAllow);
  document.getElementById("sumGrossIncome").innerText = formatMoney(yearGross);
  document.getElementById("sumDeductions").innerText = formatMoney(yearDeductions);
  document.getElementById("sumNetSalary").innerText = formatMoney(yearNet);

  document.getElementById("kpiTotalHours").innerText = `${formatHours(yearActualHours)} h`;
  document.getElementById("kpiTotalOTHours").innerText = `${formatHours(yearOTHours)} h`;
  document.getElementById("kpiTotalGross").innerText = `${formatMoney(yearGross)} đ`;
  document.getElementById("kpiTotalNet").innerText = `${formatMoney(yearNet)} đ`;
  const avgNet = Math.round(yearNet / 12);
  document.getElementById("kpiAvgNet").innerText = `Bình quân: ~${formatMoney(avgNet)} đ/tháng`;

  renderVisualChart(monthlyNets);
}

function renderVisualChart(data) {
  const container = document.getElementById("chartContainer");
  container.innerHTML = "";

  const maxVal = Math.max(...data.map(d => d.net), 25000000);

  data.forEach(item => {
    const heightPercent = Math.max(12, Math.round((item.net / maxVal) * 100));
    const isCurrent = (item.month === currentMonth);

    const col = document.createElement("div");
    col.className = "flex-1 flex flex-col items-center justify-end h-full group cursor-pointer";
    col.onclick = () => goToMonth(item.month);

    col.innerHTML = `
      <div class="text-[10px] font-mono font-semibold text-slate-700 opacity-0 group-hover:opacity-100 transition mb-1 whitespace-nowrap">
        ${(item.net / 1000000).toFixed(1)} tr
      </div>
      <div class="w-full max-w-[42px] rounded-t transition-all duration-300 ${isCurrent ? 'bg-amber-500 shadow-md ring-2 ring-amber-300' : 'bg-blue-600 hover:bg-blue-500'}" style="height: ${heightPercent}%;"></div>
      <div class="text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-amber-600 font-extrabold' : 'text-slate-600'}">
        T${item.month}
      </div>
    `;
    container.appendChild(col);
  });
}

window.goToMonth = function(m) {
  currentMonth = m;
  document.getElementById("selectMonth").value = m.toString();
  document.getElementById("tabBtnUnified").click();
  renderUnifiedTable();
};

// Quick Fill Tools
document.getElementById("btnQuickFillAllDay").addEventListener("click", () => {
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  for (let d = 1; d <= totalDays; d++) {
    const isSun = (new Date(currentYear, currentMonth - 1, d).getDay() === 0);
    applyShiftToDay(currentMonth, d, isSun ? "off" : "day");
  }
  renderUnifiedTable();
  triggerAutoSave();
});

document.getElementById("btnQuickFillAllNight").addEventListener("click", () => {
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  for (let d = 1; d <= totalDays; d++) {
    const isSun = (new Date(currentYear, currentMonth - 1, d).getDay() === 0);
    applyShiftToDay(currentMonth, d, "night");
    if (isSun) {
      monthlyStore[currentMonth][d].ot200 = 4.5;
      monthlyStore[currentMonth][d].ot270 = 7.75;
    }
  }
  document.getElementById("allowanceNight").value = 780000;
  document.getElementById("allowanceMealNight").value = 650000;
  renderUnifiedTable();
  triggerAutoSave();
});

document.getElementById("btnQuickFillRotating").addEventListener("click", () => {
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  for (let d = 1; d <= totalDays; d++) {
    const isSun = (new Date(currentYear, currentMonth - 1, d).getDay() === 0);
    if (d <= 15) {
      applyShiftToDay(currentMonth, d, isSun ? "off" : "day");
    } else {
      applyShiftToDay(currentMonth, d, isSun ? "off" : "night");
    }
  }
  document.getElementById("allowanceNight").value = 390000;
  document.getElementById("allowanceMealNight").value = 325000;
  renderUnifiedTable();
  triggerAutoSave();
});

document.getElementById("btnQuickClearAll").addEventListener("click", () => {
  if (confirm(`Bạn có muốn xóa toàn bộ giờ làm của Tháng ${currentMonth}?`)) {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    for (let d = 1; d <= totalDays; d++) {
      applyShiftToDay(currentMonth, d, "off");
    }
    renderUnifiedTable();
    triggerAutoSave();
  }
});

// Tab Switching
document.getElementById("tabBtnUnified").addEventListener("click", () => {
  currentView = "unified";
  document.getElementById("tabBtnUnified").className = "py-2.5 px-4 border-b-2 font-bold text-sm transition flex items-center gap-2 border-blue-600 text-blue-600";
  document.getElementById("tabBtnYearSummary").className = "py-2.5 px-4 border-b-2 font-bold text-sm transition flex items-center gap-2 border-transparent text-slate-500 hover:text-slate-800";
  document.getElementById("viewUnified").classList.remove("hidden");
  document.getElementById("viewYearSummary").classList.add("hidden");
});

document.getElementById("tabBtnYearSummary").addEventListener("click", () => {
  currentView = "summary";
  document.getElementById("tabBtnYearSummary").className = "py-2.5 px-4 border-b-2 font-bold text-sm transition flex items-center gap-2 border-blue-600 text-blue-600";
  document.getElementById("tabBtnUnified").className = "py-2.5 px-4 border-b-2 font-bold text-sm transition flex items-center gap-2 border-transparent text-slate-500 hover:text-slate-800";
  document.getElementById("viewUnified").classList.add("hidden");
  document.getElementById("viewYearSummary").classList.remove("hidden");
  renderYearSummary();
});

// Month & Year changes
document.getElementById("selectMonth").addEventListener("change", async (e) => {
  currentMonth = parseInt(e.target.value);
  await loadFromBackendOrStorage(currentMonth, currentYear);
  renderUnifiedTable();
});

document.getElementById("inputYear").addEventListener("change", async (e) => {
  currentYear = parseInt(e.target.value) || 2026;
  initializeDefaultData();
  await loadFromBackendOrStorage(currentMonth, currentYear);
  renderUnifiedTable();
});

// Salary parameter inputs
[
  "baseSalary", "positionAllowance", "seniorityAllowance", "kpiCoeff",
  "allowanceGas", "allowanceHouse", "allowanceChild", "allowanceSafety",
  "allowanceNight", "allowanceMealNight", "allowancePeriod", "allowanceOther",
  "bonusAttendance", "bonusKPI", "bankAccount", "bankName"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", () => {
      recalculateMonth();
      renderYearSummary();
      triggerAutoSave();
    });
  }
});

// Toggle Miễn Thuế TNCN
const taxExemptToggle = document.getElementById("taxExemptToggle");
if (taxExemptToggle) {
  taxExemptToggle.addEventListener("change", () => {
    recalculateMonth();
    renderYearSummary();
    triggerAutoSave();
  });
}

// Quick Sample Loaders
document.getElementById("btnLoadSampleDec").addEventListener("click", () => {
  currentMonth = 12;
  document.getElementById("selectMonth").value = "12";
  document.getElementById("allowanceNight").value = 0;
  document.getElementById("allowanceMealNight").value = 0;
  document.getElementById("tabBtnUnified").click();
  renderUnifiedTable();
});

document.getElementById("btnLoadSampleNov").addEventListener("click", () => {
  currentMonth = 11;
  document.getElementById("selectMonth").value = "11";
  document.getElementById("allowanceNight").value = 780000;
  document.getElementById("allowanceMealNight").value = 650000;
  document.getElementById("tabBtnUnified").click();
  renderUnifiedTable();
});

document.getElementById("btnResetData").addEventListener("click", () => {
  if (confirm("Bạn có chắc chắn muốn làm mới toàn bộ số liệu cả 12 tháng về mặc định?")) {
    initializeDefaultData();
    renderUnifiedTable();
  }
});

// Direct Export Excel with SheetJS
document.getElementById("btnExportExcel").addEventListener("click", () => {
  if (typeof XLSX === "undefined") {
    alert("Thư viện xuất Excel đang tải, vui lòng thử lại sau giây lát.");
    return;
  }

  const wb = XLSX.utils.book_new();

  // --- SHEET 1: BẢNG CHẤM CÔNG THÁNG HIỆN TẠI (GỘP CA NGÀY & ĐÊM) ---
  const ws1Data = [];
  ws1Data.push(["Tháng", currentMonth, "Năm", currentYear]);
  ws1Data.push(["BẢNG CHẤM CÔNG GỘP CA NGÀY & CA ĐÊM", "", "", "", "", "", "", "", "", "", "", "BẢNG CHUẨN TIỀN & TÍNH LƯƠNG"]);
  ws1Data.push([
    "Ngày", "Công chuẩn", "Giờ thực tế (100%)", "Ca đêm (130%)", "OT thường (150%)", "OT CN (200%)",
    "OT đêm thường (210%)", "OT đêm CN (270%)", "OT Lễ (300%)", "OT Lễ đêm (390%)",
    "",
    "Thông tin", "Giá trị", "Thông số chuẩn", "Giá trị / Đơn vị"
  ]);

  const empName = document.getElementById("empName").value;
  const empDept = document.getElementById("empDept").value;
  const stdWorkDays = document.getElementById("stdWorkDays").innerText;
  const stdWorkHours = document.getElementById("stdWorkHours").innerText;
  const baseSal = parseVal(document.getElementById("baseSalary").value);
  const hourly = document.getElementById("hourlyRate").innerText;
  const posAllowance = parseVal(document.getElementById("positionAllowance").value);
  const kpi = parseVal(document.getElementById("kpiCoeff").value);
  const senAllowance = parseVal(document.getElementById("seniorityAllowance").value);
  const insSal = document.getElementById("insuranceSalary").innerText;

  const rightRows = [
    ["Họ và tên", empName, "Ngày công chuẩn", stdWorkDays],
    ["Bộ phận", empDept, "Số giờ tiêu chuẩn", stdWorkHours],
    ["Lương cơ bản (LCB)", baseSal, "Đơn giá giờ", hourly],
    ["Phụ cấp chức vụ", posAllowance, "Hệ số KPI", kpi],
    ["Thâm niên", senAllowance, "Lương đóng BH", insSal],
    ["MỤC TÍNH LƯƠNG", "CÔNG THỨC / ĐƠN GIÁ", "SỐ GIỜ", "THÀNH TIỀN (VNĐ)"],
    ["I. LƯƠNG LÀM THỰC TẾ (100%)", document.getElementById("unitRateDay").innerText, document.getElementById("hoursDay").innerText, document.getElementById("amountDay").innerText],
    ["II. LÀM THÊM GIỜ & CA ĐÊM", "", document.getElementById("totalOTHours").innerText, document.getElementById("totalOTAmount").innerText],
    ["1. Phụ cấp ca đêm (130%)", document.getElementById("rateOT130").innerText, document.getElementById("hoursOT130").innerText, document.getElementById("amountOT130").innerText],
    ["2. Tăng ca ngày thường (150%)", document.getElementById("rateOT150").innerText, document.getElementById("hoursOT150").innerText, document.getElementById("amountOT150").innerText],
    ["3. Tăng ca Chủ Nhật ngày (200%)", document.getElementById("rateOT200").innerText, document.getElementById("hoursOT200").innerText, document.getElementById("amountOT200").innerText],
    ["4. Tăng ca đêm ngày thường (210%)", document.getElementById("rateOT210").innerText, document.getElementById("hoursOT210").innerText, document.getElementById("amountOT210").innerText],
    ["5. Tăng ca đêm Chủ Nhật (270%)", document.getElementById("rateOT270").innerText, document.getElementById("hoursOT270").innerText, document.getElementById("amountOT270").innerText],
    ["6. Tăng ca ngày Lễ (300%)", document.getElementById("rateOT300").innerText, document.getElementById("hoursOT300").innerText, document.getElementById("amountOT300").innerText],
    ["7. Tăng ca đêm ngày Lễ (390%)", document.getElementById("rateOT390").innerText, document.getElementById("hoursOT390").innerText, document.getElementById("amountOT390").innerText],
    ["III. CÁC KHOẢN TRỢ CẤP", "", "Tiêu chuẩn", document.getElementById("totalAllowance").innerText],
    ["1. Trợ cấp xăng xe", "Cố định", "", parseVal(document.getElementById("allowanceGas").value)],
    ["2. Trợ cấp nhà ở", "Cố định", "", parseVal(document.getElementById("allowanceHouse").value)],
    ["3. Trợ cấp con nhỏ", "", "", parseVal(document.getElementById("allowanceChild").value)],
    ["4. Trợ cấp PCCC / an toàn", "/", "", parseVal(document.getElementById("allowanceSafety").value)],
    ["5. Trợ cấp ca đêm", "Theo ca", "", parseVal(document.getElementById("allowanceNight").value)],
    ["6. Tiền ăn ca đêm", "Theo ca", "", parseVal(document.getElementById("allowanceMealNight").value)],
    ["7. Trợ cấp kinh nguyệt", "", "", parseVal(document.getElementById("allowancePeriod").value)],
    ["8. Trợ cấp khác", "", "", parseVal(document.getElementById("allowanceOther").value)],
    ["IV. CÁC KHOẢN THƯỞNG", "", "Tiêu chuẩn", document.getElementById("totalBonus").innerText],
    ["1. Tiền thưởng chuyên cần", document.getElementById("attBonusStatus").innerText, "", parseVal(document.getElementById("bonusAttendance").value)],
    ["2. Tiền thưởng thành tích KPI", `Hệ số: ${kpi}`, "", parseVal(document.getElementById("bonusKPI").value)],
    ["V. TỔNG THU NHẬP (I+II+III+IV)", "", "", document.getElementById("totalGrossIncome").innerText],
    ["VI. CÁC KHOẢN GIẢM TRỪ", "Tỷ lệ", "Lương đóng BH", document.getElementById("headerDeductions").innerText],
    ["1. Bảo hiểm xã hội (BHXH - 8%)", "8%", insSal, document.getElementById("deductBHXH").innerText],
    ["2. Bảo hiểm y tế (BHYT - 1.5%)", "1.50%", insSal, document.getElementById("deductBHYT").innerText],
    ["3. Bảo hiểm thất nghiệp (BHTN - 1%)", "1%", insSal, document.getElementById("deductBHTN").innerText],
    ["4. Kinh phí công đoàn (0.5%)", "0.50%", insSal, document.getElementById("deductKPCĐ").innerText],
    ["5. Thuế thu nhập cá nhân (TNCN)", document.getElementById("taxRateLabel") ? document.getElementById("taxRateLabel").innerText : "0% (Miễn thuế)", document.getElementById("taxableAmount").innerText, document.getElementById("deductTNCN").innerText],
    ["TỔNG CÁC KHOẢN GIẢM TRỪ", "", "", document.getElementById("totalDeductions").innerText],
    ["VII. THỰC LĨNH / THỰC NHẬN", "", "", document.getElementById("netSalary").innerText],
    ["Thông tin thanh toán", document.getElementById("bankAccount").value, "Ngân hàng:", document.getElementById("bankName").value]
  ];

  const totalDays = getDaysInMonth(currentYear, currentMonth);
  const mData = monthlyStore[currentMonth] || {};

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(currentYear, currentMonth - 1, day);
    const dayOfWeek = d.getDay();
    const dayName = `${day} - ${VIETNAMESE_WEEKDAYS[dayOfWeek]}`;
    const rData = mData[day] || {};

    const leftPart = [
      dayName,
      rData.std !== undefined ? rData.std : "",
      rData.actual !== undefined ? rData.actual : "",
      rData.ot130 !== undefined ? rData.ot130 : "",
      rData.ot150 !== undefined ? rData.ot150 : "",
      rData.ot200 !== undefined ? rData.ot200 : "",
      rData.ot210 !== undefined ? rData.ot210 : "",
      rData.ot270 !== undefined ? rData.ot270 : "",
      rData.ot300 !== undefined ? rData.ot300 : "",
      rData.ot390 !== undefined ? rData.ot390 : "",
      ""
    ];

    const rIdx = day - 1;
    const rightPart = rIdx < rightRows.length ? rightRows[rIdx] : ["", "", "", ""];
    ws1Data.push(leftPart.concat(rightPart));
  }

  // Row tổng cộng
  ws1Data.push([
    "TỔNG CỘNG",
    document.getElementById("totStdUnified").innerText,
    document.getElementById("totActualUnified").innerText,
    document.getElementById("tot130Unified").innerText,
    document.getElementById("tot150Unified").innerText,
    document.getElementById("tot200Unified").innerText,
    document.getElementById("tot210Unified").innerText,
    document.getElementById("tot270Unified").innerText,
    document.getElementById("tot300Unified").innerText,
    document.getElementById("tot390Unified").innerText
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, `Cham Cong T${currentMonth}_${currentYear}`);

  // --- SHEET 2: BẢNG THỐNG KÊ 12 THÁNG TRONG NĂM ---
  const ws2Data = [];
  ws2Data.push([`BẢNG THỐNG KÊ TỔNG TIỀN LƯƠNG 12 THÁNG NĂM ${currentYear}`]);
  ws2Data.push([
    "Tháng", "Công chuẩn", "Giờ thực tế", "Tổng giờ OT", "Lương thời gian", "Tiền OT",
    "Trợ cấp & Thưởng", "Tổng thu nhập", "Giảm trừ bảo hiểm", "THỰC LĨNH (VNĐ)"
  ]);

  let yStd = 0, yActual = 0, yOT = 0, yDay = 0, yOTW = 0, yBon = 0, yGross = 0, yDed = 0, yNet = 0;

  for (let m = 1; m <= 12; m++) {
    const calc = calculateSalaryForMonth(m);
    yStd += calc.stdDays;
    yActual += calc.totActual;
    yOT += calc.totalOTHours;
    yDay += calc.amountDay;
    yOTW += calc.totalOTAmount;
    yBon += (calc.totalAllowance + calc.totalBonus);
    yGross += calc.grossIncome;
    yDed += calc.totalDeductions;
    yNet += calc.netSalary;

    ws2Data.push([
      `Tháng ${m}`,
      calc.stdDays,
      calc.totActual,
      calc.totalOTHours,
      calc.amountDay,
      calc.totalOTAmount,
      (calc.totalAllowance + calc.totalBonus),
      calc.grossIncome,
      calc.totalDeductions,
      calc.netSalary
    ]);
  }

  ws2Data.push([
    "TỔNG CẢ NĂM",
    yStd,
    yActual,
    yOT,
    yDay,
    yOTW,
    yBon,
    yGross,
    yDed,
    yNet
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  XLSX.utils.book_append_sheet(wb, ws2, `Thong Ke 12 Thang ${currentYear}`);

  XLSX.writeFile(wb, `Bang_Cham_Cong_Va_Thong_Ke_Nam_${currentYear}.xlsx`);
});

// ========================================================
// BACKEND API & SQLITE STORAGE INTEGRATION
// ========================================================
const API_BASE = (window.location.protocol.startsWith("http")) 
  ? window.location.origin 
  : "http://localhost:8000";

let isBackendConnected = false;
let autoSaveTimer = null;

function updateBackendBadge(online, text) {
  const badge = document.getElementById("backendStatusBadge");
  if (!badge) return;
  if (online) {
    badge.className = "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ${text || "Backend Online (SQLite)"}`;
  } else {
    badge.className = "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-300";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> ${text || "Chế độ Offline (Trình duyệt)"}`;
  }
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  const bg = type === "success" ? "bg-emerald-600 text-white" : "bg-slate-800 text-white";
  toast.className = `${bg} px-4 py-2.5 rounded-lg shadow-lg text-xs md:text-sm font-medium flex items-center gap-2 pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-info'}"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.remove("translate-y-2", "opacity-0"); }, 10);
  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

async function checkBackendStatus() {
  try {
    const resp = await fetch(`${API_BASE}/api/status`, { signal: AbortSignal.timeout(1500) });
    if (resp.ok) {
      isBackendConnected = true;
      updateBackendBadge(true, "Backend Online (SQLite)");
      return true;
    }
  } catch (e) {
    // Backend offline
  }
  isBackendConnected = false;
  updateBackendBadge(false, "Chế độ Offline (Trình duyệt)");
  return false;
}

async function loadFromBackendOrStorage(month, year) {
  if (isBackendConnected) {
    try {
      // 1. Load attendance
      const attResp = await fetch(`${API_BASE}/api/attendance/${year}/${month}`);
      if (attResp.ok) {
        const attData = await attResp.json();
        if (attData.days && Object.keys(attData.days).length > 0) {
          monthlyStore[month] = attData.days;
        }
      }

      // 2. Load salary config
      const cfgResp = await fetch(`${API_BASE}/api/config/${year}/${month}`);
      if (cfgResp.ok) {
        const cfg = await cfgResp.json();
        applyConfigToInputs(cfg);
      }
    } catch (e) {
      console.warn("Lỗi tải từ backend, dùng bộ nhớ cục bộ:", e);
    }
  } else {
    // Load from localStorage if available
    const localAtt = localStorage.getItem(`att_${year}_${month}`);
    if (localAtt) {
      try { monthlyStore[month] = JSON.parse(localAtt); } catch(e){}
    }
    const localCfg = localStorage.getItem(`cfg_${year}_${month}`);
    if (localCfg) {
      try { applyConfigToInputs(JSON.parse(localCfg)); } catch(e){}
    }
  }
}

function applyConfigToInputs(cfg) {
  if (!cfg) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  setVal("baseSalary", cfg.base_salary);
  setVal("positionAllowance", cfg.pos_allowance);
  setVal("seniorityAllowance", cfg.sen_allowance);
  setVal("kpiCoeff", cfg.kpi_coeff);
  setVal("allowanceGas", cfg.allowance_gas);
  setVal("allowanceHouse", cfg.allowance_house);
  setVal("allowanceChild", cfg.allowance_child);
  setVal("allowanceSafety", cfg.allowance_safety);
  setVal("allowanceNight", cfg.allowance_night);
  setVal("allowanceMealNight", cfg.allowance_meal_night);
  setVal("allowancePeriod", cfg.allowance_period);
  setVal("allowanceOther", cfg.allowance_other);
  setVal("bonusAttendance", cfg.bonus_attendance);
  setVal("bonusKPI", cfg.bonus_kpi);
  setVal("bankAccount", cfg.bank_account);
  setVal("bankName", cfg.bank_name);
  if (cfg.is_tax_exempt !== undefined && document.getElementById("taxExemptToggle")) {
    document.getElementById("taxExemptToggle").checked = (cfg.is_tax_exempt == 1);
  }
}

function collectConfigPayload() {
  return {
    year: currentYear,
    month: currentMonth,
    base_salary: parseVal(document.getElementById("baseSalary").value),
    pos_allowance: parseVal(document.getElementById("positionAllowance").value),
    sen_allowance: parseVal(document.getElementById("seniorityAllowance").value),
    kpi_coeff: parseVal(document.getElementById("kpiCoeff").value),
    allowance_gas: parseVal(document.getElementById("allowanceGas").value),
    allowance_house: parseVal(document.getElementById("allowanceHouse").value),
    allowance_child: parseVal(document.getElementById("allowanceChild").value),
    allowance_safety: parseVal(document.getElementById("allowanceSafety").value),
    allowance_night: parseVal(document.getElementById("allowanceNight").value),
    allowance_meal_night: parseVal(document.getElementById("allowanceMealNight").value),
    allowance_period: parseVal(document.getElementById("allowancePeriod").value),
    allowance_other: parseVal(document.getElementById("allowanceOther").value),
    bonus_attendance: parseVal(document.getElementById("bonusAttendance").value),
    bonus_kpi: parseVal(document.getElementById("bonusKPI").value),
    is_tax_exempt: (document.getElementById("taxExemptToggle") && document.getElementById("taxExemptToggle").checked) ? 1 : 0,
    bank_account: document.getElementById("bankAccount").value,
    bank_name: document.getElementById("bankName").value
  };
}

async function saveCurrentMonthToBackend(silent = false) {
  // Save to localStorage as backup
  localStorage.setItem(`att_${currentYear}_${currentMonth}`, JSON.stringify(monthlyStore[currentMonth] || {}));
  const cfgPayload = collectConfigPayload();
  localStorage.setItem(`cfg_${currentYear}_${currentMonth}`, JSON.stringify(cfgPayload));

  if (!isBackendConnected) {
    if (!silent) showToast("Đã lưu dữ liệu vào trình duyệt (Offline)", "info");
    return;
  }

  try {
    // 1. Save attendance
    const attResp = await fetch(`${API_BASE}/api/attendance/${currentYear}/${currentMonth}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: currentYear,
        month: currentMonth,
        days: monthlyStore[currentMonth] || {}
      })
    });

    // 2. Save salary config
    const cfgResp = await fetch(`${API_BASE}/api/config/${currentYear}/${currentMonth}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfgPayload)
    });

    if (attResp.ok && cfgResp.ok) {
      if (!silent) showToast(`✅ Đã lưu Tháng ${currentMonth}/${currentYear} vào CSDL SQLite!`);
    } else {
      if (!silent) showToast("Có lỗi khi lưu vào backend", "info");
    }
  } catch (e) {
    console.error("Lỗi lưu backend:", e);
    if (!silent) showToast("Không kết nối được backend, đã lưu vào trình duyệt", "info");
  }
}

function triggerAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveCurrentMonthToBackend(true);
  }, 1200);
}

// Button "Lưu CSDL"
document.getElementById("btnSaveToDB").addEventListener("click", () => {
  saveCurrentMonthToBackend(false);
});

// Khởi chạy khi tải trang
window.addEventListener("DOMContentLoaded", async () => {
  initializeDefaultData();
  await checkBackendStatus();
  await loadFromBackendOrStorage(currentMonth, currentYear);
  renderUnifiedTable();
});
