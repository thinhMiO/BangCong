// ========================================================
// HỆ THỐNG BẢNG CHẤM CÔNG & TÍNH LƯƠNG TỰ ĐỘNG
// CÔNG THỨC CHUẨN: TIỀN OT = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ OT x % OT
// ========================================================

const VIETNAMESE_WEEKDAYS = [
  "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"
];

// Current State (Mặc định lấy đúng tháng và năm hiện tại của hệ thống)
const _initialNow = new Date();
let currentMonth = _initialNow.getMonth() + 1;
let currentYear = _initialNow.getFullYear();
let currentView = "unified"; // 'unified' or 'summary'
let filterOnlyWorkedMonths = true; // Mặc định: Chỉ hiện các tháng có dữ liệu chấm công
window.currentMonth = currentMonth;
window.currentYear = currentYear;
window.filterOnlyWorkedMonths = filterOnlyWorkedMonths;

// All 12 months data store
let monthlyStore = {};
window.monthlyStore = monthlyStore;

// All 12 months independent salary configuration store (Hồ sơ lương riêng biệt từng tháng)
let monthlyConfigStore = {};
window.monthlyConfigStore = monthlyConfigStore;

// Multi-year storage cache: allYearsStore[year] = { attendance, configs }
let allYearsStore = {};
window.allYearsStore = allYearsStore;

// ========================================================
// HỆ THỐNG ĐA NHÂN VIÊN (MULTI-EMPLOYEE PROFILES)
// Mỗi nhân viên có hồ sơ mức lương, phụ cấp và bảng chấm công riêng biệt
// ========================================================
let employeesList = [
  {
    id: "emp_default",
    name: "Nguyễn Công Thịnh",
    dept: "工程部 (Bộ phận Kỹ thuật)",
    cardId: "0838",
    startDate: "21/7/2025",
    probationEndDate: "20/9/2025",
    annualLeaveTotal: 10
  }
];
let currentEmpId = "emp_default";
let employeesDataStore = {};
let currentAuthRole = null; // 'admin' | 'employee' | null
let currentAuthEmpId = null; // empId if 'employee'
let adminPassword = "admin123";

window.employeesList = employeesList;
window.currentEmpId = currentEmpId;
window.employeesDataStore = employeesDataStore;
window.currentAuthRole = currentAuthRole;

// ========================================================
// BỘ HỖ TRỢ LƯU TRỮ TÁCH BIỆT THEO TỪNG NHÂN VIÊN
// Đảm bảo dữ liệu bảng công & phiếu lương của nhân viên nào
// được cô lập hoàn toàn cho nhân viên đó (Khóa ngoại: empId)
// ========================================================
function getAttStorageKey(year, month, empId) {
  const eId = empId || currentEmpId || "emp_default";
  return `att_${eId}_${year}_${month}`;
}
function getCfgStorageKey(year, month, empId) {
  const eId = empId || currentEmpId || "emp_default";
  return `cfg_${eId}_${year}_${month}`;
}
function readAttStorage(year, month, empId) {
  const eId = empId || currentEmpId || "emp_default";
  let s = localStorage.getItem(`att_${eId}_${year}_${month}`);
  if (!s && eId === "emp_default") {
    s = localStorage.getItem(`att_${year}_${month}`);
  }
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
function readCfgStorage(year, month, empId) {
  const eId = empId || currentEmpId || "emp_default";
  let s = localStorage.getItem(`cfg_${eId}_${year}_${month}`);
  if (!s && eId === "emp_default") {
    s = localStorage.getItem(`cfg_${year}_${month}`);
  }
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { return null; }
}
function writeAttStorage(year, month, data, empId) {
  const eId = empId || currentEmpId || "emp_default";
  localStorage.setItem(`att_${eId}_${year}_${month}`, JSON.stringify(data || {}));
}
function writeCfgStorage(year, month, data, empId) {
  const eId = empId || currentEmpId || "emp_default";
  localStorage.setItem(`cfg_${eId}_${year}_${month}`, JSON.stringify(data || {}));
}

function initEmployees() {
  try {
    const savedList = localStorage.getItem("app_employees_list");
    if (savedList) {
      const parsed = JSON.parse(savedList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        employeesList = parsed;
        window.employeesList = employeesList;
      }
    }
  } catch (e) {}

  // Đảm bảo tất cả nhân viên đều có Ngày vào xưởng, Ngày hết thử việc và Tổng ngày phép năm hợp lệ
  employeesList.forEach(emp => {
    if (!emp.cardId) {
      if (emp.id === "emp_default") emp.cardId = "1028";
      else emp.cardId = "NV" + (emp.id.replace(/\D/g, "").slice(-4) || "0001");
    }
    if (emp.id === "emp_default") {
      if (!emp.startDate) emp.startDate = "21/7/2025";
      if (!emp.probationEndDate) emp.probationEndDate = "20/9/2025";
      if (emp.annualLeaveTotal === undefined || isNaN(emp.annualLeaveTotal) || emp.annualLeaveTotal >= 20) {
        emp.annualLeaveTotal = 10;
      }
    } else {
      if (!emp.startDate) emp.startDate = "";
      if (!emp.probationEndDate) emp.probationEndDate = "";
      if (emp.annualLeaveTotal === undefined || isNaN(emp.annualLeaveTotal) || emp.annualLeaveTotal >= 20) {
        emp.annualLeaveTotal = 12;
      }
    }
  });

  // Dọn dẹp cache allYearsStore nếu có số liệu cũ bị lỗi 30
  if (allYearsStore) {
    Object.keys(allYearsStore).forEach(y => {
      if (allYearsStore[y] && (allYearsStore[y].annualLeaveTotal >= 20 || allYearsStore[y].annualLeaveTotalManual >= 20)) {
        delete allYearsStore[y].annualLeaveTotal;
        delete allYearsStore[y].annualLeaveTotalManual;
      }
    });
  }

  try {
    const savedEmpId = localStorage.getItem("app_current_emp_id");
    if (savedEmpId && employeesList.some(e => e.id === savedEmpId)) {
      currentEmpId = savedEmpId;
    } else {
      currentEmpId = employeesList[0].id;
    }
    window.currentEmpId = currentEmpId;
  } catch (e) {}

  // Nạp dữ liệu của từng nhân viên từ localStorage
  employeesList.forEach(emp => {
    try {
      const raw = localStorage.getItem("emp_data_" + emp.id);
      if (raw) {
        employeesDataStore[emp.id] = JSON.parse(raw);
      }
    } catch (e) {}
    if (!employeesDataStore[emp.id]) {
      employeesDataStore[emp.id] = { years: {} };
    }
  });

  // Tương thích ngược: Nếu emp_default chưa có years trong store, nạp từ allYearsStore hoặc localStorage cũ
  if (employeesDataStore["emp_default"] && (!employeesDataStore["emp_default"].years || Object.keys(employeesDataStore["emp_default"].years).length === 0)) {
    if (allYearsStore && Object.keys(allYearsStore).length > 0) {
      employeesDataStore["emp_default"].years = JSON.parse(JSON.stringify(allYearsStore));
    } else {
      const legacyYears = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const m = k.match(/^(?:att|cfg)_(\d{4})_(\d+)$/);
        if (m) {
          const y = parseInt(m[1]);
          const month = parseInt(m[2]);
          if (!legacyYears[y]) legacyYears[y] = { attendance: {}, configs: {} };
          try {
            const val = JSON.parse(localStorage.getItem(k));
            if (k.startsWith("att_")) legacyYears[y].attendance[month] = val;
            else legacyYears[y].configs[month] = val;
          } catch (e) {}
        }
      }
      employeesDataStore["emp_default"].years = legacyYears;
    }
    try {
      localStorage.setItem("emp_data_emp_default", JSON.stringify(employeesDataStore["emp_default"]));
      localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
      localStorage.setItem("app_current_emp_id", currentEmpId);
    } catch (e) {}
  }

  loadEmployeeData(currentEmpId, true);
  renderEmployeeSelect();
}

function loadEmployeeData(empId, isInitial = false) {
  const emp = employeesList.find(e => e.id === empId) || employeesList[0];
  currentEmpId = emp.id;
  window.currentEmpId = currentEmpId;

  if (!employeesDataStore[currentEmpId]) {
    employeesDataStore[currentEmpId] = { years: {} };
  }
  if (!employeesDataStore[currentEmpId].years) {
    employeesDataStore[currentEmpId].years = {};
  }

  allYearsStore = employeesDataStore[currentEmpId].years;
  window.allYearsStore = allYearsStore;

  const empNameEl = document.getElementById("empName");
  if (empNameEl) empNameEl.value = emp.name;
  const empDeptEl = document.getElementById("empDept");
  if (empDeptEl) empDeptEl.value = emp.dept || "";
  const empCardIdEl = document.getElementById("empCardId");
  if (empCardIdEl) empCardIdEl.value = emp.cardId || "";
  const empStartEl = document.getElementById("empStartDate");
  if (empStartEl) empStartEl.value = emp.startDate || "21/7/2025";
  const empProbationEl = document.getElementById("empProbationEndDate");
  if (empProbationEl) empProbationEl.value = emp.probationEndDate || "20/9/2025";

  initializeDefaultData();
  loadConfigStoreToInputs(currentMonth);
  renderAnnualLeaveTable();
}

function saveCurrentEmployeeData() {
  if (!currentEmpId) return;

  const emp = employeesList.find(e => e.id === currentEmpId);
  if (emp) {
    const empNameEl = document.getElementById("empName");
    if (empNameEl && empNameEl.value.trim()) emp.name = empNameEl.value.trim();
    const empDeptEl = document.getElementById("empDept");
    if (empDeptEl && empDeptEl.value.trim()) emp.dept = empDeptEl.value.trim();
    const empCardIdEl = document.getElementById("empCardId");
    if (empCardIdEl && empCardIdEl.value.trim()) emp.cardId = empCardIdEl.value.trim();
    const empStartEl = document.getElementById("empStartDate");
    if (empStartEl && empStartEl.value.trim()) emp.startDate = empStartEl.value.trim();
    const empProbationEl = document.getElementById("empProbationEndDate");
    if (empProbationEl && empProbationEl.value.trim()) emp.probationEndDate = empProbationEl.value.trim();
    const elLeave = document.getElementById("annualLeaveTotal");
    if (elLeave && elLeave.value.trim() !== "" && !isNaN(parseFloat(elLeave.value))) {
      const val = parseFloat(elLeave.value);
      if (!allYearsStore[currentYear]) allYearsStore[currentYear] = {};
      allYearsStore[currentYear].annualLeaveTotalManual = val;
      allYearsStore[currentYear].annualLeaveTotal = val;
      emp.annualLeaveTotal = val;
    }
    const elLeaveUsed = document.getElementById("annualLeaveUsed");
    if (elLeaveUsed && elLeaveUsed.value.trim() !== "" && !isNaN(parseFloat(elLeaveUsed.value))) {
      const val = parseFloat(elLeaveUsed.value);
      const stats = getEmployeeAnnualLeaveStats(currentEmpId, currentYear);
      const tUsed = stats ? stats.timesheetUsed : 0;
      const priorVal = Math.max(0, Math.round((val - tUsed) * 10) / 10);
      if (!allYearsStore[currentYear]) allYearsStore[currentYear] = {};
      allYearsStore[currentYear].annualLeaveUsedManual = priorVal;
    }
  }

  saveCurrentMonthInputsToConfigStore();
  saveYearToMemoryAndStorage(currentYear);

  if (!employeesDataStore[currentEmpId]) {
    employeesDataStore[currentEmpId] = { years: {} };
  }
  employeesDataStore[currentEmpId].years = JSON.parse(JSON.stringify(allYearsStore));

  try {
    localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
    localStorage.setItem("app_current_emp_id", currentEmpId);
    localStorage.setItem("emp_data_" + currentEmpId, JSON.stringify(employeesDataStore[currentEmpId]));
  } catch (e) {}
}

async function switchEmployee(targetEmpId) {
  if (!targetEmpId || targetEmpId === currentEmpId) return;
  if (currentAuthRole === "employee" && targetEmpId !== currentAuthEmpId) {
    showToast("⚠️ Bạn chỉ có quyền xem bảng công của chính mình!");
    return;
  }
  // Lưu toàn bộ dữ liệu của nhân viên vừa chuyển đi
  saveCurrentEmployeeData();
  saveYearToMemoryAndStorage(currentYear);
  if (typeof saveCurrentMonthToBackend === "function") {
    await saveCurrentMonthToBackend(true);
  }

  currentEmpId = targetEmpId;
  window.currentEmpId = currentEmpId;
  localStorage.setItem("app_current_emp_id", currentEmpId);

  // Nạp hồ sơ của nhân viên mới
  loadEmployeeData(currentEmpId);
  if (typeof loadAllMonthsFromBackendOrStorage === "function") {
    await loadAllMonthsFromBackendOrStorage(currentYear, currentEmpId);
  }
  if (typeof loadFromBackendOrStorage === "function") {
    await loadFromBackendOrStorage(currentMonth, currentYear, currentEmpId);
  }

  renderEmployeeSelect();
  loadConfigStoreToInputs(currentMonth);
  renderUnifiedTable();
  recalculateMonth();
  renderYearSummary();
  renderMultiYearSummary();
  renderAnnualLeaveTable();
  triggerFirebaseAutoSync();

  const emp = employeesList.find(e => e.id === currentEmpId);
  if (emp) showToast(`👤 Đã chuyển sang: ${emp.name} (MST: ${emp.cardId || "---"})`);
}

function renderEmployeeSelect() {
  const selects = [
    document.getElementById("selectEmployee"),
    document.getElementById("selectEmployeeSummary")
  ];
  // Nếu đang là nhân viên đăng nhập: chỉ hiện hồ sơ của chính người đó
  const listToRender = (currentAuthRole === "employee" && currentAuthEmpId)
    ? employeesList.filter(e => e.id === currentAuthEmpId)
    : employeesList;

  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = "";
    listToRender.forEach(emp => {
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = `${emp.name}${emp.cardId ? ` [${emp.cardId}]` : ""}${emp.dept ? ` (${emp.dept})` : ""}`;
      if (emp.id === currentEmpId) opt.selected = true;
      sel.appendChild(opt);
    });
  });

  applyAuthUI();
}

function addNewEmployee(name, dept, cardId, annualLeaveTotal, baseSalary, posAllowance, senAllowance, bankAccount, bankName, startDate, probationEndDate, annualLeaveUsed, extraSalaryConfig) {
  saveCurrentEmployeeData();

  const newId = "emp_" + Date.now();
  const newEmp = {
    id: newId,
    name: name.trim() || "Nhân viên mới",
    dept: (dept || "").trim(),
    cardId: (cardId || "").trim() || ("NV" + Date.now().toString().slice(-4)),
    annualLeaveTotal: (annualLeaveTotal !== undefined && !isNaN(annualLeaveTotal)) ? parseFloat(annualLeaveTotal) : 10,
    startDate: (startDate !== undefined) ? startDate.trim() : "",
    probationEndDate: (probationEndDate !== undefined) ? probationEndDate.trim() : ""
  };
  employeesList.push(newEmp);
  window.employeesList = employeesList;

  currentEmpId = newId;
  window.currentEmpId = currentEmpId;

  const customCfg = getDefaultSalaryConfig(currentMonth);
  if (extraSalaryConfig && typeof extraSalaryConfig === "object") {
    Object.assign(customCfg, extraSalaryConfig);
  } else {
    if (baseSalary !== undefined && !isNaN(baseSalary) && baseSalary > 0) {
      customCfg.baseSalary = baseSalary;
    }
    customCfg.positionAllowance = (posAllowance !== undefined && !isNaN(posAllowance)) ? posAllowance : 0;
    customCfg.seniorityAllowance = (senAllowance !== undefined && !isNaN(senAllowance)) ? senAllowance : 0;
    customCfg.bankAccount = (bankAccount !== undefined && bankAccount !== null) ? bankAccount.trim() : "";
    customCfg.bankName = (bankName !== undefined && bankName !== null) ? bankName.trim() : "";
  }

  const newCfgs = {};
  for (let m = 1; m <= 12; m++) {
    newCfgs[m] = Object.assign({}, customCfg);
    writeCfgStorage(currentYear, m, newCfgs[m], newId);
    writeAttStorage(currentYear, m, {}, newId);
  }

  const newYears = {};
  newYears[currentYear] = {
    attendance: {},
    configs: newCfgs,
    annualLeaveTotal: newEmp.annualLeaveTotal,
    annualLeaveTotalManual: newEmp.annualLeaveTotal
  };
  if (annualLeaveUsed !== undefined && !isNaN(annualLeaveUsed)) {
    newYears[currentYear].annualLeaveUsedManual = parseFloat(annualLeaveUsed);
  }

  employeesDataStore[newId] = { years: newYears };
  try {
    localStorage.setItem("emp_data_" + newId, JSON.stringify(employeesDataStore[newId]));
    localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
    localStorage.setItem("app_current_emp_id", currentEmpId);
  } catch (e) {}

  // Đồng bộ nhân viên mới sang CSDL Backend nếu có
  if (isBackendConnected) {
    try {
      fetch(`${API_BASE}/api/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newEmp.id,
          name: newEmp.name,
          dept: newEmp.dept,
          card_id: newEmp.cardId,
          start_date: newEmp.startDate,
          probation_end_date: newEmp.probationEndDate,
          annual_leave_total: newEmp.annualLeaveTotal
        })
      });
      // Lưu luôn cấu hình lương tháng hiện tại cho nhân viên này lên SQLite
      const cfgPayload = Object.assign({ emp_id: newId, year: currentYear, month: currentMonth }, customCfg);
      fetch(`${API_BASE}/api/config/${currentYear}/${currentMonth}?emp_id=${encodeURIComponent(newId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfgPayload)
      });
    } catch (e) {}
  }

  loadEmployeeData(currentEmpId);
  renderEmployeeSelect();
  renderUnifiedTable();
  renderMultiYearSummary();
  triggerFirebaseAutoSync();

  showToast(`🎉 Đã thêm nhân viên: ${newEmp.name} (MST: ${newEmp.cardId})!`);
}

function updateCurrentEmployeeInfo(name, dept, cardId, annualLeaveTotal, baseSalary, posAllowance, senAllowance, bankAccount, bankName, startDate, probationEndDate, annualLeaveUsed, extraSalaryConfig) {
  const emp = employeesList.find(e => e.id === currentEmpId);
  if (!emp) return;
  if (name && name.trim()) emp.name = name.trim();
  if (dept !== undefined) emp.dept = dept.trim();
  if (cardId !== undefined && cardId.trim()) emp.cardId = cardId.trim();
  if (startDate !== undefined) emp.startDate = startDate.trim();
  if (probationEndDate !== undefined) emp.probationEndDate = probationEndDate.trim();
  if (annualLeaveTotal !== undefined && !isNaN(annualLeaveTotal)) {
    emp.annualLeaveTotal = parseFloat(annualLeaveTotal);
    if (!allYearsStore[currentYear]) allYearsStore[currentYear] = { attendance: {}, configs: {} };
    allYearsStore[currentYear].annualLeaveTotal = emp.annualLeaveTotal;
    allYearsStore[currentYear].annualLeaveTotalManual = emp.annualLeaveTotal;
    if (employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years) {
      if (!employeesDataStore[currentEmpId].years[currentYear]) employeesDataStore[currentEmpId].years[currentYear] = { attendance: {}, configs: {} };
      employeesDataStore[currentEmpId].years[currentYear].annualLeaveTotal = emp.annualLeaveTotal;
      employeesDataStore[currentEmpId].years[currentYear].annualLeaveTotalManual = emp.annualLeaveTotal;
    }
  }
  if (annualLeaveUsed !== undefined && !isNaN(annualLeaveUsed)) {
    if (!allYearsStore[currentYear]) allYearsStore[currentYear] = { attendance: {}, configs: {} };
    allYearsStore[currentYear].annualLeaveUsedManual = parseFloat(annualLeaveUsed);
    if (employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years) {
      if (!employeesDataStore[currentEmpId].years[currentYear]) employeesDataStore[currentEmpId].years[currentYear] = { attendance: {}, configs: {} };
      employeesDataStore[currentEmpId].years[currentYear].annualLeaveUsedManual = parseFloat(annualLeaveUsed);
    }
  }

  const empNameEl = document.getElementById("empName");
  if (empNameEl) empNameEl.value = emp.name;
  const empDeptEl = document.getElementById("empDept");
  if (empDeptEl) empDeptEl.value = emp.dept;
  const empCardIdEl = document.getElementById("empCardId");
  if (empCardIdEl) empCardIdEl.value = emp.cardId || "";
  const empStartEl = document.getElementById("empStartDate");
  if (empStartEl) empStartEl.value = emp.startDate || "21/7/2025";
  const empProbationEl = document.getElementById("empProbationEndDate");
  if (empProbationEl) empProbationEl.value = emp.probationEndDate || "20/9/2025";
  const leaveTotalEl = document.getElementById("annualLeaveTotal");
  if (leaveTotalEl) leaveTotalEl.value = emp.annualLeaveTotal || 10;

  if (!monthlyConfigStore[currentMonth]) {
    monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
  }
  const cfg = monthlyConfigStore[currentMonth];
  if (extraSalaryConfig && typeof extraSalaryConfig === "object") {
    Object.assign(cfg, extraSalaryConfig);
    loadConfigStoreToInputs(currentMonth);
  } else {
    if (baseSalary !== undefined && !isNaN(baseSalary) && baseSalary > 0) {
      cfg.baseSalary = baseSalary;
      const el = document.getElementById("baseSalary");
      if (el) el.value = baseSalary;
    }
    if (posAllowance !== undefined && !isNaN(posAllowance)) {
      cfg.positionAllowance = posAllowance;
      const el = document.getElementById("positionAllowance");
      if (el) el.value = posAllowance;
    }
    if (senAllowance !== undefined && !isNaN(senAllowance)) {
      cfg.seniorityAllowance = senAllowance;
      const el = document.getElementById("seniorityAllowance");
      if (el) el.value = senAllowance;
    }
    if (bankAccount !== undefined) {
      cfg.bankAccount = bankAccount.trim();
      const el = document.getElementById("bankAccount");
      if (el) el.value = cfg.bankAccount;
    }
    if (bankName !== undefined) {
      cfg.bankName = bankName.trim();
      const el = document.getElementById("bankName");
      if (el) el.value = cfg.bankName;
    }
  }

  saveCurrentEmployeeData();
  renderEmployeeSelect();
  recalculateMonth();
  renderYearSummary();
  renderMultiYearSummary();
  triggerFirebaseAutoSync();
  showToast(`✏️ Đã cập nhật thông tin: ${emp.name}`);
}
const renameCurrentEmployee = updateCurrentEmployeeInfo;

function deleteCurrentEmployee() {
  if (employeesList.length <= 1) {
    alert("Không thể xóa! Hệ thống cần giữ lại ít nhất 1 nhân viên.");
    return;
  }
  const emp = employeesList.find(e => e.id === currentEmpId);
  const empName = emp ? emp.name : "này";
  if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên "${empName}"?\nToàn bộ dữ liệu chấm công và bảng lương của nhân viên này sẽ bị xóa.`)) {
    return;
  }

  const toDelete = currentEmpId;
  employeesList = employeesList.filter(e => e.id !== toDelete);
  window.employeesList = employeesList;
  delete employeesDataStore[toDelete];
  try {
    localStorage.removeItem("emp_data_" + toDelete);
    localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
    // Dọn dẹp toàn bộ dữ liệu cache của nhân viên bị xóa
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(`att_${toDelete}_`) || k.startsWith(`cfg_${toDelete}_`))) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {}

  // Xóa khỏi SQLite backend nếu có
  if (isBackendConnected) {
    try {
      fetch(`${API_BASE}/api/employees/${encodeURIComponent(toDelete)}`, { method: "DELETE" });
    } catch (e) {}
  }

  currentEmpId = employeesList[0].id;
  localStorage.setItem("app_current_emp_id", currentEmpId);

  loadEmployeeData(currentEmpId);
  renderEmployeeSelect();
  renderUnifiedTable();
  renderMultiYearSummary();
  triggerFirebaseAutoSync();

  showToast(`🗑️ Đã xóa nhân viên và chuyển sang: ${employeesList[0].name}`);
}

function setupEmployeeEventListeners() {
  const selEmp = document.getElementById("selectEmployee");
  if (selEmp) {
    selEmp.addEventListener("change", (e) => {
      switchEmployee(e.target.value);
    });
  }
  const selEmpSum = document.getElementById("selectEmployeeSummary");
  if (selEmpSum) {
    selEmpSum.addEventListener("change", (e) => {
      switchEmployee(e.target.value);
    });
  }

  const modal = document.getElementById("modalEmployee");
  const modalTitle = document.getElementById("modalEmployeeTitle");
  const modalMode = document.getElementById("modalEmpMode");
  const modalName = document.getElementById("modalEmpName");
  const modalCardId = document.getElementById("modalEmpCardId");
  const modalDept = document.getElementById("modalEmpDept");
  const modalAnnualLeave = document.getElementById("modalEmpAnnualLeave");
  const modalAnnualLeaveUsed = document.getElementById("modalEmpAnnualLeaveUsed");
  const modalStartDate = document.getElementById("modalEmpStartDate");
  const modalProbationEndDate = document.getElementById("modalEmpProbationEndDate");
  const modalSalaryRow = document.getElementById("modalSalaryRow");
  const modalSalary = document.getElementById("modalEmpBaseSalary");
  const modalPosAllowance = document.getElementById("modalEmpPosAllowance");
  const modalSenAllowance = document.getElementById("modalEmpSenAllowance");
  const modalBankAccount = document.getElementById("modalEmpBankAccount");
  const modalBankName = document.getElementById("modalEmpBankName");

  // Các khoản phụ cấp trong modal
  const modalGas = document.getElementById("modalEmpGas");
  const modalHouse = document.getElementById("modalEmpHouse");
  const modalChild = document.getElementById("modalEmpChild");
  const modalSafety = document.getElementById("modalEmpSafety");
  const modalNight = document.getElementById("modalEmpNight");
  const modalMealNight = document.getElementById("modalEmpMealNight");
  const modalPeriod = document.getElementById("modalEmpPeriod");
  const modalOther = document.getElementById("modalEmpOther");

  // Các khoản thưởng trong modal
  const modalBonusAtt = document.getElementById("modalEmpBonusAtt");
  const modalBonusFullAtt = document.getElementById("modalEmpBonusFullAtt");
  const modalBonusEfficiency = document.getElementById("modalEmpBonusEfficiency");
  const modalBonusQualityStar = document.getElementById("modalEmpBonusQualityStar");
  const modalBonusPerformance = document.getElementById("modalEmpBonusPerformance");
  const modalBonusKPI = document.getElementById("modalEmpBonusKPI");
  const modalKpiCoeff = document.getElementById("modalEmpKpiCoeff");
  const modalBonusRecruitment = document.getElementById("modalEmpBonusRecruitment");

  const btnClose = document.getElementById("btnCloseEmpModal");
  const btnCancel = document.getElementById("btnCancelEmpModal");
  const form = document.getElementById("formEmployee");

  const openModal = (mode) => {
    if (!modal) return;
    modalMode.value = mode;
    if (mode === "add") {
      modalTitle.innerHTML = `<i class="fa-solid fa-user-plus"></i> Thêm Nhân Viên Mới`;
      modalName.value = "";
      if (modalCardId) modalCardId.value = "";
      modalDept.value = "";
      if (modalAnnualLeave) modalAnnualLeave.value = "10";
      if (modalAnnualLeaveUsed) modalAnnualLeaveUsed.value = "0";
      if (modalStartDate) modalStartDate.value = "";
      if (modalProbationEndDate) modalProbationEndDate.value = "";
      if (modalSalary) modalSalary.value = "6300000";
      if (modalPosAllowance) modalPosAllowance.value = "0";
      if (modalSenAllowance) modalSenAllowance.value = "0";
      if (modalBankAccount) modalBankAccount.value = "";
      if (modalBankName) modalBankName.value = "";

      // Phụ cấp mặc định
      if (modalGas) modalGas.value = "500000";
      if (modalHouse) modalHouse.value = "500000";
      if (modalChild) modalChild.value = "0";
      if (modalSafety) modalSafety.value = "0";
      if (modalNight) modalNight.value = "0";
      if (modalMealNight) modalMealNight.value = "0";
      if (modalPeriod) modalPeriod.value = "0";
      if (modalOther) modalOther.value = "0";

      // Thưởng mặc định
      if (modalBonusAtt) modalBonusAtt.value = "600000";
      if (modalBonusFullAtt) modalBonusFullAtt.value = "0";
      if (modalBonusEfficiency) modalBonusEfficiency.value = "0";
      if (modalBonusQualityStar) modalBonusQualityStar.value = "0";
      if (modalBonusPerformance) modalBonusPerformance.value = "0";
      if (modalBonusKPI) modalBonusKPI.value = "3050000";
      if (modalKpiCoeff) modalKpiCoeff.value = "1";
      if (modalBonusRecruitment) modalBonusRecruitment.value = "0";
    } else {
      modalTitle.innerHTML = `<i class="fa-solid fa-pen"></i> Chỉnh Sửa Hồ Sơ & Mức Lương Nhân Viên`;
      const emp = employeesList.find(e => e.id === currentEmpId);
      const curLeaveStats = getEmployeeAnnualLeaveStats(currentEmpId, currentYear);
      modalName.value = emp ? emp.name : "";
      if (modalCardId) modalCardId.value = emp ? (emp.cardId || "") : "";
      modalDept.value = emp ? (emp.dept || "") : "";
      if (modalAnnualLeave) modalAnnualLeave.value = emp ? (emp.annualLeaveTotal !== undefined ? emp.annualLeaveTotal : 10) : 10;
      if (modalAnnualLeaveUsed) modalAnnualLeaveUsed.value = curLeaveStats.usedInYear;
      if (modalStartDate) modalStartDate.value = emp ? (emp.startDate || "21/7/2025") : "21/7/2025";
      if (modalProbationEndDate) modalProbationEndDate.value = emp ? (emp.probationEndDate || "20/9/2025") : "20/9/2025";
      const cfg = monthlyConfigStore[currentMonth] || getDefaultSalaryConfig(currentMonth);
      if (modalSalary) modalSalary.value = cfg.baseSalary || 6300000;
      if (modalPosAllowance) modalPosAllowance.value = cfg.positionAllowance !== undefined ? cfg.positionAllowance : (currentEmpId === "emp_default" ? 2450000 : 0);
      if (modalSenAllowance) modalSenAllowance.value = cfg.seniorityAllowance !== undefined ? cfg.seniorityAllowance : (currentEmpId === "emp_default" ? 100000 : 0);
      if (modalBankAccount) modalBankAccount.value = cfg.bankAccount !== undefined ? cfg.bankAccount : (currentEmpId === "emp_default" ? "STK: 102884878810" : "");
      if (modalBankName) modalBankName.value = cfg.bankName !== undefined ? cfg.bankName : (currentEmpId === "emp_default" ? "VietinBank" : "");

      // Phụ cấp hiện tại
      if (modalGas) modalGas.value = (cfg.allowanceGas !== undefined) ? cfg.allowanceGas : 500000;
      if (modalHouse) modalHouse.value = (cfg.allowanceHouse !== undefined) ? cfg.allowanceHouse : 500000;
      if (modalChild) modalChild.value = (cfg.allowanceChild !== undefined) ? cfg.allowanceChild : 0;
      if (modalSafety) modalSafety.value = (cfg.allowanceSafety !== undefined) ? cfg.allowanceSafety : 0;
      if (modalNight) modalNight.value = (cfg.allowanceNight !== undefined) ? cfg.allowanceNight : 0;
      if (modalMealNight) modalMealNight.value = (cfg.allowanceMealNight !== undefined) ? cfg.allowanceMealNight : 0;
      if (modalPeriod) modalPeriod.value = (cfg.allowancePeriod !== undefined) ? cfg.allowancePeriod : 0;
      if (modalOther) modalOther.value = (cfg.allowanceOther !== undefined) ? cfg.allowanceOther : 0;

      // Thưởng hiện tại
      if (modalBonusAtt) modalBonusAtt.value = (cfg.bonusAttendance !== undefined) ? cfg.bonusAttendance : 600000;
      if (modalBonusFullAtt) modalBonusFullAtt.value = (cfg.bonusFullAttendance !== undefined) ? cfg.bonusFullAttendance : 0;
      if (modalBonusEfficiency) modalBonusEfficiency.value = (cfg.bonusEfficiency !== undefined) ? cfg.bonusEfficiency : 0;
      if (modalBonusQualityStar) modalBonusQualityStar.value = (cfg.bonusQualityStar !== undefined) ? cfg.bonusQualityStar : 0;
      if (modalBonusPerformance) modalBonusPerformance.value = (cfg.bonusPerformance !== undefined) ? cfg.bonusPerformance : 0;
      if (modalBonusKPI) modalBonusKPI.value = (cfg.bonusKPI !== undefined) ? cfg.bonusKPI : 3050000;
      if (modalKpiCoeff) modalKpiCoeff.value = (cfg.kpiCoeff !== undefined) ? cfg.kpiCoeff : 1;
      if (modalBonusRecruitment) modalBonusRecruitment.value = (cfg.bonusRecruitment !== undefined) ? cfg.bonusRecruitment : 0;
    }
    if (modalSalaryRow) modalSalaryRow.classList.remove("hidden");
    modal.classList.remove("hidden");
    modalName.focus();
  };

  const closeModal = () => {
    if (modal) modal.classList.add("hidden");
  };

  const btnAdd = document.getElementById("btnAddNewEmp");
  if (btnAdd) btnAdd.addEventListener("click", () => openModal("add"));
  const btnRename = document.getElementById("btnRenameEmp");
  if (btnRename) btnRename.addEventListener("click", () => openModal("rename"));
  const btnDel = document.getElementById("btnDeleteEmp");
  if (btnDel) btnDel.addEventListener("click", () => deleteCurrentEmployee());

  if (btnClose) btnClose.addEventListener("click", closeModal);
  if (btnCancel) btnCancel.addEventListener("click", closeModal);

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = modalName.value.trim();
      const cardId = modalCardId ? modalCardId.value.trim() : "";
      const dept = modalDept.value.trim();
      const annualLeave = modalAnnualLeave ? (parseFloat(modalAnnualLeave.value) || 10) : 10;
      const annualLeaveUsed = modalAnnualLeaveUsed && modalAnnualLeaveUsed.value !== "" ? (parseFloat(modalAnnualLeaveUsed.value) || 0) : undefined;
      const sDate = modalStartDate ? modalStartDate.value.trim() : "";
      const pDate = modalProbationEndDate ? modalProbationEndDate.value.trim() : "";
      if (!name) return;
      const baseSal = modalSalary ? (parseFloat(modalSalary.value) || 6300000) : 6300000;
      const posAll = modalPosAllowance ? (parseFloat(modalPosAllowance.value) || 0) : 0;
      const senAll = modalSenAllowance ? (parseFloat(modalSenAllowance.value) || 0) : 0;
      const bankAcc = modalBankAccount ? modalBankAccount.value.trim() : "";
      const bankNm = modalBankName ? modalBankName.value.trim() : "";

      const extraSalaryConfig = {
        baseSalary: baseSal,
        positionAllowance: posAll,
        seniorityAllowance: senAll,
        allowanceGas: modalGas && modalGas.value !== "" ? (parseFloat(modalGas.value) || 0) : 500000,
        allowanceHouse: modalHouse && modalHouse.value !== "" ? (parseFloat(modalHouse.value) || 0) : 500000,
        allowanceChild: modalChild && modalChild.value !== "" ? (parseFloat(modalChild.value) || 0) : 0,
        allowanceSafety: modalSafety && modalSafety.value !== "" ? (parseFloat(modalSafety.value) || 0) : 0,
        allowanceNight: modalNight && modalNight.value !== "" ? (parseFloat(modalNight.value) || 0) : 0,
        allowanceMealNight: modalMealNight && modalMealNight.value !== "" ? (parseFloat(modalMealNight.value) || 0) : 0,
        allowancePeriod: modalPeriod && modalPeriod.value !== "" ? (parseFloat(modalPeriod.value) || 0) : 0,
        allowanceOther: modalOther && modalOther.value !== "" ? (parseFloat(modalOther.value) || 0) : 0,
        bonusAttendance: modalBonusAtt && modalBonusAtt.value !== "" ? (parseFloat(modalBonusAtt.value) || 0) : 600000,
        bonusFullAttendance: modalBonusFullAtt && modalBonusFullAtt.value !== "" ? (parseFloat(modalBonusFullAtt.value) || 0) : 0,
        bonusEfficiency: modalBonusEfficiency && modalBonusEfficiency.value !== "" ? (parseFloat(modalBonusEfficiency.value) || 0) : 0,
        bonusQualityStar: modalBonusQualityStar && modalBonusQualityStar.value !== "" ? (parseFloat(modalBonusQualityStar.value) || 0) : 0,
        bonusPerformance: modalBonusPerformance && modalBonusPerformance.value !== "" ? (parseFloat(modalBonusPerformance.value) || 0) : 0,
        bonusKPI: modalBonusKPI && modalBonusKPI.value !== "" ? (parseFloat(modalBonusKPI.value) || 0) : 3050000,
        kpiCoeff: modalKpiCoeff && modalKpiCoeff.value !== "" ? (parseFloat(modalKpiCoeff.value) || 1) : 1,
        bonusRecruitment: modalBonusRecruitment && modalBonusRecruitment.value !== "" ? (parseFloat(modalBonusRecruitment.value) || 0) : 0,
        bankAccount: bankAcc,
        bankName: bankNm
      };

      if (modalMode.value === "add") {
        addNewEmployee(name, dept, cardId, annualLeave, baseSal, posAll, senAll, bankAcc, bankNm, sDate, pDate, annualLeaveUsed, extraSalaryConfig);
      } else {
        updateCurrentEmployeeInfo(name, dept, cardId, annualLeave, baseSal, posAll, senAll, bankAcc, bankNm, sDate, pDate, annualLeaveUsed, extraSalaryConfig);
      }
      renderAnnualLeaveTable();
      closeModal();
    });
  }

  // Tự động đồng bộ khi sửa trực tiếp họ tên / mã số thẻ / bộ phận / ngày phép trong bảng lương
  const elEmpName = document.getElementById("empName");
  if (elEmpName) {
    elEmpName.addEventListener("input", () => {
      const emp = employeesList.find(e => e.id === currentEmpId);
      if (emp) {
        emp.name = elEmpName.value.trim() || "Chưa đặt tên";
        renderEmployeeSelect();
        try {
          localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
        } catch (e) {}
        triggerFirebaseAutoSync();
      }
    });
  }
  const elEmpCardId = document.getElementById("empCardId");
  if (elEmpCardId) {
    elEmpCardId.addEventListener("input", () => {
      const emp = employeesList.find(e => e.id === currentEmpId);
      if (emp) {
        emp.cardId = elEmpCardId.value.trim();
        renderEmployeeSelect();
        try {
          localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
        } catch (e) {}
        triggerFirebaseAutoSync();
      }
    });
  }
  const elEmpDept = document.getElementById("empDept");
  if (elEmpDept) {
    elEmpDept.addEventListener("input", () => {
      const emp = employeesList.find(e => e.id === currentEmpId);
      if (emp) {
        emp.dept = elEmpDept.value.trim();
        renderEmployeeSelect();
        try {
          localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
        } catch (e) {}
        triggerFirebaseAutoSync();
      }
    });
  }

  // Sửa Ngày vào xưởng trực tiếp trên bảng
  const elEmpStartDate = document.getElementById("empStartDate");
  if (elEmpStartDate) {
    elEmpStartDate.addEventListener("input", () => {
      const emp = employeesList.find(e => e.id === currentEmpId);
      if (emp) {
        emp.startDate = elEmpStartDate.value.trim();
        try {
          localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
        } catch (e) {}
        saveCurrentEmployeeData();
        triggerFirebaseAutoSync();
      }
    });
  }

  // Sửa Ngày hết thử việc trực tiếp trên bảng
  const elEmpProbationEndDate = document.getElementById("empProbationEndDate");
  if (elEmpProbationEndDate) {
    elEmpProbationEndDate.addEventListener("input", () => {
      const emp = employeesList.find(e => e.id === currentEmpId);
      if (emp) {
        emp.probationEndDate = elEmpProbationEndDate.value.trim();
        try {
          localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
        } catch (e) {}
        saveCurrentEmployeeData();
        triggerFirebaseAutoSync();
      }
    });
  }

  // Sửa tổng ngày phép năm ngay trên bảng
  const elLeaveTotal = document.getElementById("annualLeaveTotal");
  if (elLeaveTotal) {
    elLeaveTotal.addEventListener("input", () => {
      const rawVal = elLeaveTotal.value.trim();
      if (rawVal === "") {
        if (!allYearsStore[currentYear]) allYearsStore[currentYear] = {};
        delete allYearsStore[currentYear].annualLeaveTotalManual;
        delete allYearsStore[currentYear].annualLeaveTotal;
        if (employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years && employeesDataStore[currentEmpId].years[currentYear]) {
          delete employeesDataStore[currentEmpId].years[currentYear].annualLeaveTotalManual;
          delete employeesDataStore[currentEmpId].years[currentYear].annualLeaveTotal;
        }
      } else {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= 0) {
          if (!allYearsStore[currentYear]) allYearsStore[currentYear] = { attendance: {}, configs: {} };
          allYearsStore[currentYear].annualLeaveTotalManual = val;
          allYearsStore[currentYear].annualLeaveTotal = val;
          const emp = employeesList.find(e => e.id === currentEmpId);
          if (emp) emp.annualLeaveTotal = val;

          if (!employeesDataStore[currentEmpId]) employeesDataStore[currentEmpId] = { years: {} };
          if (!employeesDataStore[currentEmpId].years) employeesDataStore[currentEmpId].years = {};
          if (!employeesDataStore[currentEmpId].years[currentYear]) {
            employeesDataStore[currentEmpId].years[currentYear] = {};
          }
          employeesDataStore[currentEmpId].years[currentYear].annualLeaveTotalManual = val;
          employeesDataStore[currentEmpId].years[currentYear].annualLeaveTotal = val;
        }
      }
      renderAnnualLeaveTable();
      saveCurrentEmployeeData();
      triggerFirebaseAutoSync();
    });
  }

  // Sửa số ngày phép đã nghỉ trực tiếp trên bảng (cho người cũ đã nghỉ từ các tháng trước)
  const elLeaveUsed = document.getElementById("annualLeaveUsed");
  if (elLeaveUsed) {
    elLeaveUsed.addEventListener("input", () => {
      const rawVal = elLeaveUsed.value.trim();
      if (rawVal === "") {
        if (!allYearsStore[currentYear]) allYearsStore[currentYear] = {};
        delete allYearsStore[currentYear].annualLeaveUsedManual;
        if (employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years && employeesDataStore[currentEmpId].years[currentYear]) {
          delete employeesDataStore[currentEmpId].years[currentYear].annualLeaveUsedManual;
        }
      } else {
        const val = parseFloat(rawVal);
        if (!isNaN(val) && val >= 0) {
          const stats = getEmployeeAnnualLeaveStats(currentEmpId, currentYear);
          const tUsed = stats ? stats.timesheetUsed : 0;
          const priorVal = Math.max(0, Math.round((val - tUsed) * 10) / 10);

          if (!allYearsStore[currentYear]) allYearsStore[currentYear] = { attendance: {}, configs: {} };
          allYearsStore[currentYear].annualLeaveUsedManual = priorVal;
          if (!employeesDataStore[currentEmpId]) employeesDataStore[currentEmpId] = { years: {} };
          if (!employeesDataStore[currentEmpId].years) employeesDataStore[currentEmpId].years = {};
          if (!employeesDataStore[currentEmpId].years[currentYear]) {
            employeesDataStore[currentEmpId].years[currentYear] = {};
          }
          employeesDataStore[currentEmpId].years[currentYear].annualLeaveUsedManual = priorVal;
        }
      }
      renderAnnualLeaveTable();
      saveCurrentEmployeeData();
      triggerFirebaseAutoSync();
    });
  }
}

// ========================================================
// HỆ THỐNG PHÂN QUYỀN & TRA CỨU BẢNG LƯƠNG NHÂN VIÊN
// (Nhân viên của ai xem của người đó theo Tên & Mã số thẻ)
// ========================================================

function normalizeSearchStr(s) {
  return (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function renderLoginDatalist() {
  const dl = document.getElementById("loginEmpDatalist");
  if (!dl) return;
  dl.innerHTML = "";
  employeesList.forEach(emp => {
    const opt = document.createElement("option");
    opt.value = emp.name;
    dl.appendChild(opt);
  });
}

function showAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.remove("hidden");
  renderLoginDatalist();
  const empNameInput = document.getElementById("loginEmpName");
  if (empNameInput) empNameInput.focus();
}

function hideAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.classList.add("hidden");
}

function applyAuthUI() {
  const badge = document.getElementById("authBadge");
  const badgeText = document.getElementById("authBadgeText");
  const adminControls = document.getElementById("empAdminControls");
  const selEmp = document.getElementById("selectEmployee");
  const selEmpSummary = document.getElementById("selectEmployeeSummary");
  const empLockedLabel = document.getElementById("empLockedLabel");
  const empLockedSummaryLabel = document.getElementById("empLockedSummaryLabel");

  // Nhân viên và Admin ĐỀU ĐƯỢC PHÉP CHỈNH SỬA Bảng Chấm Công, Ngày Phép Tồn và Bảng Tính Tiền Lương của chính mình
  const inputsToEnable = [
    "empName", "empDept", "empCardId", "empStartDate", "empProbationEndDate",
    "annualLeaveTotal", "annualLeaveUsed",
    "baseSalary", "positionAllowance", "seniorityAllowance", "kpiCoeff", "kpiCoeffInline",
    "allowanceGas", "allowanceHouse", "allowanceChild", "allowanceSafety",
    "allowanceNight", "allowanceMealNight", "allowancePeriod", "allowanceOther",
    "bonusAttendance", "bonusFullAttendance", "bonusEfficiency", "bonusQualityStar", "bonusPerformance", "bonusKPI", "bonusRecruitment", "bankAccount", "bankName", "taxExemptToggle"
  ];

  inputsToEnable.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.readOnly = false;
      el.disabled = false;
      el.classList.remove("cursor-not-allowed", "bg-slate-100", "select-none", "opacity-80");
      el.removeAttribute("tabindex");
      el.title = "";
    }
  });

  // Mở khóa toàn bộ các ô trong Bảng Chấm Công
  document.querySelectorAll("#tbodyAttendanceUnified input").forEach(inp => {
    inp.readOnly = false;
    inp.disabled = false;
    inp.classList.remove("cursor-not-allowed", "bg-slate-50", "select-none");
    inp.removeAttribute("tabindex");
  });
  document.querySelectorAll("#tbodyAttendanceUnified select").forEach(sel => {
    sel.disabled = false;
    sel.classList.remove("cursor-not-allowed", "bg-slate-50", "pointer-events-none");
  });

  // Mở khóa các nút thao tác chấm công nhanh
  const quickButtons = [
    "btnQuickFillAllDay", "btnQuickFillAllNight", "btnQuickFillRotating", "btnQuickClearAll",
    "btnLoadSampleDec", "btnLoadSampleNov", "btnAddYearBtn", "btnAddYearQuick"
  ];
  quickButtons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove("opacity-40", "cursor-not-allowed", "pointer-events-none");
    }
  });

  if (currentAuthRole === "admin") {
    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs";
    }
    if (badgeText) badgeText.innerHTML = `<i class="fa-solid fa-crown text-amber-600"></i> Quản Trị Viên (Toàn quyền)`;
    if (adminControls) adminControls.style.display = "flex";
    if (selEmp) selEmp.style.display = "inline-block";
    if (selEmpSummary) selEmpSummary.style.display = "inline-block";
    if (empLockedLabel) empLockedLabel.classList.add("hidden");
    if (empLockedSummaryLabel) empLockedSummaryLabel.classList.add("hidden");
  } else if (currentAuthRole === "employee") {
    const emp = employeesList.find(e => e.id === currentAuthEmpId) || employeesList[0];
    if (badge) {
      badge.className = "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs";
    }
    if (badgeText) {
      badgeText.innerHTML = `<i class="fa-solid fa-id-badge text-blue-600"></i> NV: <b>${emp.name}</b> (MST: ${emp.cardId || "---"})`;
    }
    // Nhân viên không được thêm/xóa nhân viên khác, và chỉ xem hồ sơ của chính mình
    if (adminControls) adminControls.style.display = "none";
    if (selEmp) selEmp.style.display = "none";
    if (selEmpSummary) selEmpSummary.style.display = "none";
    if (empLockedLabel) {
      empLockedLabel.classList.remove("hidden");
      empLockedLabel.innerHTML = `<i class="fa-solid fa-user-check text-blue-600 mr-1"></i>${emp.name} <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">MST: ${emp.cardId || "---"}</span>`;
    }
    if (empLockedSummaryLabel) {
      empLockedSummaryLabel.classList.remove("hidden");
      empLockedSummaryLabel.innerHTML = `<i class="fa-solid fa-user-check text-blue-600 mr-1"></i>${emp.name} <span class="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">MST: ${emp.cardId || "---"}</span>`;
    }
  }
}

function setAuthRole(role, empId = null) {
  currentAuthRole = role;
  currentAuthEmpId = empId;
  window.currentAuthRole = currentAuthRole;
  window.currentAuthEmpId = currentAuthEmpId;

  localStorage.setItem("app_auth_role", role);
  if (empId) {
    localStorage.setItem("app_auth_empid", empId);
  } else {
    localStorage.removeItem("app_auth_empid");
  }

  hideAuthModal();
  applyAuthUI();

  if (role === "employee" && empId) {
    if (currentEmpId !== empId) {
      switchEmployee(empId);
    } else {
      loadEmployeeData(empId);
      renderUnifiedTable();
      renderYearSummary();
    }
  } else if (role === "admin") {
    renderEmployeeSelect();
    renderUnifiedTable();
    renderYearSummary();
  }
}

function logoutAuth() {
  localStorage.removeItem("app_auth_role");
  localStorage.removeItem("app_auth_empid");
  currentAuthRole = null;
  currentAuthEmpId = null;
  window.currentAuthRole = null;
  window.currentAuthEmpId = null;

  const loginEmpName = document.getElementById("loginEmpName");
  const loginEmpCard = document.getElementById("loginEmpCardId");
  const loginErr = document.getElementById("loginEmpError");
  if (loginErr) loginErr.classList.add("hidden");
  if (loginEmpName) loginEmpName.value = "";
  if (loginEmpCard) loginEmpCard.value = "";

  showAuthModal();
}

function checkAuthentication() {
  // 1. Kiểm tra tham số trên URL (VD: ?card=1028 hoặc ?name=Thinh&card=1028 hoặc ?admin=0838)
  const urlParams = new URLSearchParams(window.location.search);
  const paramCard = urlParams.get("card");
  const paramName = urlParams.get("name");
  const paramAdmin = urlParams.get("admin");

  if (paramAdmin && paramAdmin === adminPassword) {
    setAuthRole("admin");
    return;
  }

  if (paramCard) {
    const matched = employeesList.find(e => {
      const cardMatch = (e.cardId || "").toString().trim().toLowerCase() === paramCard.trim().toLowerCase();
      if (!paramName) return cardMatch;
      return cardMatch && normalizeSearchStr(e.name).includes(normalizeSearchStr(paramName));
    });
    if (matched) {
      setAuthRole("employee", matched.id);
      return;
    }
  }

  // 2. Kiểm tra phiên đã đăng nhập trước đó trên trình duyệt này
  const savedRole = localStorage.getItem("app_auth_role");
  const savedEmpId = localStorage.getItem("app_auth_empid");

  if (savedRole === "admin") {
    setAuthRole("admin");
  } else if (savedRole === "employee" && savedEmpId && employeesList.some(e => e.id === savedEmpId)) {
    setAuthRole("employee", savedEmpId);
  } else {
    showAuthModal();
  }
}

function setupAuthenticationControls() {
  // Tabs switcher
  const tabEmp = document.getElementById("tabLoginEmployee");
  const tabAdmin = document.getElementById("tabLoginAdmin");
  const formEmp = document.getElementById("formLoginEmployee");
  const formAdmin = document.getElementById("formLoginAdmin");

  if (tabEmp && tabAdmin && formEmp && formAdmin) {
    tabEmp.addEventListener("click", () => {
      tabEmp.className = "flex-1 py-3 font-bold border-b-2 border-blue-600 text-blue-700 bg-white flex items-center justify-center gap-1.5 transition";
      tabAdmin.className = "flex-1 py-3 font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition";
      formEmp.classList.remove("hidden");
      formAdmin.classList.add("hidden");
    });

    tabAdmin.addEventListener("click", () => {
      tabAdmin.className = "flex-1 py-3 font-bold border-b-2 border-amber-600 text-amber-700 bg-white flex items-center justify-center gap-1.5 transition";
      tabEmp.className = "flex-1 py-3 font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5 transition";
      formAdmin.classList.remove("hidden");
      formEmp.classList.add("hidden");
    });
  }

  // Form đăng nhập Nhân viên theo Tên & Mã số thẻ
  if (formEmp) {
    formEmp.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputName = (document.getElementById("loginEmpName")?.value || "").trim();
      const inputCard = (document.getElementById("loginEmpCardId")?.value || "").trim();
      const errBox = document.getElementById("loginEmpError");
      const errText = document.getElementById("loginEmpErrorText");

      if (!inputName || !inputCard) {
        if (errBox) {
          errBox.classList.remove("hidden");
          if (errText) errText.innerText = "Vui lòng nhập đầy đủ Họ tên và Mã số thẻ!";
        }
        return;
      }

      const normInputName = normalizeSearchStr(inputName);
      const normInputCard = inputCard.toLowerCase();

      // Kiểm tra trong danh sách nhân viên
      const matched = employeesList.find(emp => {
        const empNormName = normalizeSearchStr(emp.name);
        const empNormCard = (emp.cardId || "").toString().trim().toLowerCase();
        const isNameMatch = empNormName === normInputName || empNormName.includes(normInputName) || normInputName.includes(empNormName);
        const isCardMatch = empNormCard === normInputCard;
        return isNameMatch && isCardMatch;
      });

      if (matched) {
        if (errBox) errBox.classList.add("hidden");
        setAuthRole("employee", matched.id);
        showToast(`Xin chào ${matched.name}! Chúc bạn làm việc hiệu quả.`);
      } else {
        if (errBox) {
          errBox.classList.remove("hidden");
          if (errText) errText.innerText = "Họ tên hoặc Mã số thẻ không đúng. Vui lòng kiểm tra lại!";
        }
      }
    });
  }

  // Form đăng nhập Quản lý (Admin)
  if (formAdmin) {
    formAdmin.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputPass = (document.getElementById("loginAdminPassword")?.value || "").trim();
      const errBox = document.getElementById("loginAdminError");

      if (inputPass === adminPassword) {
        if (errBox) errBox.classList.add("hidden");
        setAuthRole("admin");
        showToast("👑 Đã đăng nhập Quản Trị Viên thành công!");
      } else {
        if (errBox) errBox.classList.remove("hidden");
      }
    });
  }

  // Nút đăng xuất / Đổi tài khoản
  const btnLogout = document.getElementById("btnAuthLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      logoutAuth();
    });
  }
}

window.initEmployees = initEmployees;
window.loadEmployeeData = loadEmployeeData;
window.saveCurrentEmployeeData = saveCurrentEmployeeData;
window.switchEmployee = switchEmployee;
window.renderEmployeeSelect = renderEmployeeSelect;
window.addNewEmployee = addNewEmployee;
window.renameCurrentEmployee = renameCurrentEmployee;
window.updateCurrentEmployeeInfo = updateCurrentEmployeeInfo;
window.deleteCurrentEmployee = deleteCurrentEmployee;
window.setupEmployeeEventListeners = setupEmployeeEventListeners;

function getAvailableYearsList() {
  const yearsSet = new Set([currentYear]);
  Object.keys(allYearsStore).forEach(y => {
    const n = parseInt(y);
    if (n && n >= 2000 && n <= 2100) yearsSet.add(n);
  });
  if (employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years) {
    Object.keys(employeesDataStore[currentEmpId].years).forEach(y => {
      const n = parseInt(y);
      if (n && n >= 2000 && n <= 2100) yearsSet.add(n);
    });
  }
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k.match(/^(?:att|cfg)_(\d{4})_\d+$/);
      if (m) {
        const yr = parseInt(m[1]);
        if (yr >= 2000 && yr <= 2100) yearsSet.add(yr);
      }
    }
  } catch(e) {}
  const sorted = Array.from(yearsSet).sort((a, b) => a - b);
  try {
    localStorage.setItem("app_available_years", JSON.stringify(sorted));
  } catch(e) {}
  return sorted;
}

function addAvailableYear(y) {
  const n = parseInt(y);
  if (!n || n < 2000 || n > 2100) return;
  const list = getAvailableYearsList();
  if (!list.includes(n)) {
    list.push(n);
    list.sort((a, b) => a - b);
    try {
      localStorage.setItem("app_available_years", JSON.stringify(list));
    } catch(e) {}
  }
}

window.deleteYear = async function(y) {
  y = parseInt(y);
  if (!y) return;
  if (y === currentYear) {
    showToast("⚠️ Không thể xóa năm đang mở. Vui lòng chuyển sang năm khác trước!", "info");
    return;
  }
  if (!confirm(`Bạn có chắc chắn muốn xóa toàn bộ dữ liệu của Năm ${y}? Thao tác này không thể hoàn tác.`)) {
    return;
  }
  delete allYearsStore[y];
  if (employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years) {
    delete employeesDataStore[currentEmpId].years[y];
  }
  for (let m = 1; m <= 12; m++) {
    localStorage.removeItem(getAttStorageKey(y, m, currentEmpId));
    localStorage.removeItem(getCfgStorageKey(y, m, currentEmpId));
    if (currentEmpId === "emp_default") {
      localStorage.removeItem(`att_${y}_${m}`);
      localStorage.removeItem(`cfg_${y}_${m}`);
    }
  }
  try {
    const saved = localStorage.getItem("app_available_years");
    if (saved) {
      const list = JSON.parse(saved).filter(item => parseInt(item) !== y);
      localStorage.setItem("app_available_years", JSON.stringify(list));
    }
  } catch(e) {}

  // Xóa trên Firebase nếu có
  try {
    await fetch(`${FIREBASE_DB_URL.replace('.json', '')}/years/${y}.json`, { method: "DELETE" });
  } catch(e) {}

  renderEmployeeSelect();
  renderYearSummary();
  renderMultiYearSummary();
  flushAutoSave();
  showToast(`🗑️ Đã xóa thành công Năm ${y}!`);
};

function saveYearToMemoryAndStorage(year) {
  if (!year) year = currentYear;
  if (!allYearsStore[year]) allYearsStore[year] = {};
  allYearsStore[year].attendance = JSON.parse(JSON.stringify(monthlyStore));
  allYearsStore[year].configs = JSON.parse(JSON.stringify(monthlyConfigStore));

  // Sync vào kho của nhân viên hiện tại, bảo toàn dữ liệu phép năm đã sửa tay
  if (currentEmpId && employeesDataStore[currentEmpId]) {
    if (!employeesDataStore[currentEmpId].years) employeesDataStore[currentEmpId].years = {};
    if (!employeesDataStore[currentEmpId].years[year]) employeesDataStore[currentEmpId].years[year] = {};
    employeesDataStore[currentEmpId].years[year].attendance = JSON.parse(JSON.stringify(monthlyStore));
    employeesDataStore[currentEmpId].years[year].configs = JSON.parse(JSON.stringify(monthlyConfigStore));
    
    if (allYearsStore[year].annualLeaveTotalManual !== undefined) {
      employeesDataStore[currentEmpId].years[year].annualLeaveTotalManual = allYearsStore[year].annualLeaveTotalManual;
    }
    if (allYearsStore[year].annualLeaveUsedManual !== undefined) {
      employeesDataStore[currentEmpId].years[year].annualLeaveUsedManual = allYearsStore[year].annualLeaveUsedManual;
    }
    if (allYearsStore[year].annualLeaveTotal !== undefined) {
      employeesDataStore[currentEmpId].years[year].annualLeaveTotal = allYearsStore[year].annualLeaveTotal;
    }
    try {
      localStorage.setItem("emp_data_" + currentEmpId, JSON.stringify(employeesDataStore[currentEmpId]));
    } catch (e) {}
  }

  for (let m = 1; m <= 12; m++) {
    if (monthlyStore[m]) {
      writeAttStorage(year, m, monthlyStore[m], currentEmpId);
    }
    if (monthlyConfigStore[m]) {
      writeCfgStorage(year, m, monthlyConfigStore[m], currentEmpId);
    }
  }
  addAvailableYear(year);
}

function getMonthDataForYear(year, month) {
  if (year === currentYear && monthlyStore[month]) {
    return monthlyStore[month];
  }
  if (allYearsStore[year] && allYearsStore[year].attendance && allYearsStore[year].attendance[month]) {
    return allYearsStore[year].attendance[month];
  }
  const saved = readAttStorage(year, month, currentEmpId);
  if (saved) return saved;
  return null;
}

function getMonthConfigForYear(year, month) {
  if (year === currentYear && monthlyConfigStore[month]) {
    return monthlyConfigStore[month];
  }
  if (allYearsStore[year] && allYearsStore[year].configs && allYearsStore[year].configs[month]) {
    return allYearsStore[year].configs[month];
  }
  const saved = readCfgStorage(year, month, currentEmpId);
  if (saved) return normalizeConfig(saved);
  return getDefaultSalaryConfig(month);
}

function getLatestSalaryConfigForEmployee(empId = currentEmpId, preferYear = currentYear, preferMonth = currentMonth) {
  if (!empId) empId = currentEmpId;

  // 1. Kiểm tra chính preferMonth nếu preferYear trùng năm đang mở trong RAM
  if (preferYear === currentYear && monthlyConfigStore && monthlyConfigStore[preferMonth]) {
    const curCfg = monthlyConfigStore[preferMonth];
    if (curCfg && (curCfg.baseSalary !== undefined || curCfg.base_salary !== undefined)) {
      const norm = normalizeConfig(curCfg);
      if (norm && norm.baseSalary > 0) return JSON.parse(JSON.stringify(norm));
    }
  }

  // 2. Tìm ngược từ tháng 12 về tháng 1 trong monthlyConfigStore đang mở
  if (preferYear === currentYear && monthlyConfigStore) {
    for (let m = 12; m >= 1; m--) {
      const cfg = monthlyConfigStore[m];
      if (cfg && (cfg.baseSalary !== undefined || cfg.base_salary !== undefined)) {
        const norm = normalizeConfig(cfg);
        if (norm && norm.baseSalary > 0) return JSON.parse(JSON.stringify(norm));
      }
    }
  }

  // 3. Tìm trong kho allYearsStore hoặc employeesDataStore[empId].years
  const store = (employeesDataStore[empId] && employeesDataStore[empId].years)
    ? employeesDataStore[empId].years
    : allYearsStore;

  if (store) {
    const years = Object.keys(store).map(Number).filter(y => !isNaN(y));
    let targetYears = years.filter(y => y <= preferYear).sort((a, b) => b - a);
    if (targetYears.length === 0) targetYears = years.sort((a, b) => b - a);

    for (const y of targetYears) {
      const yData = store[y];
      if (yData && yData.configs) {
        for (let m = 12; m >= 1; m--) {
          const cfg = yData.configs[m];
          if (cfg && (cfg.baseSalary !== undefined || cfg.base_salary !== undefined)) {
            const norm = normalizeConfig(cfg);
            if (norm && norm.baseSalary > 0) return JSON.parse(JSON.stringify(norm));
          }
        }
      }
    }
  }

  // 4. Tìm trong localStorage tách biệt theo từng nhân viên
  for (let y = preferYear; y >= preferYear - 5; y--) {
    for (let m = 12; m >= 1; m--) {
      const s = readCfgStorage(y, m, empId);
      if (s) {
        try {
          const norm = normalizeConfig(s);
          if (norm && norm.baseSalary > 0) return JSON.parse(JSON.stringify(norm));
        } catch(e) {}
      }
    }
  }

  // 5. Fallback nếu là nhân viên hoàn toàn mới chưa có bất kỳ cấu hình nào
  const isDefaultEmp = (empId === "emp_default");
  return {
    baseSalary: 6300000,
    positionAllowance: isDefaultEmp ? 2450000 : 0,
    seniorityAllowance: isDefaultEmp ? 100000 : 0,
    kpiCoeff: 1.0,
    allowanceGas: 500000,
    allowanceHouse: 500000,
    allowanceChild: 0,
    allowanceSafety: 0,
    allowanceNight: 0,
    allowanceMealNight: 0,
    isManualNight: false,
    allowancePeriod: 0,
    allowanceOther: 0,
    bonusAttendance: 600000,
    bonusFullAttendance: 0,
    bonusEfficiency: 0,
    bonusQualityStar: 0,
    bonusPerformance: 0,
    bonusKPI: 3050000,
    bonusRecruitment: 0,
    isTaxExempt: 1,
    bankAccount: isDefaultEmp ? "STK: 102884878810" : "",
    bankName: isDefaultEmp ? "VietinBank" : ""
  };
}

function getDefaultSalaryConfig(m) {
  const latest = getLatestSalaryConfigForEmployee(currentEmpId, currentYear, m);
  return JSON.parse(JSON.stringify(latest));
}

function saveCurrentMonthInputsToConfigStore() {
  const getNum = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const v = parseVal(el.value);
    return isNaN(v) ? fallback : v;
  };
  const getStr = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el) return fallback;
    return (el.value !== undefined && el.value !== null) ? el.value.trim() : fallback;
  };

  const oldCfg = monthlyConfigStore[currentMonth] || {};
  const isManual = Boolean(oldCfg.isManualNight);

  const isDefaultEmp = (currentEmpId === "emp_default");
  const fallbackPos = isDefaultEmp ? 2450000 : 0;
  const fallbackSen = isDefaultEmp ? 100000 : 0;
  const fallbackBankAcc = isDefaultEmp ? "STK: 102884878810" : "";
  const fallbackBankName = isDefaultEmp ? "VietinBank" : "";

  monthlyConfigStore[currentMonth] = {
    baseSalary: getNum("baseSalary", oldCfg.baseSalary !== undefined ? oldCfg.baseSalary : 6300000),
    positionAllowance: getNum("positionAllowance", oldCfg.positionAllowance !== undefined ? oldCfg.positionAllowance : fallbackPos),
    seniorityAllowance: getNum("seniorityAllowance", oldCfg.seniorityAllowance !== undefined ? oldCfg.seniorityAllowance : fallbackSen),
    kpiCoeff: getNum("kpiCoeff", oldCfg.kpiCoeff !== undefined ? oldCfg.kpiCoeff : 1.0),
    allowanceGas: getNum("allowanceGas", oldCfg.allowanceGas !== undefined ? oldCfg.allowanceGas : 500000),
    allowanceHouse: getNum("allowanceHouse", oldCfg.allowanceHouse !== undefined ? oldCfg.allowanceHouse : 500000),
    allowanceChild: getNum("allowanceChild", oldCfg.allowanceChild !== undefined ? oldCfg.allowanceChild : 0),
    allowanceSafety: getNum("allowanceSafety", oldCfg.allowanceSafety !== undefined ? oldCfg.allowanceSafety : 0),
    allowanceNight: getNum("allowanceNight", oldCfg.allowanceNight !== undefined ? oldCfg.allowanceNight : 0),
    allowanceMealNight: getNum("allowanceMealNight", oldCfg.allowanceMealNight !== undefined ? oldCfg.allowanceMealNight : 0),
    isManualNight: isManual,
    lastNightShifts: oldCfg.lastNightShifts,
    allowancePeriod: getNum("allowancePeriod", oldCfg.allowancePeriod !== undefined ? oldCfg.allowancePeriod : 0),
    allowanceOther: getNum("allowanceOther", oldCfg.allowanceOther !== undefined ? oldCfg.allowanceOther : 0),
        bonusAttendance: getNum("bonusAttendance", oldCfg.bonusAttendance !== undefined ? oldCfg.bonusAttendance : 600000),
    bonusFullAttendance: getNum("bonusFullAttendance", oldCfg.bonusFullAttendance !== undefined ? oldCfg.bonusFullAttendance : 0),
    bonusEfficiency: getNum("bonusEfficiency", oldCfg.bonusEfficiency !== undefined ? oldCfg.bonusEfficiency : 0),
    bonusQualityStar: getNum("bonusQualityStar", oldCfg.bonusQualityStar !== undefined ? oldCfg.bonusQualityStar : 0),
    bonusPerformance: getNum("bonusPerformance", oldCfg.bonusPerformance !== undefined ? oldCfg.bonusPerformance : 0),
    bonusKPI: getNum("bonusKPI", oldCfg.bonusKPI !== undefined ? oldCfg.bonusKPI : 3050000),
    bonusRecruitment: getNum("bonusRecruitment", oldCfg.bonusRecruitment !== undefined ? oldCfg.bonusRecruitment : 0),
    isTaxExempt: (document.getElementById("taxExemptToggle") && document.getElementById("taxExemptToggle").checked !== undefined) 
      ? (document.getElementById("taxExemptToggle").checked ? 1 : 0) 
      : (oldCfg.isTaxExempt !== undefined ? oldCfg.isTaxExempt : 1),
    bankAccount: getStr("bankAccount", oldCfg.bankAccount !== undefined ? oldCfg.bankAccount : fallbackBankAcc),
    bankName: getStr("bankName", oldCfg.bankName !== undefined ? oldCfg.bankName : fallbackBankName)
  };
  // Đồng bộ ngay lập tức vào localStorage tách biệt theo từng nhân viên
  writeCfgStorage(currentYear, currentMonth, monthlyConfigStore[currentMonth], currentEmpId);

  // Đồng bộ vào kho nhân viên hiện tại
  if (!allYearsStore[currentYear]) allYearsStore[currentYear] = {};
  if (!allYearsStore[currentYear].configs) allYearsStore[currentYear].configs = {};
  allYearsStore[currentYear].configs[currentMonth] = JSON.parse(JSON.stringify(monthlyConfigStore[currentMonth]));

  if (currentEmpId && employeesDataStore[currentEmpId]) {
    if (!employeesDataStore[currentEmpId].years) employeesDataStore[currentEmpId].years = {};
    if (!employeesDataStore[currentEmpId].years[currentYear]) employeesDataStore[currentEmpId].years[currentYear] = {};
    if (!employeesDataStore[currentEmpId].years[currentYear].configs) employeesDataStore[currentEmpId].years[currentYear].configs = {};
    employeesDataStore[currentEmpId].years[currentYear].configs[currentMonth] = JSON.parse(JSON.stringify(monthlyConfigStore[currentMonth]));
    try {
      localStorage.setItem("emp_data_" + currentEmpId, JSON.stringify(employeesDataStore[currentEmpId]));
    } catch (e) {}
  }
}

function copySalaryProfile(from, to) {
  if (!from || !to) return;
  to.baseSalary = from.baseSalary;
  to.positionAllowance = from.positionAllowance;
  to.seniorityAllowance = from.seniorityAllowance;
  to.kpiCoeff = from.kpiCoeff;
  to.allowanceGas = from.allowanceGas;
  to.allowanceHouse = from.allowanceHouse;
  to.allowanceChild = from.allowanceChild;
  to.allowanceSafety = from.allowanceSafety;
  to.allowancePeriod = from.allowancePeriod;
  to.allowanceOther = from.allowanceOther;
  to.bonusAttendance = from.bonusAttendance;
  to.bonusFullAttendance = from.bonusFullAttendance;
  to.bonusEfficiency = from.bonusEfficiency;
  to.bonusQualityStar = from.bonusQualityStar;
  to.bonusPerformance = from.bonusPerformance;
  to.bonusKPI = from.bonusKPI;
  to.bonusRecruitment = from.bonusRecruitment;
  to.bankAccount = from.bankAccount;
  to.bankName = from.bankName;
  to.isTaxExempt = from.isTaxExempt;
}

function applyCurrentMonthSalaryToFutureMonths(silent = false) {
  saveCurrentMonthInputsToConfigStore();
  const curCfg = monthlyConfigStore[currentMonth];
  if (!curCfg) return;

  for (let m = currentMonth + 1; m <= 12; m++) {
    const nextAtt = monthlyStore[m];
    const nextWorked = nextAtt && Object.values(nextAtt).some(d => d && (d.actual > 0 || d.shift === "night" || d.leave));
    // Nếu chưa làm việc hoặc người dùng bấm nút áp dụng thủ công
    if (!nextWorked || !silent) {
      if (!monthlyConfigStore[m]) monthlyConfigStore[m] = {};
      copySalaryProfile(curCfg, monthlyConfigStore[m]);
      writeCfgStorage(currentYear, m, monthlyConfigStore[m], currentEmpId);
      if (allYearsStore[currentYear] && allYearsStore[currentYear].configs) {
        allYearsStore[currentYear].configs[m] = JSON.parse(JSON.stringify(monthlyConfigStore[m]));
      }
      if (currentEmpId && employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years && employeesDataStore[currentEmpId].years[currentYear]) {
        if (!employeesDataStore[currentEmpId].years[currentYear].configs) employeesDataStore[currentEmpId].years[currentYear].configs = {};
        employeesDataStore[currentEmpId].years[currentYear].configs[m] = JSON.parse(JSON.stringify(monthlyConfigStore[m]));
      }
    }
  }
  saveYearToMemoryAndStorage(currentYear);
  renderYearSummary();
  if (!silent) {
    showToast(`⚡ Đã áp dụng mức lương Tháng ${currentMonth} cho toàn bộ các tháng từ ${currentMonth + 1} đến 12/${currentYear}!`);
  }
}
window.applyCurrentMonthSalaryToFutureMonths = applyCurrentMonthSalaryToFutureMonths;

function loadConfigStoreToInputs(m) {
  const labelSalaryMonth = document.getElementById("labelCurrentMonthSalary");
  if (labelSalaryMonth) labelSalaryMonth.innerText = m;

  // 1. Nếu tháng m chưa có cấu hình: lấy từ tháng trước đó (m - 1) hoặc mặc định
  if (!monthlyConfigStore[m]) {
    if (m > 1 && monthlyConfigStore[m - 1] && monthlyConfigStore[m - 1].baseSalary > 0) {
      monthlyConfigStore[m] = JSON.parse(JSON.stringify(monthlyConfigStore[m - 1]));
    } else {
      monthlyConfigStore[m] = getDefaultSalaryConfig(m);
    }
  } else {
    // 2. Nếu tháng m chưa có chấm công thực tế nào, tự động nhận dữ liệu lương của tháng trước đó (m - 1)
    const mData = monthlyStore[m];
    const hasWorked = mData && Object.values(mData).some(d => d && (d.actual > 0 || d.shift === "night" || d.leave));
    if (!hasWorked && m > 1) {
      for (let prevM = m - 1; prevM >= 1; prevM--) {
        const prevCfg = monthlyConfigStore[prevM];
        if (prevCfg && prevCfg.baseSalary > 0) {
          copySalaryProfile(prevCfg, monthlyConfigStore[m]);
          break;
        }
      }
    }
  }
  const cfg = monthlyConfigStore[m];
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };

  setVal("baseSalary", cfg.baseSalary);
  setVal("positionAllowance", cfg.positionAllowance);
  setVal("seniorityAllowance", cfg.seniorityAllowance);
  setVal("kpiCoeff", cfg.kpiCoeff);
  setVal("allowanceGas", cfg.allowanceGas);
  setVal("allowanceHouse", cfg.allowanceHouse);
  setVal("allowanceChild", cfg.allowanceChild);
  setVal("allowanceSafety", cfg.allowanceSafety);

  // Tự tính theo số ca đêm thực tế của tháng
  let nShifts = 0;
  const mData = monthlyStore[m] || {};
  const totalDays = getDaysInMonth(currentYear, m);
  for (let d = 1; d <= totalDays; d++) {
    const dayData = mData[d] || {};
    if (dayData.shift === "night" || parseVal(dayData.ot130) > 0) nShifts++;
  }
  const autoNight = nShifts * 30000;
  const autoMeal = nShifts * 25000;
  if (cfg.lastNightShifts !== undefined && cfg.lastNightShifts !== nShifts) {
    cfg.isManualNight = false;
  }
  if ((cfg.allowanceNight === 780000 && nShifts !== 26) || (cfg.allowanceMealNight === 650000 && nShifts !== 26)) {
    cfg.isManualNight = false;
  }
  cfg.lastNightShifts = nShifts;
  const nightVal = (cfg.isManualNight && cfg.allowanceNight !== undefined) ? cfg.allowanceNight : autoNight;
  const mealVal = (cfg.isManualNight && cfg.allowanceMealNight !== undefined) ? cfg.allowanceMealNight : autoMeal;

  setVal("allowanceNight", nightVal);
  setVal("allowanceMealNight", mealVal);
  setVal("allowancePeriod", cfg.allowancePeriod);
  setVal("allowanceOther", cfg.allowanceOther);
    setVal("bonusAttendance", cfg.bonusAttendance);
  setVal("bonusFullAttendance", cfg.bonusFullAttendance !== undefined ? cfg.bonusFullAttendance : 0);
  setVal("bonusEfficiency", cfg.bonusEfficiency !== undefined ? cfg.bonusEfficiency : 0);
  setVal("bonusQualityStar", cfg.bonusQualityStar !== undefined ? cfg.bonusQualityStar : 0);
  setVal("bonusPerformance", cfg.bonusPerformance !== undefined ? cfg.bonusPerformance : 0);
  setVal("bonusKPI", cfg.bonusKPI);
  setVal("bonusRecruitment", cfg.bonusRecruitment !== undefined ? cfg.bonusRecruitment : 0);
  setVal("kpiCoeff", cfg.kpiCoeff);
  setVal("kpiCoeffInline", cfg.kpiCoeff);
  setVal("bankAccount", cfg.bankAccount);
  setVal("bankName", cfg.bankName);
  if (document.getElementById("taxExemptToggle") && cfg.isTaxExempt !== undefined) {
    document.getElementById("taxExemptToggle").checked = (cfg.isTaxExempt == 1);
  }
}

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
// KÝ HIỆU CHẤM CÔNG & NGHỈ PHÉP CHUẨN NHÀ MÁY:
// P: Nghỉ phép năm (年休假) - 8h hưởng 100% lương, tính đủ công chuyên cần
// L: Nghỉ lễ (法定假期) - 8h hưởng 100% lương, tính đủ công chuyên cần
// NB: Nghỉ bù (补休) - 8h hưởng 100% lương, tính đủ công chuyên cần
// N: Nhỡ việc / Chờ việc (待工) - 8h hưởng 100% lương
// KL: Nghỉ việc riêng không lương (事假) - 0h hưởng lương, trừ công
// TD: Nghỉ tự do / Vô phép (旷工) - 0h hưởng lương, MẤT 100% TIỀN CHUYÊN CẦN
// ========================================================
const LEAVE_CODES = ["P", "L", "NB", "N", "KL", "TD", "4P", "P4", "0.5P", "4KL", "KL4", "0.5KL", "4TD", "TD4", "0.5TD"];

function parseLeaveAndHours(val) {
  if (val === "" || val === null || val === undefined) return { code: null, hours: 0, workedHours: 0, leaveHours: 0, dayFraction: 0 };
  const str = val.toString().trim().toUpperCase();

  // 1. Cả ngày (Full day)
  if (["P", "L", "NB", "N"].includes(str)) {
    return { code: str, hours: 8, workedHours: 0, leaveHours: 8, dayFraction: 1 };
  }
  if (["KL", "TD"].includes(str)) {
    return { code: str, hours: 0, workedHours: 0, leaveHours: 0, dayFraction: 0 };
  }

  // 2. Nửa ngày độc lập: "0.5P", "0.5 P", "P 0.5", "P/2", "P0.5"
  const halfMatch = str.match(/^(0\.5|1\/2)\s*(P|L|NB|N|KL|TD)$/) || str.match(/^(P|L|NB|N|KL|TD)\s*(0\.5|1\/2|\/2)$/);
  if (halfMatch) {
    const code = (halfMatch[1].match(/[A-Z]/) ? halfMatch[1] : halfMatch[2]).toUpperCase();
    const isPaid = ["P", "L", "NB", "N"].includes(code);
    return {
      code: code,
      isHalf: true,
      hours: isPaid ? 4 : 0,
      workedHours: 0,
      leaveHours: isPaid ? 4 : 0,
      dayFraction: isPaid ? 0.5 : 0
    };
  }

  // 3. Làm nửa ngày (4h) + Nửa ngày nghỉ: "4P", "P4", "4 P", "4+P", "4/P", "4+4P"
  const comboMatch = str.match(/^4\s*[\+\/]?\s*(4)?\s*(P|L|NB|N|KL|TD)$/) || str.match(/^(P|L|NB|N|KL|TD)\s*[\+\/]?\s*4$/);
  if (comboMatch) {
    const code = (comboMatch[2] || comboMatch[1]).toUpperCase();
    const isPaidLeave = ["P", "L", "NB", "N"].includes(code);
    return {
      code: code,
      isCombo: true,
      hours: isPaidLeave ? 8 : 4,
      workedHours: 4,
      leaveHours: isPaidLeave ? 4 : 0,
      dayFraction: isPaidLeave ? 1 : 0.5
    };
  }

  // 4. Trường hợp tổng quát: "P 4", "KL 4", "TD 4"
  const genMatch = str.match(/^(P|L|NB|N|KL|TD)\s*(\d*\.?\d*)$/) || str.match(/^(\d*\.?\d*)\s*(P|L|NB|N|KL|TD)$/);
  if (genMatch) {
    const code = (genMatch[1] && isNaN(Number(genMatch[1])) ? genMatch[1] : genMatch[2]).toUpperCase();
    const num = parseFloat(genMatch[1] && !isNaN(Number(genMatch[1])) ? genMatch[1] : genMatch[2]);
    const isPaid = ["P", "L", "NB", "N"].includes(code);
    const h = !isNaN(num) && num > 0 ? num : (isPaid ? 8 : 0);
    return {
      code: code,
      hours: isPaid ? h : 0,
      workedHours: !isPaid ? (8 - h > 0 ? 8 - h : 0) : 0,
      leaveHours: isPaid ? h : 0,
      dayFraction: h / 8
    };
  }

  const num = parseVal(val);
  return { code: null, hours: num, workedHours: num, leaveHours: 0, dayFraction: num >= 8 ? 1 : (num > 0 ? num / 8 : 0) };
}

function getLeaveBadgeClass(code, rawVal) {
  const str = (rawVal || code || "").toString().trim().toUpperCase();
  if (str.includes("TD")) return "bg-red-200 text-red-900 font-extrabold border-red-500";
  if (str.includes("KL")) return "bg-slate-200 text-slate-800 font-extrabold border-slate-400";
  if (str.includes("P")) return "bg-emerald-100 text-emerald-800 font-extrabold border-emerald-400";
  if (str.includes("L")) return "bg-rose-100 text-rose-800 font-extrabold border-rose-400";
  if (str.includes("NB")) return "bg-purple-100 text-purple-800 font-extrabold border-purple-400";
  if (str.includes("N")) return "bg-amber-100 text-amber-800 font-extrabold border-amber-400";
  return "";
}

function getLeaveTitle(code, rawVal) {
  const str = (rawVal || code || "").toString().trim().toUpperCase();
  if (str === "4P" || str === "P4") return "Làm 4h + Nghỉ 4h phép năm (8h hưởng 100% lương, tính đủ chuyên cần)";
  if (str === "0.5P" || str === "P/2") return "Nửa ngày phép năm (4h hưởng 100% lương)";
  if (str === "4KL" || str === "KL4") return "Làm 4h + Nghỉ 4h việc riêng không lương (4h có lương)";
  if (str === "0.5KL") return "Nửa ngày việc riêng không lương (0h lương)";
  if (str === "4TD" || str === "TD4") return "Làm 4h + 4h tự do/vô phép (4h lương, MẤT THƯỞNG CHUYÊN CẦN)";
  if (str === "0.5TD") return "Nửa ngày tự do/vô phép (0h lương, MẤT THƯỞNG CHUYÊN CẦN)";
  switch (code) {
    case "P": return "Nghỉ phép năm 年休假 (8h hưởng 100% lương, tính đủ chuyên cần)";
    case "L": return "Nghỉ lễ 法定假期 (8h hưởng 100% lương, tính đủ chuyên cần)";
    case "NB": return "Nghỉ bù 补休 (8h hưởng 100% lương, tính đủ chuyên cần)";
    case "N": return "Nhỡ việc 待工 (8h hưởng 100% lương)";
    case "KL": return "Nghỉ không lương việc riêng 事假 (0h lương)";
    case "TD": return "Nghỉ tự do / Vô phép 旷工 (0h lương, MẤT THƯỞNG CHUYÊN CẦN)";
    default: return "";
  }
}

// ========================================================
// SHIFT LOGIC: TỰ ĐỘNG ĐIỀN GIỜ THEO CA & CHẾ ĐỘ NGHỈ
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
    // NGHỈ THƯỜNG
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
  } else if (shiftType === "4P") {
    // Làm 4h + Nghỉ 4h phép năm (tổng 8h có lương)
    monthlyStore[month][day] = {
      shift: "4P", std: 8, actual: "4P",
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (shiftType === "0.5P") {
    // Nửa ngày phép (4h có lương)
    monthlyStore[month][day] = {
      shift: "0.5P", std: 8, actual: "0.5P",
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (shiftType === "4KL") {
    // Làm 4h + 4h việc riêng không lương (4h có lương)
    monthlyStore[month][day] = {
      shift: "4KL", std: 8, actual: "4KL",
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (shiftType === "0.5KL") {
    // Nửa ngày việc riêng không lương (0h lương)
    monthlyStore[month][day] = {
      shift: "0.5KL", std: 8, actual: "0.5KL",
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (shiftType === "4TD") {
    // Làm 4h + 4h nghỉ tự do (4h có lương, MẤT CHUYÊN CẦN)
    monthlyStore[month][day] = {
      shift: "4TD", std: 8, actual: "4TD",
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (shiftType === "0.5TD") {
    // Nửa ngày nghỉ tự do (0h lương, MẤT CHUYÊN CẦN)
    monthlyStore[month][day] = {
      shift: "0.5TD", std: 8, actual: "0.5TD",
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (shiftType === "4") {
    // Làm nửa ngày 4h
    monthlyStore[month][day] = {
      shift: "day", std: 8, actual: 4,
      ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: ""
    };
  } else if (["P", "L", "NB", "N"].includes(shiftType)) {
    // Nghỉ phép năm (P), Nghỉ lễ (L), Nghỉ bù (NB), Nhỡ việc (N): 8h hưởng 100% lương
    monthlyStore[month][day] = {
      shift: shiftType,
      std: 8,
      actual: shiftType,
      ot130: "",
      ot150: "",
      ot200: "",
      ot210: "",
      ot270: "",
      ot300: "",
      ot390: ""
    };
  } else if (["KL", "TD"].includes(shiftType)) {
    // Nghỉ không lương (KL), Nghỉ tự do (TD): 0h hưởng lương
    monthlyStore[month][day] = {
      shift: shiftType,
      std: 8,
      actual: shiftType,
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
function initializeDefaultData(inheritedSalaryConfig) {
  addAvailableYear(currentYear);
  monthlyStore = {};
  monthlyConfigStore = {};
  window.monthlyStore = monthlyStore;
  window.monthlyConfigStore = monthlyConfigStore;

  const hasWorkedAttendance = (store) => {
    if (!store) return false;
    for (let m = 1; m <= 12; m++) {
      const mData = store[m];
      if (mData && Object.keys(mData).length > 0) {
        for (const day in mData) {
          if (mData[day] && (mData[day].actual > 0 || mData[day].shift === "night" || mData[day].leave)) return true;
        }
      }
    }
    return false;
  };

  // Nếu trong allYearsStore đã có dữ liệu năm này
  if (allYearsStore[currentYear] && allYearsStore[currentYear].attendance && allYearsStore[currentYear].configs) {
    monthlyStore = JSON.parse(JSON.stringify(allYearsStore[currentYear].attendance));
    monthlyConfigStore = JSON.parse(JSON.stringify(allYearsStore[currentYear].configs));

    // Nếu năm này hoàn toàn chưa có chấm công thực tế nào (chưa làm việc),
    // và có cấu hình mới nhất từ năm cũ mang sang (ví dụ lcb tháng 12 năm cũ là 5.7M):
    // Cập nhật lại cấu hình lương cho cả 12 tháng theo cấu hình mới nhất!
    if (inheritedSalaryConfig && !hasWorkedAttendance(monthlyStore)) {
      for (let m = 1; m <= 12; m++) {
        monthlyConfigStore[m] = JSON.parse(JSON.stringify(inheritedSalaryConfig));
      }
      allYearsStore[currentYear].configs = JSON.parse(JSON.stringify(monthlyConfigStore));
      if (currentEmpId && employeesDataStore[currentEmpId] && employeesDataStore[currentEmpId].years) {
        if (!employeesDataStore[currentEmpId].years[currentYear]) employeesDataStore[currentEmpId].years[currentYear] = {};
        employeesDataStore[currentEmpId].years[currentYear].configs = JSON.parse(JSON.stringify(monthlyConfigStore));
      }
    }

    window.monthlyStore = monthlyStore;
    window.monthlyConfigStore = monthlyConfigStore;
    return;
  }

  // Lấy cấu hình lương mới nhất để kế thừa cho toàn bộ 12 tháng của năm mới
  const baseCfg = inheritedSalaryConfig || getLatestSalaryConfigForEmployee(currentEmpId, currentYear - 1, 12);

  for (let m = 1; m <= 12; m++) {
    monthlyConfigStore[m] = JSON.parse(JSON.stringify(baseCfg));
    
    // Check if saved in localStorage tách biệt theo nhân viên
    const savedCfg = readCfgStorage(currentYear, m, currentEmpId);
    if (savedCfg) {
      try {
        monthlyConfigStore[m] = normalizeConfig(savedCfg);
      } catch(e) {}
    }

    const totalDays = getDaysInMonth(currentYear, m);
    monthlyStore[m] = {};

    // 1. ƯU TIÊN SỐ 1: Nạp từ localStorage nếu nhân viên này đã từng lưu/chấm công tháng này
    const savedAtt = readAttStorage(currentYear, m, currentEmpId);
    if (savedAtt && Object.keys(savedAtt).length > 0) {
      monthlyStore[m] = savedAtt;
      continue; // ĐÃ CÓ DỮ LIỆU ĐƯỢC LƯU, GIỮ NGUYÊN DỮ LIỆU CỦA NGƯỜI DÙNG!
    }

    // 2. CHỈ NẠP DỮ LIỆU THỰC TẾ CHO NĂM 2026 THÁNG 11 (Không nạp cho các năm mới hay tháng tương lai)
    if (currentYear === 2026 && currentEmpId === "emp_default" && m === 11) {
      // Month 11/2026: Night Shift thực tế (Khớp chính xác 100% Ảnh 1)
      for (let d = 1; d <= totalDays; d++) {
        const isSun = (new Date(currentYear, 10, d).getDay() === 0);
        if (isSun) {
          if (d === 1) {
            monthlyStore[m][d] = { shift: "off", std: "", actual: "", ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: "" };
          } else {
            monthlyStore[m][d] = { shift: "night", std: "", actual: "", ot130: "", ot150: "", ot200: (d === 22 ? 4 : 4.5), ot210: "", ot270: 7.75, ot300: "", ot390: "" };
          }
        } else if (d === 24) {
          monthlyStore[m][d] = { shift: "day", std: 8, actual: 8, ot130: "", ot150: "", ot200: "", ot210: "", ot270: "", ot300: "", ot390: "" };
        } else if ([6, 9, 12, 21, 28].includes(d)) {
          monthlyStore[m][d] = { shift: "night", std: 8, actual: 2, ot130: 6, ot150: 2.5, ot200: "", ot210: 1.75, ot270: "", ot300: "", ot390: "" };
        } else if (d === 10) {
          monthlyStore[m][d] = { shift: "night", std: 8, actual: 2, ot130: 6, ot150: 3, ot200: "", ot210: 1.75, ot270: "", ot300: "", ot390: "" };
        } else if (d === 20) {
          monthlyStore[m][d] = { shift: "night", std: 8, actual: 2, ot130: 6, ot150: 2, ot200: "", ot210: 6.05, ot270: "", ot300: "", ot390: "" };
        } else if ([7, 14].includes(d)) {
          monthlyStore[m][d] = { shift: "night", std: 8, actual: 2, ot130: 6, ot150: 1.5, ot200: "", ot210: 1.75, ot270: "", ot300: "", ot390: "" };
        } else {
          monthlyStore[m][d] = { shift: "night", std: 8, actual: 2, ot130: 6, ot150: 2, ot200: "", ot210: 1.75, ot270: "", ot300: "", ot390: "" };
        }
      }
    } else {
      // Các tháng khác và các năm mới: Khởi tạo bảng công sạch sẽ, KHÔNG ĐƯỢC TỰ ĐIỀN GIỜ
      for (let d = 1; d <= totalDays; d++) {
        const isSun = (new Date(currentYear, m - 1, d).getDay() === 0);
        monthlyStore[m][d] = {
          shift: isSun ? "off" : "",
          std: isSun ? "" : 8,
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
  }

  if (!allYearsStore[currentYear]) allYearsStore[currentYear] = {};
  allYearsStore[currentYear].attendance = JSON.parse(JSON.stringify(monthlyStore));
  allYearsStore[currentYear].configs = JSON.parse(JSON.stringify(monthlyConfigStore));

  if (currentEmpId && employeesDataStore[currentEmpId]) {
    if (!employeesDataStore[currentEmpId].years) employeesDataStore[currentEmpId].years = {};
    employeesDataStore[currentEmpId].years[currentYear] = {
      attendance: JSON.parse(JSON.stringify(monthlyStore)),
      configs: JSON.parse(JSON.stringify(monthlyConfigStore))
    };
  }

  window.monthlyStore = monthlyStore;
  window.monthlyConfigStore = monthlyConfigStore;
}

// ========================================================
// QUẢN LÝ PHÉP TỒN NĂM (年假管理)
// Quy tắc chuẩn:
// 1. Chỉ được cộng 1 phép / 1 tháng (1 năm tối đa 12 ngày phép cơ bản)
// 2. Cứ đến ngày vào xưởng hàng tháng sẽ tích lũy 1 ngày phép
// 3. Phép tồn (Còn lại) = Tổng ngày phép - Số ngày nghỉ phép
// 4. Phép tồn còn dư của năm trước tự động cộng dồn sang năm sau
// ========================================================

function getBaseLeaveForYear(emp, targetYear) {
  if (!emp || !emp.startDate) return 12;
  const parts = emp.startDate.toString().split(/[\/\-\.]/);
  if (parts.length < 3) return 12;
  const startDay = parseInt(parts[0]) || 1;
  const startMonth = parseInt(parts[1]) || 1;
  const startYear = parseInt(parts[2]) || targetYear;

  // Chưa vào xưởng: 0 ngày phép
  if (targetYear < startYear) return 0;

  // Năm vào xưởng:
  if (targetYear === startYear) {
    if (emp.id === "emp_default" && startYear === 2025) {
      return 10; // Hồ sơ mẫu Nguyễn Công Thịnh năm 2025: 10 ngày
    }
    // 1 tháng làm việc = 1 phép từ tháng vào xưởng đến tháng 12
    return Math.max(1, 12 - startMonth + 1);
  }

  // Các năm sau: 1 năm 12 tháng = 12 ngày phép (chỉ được cộng 1 phép 1 tháng)
  // Thâm niên: Cứ 5 năm làm việc tính từ ngày vào xưởng được +1 ngày phép
  const seniorityBonus = Math.floor(Math.max(0, targetYear - startYear) / 5);
  return 12 + seniorityBonus;
}

function getEmployeeAnnualLeaveStats(empId = currentEmpId, targetYear = currentYear) {
  const emp = employeesList.find(e => e.id === empId) || {};
  const empYears = (employeesDataStore[empId] && employeesDataStore[empId].years) || (empId === currentEmpId ? allYearsStore : {}) || {};

  // Xác định năm vào xưởng
  let startY = targetYear;
  if (emp.startDate) {
    const parts = emp.startDate.toString().split(/[\/\-\.]/);
    if (parts.length >= 3) {
      const parsedY = parseInt(parts[2]);
      if (parsedY && parsedY >= 2000 && parsedY <= targetYear) {
        startY = parsedY;
      }
    }
  }

  function getStatsOfYear(y, carryIn) {
    // Luôn ưu tiên allYearsStore nếu đang xem nhân viên và năm hiện tại
    let yData = {};
    if (empId === currentEmpId && y === currentYear && allYearsStore[y]) {
      yData = allYearsStore[y];
    } else if (empYears[y]) {
      yData = empYears[y];
    } else if (empId === currentEmpId && allYearsStore[y]) {
      yData = allYearsStore[y];
    }

    // 1. Phép cơ bản năm nay (1 tháng = 1 phép, tối đa 12 ngày/năm + thâm niên)
    const baseTotal = getBaseLeaveForYear(emp, y);

    // 2. TỔNG NGÀY PHÉP:
    // NẾU ADMIN ĐÃ SỬA TAY TỔNG NGÀY PHÉP (VD: 10 NGÀY) HOẶC THIẾT LẬP annualLeaveTotal:
    // DÙNG CHÍNH XÁC SỐ ĐÓ, TUYỆT ĐỐI KHÔNG CỘNG THÊM PHÉP TỒN carryIn LÊN TRÊN SỐ ADMIN GÕ!
    let total = baseTotal + carryIn;
    let isManualTotal = false;

    if (yData && yData.annualLeaveTotalManual !== undefined && !isNaN(yData.annualLeaveTotalManual) && yData.annualLeaveTotalManual !== null) {
      total = parseFloat(yData.annualLeaveTotalManual);
      isManualTotal = true;
    } else if (yData && yData.annualLeaveTotal !== undefined && !isNaN(yData.annualLeaveTotal) && yData.annualLeaveTotal !== null) {
      total = parseFloat(yData.annualLeaveTotal);
      isManualTotal = true;
    } else if (emp.id === "emp_default" && (y === 2025 || (emp.annualLeaveTotal === 10 && y === targetYear))) {
      total = 10;
      isManualTotal = true;
    } else if (emp.annualLeaveTotal !== undefined && !isNaN(emp.annualLeaveTotal) && y === targetYear) {
      total = parseFloat(emp.annualLeaveTotal);
      isManualTotal = true;
    }

    // 3. SỐ NGÀY PHÉP ĐÃ NGHỈ TRONG NĂM:
    // a) Đếm từ bảng chấm công (các chữ 'P' và '0.5P')
    let timesheetUsed = 0;
    let usedInMonth = 0;
    const attendance = (empId === currentEmpId && y === currentYear) ? monthlyStore : ((yData && yData.attendance) || {});
    for (let m = 1; m <= 12; m++) {
      const mData = (empId === currentEmpId && y === currentYear && m === currentMonth)
        ? (monthlyStore[currentMonth] || {})
        : (attendance[m] || {});
      const daysInM = getDaysInMonth(y, m);
      let mCountP = 0;
      for (let d = 1; d <= daysInM; d++) {
        const dayObj = mData[d] || {};
        const parsedAct = parseLeaveAndHours(dayObj.actual);
        const parsedStd = parseLeaveAndHours(dayObj.std);
        const shiftUpper = (dayObj.shift || "").toString().trim().toUpperCase();
        const parsedShift = parseLeaveAndHours(shiftUpper);
        const leaveCode = parsedAct.code || parsedStd.code || parsedShift.code;
        if (leaveCode === "P") {
          const isHalf = parsedAct.isHalf || parsedAct.isCombo || parsedShift.isHalf || parsedShift.isCombo;
          mCountP += isHalf ? 0.5 : 1;
        }
      }
      timesheetUsed += mCountP;
      if (m === currentMonth && y === currentYear) usedInMonth = mCountP;
    }

    // b) Số ngày nghỉ trước đó do Admin sửa tay (cho các tháng trước hoặc hệ thống cũ)
    let priorUsed = 0;
    let isManualUsed = false;
    if (yData && yData.annualLeaveUsedManual !== undefined && !isNaN(yData.annualLeaveUsedManual) && yData.annualLeaveUsedManual !== null) {
      priorUsed = parseFloat(yData.annualLeaveUsedManual);
      isManualUsed = true;
    } else if (emp.id === "emp_default") {
      priorUsed = 6; // Khớp 100% hồ sơ mẫu Nguyễn Công Thịnh đã nghỉ 6 ngày trước đó
      isManualUsed = true;
    }

    // TỔNG SỐ NGÀY PHÉP ĐÃ NGHỈ = Số ngày phép đã nghỉ trước đó (sửa tay) + Số ngày chấm P trên bảng công
    timesheetUsed = Math.round(timesheetUsed * 10) / 10;
    priorUsed = Math.round(priorUsed * 10) / 10;
    let usedInYear = Math.round((priorUsed + timesheetUsed) * 10) / 10;

    // 4. SỐ NGÀY PHÉP CÒN LẠI = TỔNG NGÀY PHÉP - SỐ NGÀY NGHỈ PHÉP
    total = Math.round(total * 10) / 10;
    const remain = Math.round((total - usedInYear) * 10) / 10;

    return {
      baseTotal,
      carryForward: isManualTotal ? 0 : carryIn,
      total,
      priorUsed,
      usedInYear,
      usedInMonth: Math.round(usedInMonth * 10) / 10,
      timesheetUsed,
      isManualUsed,
      isManualTotal,
      remain
    };
  }

  // Chạy chuỗi cộng dồn từ startY đến targetYear
  let carry = 0;
  let result = null;
  for (let y = startY; y <= targetYear; y++) {
    result = getStatsOfYear(y, carry);
    // Nếu năm trước còn dư phép (> 0), cộng dồn sang năm sau (chỉ khi năm sau không có cấu hình cứng)
    carry = Math.max(0, result.remain);
  }

  return result || {
    baseTotal: 10,
    carryForward: 0,
    total: 10,
    usedInYear: 6,
    usedInMonth: 0,
    timesheetUsed: 0,
    isManualUsed: true,
    isManualTotal: true,
    remain: 4
  };
}

function renderAnnualLeaveTable() {
  const stats = getEmployeeAnnualLeaveStats(currentEmpId, currentYear);
  const emp = employeesList.find(e => e.id === currentEmpId) || {};

  // 1. Cập nhật bảng phép tồn ở View 1 (Ngay trên bảng tính lương)
  const elStartDate = document.getElementById("empStartDate");
  const elProbationEndDate = document.getElementById("empProbationEndDate");
  const elTotal = document.getElementById("annualLeaveTotal");
  const elUsed = document.getElementById("annualLeaveUsed");
  const elCarryNote = document.getElementById("annualLeaveCarryNote");
  const elMonthNote = document.getElementById("annualLeaveMonthNote");
  const elRemain = document.getElementById("annualLeaveRemain");
  const elBadge = document.getElementById("annualLeaveStatusBadge");

  if (elStartDate && document.activeElement !== elStartDate) {
    elStartDate.value = emp.startDate || "21/7/2025";
  }
  if (elProbationEndDate && document.activeElement !== elProbationEndDate) {
    elProbationEndDate.value = emp.probationEndDate || "20/9/2025";
  }
  if (elTotal && document.activeElement !== elTotal) {
    elTotal.value = stats.total;
  }
  if (elUsed && document.activeElement !== elUsed) {
    elUsed.value = stats.usedInYear;
  }
  if (elCarryNote) {
    if (stats.carryForward > 0 && !stats.isManualTotal) {
      elCarryNote.innerText = `(+${stats.carryForward} tồn từ ${currentYear - 1})`;
      elCarryNote.classList.remove("hidden");
    } else {
      elCarryNote.innerText = "";
      elCarryNote.classList.add("hidden");
    }
  }
  if (elMonthNote) {
    if (stats.priorUsed > 0 && stats.timesheetUsed > 0) {
      elMonthNote.innerText = `(Trước đó: ${stats.priorUsed} • Chấm P: ${stats.timesheetUsed})`;
    } else if (stats.priorUsed > 0) {
      elMonthNote.innerText = `(Sửa tay: ${stats.priorUsed} • Chấm P: 0)`;
    } else {
      elMonthNote.innerText = `(Tháng ${currentMonth}: ${stats.usedInMonth} • Chấm P cả năm: ${stats.timesheetUsed})`;
    }
  }
  if (elRemain) {
    elRemain.innerText = stats.remain;
    if (stats.remain < 0) {
      elRemain.className = "font-mono font-bold text-rose-600 text-sm md:text-base";
    } else {
      elRemain.className = "font-mono font-bold text-emerald-700 text-sm md:text-base";
    }
  }
  if (elBadge) {
    if (stats.remain > 0) {
      elBadge.className = "block text-[10px] font-semibold text-emerald-700 mt-0.5";
      elBadge.innerText = `🌿 Còn ${stats.remain} ngày`;
    } else if (stats.remain === 0) {
      elBadge.className = "block text-[10px] font-semibold text-amber-700 mt-0.5";
      elBadge.innerText = `Đã dùng hết phép`;
    } else {
      elBadge.className = "block text-[10px] font-bold text-rose-600 mt-0.5";
      elBadge.innerText = `⚠️ Vượt ${Math.abs(stats.remain)} ngày`;
    }
  }

  // 2. Cập nhật thẻ Phép Tồn Năm ở View 2 (Bảng thống kê 12 tháng)
  const kpiRemain = document.getElementById("kpiAnnualLeaveRemain");
  const kpiSub = document.getElementById("kpiAnnualLeaveSub");
  if (kpiRemain) {
    kpiRemain.innerText = `${stats.remain} ngày`;
    kpiRemain.className = `text-xl md:text-2xl font-bold font-mono mt-1 ${stats.remain < 0 ? 'text-rose-600' : 'text-orange-950'}`;
  }
  if (kpiSub) {
    let subStr = `Đã nghỉ: ${stats.usedInYear} / ${stats.total} ngày`;
    if (stats.carryForward > 0 && !stats.isManualTotal) {
      subStr += ` (Gồm +${stats.carryForward} tồn từ ${currentYear - 1})`;
    }
    kpiSub.innerText = subStr;
  }
}

// ========================================================
// RENDER UNIFIED ATTENDANCE TABLE WITH SHIFT PILLS
// ========================================================
function renderUnifiedTable() {
  renderAnnualLeaveTable();
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
      currentMonthData[day] = {
        shift: isSunday ? "off" : "",
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
    const rData = currentMonthData[day];
    const parsedAct = parseLeaveAndHours(rData.actual);
    const parsedStd = parseLeaveAndHours(rData.std);
    const shiftUpper = (rData.shift || "").toString().trim().toUpperCase();
    const leaveCode = parsedAct.code || parsedStd.code || (LEAVE_CODES.includes(shiftUpper) ? shiftUpper : null);

    const shift = rData.shift || (parseVal(rData.ot130) > 0 ? "night" : (leaveCode ? leaveCode : (parseVal(rData.actual) > 0 ? "day" : (isSunday ? "off" : ""))));
    if (shift === "night" || parseVal(rData.ot130) > 0) countNightShifts++;

    const rawAct = (rData.actual !== undefined && rData.actual !== null) ? rData.actual.toString().trim().toUpperCase() : "";
    const leaveBadgeClass = leaveCode ? getLeaveBadgeClass(leaveCode, rawAct) : "";
    const leaveTitle = leaveCode ? getLeaveTitle(leaveCode, rawAct) : "Nhập số giờ hoặc mã nghỉ (P, L, NB, N, KL, TD, 4P, 0.5P, 4KL, 0.5KL, 4TD...)";
    const isSpecialLeave = LEAVE_CODES.includes(shiftUpper) || LEAVE_CODES.includes(rawAct) || rawAct === "4";

    const tr = document.createElement("tr");
    tr.className = `border-b border-black text-center ${isSunday ? "bg-green-highlight" : "hover:bg-blue-50/50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-1 px-1 font-semibold whitespace-nowrap text-left sticky-col-left">${dayName}</td>
      <td class="border-r border-black py-1 px-1 no-print whitespace-nowrap">
        <div class="inline-flex items-center gap-1">
          <button type="button" onclick="setDayShift(${day}, 'day')" class="shift-btn ${shift === 'day' ? 'shift-day-active' : 'bg-white hover:bg-yellow-50 text-slate-700 border border-slate-300'}" title="Tự điền Ca Ngày (8h + 3h OT)">☀️</button>
          <button type="button" onclick="setDayShift(${day}, 'night')" class="shift-btn ${shift === 'night' ? 'shift-night-active' : 'bg-white hover:bg-indigo-50 text-slate-700 border border-slate-300'}" title="Tự điền Ca Đêm (2h + 6h đêm + OT)">🌙</button>
          <button type="button" onclick="setDayShift(${day}, 'off')" class="shift-btn ${shift === 'off' ? 'shift-off-active' : 'bg-white hover:bg-slate-100 text-slate-500 border border-slate-200'}" title="Nghỉ thường (Xóa giờ)">⚪</button>
          <select onchange="setDayShift(${day}, this.value)" class="text-[10px] font-bold border border-slate-300 rounded px-1 py-0.5 bg-white text-slate-700 hover:border-blue-500 cursor-pointer outline-none" title="Chọn loại nghỉ / chế độ">
            <option value="" disabled ${!isSpecialLeave ? 'selected' : ''}>Nghỉ/Phép ▼</option>
            <optgroup label="Cả ngày (8h)">
              <option value="P" ${shiftUpper === 'P' || rawAct === 'P' ? 'selected' : ''}>P - Phép năm (8h có lương)</option>
              <option value="L" ${shiftUpper === 'L' || rawAct === 'L' ? 'selected' : ''}>L - Nghỉ lễ (8h có lương)</option>
              <option value="NB" ${shiftUpper === 'NB' || rawAct === 'NB' ? 'selected' : ''}>NB - Nghỉ bù (8h có lương)</option>
              <option value="N" ${shiftUpper === 'N' || rawAct === 'N' ? 'selected' : ''}>N - Nhỡ việc (8h có lương)</option>
              <option value="KL" ${shiftUpper === 'KL' || rawAct === 'KL' ? 'selected' : ''}>KL - Không lương (0h)</option>
              <option value="TD" ${shiftUpper === 'TD' || rawAct === 'TD' ? 'selected' : ''}>TD - Tự do (0h, Mất CC)</option>
            </optgroup>
            <optgroup label="Nửa ngày (4h)">
              <option value="4P" ${shiftUpper === '4P' || rawAct === '4P' || rawAct === 'P4' ? 'selected' : ''}>4P - Làm 4h + Phép 4h (8h lương)</option>
              <option value="0.5P" ${shiftUpper === '0.5P' || rawAct === '0.5P' || rawAct === 'P0.5' ? 'selected' : ''}>0.5P - Nửa ngày phép (4h lương)</option>
              <option value="4KL" ${shiftUpper === '4KL' || rawAct === '4KL' || rawAct === 'KL4' ? 'selected' : ''}>4KL - Làm 4h + Ko lương (4h lương)</option>
              <option value="0.5KL" ${shiftUpper === '0.5KL' || rawAct === '0.5KL' || rawAct === 'KL0.5' ? 'selected' : ''}>0.5KL - Nửa ngày ko lương (0h)</option>
              <option value="4TD" ${shiftUpper === '4TD' || rawAct === '4TD' || rawAct === 'TD4' ? 'selected' : ''}>4TD - Làm 4h + Tự do (4h, Mất CC)</option>
              <option value="0.5TD" ${shiftUpper === '0.5TD' || rawAct === '0.5TD' || rawAct === 'TD0.5' ? 'selected' : ''}>0.5TD - Nửa ngày tự do (0h, Mất CC)</option>
              <option value="4" ${rawAct === '4' ? 'selected' : ''}>4h - Làm nửa ngày thường (4h)</option>
            </optgroup>
            <option value="off">⚪ Nghỉ thường (Xóa giờ)</option>
          </select>
        </div>
      </td>
      <td class="border-r border-black p-0"><input type="text" class="table-input" data-day="${day}" data-field="std" value="${rData.std !== undefined ? rData.std : ""}" placeholder="-"></td>
      <td class="border-r border-black p-0"><input type="text" class="table-input font-bold ${leaveBadgeClass}" data-day="${day}" data-field="actual" value="${rData.actual !== undefined ? rData.actual : ""}" placeholder="-" title="${leaveTitle}"></td>
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
  applyAuthUI();
}

window.setDayShift = function(day, shiftType) {
  applyShiftToDay(currentMonth, day, shiftType);
  if (monthlyStore[currentMonth]) {
    writeAttStorage(currentYear, currentMonth, monthlyStore[currentMonth], currentEmpId);
  }
  if (!monthlyConfigStore[currentMonth]) {
    monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
  }
  monthlyConfigStore[currentMonth].isManualNight = false; // Khi đổi ca thì tự động tính lại tiền trợ cấp & ăn đêm
  renderUnifiedTable();
  triggerAutoSave();
};

function attachTableInputs() {
  document.querySelectorAll("#tbodyAttendanceUnified input").forEach(input => {
    input.addEventListener("input", (e) => {
      const day = e.target.getAttribute("data-day");
      const field = e.target.getAttribute("data-field");
      let val = e.target.value;

      // Tự động viết hoa nếu gõ các mã nghỉ: P, L, NB, N, KL, TD
      const upper = val.trim().toUpperCase();
      if (LEAVE_CODES.includes(upper)) {
        val = upper;
        e.target.value = upper;
      }

      if (monthlyStore[currentMonth] && monthlyStore[currentMonth][day]) {
        monthlyStore[currentMonth][day][field] = val;
        // Nếu gõ mã nghỉ vào actual hoặc std thì cập nhật shift tương ứng
        if ((field === "actual" || field === "std") && LEAVE_CODES.includes(upper)) {
          monthlyStore[currentMonth][day].shift = upper;
          const tr = e.target.closest("tr");
          if (tr) {
            const selectEl = tr.querySelector("select");
            if (selectEl) selectEl.value = upper;
          }
        }
      }

      if (field === "actual") {
        const parsed = parseLeaveAndHours(val);
        const leaveCode = parsed.code || (LEAVE_CODES.includes(upper) ? upper : null);
        e.target.className = `table-input font-bold ${leaveCode ? getLeaveBadgeClass(leaveCode, val) : ""}`;
      }

      if (!monthlyConfigStore[currentMonth]) {
        monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
      }
      monthlyConfigStore[currentMonth].isManualNight = false; // Khi sửa giờ thì tự động tính lại tiền trợ cấp & ăn đêm
      recalculateMonth();
      renderAnnualLeaveTable();
      renderYearSummary();
      triggerAutoSave();
    });
  });
}

// Kiểm tra tháng có dữ liệu chấm công thực tế hay không
function hasMonthAttendanceData(mData) {
  if (!mData || typeof mData !== "object") return false;
  for (const day in mData) {
    const d = mData[day];
    if (!d) continue;
    if (d.actual !== undefined && d.actual !== null && d.actual.toString().trim() !== "") {
      const parsed = parseLeaveAndHours(d.actual);
      if (parsed.hours > 0 || parsed.code) return true;
    }
    if (parseVal(d.ot130) > 0 || parseVal(d.ot150) > 0 || parseVal(d.ot200) > 0 ||
        parseVal(d.ot210) > 0 || parseVal(d.ot270) > 0 || parseVal(d.ot300) > 0 || parseVal(d.ot390) > 0) {
      return true;
    }
    if (d.shift && !["off", ""].includes(d.shift)) {
      if (d.shift === "day" || d.shift === "night") {
        if (d.actual !== "") return true;
      } else {
        return true;
      }
    }
  }
  return false;
}

// ========================================================
// TÍNH LƯƠNG TỰ ĐỘNG CHUẨN XÁC:
// LƯƠNG THỜI GIAN = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ LÀM (100%)
// TIỀN OT = ĐƠN GIÁ 1 GIỜ x SỐ GIỜ OT x % OT
// ========================================================
function calculateSalaryForMonth(monthNum, targetYear = currentYear) {
  const totalDays = getDaysInMonth(targetYear, monthNum);
  let mData;
  let cfg;

  if (targetYear === currentYear) {
    mData = monthlyStore[monthNum] || {};
    if (monthNum === currentMonth) {
      saveCurrentMonthInputsToConfigStore();
      cfg = monthlyConfigStore[currentMonth] || getDefaultSalaryConfig(currentMonth);
    } else {
      cfg = monthlyConfigStore[monthNum] || getDefaultSalaryConfig(monthNum);
    }
  } else {
    mData = getMonthDataForYear(targetYear, monthNum) || {};
    cfg = getMonthConfigForYear(targetYear, monthNum);
  }


  // 1. Lương cơ bản & các phụ cấp lương của riêng tháng này
  const baseSalary = (cfg.baseSalary !== undefined && cfg.baseSalary !== null) ? cfg.baseSalary : 6300000;
  const posAllowance = (cfg.positionAllowance !== undefined && cfg.positionAllowance !== null) ? cfg.positionAllowance : 2450000;
  const senAllowance = (cfg.seniorityAllowance !== undefined && cfg.seniorityAllowance !== null) ? cfg.seniorityAllowance : 100000;
  const kpiCoeff = (cfg.kpiCoeff !== undefined && cfg.kpiCoeff !== null) ? cfg.kpiCoeff : 1.0;

  // 2. Công chuẩn, Giờ tiêu chuẩn và Đơn giá 1 giờ
  const stdDays = getStandardWorkDays(targetYear, monthNum);
  const stdHours = stdDays * 8;
  const insSalary = baseSalary + posAllowance + senAllowance;
  
  // ĐƠN GIÁ 1 GIỜ = Lương đóng BH / Số giờ tiêu chuẩn
  const exactHourlyRate = stdHours > 0 ? (insSalary / stdHours) : 0;
  const hourlyRate = Math.round(exactHourlyRate);

  // NẾU THÁNG NÀY HOÀN TOÀN CHƯA CÓ CHẤM CÔNG (Tháng tương lai hoặc năm mới chưa làm):
  // KHÔNG TỰ TÍNH TIỀN LƯƠNG, PHỤ CẤP VÀ THƯỞNG ẢO
  const hasData = hasMonthAttendanceData(mData);
  if (!hasData) {
    return {
      hasData: false,
      month: monthNum,
      year: targetYear,
      baseSalary,
      posAllowance,
      senAllowance,
      kpiCoeff,
      stdDays,
      stdHours,
      hourlyRate,
      insSalary,
      totStd: 0,
      totActual: 0,
      tot130: 0, tot150: 0, tot200: 0, tot210: 0, tot270: 0, tot300: 0, tot390: 0,
      totalOTHours: 0,
      amountDay: 0,
      totalOTAmount: 0,
      rate130: 0, amount130: 0,
      rate150: 0, amount150: 0,
      rate200: 0, amount200: 0,
      rate210: 0, amount210: 0,
      rate270: 0, amount270: 0,
      rate300: 0, amount300: 0,
      rate390: 0, amount390: 0,
      nightShifts: 0,
      nightSubsidy: 0,
      mealNight: 0,
      totalAllowance: 0,
      bonusAtt: 0,
      amountKPI: 0,
      stdTotalBonus: 0,
      totalBonus: 0,
      grossIncome: 0,
      deductBHXH: 0,
      deductBHYT: 0,
      deductBHTN: 0,
      deductKPCĐ: 0,
      deductTNCN: 0,
      taxableIncome: 0,
      isTaxExempt: true,
      totalDeductions: 0,
      netSalary: 0,
      workedDays: 0,
      countP: 0, countL: 0, countNB: 0, countN: 0, countKL: 0, countTD: 0,
      isFullAttendance: false
    };
  }

  let totStd = 0, totActual = 0, tot130 = 0, tot150 = 0, tot200 = 0, tot210 = 0, tot270 = 0, tot300 = 0, tot390 = 0;
  let nightShifts = 0;
  let workedDays = 0;
  let countP = 0, countL = 0, countNB = 0, countN = 0, countKL = 0, countTD = 0;

  for (let day = 1; day <= totalDays; day++) {
    const d = mData[day] || {};
    const parsedAct = parseLeaveAndHours(d.actual);
    const parsedStd = parseLeaveAndHours(d.std);
    const shiftUpper = (d.shift || "").toString().trim().toUpperCase();
    const parsedShift = parseLeaveAndHours(shiftUpper);

    // Xác định mã nghỉ và số giờ tính
    let actHours = parsedAct.hours;
    let dayFraction = parsedAct.dayFraction;
    const leaveCode = parsedAct.code || parsedStd.code || parsedShift.code;

    if (!parsedAct.code && parsedShift.code) {
      actHours = parsedShift.hours;
      dayFraction = parsedShift.dayFraction;
    }

    // Đếm số ngày nghỉ (cả ngày = 1, nửa ngày = 0.5)
    const isHalfDay = parsedAct.isHalf || parsedAct.isCombo || parsedShift.isHalf || parsedShift.isCombo;
    const leaveWeight = isHalfDay ? 0.5 : 1;

    if (leaveCode === "P") countP += leaveWeight;
    else if (leaveCode === "L") countL += leaveWeight;
    else if (leaveCode === "NB") countNB += leaveWeight;
    else if (leaveCode === "N") countN += leaveWeight;
    else if (leaveCode === "KL") countKL += leaveWeight;
    else if (leaveCode === "TD") countTD += leaveWeight;

    const ot130 = parseVal(d.ot130);

    totStd += parseVal(d.std) || 8;
    totActual += actHours;
    tot130 += ot130;
    tot150 += parseVal(d.ot150);
    tot200 += parseVal(d.ot200);
    tot210 += parseVal(d.ot210);
    tot270 += parseVal(d.ot270);
    tot300 += parseVal(d.ot300);
    tot390 += parseVal(d.ot390);

    if (d.shift === "night" || ot130 > 0) nightShifts++;

    // TÍNH NGÀY CÔNG (workedDays):
    // - Cộng theo dayFraction (VD: cả ngày = 1, nửa ngày = 0.5)
    // - Hoặc có ca đêm 130%
    if (dayFraction > 0) {
      workedDays += dayFraction;
    } else if (ot130 > 0) {
      workedDays += 1;
    }
  }

  // Làm tròn workedDays đến 1 chữ số thập phân (VD: 25.5 ngày công)
  workedDays = Math.round(workedDays * 10) / 10;

  // Tổng giờ công chuẩn thực tế (bao gồm cả giờ làm thực tế, nghỉ có lương và giờ ca đêm 130%)
  const totalBaseWorkedHours = totActual + tot130;


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

  // 5. III. CÁC KHOẢN TRỢ CẤP (Theo hồ sơ lương của riêng tháng này)
  const gas = (cfg.allowanceGas !== undefined && cfg.allowanceGas !== null) ? cfg.allowanceGas : 500000;
  const house = (cfg.allowanceHouse !== undefined && cfg.allowanceHouse !== null) ? cfg.allowanceHouse : 500000;
  const child = cfg.allowanceChild || 0;
  const safety = cfg.allowanceSafety || 0;
  // Tự động tính trợ cấp ca đêm và ăn ca đêm theo số ca đêm thực tế trong bảng:
  // Công thức chuẩn: 30.000đ/đêm và 25.000đ/đêm
  const autoNightSubsidy = nightShifts * 30000;
  const autoMealNight = nightShifts * 25000;

  // Nếu số ca đêm thay đổi hoặc giá trị cũ bị kẹt, tự động mở khóa tính theo công thức chuẩn:
  if (cfg.lastNightShifts !== undefined && cfg.lastNightShifts !== nightShifts) {
    cfg.isManualNight = false;
  }
  if ((cfg.allowanceNight === 780000 && nightShifts !== 26) || (cfg.allowanceMealNight === 650000 && nightShifts !== 26)) {
    cfg.isManualNight = false;
  }
  cfg.lastNightShifts = nightShifts;

  const nightSubsidy = (cfg.isManualNight && cfg.allowanceNight !== undefined && cfg.allowanceNight !== null)
    ? cfg.allowanceNight
    : autoNightSubsidy;
  const mealNight = (cfg.isManualNight && cfg.allowanceMealNight !== undefined && cfg.allowanceMealNight !== null)
    ? cfg.allowanceMealNight
    : autoMealNight;
  const period = cfg.allowancePeriod || 0;
  const other = cfg.allowanceOther || 0;
  const totalAllowance = gas + house + child + safety + nightSubsidy + mealNight + period + other;

  // 6. IV. CÁC KHOẢN THƯỞNG
  // Đi làm đủ công hoặc nghỉ có lương (P, L, NB, N) được tính đủ chuyên cần.
  // Riêng nghỉ tự do (TD - 旷工) mất 100% tiền thưởng chuyên cần.
  const isFullAttendance = (countTD === 0) && ((workedDays >= stdDays) || (totalBaseWorkedHours >= stdHours));
  const baseBonusAtt = (cfg.bonusAttendance !== undefined && cfg.bonusAttendance !== null) ? cfg.bonusAttendance : 600000;
  let bonusAtt = 0;
  if (countTD > 0) {
    bonusAtt = 0; // Nghỉ tự do (vô phép) -> MẤT CHUYÊN CẦN
  } else if (isFullAttendance) {
    bonusAtt = baseBonusAtt;
  } else if (workedDays > 0) {
    bonusAtt = (workedDays >= stdDays - 2) ? Math.round(baseBonusAtt * (workedDays / stdDays)) : 0;
  }

  const bonusFullAttendance = (cfg.bonusFullAttendance !== undefined && cfg.bonusFullAttendance !== null) ? Number(cfg.bonusFullAttendance) : 0;
  const bonusEfficiency = (cfg.bonusEfficiency !== undefined && cfg.bonusEfficiency !== null) ? Number(cfg.bonusEfficiency) : 0;
  const bonusQualityStar = (cfg.bonusQualityStar !== undefined && cfg.bonusQualityStar !== null) ? Number(cfg.bonusQualityStar) : 0;
  const bonusPerformance = (cfg.bonusPerformance !== undefined && cfg.bonusPerformance !== null) ? Number(cfg.bonusPerformance) : 0;
  const bonusRecruitment = (cfg.bonusRecruitment !== undefined && cfg.bonusRecruitment !== null) ? Number(cfg.bonusRecruitment) : 0;

  const baseKPI = (cfg.bonusKPI !== undefined && cfg.bonusKPI !== null) ? cfg.bonusKPI : 3050000;
  const amountKPI = Math.round(baseKPI * kpiCoeff);
  const stdTotalBonus = baseBonusAtt + bonusFullAttendance + bonusEfficiency + bonusQualityStar + bonusPerformance + baseKPI + bonusRecruitment;
  const totalBonus = bonusAtt + bonusFullAttendance + bonusEfficiency + bonusQualityStar + bonusPerformance + amountKPI + bonusRecruitment;

  // 7. V. TỔNG THU NHẬP (GROSS) = I + II + III + IV
  const grossIncome = amountDay + totalOTAmount + totalAllowance + totalBonus;

  // 8. VI. CÁC KHOẢN GIẢM TRỪ (Bảo hiểm & Thuế)
  const deductBHXH = Math.round(insSalary * 0.08);
  const deductBHYT = Math.round(insSalary * 0.015);
  const deductBHTN = Math.round(insSalary * 0.01);
  const deductKPCĐ = Math.round(insSalary * 0.005);

  // Thuế thu nhập cá nhân (TNCN)
  const isTaxExempt = (cfg.isTaxExempt == 1);
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
    hasData: true,
    month: monthNum,
    year: targetYear,
    baseSalary, posAllowance, senAllowance, kpiCoeff,
    stdDays, stdHours, exactHourlyRate, hourlyRate, insSalary, nightShifts,
    workedDays, totalBaseWorkedHours, isFullAttendance, bonusAtt,
    countP, countL, countNB, countN, countKL, countTD,
    totStd, totActual, tot130, tot150, tot200, tot210, tot270, tot300, tot390,
    amountDay,
    rate130, rate150, rate200, rate210, rate270, rate300, rate390,
    amount130, amount150, amount200, amount210, amount270, amount300, amount390,
    totalOTHours, totalOTAmount,
    gas, house, child, safety, nightSubsidy, mealNight, period, other, totalAllowance,
    baseBonusAtt, bonusAtt, bonusFullAttendance, bonusEfficiency, bonusQualityStar, bonusPerformance, baseKPI, amountKPI, bonusRecruitment, stdTotalBonus, totalBonus,
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

  // Update Night Shift Subsidy auto hints and inputs
  const nShifts = (nightShiftsCount !== undefined) ? nightShiftsCount : calc.nightShifts;
  document.getElementById("labelNightSubsidy").innerText = `30k x ${nShifts} đêm`;
  document.getElementById("labelMealSubsidy").innerText = `25k x ${nShifts} đêm`;

  const inputNight = document.getElementById("allowanceNight");
  if (inputNight && document.activeElement !== inputNight) {
    inputNight.value = calc.nightSubsidy;
  }
  const inputMeal = document.getElementById("allowanceMealNight");
  if (inputMeal && document.activeElement !== inputMeal) {
    inputMeal.value = calc.mealNight;
  }

  // Cập nhật lại configStore và localStorage để đồng bộ chuẩn xác
  if (monthlyConfigStore[currentMonth]) {
    monthlyConfigStore[currentMonth].allowanceNight = calc.nightSubsidy;
    monthlyConfigStore[currentMonth].allowanceMealNight = calc.mealNight;
    monthlyConfigStore[currentMonth].lastNightShifts = calc.nightShifts;
    writeCfgStorage(currentYear, currentMonth, monthlyConfigStore[currentMonth], currentEmpId);
  }

  // Part III & IV
  document.getElementById("totalAllowance").innerText = formatMoney(calc.totalAllowance);
  document.getElementById("totalBonus").innerText = formatMoney(calc.totalBonus);
  if (document.getElementById("stdTotalBonus")) {
    document.getElementById("stdTotalBonus").innerText = formatMoney(calc.stdTotalBonus);
  }
  if (document.getElementById("amountBonusAtt")) {
    document.getElementById("amountBonusAtt").innerText = formatMoney(calc.bonusAtt);
  }
  if (document.getElementById("amountBonusFullAtt")) {
    document.getElementById("amountBonusFullAtt").innerText = formatMoney(calc.bonusFullAttendance);
  }
  if (document.getElementById("amountBonusEfficiency")) {
    document.getElementById("amountBonusEfficiency").innerText = formatMoney(calc.bonusEfficiency);
  }
  if (document.getElementById("amountBonusQualityStar")) {
    document.getElementById("amountBonusQualityStar").innerText = formatMoney(calc.bonusQualityStar);
  }
  if (document.getElementById("amountBonusPerformance")) {
    document.getElementById("amountBonusPerformance").innerText = formatMoney(calc.bonusPerformance);
  }
  if (document.getElementById("amountBonusKPI")) {
    document.getElementById("amountBonusKPI").innerText = formatMoney(calc.amountKPI);
  }
  if (document.getElementById("amountBonusRecruitment")) {
    document.getElementById("amountBonusRecruitment").innerText = formatMoney(calc.bonusRecruitment);
  }
  const kpiInputEl = document.getElementById("kpiCoeff");
  const kpiVal = (kpiInputEl && kpiInputEl.value !== "") ? parseVal(kpiInputEl.value) : 1;
  const kpiInline = document.getElementById("kpiCoeffInline");
  if (kpiInline && document.activeElement !== kpiInline) {
    kpiInline.value = kpiVal;
  }
  const kpiTop = document.getElementById("kpiCoeff");
  if (kpiTop && document.activeElement !== kpiTop) {
    kpiTop.value = kpiVal;
  }

  const formatLeaveNum = (n) => (n % 1 === 0 ? n.toString() : (Math.round(n * 10) / 10).toString().replace(".", ","));

  if (calc.countTD > 0) {
    document.getElementById("attBonusStatus").innerText = `Nghỉ tự do (${formatLeaveNum(calc.countTD)} ngày) - Mất CC`;
    document.getElementById("badgeAttendanceStatus").innerText = `Nghỉ tự do (Mất CC)`;
    document.getElementById("badgeAttendanceStatus").className = "auto-badge bg-rose-100 text-rose-800";
  } else if (calc.isFullAttendance) {
    let note = "Đủ công";
    const leaveNotes = [];
    if (calc.countP > 0) leaveNotes.push(`${formatLeaveNum(calc.countP)}P`);
    if (calc.countL > 0) leaveNotes.push(`${formatLeaveNum(calc.countL)}L`);
    if (calc.countNB > 0) leaveNotes.push(`${formatLeaveNum(calc.countNB)}NB`);
    if (calc.countN > 0) leaveNotes.push(`${formatLeaveNum(calc.countN)}N`);
    if (leaveNotes.length > 0) note += ` (${leaveNotes.join(", ")})`;
    document.getElementById("attBonusStatus").innerText = note;
    document.getElementById("badgeAttendanceStatus").innerText = "Đủ công";
    document.getElementById("badgeAttendanceStatus").className = "auto-badge bg-emerald-100 text-emerald-800";
  } else {
    let note = `Thiếu (${formatLeaveNum(calc.workedDays)}/${calc.stdDays} ngày)`;
    if (calc.countKL > 0) note += ` [${formatLeaveNum(calc.countKL)}KL]`;
    document.getElementById("attBonusStatus").innerText = note;
    document.getElementById("badgeAttendanceStatus").innerText = `Thiếu (${formatLeaveNum(calc.workedDays)}/${calc.stdDays})`;
    document.getElementById("badgeAttendanceStatus").className = "auto-badge bg-amber-100 text-amber-800";
  }

  // Cập nhật nhãn tổng hợp ngày nghỉ phép / lễ (có hỗ trợ nửa ngày)
  const leaveStatsEl = document.getElementById("leaveStatsBadge");
  if (leaveStatsEl) {
    const parts = [];
    if (calc.countP > 0) parts.push(`🌿 ${formatLeaveNum(calc.countP)} Phép (P)`);
    if (calc.countL > 0) parts.push(`🎉 ${formatLeaveNum(calc.countL)} Lễ (L)`);
    if (calc.countNB > 0) parts.push(`🔄 ${formatLeaveNum(calc.countNB)} Nghỉ bù (NB)`);
    if (calc.countN > 0) parts.push(`⏳ ${formatLeaveNum(calc.countN)} Nhỡ việc (N)`);
    if (calc.countKL > 0) parts.push(`⚪ ${formatLeaveNum(calc.countKL)} Không lương (KL)`);
    if (calc.countTD > 0) parts.push(`⚠️ ${formatLeaveNum(calc.countTD)} Tự do (TD)`);
    if (parts.length > 0) {
      leaveStatsEl.classList.remove("hidden");
      leaveStatsEl.innerHTML = parts.join(" • ");
    } else {
      leaveStatsEl.classList.add("hidden");
    }
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
  const mobileBottomNet = document.getElementById("mobileBottomNet");
  if (mobileBottomNet) {
    mobileBottomNet.innerText = `${formatMoney(calc.netSalary)} đ`;
  }

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

  renderAnnualLeaveTable();
}

// ========================================================
// BẢNG THỐNG KÊ TỔNG TIỀN 12 THÁNG TRONG NĂM
// ========================================================
function renderYearSummary() {
  saveCurrentMonthInputsToConfigStore();
  document.getElementById("summaryYearLabel").innerText = currentYear;

  const tbody = document.getElementById("tbodyYearSummary");
  tbody.innerHTML = "";

  let yearStdDays = 0, yearActualHours = 0, yearOTHours = 0;
  let yearDayWages = 0, yearOTWages = 0, yearBonusAllow = 0;
  let yearGross = 0, yearDeductions = 0, yearNet = 0;
  let workedMonthsCount = 0;
  let visibleRowsCount = 0;

  const monthlyNets = [];

  for (let m = 1; m <= 12; m++) {
    const calc = calculateSalaryForMonth(m);
    monthlyNets.push({ month: m, net: calc.netSalary, hasData: calc.hasData });

    if (calc.hasData) {
      workedMonthsCount++;
      yearStdDays += calc.stdDays;
      yearActualHours += calc.totActual;
      yearOTHours += calc.totalOTHours;
      yearDayWages += calc.amountDay;
      yearOTWages += calc.totalOTAmount;
      yearBonusAllow += (calc.totalAllowance + calc.totalBonus);
      yearGross += calc.grossIncome;
      yearDeductions += calc.totalDeductions;
      yearNet += calc.netSalary;
    }

    const isHidden = filterOnlyWorkedMonths && !calc.hasData;
    if (!isHidden) visibleRowsCount++;

    const tr = document.createElement("tr");
    const isCur = (m === currentMonth);
    tr.className = `border-b border-black text-center ${isCur ? "bg-amber-100/90 font-bold ring-2 ring-inset ring-amber-400" : (calc.hasData ? "hover:bg-slate-50" : "bg-slate-50/40 text-slate-400 hover:bg-slate-100")} ${isHidden ? "hidden" : ""}`;

    tr.innerHTML = `
      <td class="border-r border-black py-2 px-2 font-bold ${calc.hasData ? 'text-slate-900' : 'text-slate-500'} sticky-col-left bg-inherit">
        Tháng ${m} ${isCur ? "<span class='text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold ml-1 shadow-2xs'>Đang xem T" + m + "</span>" : ""}
      </td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-semibold ${calc.hasData ? 'text-slate-800' : 'text-slate-400'} bg-slate-50/50">${formatMoney(calc.baseSalary)}</td>
      <td class="border-r border-black py-2 px-1 num-font ${calc.hasData ? '' : 'text-slate-400'}">${calc.stdDays} ngày</td>
      <td class="border-r border-black py-2 px-1 num-font ${calc.hasData ? 'text-blue-800 font-semibold' : 'text-slate-400'}">${calc.hasData ? formatHours(calc.totActual) + ' h' : '-'}</td>
      <td class="border-r border-black py-2 px-1 num-font ${calc.hasData ? 'text-purple-800 font-semibold' : 'text-slate-400'}">${calc.hasData ? formatHours(calc.totalOTHours) + ' h' : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${calc.hasData ? '' : 'text-slate-400'}">${calc.hasData ? formatMoney(calc.amountDay) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${calc.hasData ? 'text-purple-700' : 'text-slate-400'}">${calc.hasData ? formatMoney(calc.totalOTAmount) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${calc.hasData ? 'text-emerald-700' : 'text-slate-400'}">${calc.hasData ? formatMoney(calc.totalAllowance + calc.totalBonus) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${calc.hasData ? 'font-bold text-slate-900' : 'text-slate-400'}">${calc.hasData ? formatMoney(calc.grossIncome) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${calc.hasData ? 'text-rose-700' : 'text-slate-400'}">${calc.hasData ? formatMoney(calc.totalDeductions) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-bold ${calc.hasData ? 'text-emerald-800 text-sm bg-emerald-50/50' : 'text-slate-400 text-xs italic'}">
        ${calc.hasData ? formatMoney(calc.netSalary) : 'Chưa chấm công'}
      </td>
      <td class="border-r border-black py-1 px-1 no-print">
        <button onclick="goToMonth(${m})" class="px-2 py-1 ${calc.hasData ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 hover:bg-blue-600 hover:text-white text-slate-700'} text-[11px] rounded shadow-2xs transition">
          <i class="fa-solid fa-pen-to-square"></i> ${calc.hasData ? 'Xem/Sửa' : 'Nhập công'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  // Nếu đang lọc chỉ hiện tháng có dữ liệu mà năm này chưa có tháng nào làm:
  if (visibleRowsCount === 0) {
    const trEmpty = document.createElement("tr");
    trEmpty.innerHTML = `
      <td colspan="12" class="py-8 text-center text-slate-500 font-medium bg-slate-50/50">
        <i class="fa-solid fa-calendar-xmark text-amber-500 text-lg mb-1 block"></i>
        <span>Năm <b>${currentYear}</b> chưa có tháng nào được chấm công.</span><br>
        <button onclick="goToMonth(1)" class="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold shadow-xs transition">
          <i class="fa-solid fa-pen"></i> Chấm công Tháng 1/${currentYear}
        </button>
      </td>
    `;
    tbody.appendChild(trEmpty);
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
  const avgNet = workedMonthsCount > 0 ? Math.round(yearNet / workedMonthsCount) : 0;
  document.getElementById("kpiAvgNet").innerText = `Bình quân: ~${formatMoney(avgNet)} đ/tháng (${workedMonthsCount} tháng đã làm)`;

  renderAnnualLeaveTable();
  renderVisualChart(monthlyNets);
  renderMultiYearSummary();
}

function calculateYearTotal(targetYear) {
  let yearStdDays = 0, yearActualHours = 0, yearOTHours = 0;
  let yearDayWages = 0, yearOTWages = 0, yearBonusAllow = 0;
  let yearGross = 0, yearDeductions = 0, yearNet = 0;
  let workedMonths = 0;

  for (let m = 1; m <= 12; m++) {
    const calc = calculateSalaryForMonth(m, targetYear);
    if (calc.hasData) {
      workedMonths++;
      yearStdDays += calc.stdDays;
      yearActualHours += calc.totActual;
      yearOTHours += calc.totalOTHours;
      yearDayWages += calc.amountDay;
      yearOTWages += calc.totalOTAmount;
      yearBonusAllow += (calc.totalAllowance + calc.totalBonus);
      yearGross += calc.grossIncome;
      yearDeductions += calc.totalDeductions;
      yearNet += calc.netSalary;
    }
  }

  return {
    year: targetYear,
    workedMonths,
    yearStdDays,
    yearActualHours,
    yearOTHours,
    yearDayWages,
    yearOTWages,
    yearBonusAllow,
    yearGross,
    yearDeductions,
    yearNet,
    avgNet: workedMonths > 0 ? Math.round(yearNet / workedMonths) : 0
  };
}

function renderMultiYearSummary() {
  const tbody = document.getElementById("tbodyMultiYearSummary");
  const tfoot = document.getElementById("tfootMultiYearSummary");
  if (!tbody) return;
  tbody.innerHTML = "";

  const years = getAvailableYearsList();

  // Populate #selectYearSummary options
  const selectYearSummary = document.getElementById("selectYearSummary");
  if (selectYearSummary) {
    selectYearSummary.innerHTML = "";
    years.forEach(y => {
      const opt = document.createElement("option");
      opt.value = y.toString();
      opt.innerText = `Năm ${y}`;
      if (y === currentYear) opt.selected = true;
      selectYearSummary.appendChild(opt);
    });
  }

  let grandStdDays = 0, grandActualHours = 0, grandOTHours = 0;
  let grandDayWages = 0, grandOTWages = 0, grandBonusAllow = 0;
  let grandGross = 0, grandDeductions = 0, grandNet = 0;
  let grandWorkedMonths = 0;

  years.forEach(y => {
    const total = calculateYearTotal(y);
    grandStdDays += total.yearStdDays;
    grandActualHours += total.yearActualHours;
    grandOTHours += total.yearOTHours;
    grandDayWages += total.yearDayWages;
    grandOTWages += total.yearOTWages;
    grandBonusAllow += total.yearBonusAllow;
    grandGross += total.yearGross;
    grandDeductions += total.yearDeductions;
    grandNet += total.yearNet;
    grandWorkedMonths += total.workedMonths;

    const isCurrent = (y === currentYear);
    const tr = document.createElement("tr");
    tr.className = `border-b border-black text-center ${isCurrent ? "bg-amber-100/90 font-bold ring-2 ring-inset ring-amber-400" : "hover:bg-slate-50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap sticky-col-left bg-inherit">
        Năm ${y} ${isCurrent ? "<span class='text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold ml-1 shadow-2xs'>Đang xem</span>" : ""}
      </td>
      <td class="border-r border-black py-2 px-1 num-font ${total.workedMonths > 0 ? '' : 'text-slate-400'}">${total.yearStdDays} ngày</td>
      <td class="border-r border-black py-2 px-1 num-font ${total.workedMonths > 0 ? 'text-blue-800 font-semibold' : 'text-slate-400'}">${total.workedMonths > 0 ? formatHours(total.yearActualHours) + ' h' : '-'}</td>
      <td class="border-r border-black py-2 px-1 num-font ${total.workedMonths > 0 ? 'text-purple-800 font-semibold' : 'text-slate-400'}">${total.workedMonths > 0 ? formatHours(total.yearOTHours) + ' h' : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${total.workedMonths > 0 ? '' : 'text-slate-400'}">${total.workedMonths > 0 ? formatMoney(total.yearDayWages) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${total.workedMonths > 0 ? 'text-purple-700' : 'text-slate-400'}">${total.workedMonths > 0 ? formatMoney(total.yearOTWages) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${total.workedMonths > 0 ? 'text-emerald-700' : 'text-slate-400'}">${total.workedMonths > 0 ? formatMoney(total.yearBonusAllow) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${total.workedMonths > 0 ? 'font-bold text-slate-900' : 'text-slate-400'}">${total.workedMonths > 0 ? formatMoney(total.yearGross) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${total.workedMonths > 0 ? 'text-rose-700' : 'text-slate-400'}">${total.workedMonths > 0 ? formatMoney(total.yearDeductions) : '-'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-bold ${total.workedMonths > 0 ? 'text-emerald-800 text-sm bg-emerald-50/50' : 'text-slate-400 italic text-xs'}">${total.workedMonths > 0 ? formatMoney(total.yearNet) : 'Chưa có dữ liệu'}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right ${total.workedMonths > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}">${total.workedMonths > 0 ? '~' + formatMoney(total.avgNet) + ' đ' : '-'}</td>
      <td class="border-r border-black py-1 px-1 no-print whitespace-nowrap">
        ${isCurrent ? "<span class='text-xs text-slate-400 italic font-normal'>Đang xem</span>" : `
          <button onclick="switchYear(${y})" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] rounded shadow-2xs transition font-semibold" title="Mở năm ${y}">
            <i class="fa-solid fa-folder-open"></i> Xem Năm ${y}
          </button>
          <button onclick="deleteYear(${y})" class="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-300 text-[11px] rounded shadow-2xs transition ml-1" title="Xóa năm ${y}">
            <i class="fa-solid fa-trash-can"></i> Xóa
          </button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (tfoot) {
    const avgAllNet = grandWorkedMonths > 0 ? Math.round(grandNet / grandWorkedMonths) : 0;
    tfoot.innerHTML = `
      <tr class="bg-slate-900 text-white font-bold text-center text-xs md:text-sm">
        <td class="border border-black py-2.5 px-3 sticky-col-left bg-slate-900 text-white">TỔNG (${years.length} NĂM)</td>
        <td class="border border-black py-2 px-1 num-font">${grandStdDays} ngày</td>
        <td class="border border-black py-2 px-1 num-font">${formatHours(grandActualHours)} h</td>
        <td class="border border-black py-2 px-1 num-font">${formatHours(grandOTHours)} h</td>
        <td class="border border-black py-2 px-2 num-font text-right">${formatMoney(grandDayWages)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-purple-300">${formatMoney(grandOTWages)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-emerald-300">${formatMoney(grandBonusAllow)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-amber-300 font-bold">${formatMoney(grandGross)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-rose-300">${formatMoney(grandDeductions)}</td>
        <td class="border border-black py-2.5 px-3 num-font text-right text-base text-yellow-300 font-extrabold bg-emerald-950">${formatMoney(grandNet)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-slate-300">${grandWorkedMonths > 0 ? '~' + formatMoney(avgAllNet) + ' đ/th' : '-'}</td>
        <td class="border border-black py-2 px-1 no-print">-</td>
      </tr>
    `;
  }
}

window.switchYear = async function(newYear) {
  if (!newYear || isNaN(newYear)) return;
  newYear = parseInt(newYear);
  if (newYear === currentYear) return;

  // 1. Lưu năm hiện tại trước khi chuyển
  saveCurrentMonthInputsToConfigStore();
  saveYearToMemoryAndStorage(currentYear);
  flushAutoSave();

  // 2. Lấy cấu hình lương mới nhất của năm cũ (ưu tiên tháng 12 của năm cũ)
  const latestSalaryCfg = getLatestSalaryConfigForEmployee(currentEmpId, currentYear, 12);

  // 3. Cập nhật năm mới và chuyển về Tháng 1 của năm mới
  const oldYear = currentYear;
  currentYear = newYear;
  currentMonth = 1;
  addAvailableYear(newYear);

  const inputYear = document.getElementById("inputYear");
  if (inputYear) inputYear.value = currentYear;
  const selectMonthEl = document.getElementById("selectMonth");
  if (selectMonthEl) selectMonthEl.value = "1";
  const summaryLabel = document.getElementById("summaryYearLabel");
  if (summaryLabel) summaryLabel.innerText = currentYear;
  const selectYearSummary = document.getElementById("selectYearSummary");
  if (selectYearSummary) selectYearSummary.value = currentYear.toString();

  // 4. Khởi tạo/nạp dữ liệu năm mới với cấu hình kế thừa từ tháng 12 năm cũ
  initializeDefaultData(latestSalaryCfg);
  await loadAllMonthsFromBackendOrStorage(currentYear);
  loadConfigStoreToInputs(currentMonth);

  // 5. Render lại toàn bộ giao diện
  renderUnifiedTable();
  renderAnnualLeaveTable();
  recalculateMonth();
  renderYearSummary();
  renderMultiYearSummary();
  showToast(`📅 Đã chuyển sang làm việc với dữ liệu Năm ${currentYear}!`);
};

async function promptAddNewYear() {
  const currentList = getAvailableYearsList();
  const nextSuggestion = Math.max(...currentList, currentYear) + 1;
  const val = prompt("Nhập năm bạn muốn tạo bảng chấm công & tính lương (ví dụ: " + nextSuggestion + "):", nextSuggestion.toString());
  if (!val) return;
  const n = parseInt(val.trim());
  if (isNaN(n) || n < 2000 || n > 2100) {
    alert("Vui lòng nhập năm hợp lệ từ 2000 đến 2100.");
    return;
  }
  addAvailableYear(n);
  await switchYear(n);
}
window.promptAddNewYear = promptAddNewYear;

function renderVisualChart(data) {
  const container = document.getElementById("chartContainer");
  container.innerHTML = "";

  const validNets = data.filter(d => d.hasData && d.net > 0).map(d => d.net);
  const maxVal = validNets.length > 0 ? Math.max(...validNets, 25000000) : 25000000;

  data.forEach(item => {
    const isWorked = item.hasData && item.net > 0;
    const heightPercent = isWorked ? Math.max(12, Math.round((item.net / maxVal) * 100)) : 4;
    const isCurrent = (item.month === currentMonth);

    const col = document.createElement("div");
    col.className = "flex-1 flex flex-col items-center justify-end h-full group cursor-pointer";
    col.onclick = () => goToMonth(item.month);

    col.innerHTML = `
      <div class="text-[10px] font-mono font-semibold text-slate-700 opacity-0 group-hover:opacity-100 transition mb-1 whitespace-nowrap">
        ${isWorked ? (item.net / 1000000).toFixed(1) + ' tr' : '-'}
      </div>
      <div class="w-full max-w-[42px] rounded-t transition-all duration-300 ${!isWorked ? 'bg-slate-200 hover:bg-slate-300' : (isCurrent ? 'bg-amber-500 shadow-md ring-2 ring-amber-300' : 'bg-blue-600 hover:bg-blue-500')}" style="height: ${heightPercent}%;"></div>
      <div class="text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-amber-600 font-extrabold' : (isWorked ? 'text-slate-600' : 'text-slate-400 font-normal')}">
        T${item.month}
      </div>
    `;
    container.appendChild(col);
  });
}

function flushAutoSave() {
  clearTimeout(autoSaveTimer);
  if (typeof firebaseSyncTimer !== "undefined") clearTimeout(firebaseSyncTimer);
  saveCurrentMonthToBackend(true);
  if (typeof pushToFirebase === "function") pushToFirebase(true);
}

window.goToMonth = function(m) {
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();
  currentMonth = m;
  document.getElementById("selectMonth").value = m.toString();
  loadConfigStoreToInputs(m);
  document.getElementById("tabBtnUnified").click();
  renderUnifiedTable();
};

// Hàm áp dụng Ca Ngày cho một tháng bất kỳ (mặc định là tháng hiện tại)
function applyDayShiftToMonth(m) {
  const totalDays = getDaysInMonth(currentYear, m);
  for (let d = 1; d <= totalDays; d++) {
    const isSun = (new Date(currentYear, m - 1, d).getDay() === 0);
    applyShiftToDay(m, d, isSun ? "off" : "day");
  }
  if (m === currentMonth) {
    const elN = document.getElementById("allowanceNight");
    if (elN) elN.value = 0;
    const elM = document.getElementById("allowanceMealNight");
    if (elM) elM.value = 0;
  }
  if (!monthlyConfigStore[m]) monthlyConfigStore[m] = getDefaultSalaryConfig(m);
  monthlyConfigStore[m].allowanceNight = 0;
  monthlyConfigStore[m].allowanceMealNight = 0;
  monthlyConfigStore[m].isManualNight = false;

  writeAttStorage(currentYear, m, monthlyStore[m], currentEmpId);
  writeCfgStorage(currentYear, m, monthlyConfigStore[m], currentEmpId);
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();
  renderUnifiedTable();
  showToast(`☀️ Đã áp dụng Ca Ngày cho Tháng ${m}/${currentYear}!`);
}

// Hàm áp dụng Ca Đêm cho một tháng bất kỳ (mặc định là tháng hiện tại)
function applyNightShiftToMonth(m) {
  const totalDays = getDaysInMonth(currentYear, m);
  let countNight = 0;
  for (let d = 1; d <= totalDays; d++) {
    const isSun = (new Date(currentYear, m - 1, d).getDay() === 0);
    applyShiftToDay(m, d, "night");
    if (isSun) {
      monthlyStore[m][d].ot200 = 4;
      monthlyStore[m][d].ot270 = 7.75;
    }
    countNight++;
  }
  const autoNight = countNight * 30000;
  const autoMeal = countNight * 25000;
  if (m === currentMonth) {
    const elN = document.getElementById("allowanceNight");
    if (elN) elN.value = autoNight;
    const elM = document.getElementById("allowanceMealNight");
    if (elM) elM.value = autoMeal;
  }
  if (!monthlyConfigStore[m]) monthlyConfigStore[m] = getDefaultSalaryConfig(m);
  monthlyConfigStore[m].allowanceNight = autoNight;
  monthlyConfigStore[m].allowanceMealNight = autoMeal;
  monthlyConfigStore[m].isManualNight = false;

  writeAttStorage(currentYear, m, monthlyStore[m], currentEmpId);
  writeCfgStorage(currentYear, m, monthlyConfigStore[m], currentEmpId);
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();
  renderUnifiedTable();
  showToast(`🌙 Đã áp dụng Ca Đêm (${countNight} ca) cho Tháng ${m}/${currentYear}!`);
}

// Quick Fill Tools
document.getElementById("btnQuickFillAllDay").addEventListener("click", () => {
  applyDayShiftToMonth(currentMonth);
});

document.getElementById("btnQuickFillAllNight").addEventListener("click", () => {
  applyNightShiftToMonth(currentMonth);
});

document.getElementById("btnQuickFillRotating").addEventListener("click", () => {
  const totalDays = getDaysInMonth(currentYear, currentMonth);
  let countNight = 0;
  for (let d = 1; d <= totalDays; d++) {
    const isSun = (new Date(currentYear, currentMonth - 1, d).getDay() === 0);
    if (d <= 15) {
      applyShiftToDay(currentMonth, d, isSun ? "off" : "day");
    } else {
      applyShiftToDay(currentMonth, d, "night");
      if (isSun) {
        monthlyStore[currentMonth][d].ot200 = 4;
        monthlyStore[currentMonth][d].ot270 = 7.75;
      }
      countNight++;
    }
  }
  const autoNight = countNight * 30000;
  const autoMeal = countNight * 25000;
  const elN = document.getElementById("allowanceNight");
  if (elN) elN.value = autoNight;
  const elM = document.getElementById("allowanceMealNight");
  if (elM) elM.value = autoMeal;

  if (!monthlyConfigStore[currentMonth]) monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
  monthlyConfigStore[currentMonth].allowanceNight = autoNight;
  monthlyConfigStore[currentMonth].allowanceMealNight = autoMeal;
  monthlyConfigStore[currentMonth].isManualNight = false;

  writeAttStorage(currentYear, currentMonth, monthlyStore[currentMonth], currentEmpId);
  writeCfgStorage(currentYear, currentMonth, monthlyConfigStore[currentMonth], currentEmpId);
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();
  renderUnifiedTable();
  showToast(`🔄 Đã áp dụng Lịch xoay ca cho Tháng ${currentMonth}/${currentYear}!`);
});

document.getElementById("btnQuickClearAll").addEventListener("click", () => {
  if (confirm(`Bạn có muốn xóa toàn bộ giờ làm của Tháng ${currentMonth}?`)) {
    const totalDays = getDaysInMonth(currentYear, currentMonth);
    for (let d = 1; d <= totalDays; d++) {
      applyShiftToDay(currentMonth, d, "off");
    }
    writeAttStorage(currentYear, currentMonth, monthlyStore[currentMonth], currentEmpId);
    saveCurrentMonthInputsToConfigStore();
    flushAutoSave();
    renderUnifiedTable();
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
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();
  currentView = "summary";
  document.getElementById("tabBtnYearSummary").className = "py-2.5 px-4 border-b-2 font-bold text-sm transition flex items-center gap-2 border-blue-600 text-blue-600";
  document.getElementById("tabBtnUnified").className = "py-2.5 px-4 border-b-2 font-bold text-sm transition flex items-center gap-2 border-transparent text-slate-500 hover:text-slate-800";
  document.getElementById("viewUnified").classList.add("hidden");
  document.getElementById("viewYearSummary").classList.remove("hidden");
  renderYearSummary();
});

// Month & Year changes
document.getElementById("selectMonth").addEventListener("change", (e) => {
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();
  currentMonth = parseInt(e.target.value);
  loadConfigStoreToInputs(currentMonth);
  renderUnifiedTable();
});

// Month Navigation (Nút next / prev tháng - Đến Tháng 12 chuyển sang Tháng 1 năm mới)
async function goToNextMonth() {
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();

  if (currentMonth < 12) {
    goToMonth(currentMonth + 1);
  } else {
    // Đang ở Tháng 12 -> Chuyển sang Tháng 1 của Năm mới (currentYear + 1)
    const nextYear = currentYear + 1;
    await switchYear(nextYear);
    goToMonth(1);
    showToast(`🎆 Đã chuyển sang Tháng 1 Năm ${nextYear}!`);
  }
}
window.goToNextMonth = goToNextMonth;

async function goToPrevMonth() {
  saveCurrentMonthInputsToConfigStore();
  flushAutoSave();

  if (currentMonth > 1) {
    goToMonth(currentMonth - 1);
  } else {
    // Đang ở Tháng 1 -> Chuyển lùi về Tháng 12 của Năm trước (currentYear - 1)
    const prevYear = currentYear - 1;
    await switchYear(prevYear);
    goToMonth(12);
    showToast(`📅 Đã chuyển lùi về Tháng 12 Năm ${prevYear}!`);
  }
}
window.goToPrevMonth = goToPrevMonth;

const btnPrevMonthMain = document.getElementById("btnPrevMonthMain");
if (btnPrevMonthMain) {
  btnPrevMonthMain.addEventListener("click", () => goToPrevMonth());
}
const btnNextMonthMain = document.getElementById("btnNextMonthMain");
if (btnNextMonthMain) {
  btnNextMonthMain.addEventListener("click", () => goToNextMonth());
}

// Year Navigation & Selection Listeners
const inputYearEl = document.getElementById("inputYear");
if (inputYearEl) {
  inputYearEl.addEventListener("change", async (e) => {
    await switchYear(parseInt(e.target.value));
  });
}
const btnPrevYearMain = document.getElementById("btnPrevYearMain");
if (btnPrevYearMain) {
  btnPrevYearMain.addEventListener("click", () => switchYear(currentYear - 1));
}
const btnNextYearMain = document.getElementById("btnNextYearMain");
if (btnNextYearMain) {
  btnNextYearMain.addEventListener("click", () => switchYear(currentYear + 1));
}

const selectYearSummary = document.getElementById("selectYearSummary");
if (selectYearSummary) {
  selectYearSummary.addEventListener("change", async (e) => {
    await switchYear(parseInt(e.target.value));
  });
}
const btnPrevYearSummary = document.getElementById("btnPrevYearSummary");
if (btnPrevYearSummary) {
  btnPrevYearSummary.addEventListener("click", () => switchYear(currentYear - 1));
}
const btnNextYearSummary = document.getElementById("btnNextYearSummary");
if (btnNextYearSummary) {
  btnNextYearSummary.addEventListener("click", () => switchYear(currentYear + 1));
}

const btnAddYearQuick = document.getElementById("btnAddYearQuick");
if (btnAddYearQuick) {
  btnAddYearQuick.addEventListener("click", promptAddNewYear);
}
const btnAddYearBtn = document.getElementById("btnAddYearBtn");
if (btnAddYearBtn) {
  btnAddYearBtn.addEventListener("click", promptAddNewYear);
}

// Bộ lọc hiển thị tháng trong Bảng Thống Kê 12 Tháng
const btnFilterAllMonths = document.getElementById("btnFilterAllMonths");
const btnFilterWorkedMonths = document.getElementById("btnFilterWorkedMonths");
if (btnFilterAllMonths && btnFilterWorkedMonths) {
  btnFilterAllMonths.addEventListener("click", () => {
    filterOnlyWorkedMonths = false;
    btnFilterAllMonths.className = "px-2.5 py-1 rounded font-bold transition bg-blue-600 text-white shadow-xs";
    btnFilterWorkedMonths.className = "px-2.5 py-1 rounded font-semibold transition text-slate-700 hover:text-blue-700 flex items-center gap-1";
    renderYearSummary();
  });
  btnFilterWorkedMonths.addEventListener("click", () => {
    filterOnlyWorkedMonths = true;
    btnFilterWorkedMonths.className = "px-2.5 py-1 rounded font-bold transition bg-blue-600 text-white shadow-xs flex items-center gap-1";
    btnFilterAllMonths.className = "px-2.5 py-1 rounded font-semibold transition text-slate-700 hover:text-blue-700";
    renderYearSummary();
  });
}

// Salary parameter inputs
[
  "baseSalary", "positionAllowance", "seniorityAllowance", "kpiCoeff",
  "allowanceGas", "allowanceHouse", "allowanceChild", "allowanceSafety",
  "allowanceNight", "allowanceMealNight", "allowancePeriod", "allowanceOther",
  "bonusAttendance", "bonusFullAttendance", "bonusEfficiency", "bonusQualityStar", "bonusPerformance", "bonusKPI", "bonusRecruitment", "bankAccount", "bankName"
].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("input", () => {
      if (id === "allowanceNight" || id === "allowanceMealNight") {
        if (!monthlyConfigStore[currentMonth]) monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
        monthlyConfigStore[currentMonth].isManualNight = true; // Đánh dấu khi người dùng cố ý tự gõ số tiền
      }
      if (id === "kpiCoeff") {
        const inlineEl = document.getElementById("kpiCoeffInline");
        if (inlineEl) inlineEl.value = el.value;
      }
      saveCurrentMonthInputsToConfigStore();
      if (!["allowanceNight", "allowanceMealNight"].includes(id)) {
        applyCurrentMonthSalaryToFutureMonths(true);
      }
      recalculateMonth();
      renderYearSummary();
      triggerAutoSave();
    });
  }
});

// Listener riêng cho ô Hệ số KPI trực tiếp trong hàng KPI
const elKpiInline = document.getElementById("kpiCoeffInline");
if (elKpiInline) {
  elKpiInline.addEventListener("input", (e) => {
    const elKpiTop = document.getElementById("kpiCoeff");
    if (elKpiTop) elKpiTop.value = e.target.value;
    saveCurrentMonthInputsToConfigStore();
    recalculateMonth();
    renderYearSummary();
    triggerAutoSave();
  });
}

// Toggle Miễn Thuế TNCN
const taxExemptToggle = document.getElementById("taxExemptToggle");
if (taxExemptToggle) {
  taxExemptToggle.addEventListener("change", () => {
    saveCurrentMonthInputsToConfigStore();
    recalculateMonth();
    renderYearSummary();
    triggerAutoSave();
  });
}

// Top Bar Action Buttons: Áp dụng trực tiếp vào THÁNG ĐANG CHỌN (Không bị nhảy tháng)
const btnSampleDec = document.getElementById("btnLoadSampleDec");
if (btnSampleDec) {
  btnSampleDec.addEventListener("click", () => {
    applyDayShiftToMonth(currentMonth);
  });
}

const btnSampleNov = document.getElementById("btnLoadSampleNov");
if (btnSampleNov) {
  btnSampleNov.addEventListener("click", () => {
    applyNightShiftToMonth(currentMonth);
  });
}

// Nút xem mẫu gốc T11 / T12 (Nếu có trong DOM)
const btnNovOrigin = document.getElementById("btnLoadSampleNovOrigin");
if (btnNovOrigin) {
  btnNovOrigin.addEventListener("click", () => {
    goToMonth(11);
  });
}
const btnDecOrigin = document.getElementById("btnLoadSampleDecOrigin");
if (btnDecOrigin) {
  btnDecOrigin.addEventListener("click", () => {
    goToMonth(12);
  });
}

const btnResetEl = document.getElementById("btnResetData");
if (btnResetEl) {
  btnResetEl.addEventListener("click", () => {
    if (currentAuthRole !== "admin") {
      showToast("⚠️ Chỉ Quản trị viên (Admin) mới có quyền làm mới số liệu!");
      return;
    }
    if (confirm("Bạn có chắc chắn muốn làm mới toàn bộ số liệu cả 12 tháng về mặc định?")) {
      initializeDefaultData();
      renderUnifiedTable();
    }
  });
}

// Build Export Workbook with SheetJS
function buildExportWorkbook() {
  if (typeof XLSX === "undefined") return null;

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

  const empName = document.getElementById("empName") ? document.getElementById("empName").value : "Nguyễn Công Thịnh";
  const empCardId = document.getElementById("empCardId") ? document.getElementById("empCardId").value : "";
  const empDept = document.getElementById("empDept") ? document.getElementById("empDept").value : "Bộ phận Kỹ thuật";
  const stdWorkDays = document.getElementById("stdWorkDays") ? document.getElementById("stdWorkDays").innerText : "26";
  const stdWorkHours = document.getElementById("stdWorkHours") ? document.getElementById("stdWorkHours").innerText : "208";
  const baseSal = parseVal(document.getElementById("baseSalary") ? document.getElementById("baseSalary").value : 6300000);
  const hourly = document.getElementById("hourlyRate") ? document.getElementById("hourlyRate").innerText : "42.548";
  const posAllowance = parseVal(document.getElementById("positionAllowance") ? document.getElementById("positionAllowance").value : 2450000);
  const kpi = parseVal(document.getElementById("kpiCoeff") ? document.getElementById("kpiCoeff").value : 1.0);
  const senAllowance = parseVal(document.getElementById("seniorityAllowance") ? document.getElementById("seniorityAllowance").value : 100000);
  const insSal = document.getElementById("insuranceSalary") ? document.getElementById("insuranceSalary").innerText : "8.850.000";

  const rightRows = [
    ["Họ và tên", empName, "Mã số thẻ", empCardId],
    ["Bộ phận", empDept, "Ngày công chuẩn", stdWorkDays],
    ["Lương cơ bản (LCB)", baseSal, "Số giờ tiêu chuẩn", stdWorkHours],
    ["Phụ cấp chức vụ", posAllowance, "Đơn giá giờ", hourly],
    ["Thâm niên", senAllowance, "Hệ số KPI", kpi],
    ["Lương đóng BH", insSal, "Bảo mật", "Theo MST"],
    ["MỤC TÍNH LƯƠNG", "CÔNG THỨC / ĐƠN GIÁ", "SỐ GIỜ", "THÀNH TIỀN (VNĐ)"],
    ["I. LƯƠNG LÀM THỰC TẾ (100%)", document.getElementById("unitRateDay") ? document.getElementById("unitRateDay").innerText : "", document.getElementById("hoursDay") ? document.getElementById("hoursDay").innerText : "", document.getElementById("amountDay") ? document.getElementById("amountDay").innerText : ""],
    ["II. LÀM THÊM GIỜ & CA ĐÊM", "", document.getElementById("totalOTHours") ? document.getElementById("totalOTHours").innerText : "", document.getElementById("totalOTAmount") ? document.getElementById("totalOTAmount").innerText : ""],
    ["1. Phụ cấp ca đêm (130%)", document.getElementById("rateOT130") ? document.getElementById("rateOT130").innerText : "", document.getElementById("hoursOT130") ? document.getElementById("hoursOT130").innerText : "", document.getElementById("amountOT130") ? document.getElementById("amountOT130").innerText : ""],
    ["2. Tăng ca ngày thường (150%)", document.getElementById("rateOT150") ? document.getElementById("rateOT150").innerText : "", document.getElementById("hoursOT150") ? document.getElementById("hoursOT150").innerText : "", document.getElementById("amountOT150") ? document.getElementById("amountOT150").innerText : ""],
    ["3. Tăng ca Chủ Nhật ngày (200%)", document.getElementById("rateOT200") ? document.getElementById("rateOT200").innerText : "", document.getElementById("hoursOT200") ? document.getElementById("hoursOT200").innerText : "", document.getElementById("amountOT200") ? document.getElementById("amountOT200").innerText : ""],
    ["4. Tăng ca đêm ngày thường (210%)", document.getElementById("rateOT210") ? document.getElementById("rateOT210").innerText : "", document.getElementById("hoursOT210") ? document.getElementById("hoursOT210").innerText : "", document.getElementById("amountOT210") ? document.getElementById("amountOT210").innerText : ""],
    ["5. Tăng ca đêm Chủ Nhật (270%)", document.getElementById("rateOT270") ? document.getElementById("rateOT270").innerText : "", document.getElementById("hoursOT270") ? document.getElementById("hoursOT270").innerText : "", document.getElementById("amountOT270") ? document.getElementById("amountOT270").innerText : ""],
    ["6. Tăng ca ngày Lễ (300%)", document.getElementById("rateOT300") ? document.getElementById("rateOT300").innerText : "", document.getElementById("hoursOT300") ? document.getElementById("hoursOT300").innerText : "", document.getElementById("amountOT300") ? document.getElementById("amountOT300").innerText : ""],
    ["7. Tăng ca đêm ngày Lễ (390%)", document.getElementById("rateOT390") ? document.getElementById("rateOT390").innerText : "", document.getElementById("hoursOT390") ? document.getElementById("hoursOT390").innerText : "", document.getElementById("amountOT390") ? document.getElementById("amountOT390").innerText : ""],
    ["III. CÁC KHOẢN TRỢ CẤP", "", "Tiêu chuẩn", document.getElementById("totalAllowance") ? document.getElementById("totalAllowance").innerText : ""],
    ["1. Trợ cấp xăng xe", "Cố định", "", parseVal(document.getElementById("allowanceGas") ? document.getElementById("allowanceGas").value : 500000)],
    ["2. Trợ cấp nhà ở", "Cố định", "", parseVal(document.getElementById("allowanceHouse") ? document.getElementById("allowanceHouse").value : 500000)],
    ["3. Trợ cấp con nhỏ", "", "", parseVal(document.getElementById("allowanceChild") ? document.getElementById("allowanceChild").value : 0)],
    ["4. Trợ cấp PCCC/ Trợ cấp an toàn", "/", "", parseVal(document.getElementById("allowanceSafety") ? document.getElementById("allowanceSafety").value : 0)],
    ["5. Trợ cấp ca đêm", "", "", parseVal(document.getElementById("allowanceNight") ? document.getElementById("allowanceNight").value : 0)],
    ["6. Tiền ăn ca đêm / Tiền 10K ca ngày", "", "", parseVal(document.getElementById("allowanceMealNight") ? document.getElementById("allowanceMealNight").value : 0)],
    ["7. Trợ cấp kinh nguyệt", "", "", parseVal(document.getElementById("allowancePeriod") ? document.getElementById("allowancePeriod").value : 0)],
    ["8. Trợ cấp khác", "", "", parseVal(document.getElementById("allowanceOther") ? document.getElementById("allowanceOther").value : 0)],
    ["IV. CÁC KHOẢN THƯỞNG", "", document.getElementById("stdTotalBonus") ? document.getElementById("stdTotalBonus").innerText : "3.650.000", document.getElementById("totalBonus") ? document.getElementById("totalBonus").innerText : ""],
    ["1. Tiền thưởng chuyên cần", document.getElementById("attBonusStatus") ? document.getElementById("attBonusStatus").innerText : "Đủ công", parseVal(document.getElementById("bonusAttendance") ? document.getElementById("bonusAttendance").value : 600000), document.getElementById("amountBonusAtt") ? document.getElementById("amountBonusAtt").innerText : ""],
    ["2. Thưởng khác/ Thưởng đi làm đầy đủ", "", parseVal(document.getElementById("bonusFullAttendance") ? document.getElementById("bonusFullAttendance").value : 0), document.getElementById("amountBonusFullAtt") ? document.getElementById("amountBonusFullAtt").innerText : ""],
    ["3. Tiền thưởng hiệu suất", "", parseVal(document.getElementById("bonusEfficiency") ? document.getElementById("bonusEfficiency").value : 0), document.getElementById("amountBonusEfficiency") ? document.getElementById("amountBonusEfficiency").innerText : ""],
    ["4. Khen thưởng sao sáng,ngôi sao chất lượng", "", parseVal(document.getElementById("bonusQualityStar") ? document.getElementById("bonusQualityStar").value : 0), document.getElementById("amountBonusQualityStar") ? document.getElementById("amountBonusQualityStar").innerText : ""],
    ["5. Thưởng biểu hiện công việc", "", parseVal(document.getElementById("bonusPerformance") ? document.getElementById("bonusPerformance").value : 0), document.getElementById("amountBonusPerformance") ? document.getElementById("amountBonusPerformance").innerText : ""],
    ["6. Tiền thưởng thành tích KPI", `Hệ số: ${kpi}`, parseVal(document.getElementById("bonusKPI") ? document.getElementById("bonusKPI").value : 3050000), document.getElementById("amountBonusKPI") ? document.getElementById("amountBonusKPI").innerText : ""],
    ["7. Thưởng tuyển dụng(giới thiệu&tự ứng tuyển)", "", parseVal(document.getElementById("bonusRecruitment") ? document.getElementById("bonusRecruitment").value : 0), document.getElementById("amountBonusRecruitment") ? document.getElementById("amountBonusRecruitment").innerText : ""],
    ["V. TỔNG THU NHẬP (I+II+III+IV)", "", "", document.getElementById("totalGrossIncome") ? document.getElementById("totalGrossIncome").innerText : ""],
    ["VI. CÁC KHOẢN GIẢM TRỪ", "Tỷ lệ", "Lương đóng BH", document.getElementById("headerDeductions") ? document.getElementById("headerDeductions").innerText : ""],
    ["1. Bảo hiểm xã hội (BHXH - 8%)", "8%", insSal, document.getElementById("deductBHXH") ? document.getElementById("deductBHXH").innerText : ""],
    ["2. Bảo hiểm y tế (BHYT - 1.5%)", "1.50%", insSal, document.getElementById("deductBHYT") ? document.getElementById("deductBHYT").innerText : ""],
    ["3. Bảo hiểm thất nghiệp (BHTN - 1%)", "1%", insSal, document.getElementById("deductBHTN") ? document.getElementById("deductBHTN").innerText : ""],
    ["4. Kinh phí công đoàn (0.5%)", "0.50%", insSal, document.getElementById("deductKPCĐ") ? document.getElementById("deductKPCĐ").innerText : ""],
    ["5. Thuế thu nhập cá nhân (TNCN)", document.getElementById("taxRateLabel") ? document.getElementById("taxRateLabel").innerText : "0% (Miễn thuế)", document.getElementById("taxableAmount") ? document.getElementById("taxableAmount").innerText : "0", document.getElementById("deductTNCN") ? document.getElementById("deductTNCN").innerText : "0"],
    ["TỔNG CÁC KHOẢN GIẢM TRỪ", "", "", document.getElementById("totalDeductions") ? document.getElementById("totalDeductions").innerText : ""],
    ["VII. THỰC LĨNH / THỰC NHẬN", "", "", document.getElementById("netSalary") ? document.getElementById("netSalary").innerText : ""],
    ["Thông tin thanh toán", document.getElementById("bankAccount") ? document.getElementById("bankAccount").value : "", "Ngân hàng:", document.getElementById("bankName") ? document.getElementById("bankName").value : ""]
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
    document.getElementById("totStdUnified") ? document.getElementById("totStdUnified").innerText : "",
    document.getElementById("totActualUnified") ? document.getElementById("totActualUnified").innerText : "",
    document.getElementById("tot130Unified") ? document.getElementById("tot130Unified").innerText : "",
    document.getElementById("tot150Unified") ? document.getElementById("tot150Unified").innerText : "",
    document.getElementById("tot200Unified") ? document.getElementById("tot200Unified").innerText : "",
    document.getElementById("tot210Unified") ? document.getElementById("tot210Unified").innerText : "",
    document.getElementById("tot270Unified") ? document.getElementById("tot270Unified").innerText : "",
    document.getElementById("tot300Unified") ? document.getElementById("tot300Unified").innerText : "",
    document.getElementById("tot390Unified") ? document.getElementById("tot390Unified").innerText : ""
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  XLSX.utils.book_append_sheet(wb, ws1, `Cham Cong T${currentMonth}_${currentYear}`);

  // --- SHEET 2: BẢNG THỐNG KÊ 12 THÁNG TRONG NĂM ---
  const ws2Data = [];
  ws2Data.push([`BẢNG THỐNG KÊ TỔNG TIỀN LƯƠNG 12 THÁNG NĂM ${currentYear}`]);
  ws2Data.push([
    "Tháng", "Lương cơ bản (LCB)", "Công chuẩn", "Giờ thực tế", "Tổng giờ OT", "Lương thời gian", "Tiền OT",
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
      calc.baseSalary,
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
    "-",
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

  // --- SHEET 3: BẢNG TỔNG HỢP SO SÁNH THU NHẬP QUA CÁC NĂM (ĐA NĂM) ---
  const ws3Data = [];
  ws3Data.push(["BẢNG TỔNG HỢP SO SÁNH THU NHẬP QUA CÁC NĂM (LƯU TRỮ ĐA NĂM)"]);
  ws3Data.push([
    "Năm", "Công chuẩn", "Giờ thực tế", "Tổng giờ OT", "Lương thời gian", "Tiền OT",
    "Trợ cấp & Thưởng", "Tổng thu nhập (Gross)", "Giảm trừ BH", "THỰC LĨNH (NET)", "Bình quân / tháng"
  ]);

  const yearsList = getAvailableYearsList();
  let gStd = 0, gActual = 0, gOT = 0, gDay = 0, gOTW = 0, gBon = 0, gGross = 0, gDed = 0, gNet = 0;

  yearsList.forEach(y => {
    const tot = calculateYearTotal(y);
    gStd += tot.yearStdDays;
    gActual += tot.yearActualHours;
    gOT += tot.yearOTHours;
    gDay += tot.yearDayWages;
    gOTW += tot.yearOTWages;
    gBon += tot.yearBonusAllow;
    gGross += tot.yearGross;
    gDed += tot.yearDeductions;
    gNet += tot.yearNet;

    ws3Data.push([
      `Năm ${y}`,
      tot.yearStdDays,
      tot.yearActualHours,
      tot.yearOTHours,
      tot.yearDayWages,
      tot.yearOTWages,
      tot.yearBonusAllow,
      tot.yearGross,
      tot.yearDeductions,
      tot.yearNet,
      tot.avgNet
    ]);
  });

  ws3Data.push([
    `TỔNG (${yearsList.length} NĂM)`,
    gStd,
    gActual,
    gOT,
    gDay,
    gOTW,
    gBon,
    gGross,
    gDed,
    gNet,
    yearsList.length > 0 ? Math.round(gNet / (yearsList.length * 12)) : 0
  ]);

  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  XLSX.utils.book_append_sheet(wb, ws3, "Tong Hop Cac Nam");

  return wb;
}

// Direct Export Excel with SheetJS
document.getElementById("btnExportExcel").addEventListener("click", () => {
  if (typeof XLSX === "undefined") {
    alert("Thư viện xuất Excel đang tải, vui lòng thử lại sau giây lát.");
    return;
  }

  const wb = buildExportWorkbook();
  if (wb) {
    const rawEmpName = (document.getElementById("empName") ? document.getElementById("empName").value.trim() : "").replace(/[\/\\?%*:|"<>]/g, "_") || "NhanVien";
    XLSX.writeFile(wb, `Bang_Cham_Cong_Va_Luong_${rawEmpName}_Nam_${currentYear}.xlsx`);
  }
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

function normalizeConfig(cfg) {
  if (!cfg) return null;
  return {
    baseSalary: cfg.base_salary !== undefined ? cfg.base_salary : (cfg.baseSalary !== undefined ? cfg.baseSalary : 6300000),
    positionAllowance: cfg.pos_allowance !== undefined ? cfg.pos_allowance : (cfg.positionAllowance !== undefined ? cfg.positionAllowance : 2450000),
    seniorityAllowance: cfg.sen_allowance !== undefined ? cfg.sen_allowance : (cfg.seniorityAllowance !== undefined ? cfg.seniorityAllowance : 100000),
    kpiCoeff: cfg.kpi_coeff !== undefined ? cfg.kpi_coeff : (cfg.kpiCoeff !== undefined ? cfg.kpiCoeff : 1.0),
    allowanceGas: cfg.allowance_gas !== undefined ? cfg.allowance_gas : (cfg.allowanceGas !== undefined ? cfg.allowanceGas : 500000),
    allowanceHouse: cfg.allowance_house !== undefined ? cfg.allowance_house : (cfg.allowanceHouse !== undefined ? cfg.allowanceHouse : 500000),
    allowanceChild: cfg.allowance_child !== undefined ? cfg.allowance_child : (cfg.allowanceChild !== undefined ? cfg.allowanceChild : 0),
    allowanceSafety: cfg.allowance_safety !== undefined ? cfg.allowance_safety : (cfg.allowanceSafety !== undefined ? cfg.allowanceSafety : 0),
    allowanceNight: cfg.allowance_night !== undefined ? cfg.allowance_night : (cfg.allowanceNight !== undefined ? cfg.allowanceNight : 0),
    allowanceMealNight: cfg.allowance_meal_night !== undefined ? cfg.allowance_meal_night : (cfg.allowanceMealNight !== undefined ? cfg.allowanceMealNight : 0),
    isManualNight: cfg.is_manual_night !== undefined ? Boolean(cfg.is_manual_night) : Boolean(cfg.isManualNight),
    allowancePeriod: cfg.allowance_period !== undefined ? cfg.allowance_period : (cfg.allowancePeriod !== undefined ? cfg.allowancePeriod : 0),
    allowanceOther: cfg.allowance_other !== undefined ? cfg.allowance_other : (cfg.allowanceOther !== undefined ? cfg.allowanceOther : 0),
        bonusAttendance: cfg.bonus_attendance !== undefined ? cfg.bonus_attendance : (cfg.bonusAttendance !== undefined ? cfg.bonusAttendance : 600000),
    bonusFullAttendance: cfg.bonus_full_attendance !== undefined ? cfg.bonus_full_attendance : (cfg.bonusFullAttendance !== undefined ? cfg.bonusFullAttendance : 0),
    bonusEfficiency: cfg.bonus_efficiency !== undefined ? cfg.bonus_efficiency : (cfg.bonusEfficiency !== undefined ? cfg.bonusEfficiency : 0),
    bonusQualityStar: cfg.bonus_quality_star !== undefined ? cfg.bonus_quality_star : (cfg.bonusQualityStar !== undefined ? cfg.bonusQualityStar : 0),
    bonusPerformance: cfg.bonus_performance !== undefined ? cfg.bonus_performance : (cfg.bonusPerformance !== undefined ? cfg.bonusPerformance : 0),
    bonusKPI: cfg.bonus_kpi !== undefined ? cfg.bonus_kpi : (cfg.bonusKPI !== undefined ? cfg.bonusKPI : 3050000),
    bonusRecruitment: cfg.bonus_recruitment !== undefined ? cfg.bonus_recruitment : (cfg.bonusRecruitment !== undefined ? cfg.bonusRecruitment : 0),
    isTaxExempt: cfg.is_tax_exempt !== undefined ? cfg.is_tax_exempt : (cfg.isTaxExempt !== undefined ? cfg.isTaxExempt : 1),
    bankAccount: cfg.bank_account || cfg.bankAccount || "STK: 102884878810",
    bankName: cfg.bank_name || cfg.bankName || "VietinBank"
  };
}

async function loadAllMonthsFromBackendOrStorage(year, empId) {
  const targetEmpId = empId || currentEmpId || "emp_default";
  if (isBackendConnected) {
    try {
      // 1. Tải toàn bộ chấm công 12 tháng từ CSDL cho nhân viên này
      const resp = await fetch(`${API_BASE}/api/attendance/${year}?emp_id=${encodeURIComponent(targetEmpId)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.months) {
          for (let m = 1; m <= 12; m++) {
            if (data.months[m] && Object.keys(data.months[m]).length > 0) {
              if (targetEmpId === currentEmpId) {
                monthlyStore[m] = data.months[m];
              }
              writeAttStorage(year, m, data.months[m], targetEmpId);
            }
          }
        }
      }
      // 2. Tải toàn bộ cấu hình lương 12 tháng từ CSDL cho nhân viên này
      const cfgResp = await fetch(`${API_BASE}/api/config/${year}?emp_id=${encodeURIComponent(targetEmpId)}`);
      if (cfgResp.ok) {
        const data = await cfgResp.json();
        if (data.configs) {
          for (let m = 1; m <= 12; m++) {
            if (data.configs[m]) {
              const norm = normalizeConfig(data.configs[m]);
              if (targetEmpId === currentEmpId) {
                monthlyConfigStore[m] = norm;
              }
              writeCfgStorage(year, m, norm, targetEmpId);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Lỗi tải toàn bộ năm từ backend, dùng localStorage:", e);
    }
  } else {
    // Chế độ Offline: Đồng bộ từ localStorage tách biệt của nhân viên này
    for (let m = 1; m <= 12; m++) {
      const sAtt = readAttStorage(year, m, targetEmpId);
      if (sAtt) {
        if (targetEmpId === currentEmpId) monthlyStore[m] = sAtt;
      }
      const sCfg = readCfgStorage(year, m, targetEmpId);
      if (sCfg) {
        const norm = normalizeConfig(sCfg);
        if (targetEmpId === currentEmpId) monthlyConfigStore[m] = norm;
      }
    }
  }
}

async function loadFromBackendOrStorage(month, year, empId) {
  const targetEmpId = empId || currentEmpId || "emp_default";
  if (isBackendConnected) {
    try {
      // 1. Load attendance cho nhân viên này
      const attResp = await fetch(`${API_BASE}/api/attendance/${year}/${month}?emp_id=${encodeURIComponent(targetEmpId)}`);
      if (attResp.ok) {
        const attData = await attResp.json();
        if (attData.days && Object.keys(attData.days).length > 0) {
          if (targetEmpId === currentEmpId) monthlyStore[month] = attData.days;
          writeAttStorage(year, month, attData.days, targetEmpId);
        }
      }

      // 2. Load salary config cho nhân viên này
      const cfgResp = await fetch(`${API_BASE}/api/config/${year}/${month}?emp_id=${encodeURIComponent(targetEmpId)}`);
      if (cfgResp.ok) {
        const cfg = await cfgResp.json();
        const norm = normalizeConfig(cfg);
        if (targetEmpId === currentEmpId) {
          applyConfigToInputs(norm);
          monthlyConfigStore[month] = norm;
        }
        writeCfgStorage(year, month, norm, targetEmpId);
      }
    } catch (e) {
      console.warn(`Lỗi tải từ backend cho ${targetEmpId}, dùng bộ nhớ cục bộ:`, e);
    }
  } else {
    // Load from localStorage if available
    const localAtt = readAttStorage(year, month, targetEmpId);
    if (localAtt) {
      if (targetEmpId === currentEmpId) monthlyStore[month] = localAtt;
    }
    const localCfg = readCfgStorage(year, month, targetEmpId);
    if (localCfg) {
      const norm = normalizeConfig(localCfg);
      if (targetEmpId === currentEmpId) {
        applyConfigToInputs(norm);
        monthlyConfigStore[month] = norm;
      }
    }
  }
}

function applyConfigToInputs(cfg) {
  if (!cfg) return;
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  setVal("baseSalary", cfg.base_salary !== undefined ? cfg.base_salary : cfg.baseSalary);
  setVal("positionAllowance", cfg.pos_allowance !== undefined ? cfg.pos_allowance : cfg.positionAllowance);
  setVal("seniorityAllowance", cfg.sen_allowance !== undefined ? cfg.sen_allowance : cfg.seniorityAllowance);
  setVal("kpiCoeff", cfg.kpi_coeff !== undefined ? cfg.kpi_coeff : cfg.kpiCoeff);
  setVal("allowanceGas", cfg.allowance_gas !== undefined ? cfg.allowance_gas : cfg.allowanceGas);
  setVal("allowanceHouse", cfg.allowance_house !== undefined ? cfg.allowance_house : cfg.allowanceHouse);
  setVal("allowanceChild", cfg.allowance_child !== undefined ? cfg.allowance_child : cfg.allowanceChild);
  setVal("allowanceSafety", cfg.allowance_safety !== undefined ? cfg.allowance_safety : cfg.allowanceSafety);
  setVal("allowanceNight", cfg.allowance_night !== undefined ? cfg.allowance_night : cfg.allowanceNight);
  setVal("allowanceMealNight", cfg.allowance_meal_night !== undefined ? cfg.allowance_meal_night : cfg.allowanceMealNight);
  setVal("allowancePeriod", cfg.allowance_period !== undefined ? cfg.allowance_period : cfg.allowancePeriod);
  setVal("allowanceOther", cfg.allowance_other !== undefined ? cfg.allowance_other : cfg.allowanceOther);
    setVal("bonusAttendance", cfg.bonus_attendance !== undefined ? cfg.bonus_attendance : cfg.bonusAttendance);
  setVal("bonusFullAttendance", cfg.bonus_full_attendance !== undefined ? cfg.bonus_full_attendance : (cfg.bonusFullAttendance || 0));
  setVal("bonusEfficiency", cfg.bonus_efficiency !== undefined ? cfg.bonus_efficiency : (cfg.bonusEfficiency || 0));
  setVal("bonusQualityStar", cfg.bonus_quality_star !== undefined ? cfg.bonus_quality_star : (cfg.bonusQualityStar || 0));
  setVal("bonusPerformance", cfg.bonus_performance !== undefined ? cfg.bonus_performance : (cfg.bonusPerformance || 0));
  setVal("bonusKPI", cfg.bonus_kpi !== undefined ? cfg.bonus_kpi : cfg.bonusKPI);
  setVal("bonusRecruitment", cfg.bonus_recruitment !== undefined ? cfg.bonus_recruitment : (cfg.bonusRecruitment || 0));
  setVal("bankAccount", cfg.bank_account || cfg.bankAccount);
  setVal("bankName", cfg.bank_name || cfg.bankName);
  const taxEx = (cfg.is_tax_exempt !== undefined) ? cfg.is_tax_exempt : (cfg.isTaxExempt !== undefined ? cfg.isTaxExempt : 1);
  if (document.getElementById("taxExemptToggle")) {
    document.getElementById("taxExemptToggle").checked = (taxEx == 1);
  }

  // Cập nhật lại config store cho tháng này
  saveCurrentMonthInputsToConfigStore();
}

function collectConfigPayload() {
  return {
    emp_id: currentEmpId,
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
    bonus_full_attendance: parseVal(document.getElementById("bonusFullAttendance") ? document.getElementById("bonusFullAttendance").value : 0),
    bonus_efficiency: parseVal(document.getElementById("bonusEfficiency") ? document.getElementById("bonusEfficiency").value : 0),
    bonus_quality_star: parseVal(document.getElementById("bonusQualityStar") ? document.getElementById("bonusQualityStar").value : 0),
    bonus_performance: parseVal(document.getElementById("bonusPerformance") ? document.getElementById("bonusPerformance").value : 0),
    bonus_kpi: parseVal(document.getElementById("bonusKPI").value),
    bonus_recruitment: parseVal(document.getElementById("bonusRecruitment") ? document.getElementById("bonusRecruitment").value : 0),
    is_tax_exempt: (document.getElementById("taxExemptToggle") && document.getElementById("taxExemptToggle").checked) ? 1 : 0,
    bank_account: document.getElementById("bankAccount").value,
    bank_name: document.getElementById("bankName").value
  };
}

async function saveCurrentMonthToBackend(silent = false, empId) {
  const targetEmpId = empId || currentEmpId || "emp_default";
  // Lưu vào localStorage tách biệt theo nhân viên
  writeAttStorage(currentYear, currentMonth, monthlyStore[currentMonth] || {}, targetEmpId);
  const cfgPayload = collectConfigPayload();
  cfgPayload.emp_id = targetEmpId;
  writeCfgStorage(currentYear, currentMonth, cfgPayload, targetEmpId);

  // Sync vào allYearsStore và employeesDataStore
  saveYearToMemoryAndStorage(currentYear);

  if (!isBackendConnected) {
    if (!silent) showToast("Đã lưu dữ liệu vào trình duyệt (Offline)", "info");
    return;
  }

  try {
    // 1. Save attendance to SQLite with emp_id
    const attResp = await fetch(`${API_BASE}/api/attendance/${currentYear}/${currentMonth}?emp_id=${encodeURIComponent(targetEmpId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emp_id: targetEmpId,
        year: currentYear,
        month: currentMonth,
        days: monthlyStore[currentMonth] || {}
      })
    });

    // 2. Save salary config to SQLite with emp_id
    const cfgResp = await fetch(`${API_BASE}/api/config/${currentYear}/${currentMonth}?emp_id=${encodeURIComponent(targetEmpId)}`, {
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
    // Tự động đồng bộ ngay lập tức lên Firebase Realtime Cloud
    if (typeof triggerFirebaseAutoSync === "function") triggerFirebaseAutoSync();
  }, 1000);
}

// Button "Lưu CSDL"
document.getElementById("btnSaveToDB").addEventListener("click", () => {
  saveCurrentMonthToBackend(false);
});

// ========================================================
// FIREBASE REALTIME CLOUD SYNC (TỰ ĐỘNG ĐỒNG BỘ MÁY TÍNH & ĐIỆN THOẠI)
// ========================================================
const FIREBASE_DB_URL = "https://bangcong-463ae-default-rtdb.firebaseio.com/bangcong_data.json";

let firebaseSyncTimer = null;
let firebaseEventSource = null;

function updateCloudBadge(online, text) {
  const badge = document.getElementById("backendStatusBadge");
  if (!badge) return;
  if (online) {
    badge.className = "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 shadow-2xs";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ${text || "Firebase Realtime (Tự động)"}`;
  } else {
    badge.className = "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-300";
    badge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> ${text || "Chế độ Offline (Chưa kết nối Cloud)"}`;
  }
}

async function pushToFirebase(silent = false) {
  try {
    saveCurrentEmployeeData();
    saveYearToMemoryAndStorage(currentYear);

    // Gom dữ liệu của tất cả các năm đã lưu để đồng bộ lên Cloud
    const yearsPayload = {};
    const yearsList = getAvailableYearsList();
    yearsList.forEach(y => {
      const yData = allYearsStore[y] || {};
      const attYear = yData.attendance || {};
      const cfgYear = yData.configs || {};
      const finalAtt = {};
      const finalCfg = {};
      for (let m = 1; m <= 12; m++) {
        if (attYear[m] && Object.keys(attYear[m]).length > 0) {
          finalAtt[m] = attYear[m];
        } else {
          const s = readAttStorage(y, m, currentEmpId);
          if (s) {
            finalAtt[m] = s;
          }
        }
        if (cfgYear[m]) {
          finalCfg[m] = cfgYear[m];
        } else {
          const s = readCfgStorage(y, m, currentEmpId);
          if (s) {
            finalCfg[m] = s;
          }
        }
      }
      yearsPayload[y] = {
        attendance: finalAtt,
        configs: finalCfg,
        annualLeaveTotalManual: yData.annualLeaveTotalManual,
        annualLeaveUsedManual: yData.annualLeaveUsedManual,
        annualLeaveTotal: yData.annualLeaveTotal
      };
    });

    const payload = {
      updatedAt: Date.now(),
      currentYear: currentYear,
      currentEmpId: currentEmpId,
      employees: employeesList,
      employeesData: employeesDataStore,
      years: yearsPayload,
      // Tương thích ngược cho phiên bản cũ
      year: currentYear,
      attendance: monthlyStore,
      configs: monthlyConfigStore
    };

    const resp = await fetch(FIREBASE_DB_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (resp.ok) {
      localStorage.setItem("firebase_last_push_time", payload.updatedAt.toString());
      updateCloudBadge(true, "Firebase Realtime (Đồng bộ tức thì)");
      if (!silent) showToast("☁️ Đã đồng bộ toàn bộ dữ liệu nhân viên lên Cloud!");
      return true;
    }
  } catch (err) {
    console.warn("Lỗi push Firebase:", err);
    updateCloudBadge(false, "Chế độ Offline");
    if (!silent) showToast("Không thể kết nối Firebase Cloud, dữ liệu đã lưu trong máy", "info");
  }
  return false;
}

async function pullFromFirebase(silent = false) {
  try {
    const resp = await fetch(`${FIREBASE_DB_URL}?nocache=${Date.now()}`);
    if (!resp.ok) return false;

    const data = await resp.json();
    if (!data) {
      // Cơ sở dữ liệu Firebase vừa tạo chưa có dữ liệu -> Đẩy dữ liệu hiện tại lên để khởi tạo!
      await pushToFirebase(true);
      updateCloudBadge(true, "Firebase Realtime (Đồng bộ tức thì)");
      return true;
    }

    // 0. Đồng bộ hệ thống đa nhân viên
    if (data.employees && Array.isArray(data.employees) && data.employees.length > 0) {
      employeesList = data.employees;
      employeesList.forEach(emp => {
        if (!emp.cardId) {
          if (emp.id === "emp_default") emp.cardId = "1028";
          else emp.cardId = "NV" + (emp.id.replace(/\D/g, "").slice(-4) || "0001");
        }
      });
      window.employeesList = employeesList;
      try { localStorage.setItem("app_employees_list", JSON.stringify(employeesList)); } catch (e) {}

      if (data.employeesData && typeof data.employeesData === "object") {
        Object.keys(data.employeesData).forEach(empId => {
          employeesDataStore[empId] = data.employeesData[empId];
          try {
            localStorage.setItem("emp_data_" + empId, JSON.stringify(data.employeesData[empId]));
          } catch (e) {}
        });
      }

      if (currentAuthRole === "employee" && currentAuthEmpId) {
        currentEmpId = currentAuthEmpId;
      } else if (!employeesList.some(e => e.id === currentEmpId)) {
        currentEmpId = (data.currentEmpId && employeesList.some(e => e.id === data.currentEmpId))
          ? data.currentEmpId
          : employeesList[0].id;
        try { localStorage.setItem("app_current_emp_id", currentEmpId); } catch (e) {}
      }

      loadEmployeeData(currentEmpId);
      renderEmployeeSelect();
    }

    // 1. Nhận dữ liệu đa năm nếu có trên Cloud
    if (data.years && typeof data.years === "object") {
      Object.keys(data.years).forEach(yStr => {
        const yNum = parseInt(yStr);
        if (!isNaN(yNum)) {
          addAvailableYear(yNum);
          const yObj = data.years[yStr];
          if (!allYearsStore[yNum]) allYearsStore[yNum] = { attendance: {}, configs: {} };

          if (yObj.attendance) {
            for (let m = 1; m <= 12; m++) {
              if (yObj.attendance[m] && Object.keys(yObj.attendance[m]).length > 0) {
                allYearsStore[yNum].attendance[m] = yObj.attendance[m];
                writeAttStorage(yNum, m, yObj.attendance[m], currentEmpId);
                if (yNum === currentYear) monthlyStore[m] = yObj.attendance[m];
              }
            }
          }
          if (yObj.annualLeaveTotalManual !== undefined) {
            allYearsStore[yNum].annualLeaveTotalManual = yObj.annualLeaveTotalManual;
          }
          if (yObj.annualLeaveUsedManual !== undefined) {
            allYearsStore[yNum].annualLeaveUsedManual = yObj.annualLeaveUsedManual;
          }
          if (yObj.annualLeaveTotal !== undefined) {
            allYearsStore[yNum].annualLeaveTotal = yObj.annualLeaveTotal;
          }
          if (yObj.configs) {
            for (let m = 1; m <= 12; m++) {
              if (yObj.configs[m]) {
                const norm = normalizeConfig(yObj.configs[m]);
                allYearsStore[yNum].configs[m] = norm;
                writeCfgStorage(yNum, m, norm, currentEmpId);
                if (yNum === currentYear) monthlyConfigStore[m] = norm;
              }
            }
          }
        }
      });
    }

    // 2. Tương thích ngược nếu Cloud trả về dữ liệu đơn năm cũ
    if (!data.years && data.attendance) {
      const legacyYear = data.year || currentYear;
      addAvailableYear(legacyYear);
      if (!allYearsStore[legacyYear]) allYearsStore[legacyYear] = { attendance: {}, configs: {} };
      for (let m = 1; m <= 12; m++) {
        if (data.attendance[m] && Object.keys(data.attendance[m]).length > 0) {
          if (legacyYear === currentYear) monthlyStore[m] = data.attendance[m];
          allYearsStore[legacyYear].attendance[m] = data.attendance[m];
          localStorage.setItem(`att_${legacyYear}_${m}`, JSON.stringify(data.attendance[m]));
        }
      }
      if (data.configs) {
        for (let m = 1; m <= 12; m++) {
          if (data.configs[m]) {
            const norm = normalizeConfig(data.configs[m]);
            if (legacyYear === currentYear) monthlyConfigStore[m] = norm;
            allYearsStore[legacyYear].configs[m] = norm;
            localStorage.setItem(`cfg_${legacyYear}_${m}`, JSON.stringify(norm));
          }
        }
      }
    }

    localStorage.setItem("firebase_last_push_time", (data.updatedAt || Date.now()).toString());
    loadConfigStoreToInputs(currentMonth);
    renderUnifiedTable();
    renderMultiYearSummary();
    updateCloudBadge(true, "Firebase Realtime (Đồng bộ tức thì)");
    if (!silent) showToast("✅ Đã đồng bộ dữ liệu đa năm từ Firebase Cloud!");
    return true;

  } catch (err) {
    console.warn("Lỗi pull Firebase:", err);
    updateCloudBadge(false, "Chế độ Offline");
  }
  return false;
}

function triggerFirebaseAutoSync() {
  clearTimeout(firebaseSyncTimer);
  firebaseSyncTimer = setTimeout(() => {
    pushToFirebase(true);
  }, 1000); // 1 giây sau lần sửa cuối là tự đẩy lên Cloud
}

// Lắng nghe sự thay đổi theo thời gian thực (Realtime Server-Sent Events)
function listenFirebaseRealtime() {
  try {
    if (firebaseEventSource) firebaseEventSource.close();
    firebaseEventSource = new EventSource(FIREBASE_DB_URL);
    firebaseEventSource.addEventListener("put", (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.path === "/" && msg.data) {
          const cloud = msg.data;
          const myLastPush = parseInt(localStorage.getItem("firebase_last_push_time") || "0");
          // Nếu thay đổi đến từ thiết bị khác (chênh lệch thời gian trên 1500ms)
          if (cloud.updatedAt && Math.abs(cloud.updatedAt - myLastPush) > 1500) {
            if (cloud.employees && Array.isArray(cloud.employees) && cloud.employees.length > 0) {
              employeesList = cloud.employees;
              employeesList.forEach(emp => {
                if (!emp.cardId) {
                  if (emp.id === "emp_default") emp.cardId = "1028";
                  else emp.cardId = "NV" + (emp.id.replace(/\D/g, "").slice(-4) || "0001");
                }
              });
              window.employeesList = employeesList;
              try { localStorage.setItem("app_employees_list", JSON.stringify(employeesList)); } catch (e) {}

              if (cloud.employeesData && typeof cloud.employeesData === "object") {
                Object.keys(cloud.employeesData).forEach(empId => {
                  employeesDataStore[empId] = cloud.employeesData[empId];
                  try {
                    localStorage.setItem("emp_data_" + empId, JSON.stringify(cloud.employeesData[empId]));
                  } catch (e) {}
                });
              }

              if (currentAuthRole === "employee" && currentAuthEmpId) {
                currentEmpId = currentAuthEmpId;
              } else if (!employeesList.some(e => e.id === currentEmpId)) {
                currentEmpId = (cloud.currentEmpId && employeesList.some(e => e.id === cloud.currentEmpId))
                  ? cloud.currentEmpId
                  : employeesList[0].id;
                try { localStorage.setItem("app_current_emp_id", currentEmpId); } catch (e) {}
              }

              loadEmployeeData(currentEmpId);
              renderEmployeeSelect();
            }

            if (cloud.years && typeof cloud.years === "object") {
              Object.keys(cloud.years).forEach(yStr => {
                const yNum = parseInt(yStr);
                if (!isNaN(yNum)) {
                  addAvailableYear(yNum);
                  const yObj = cloud.years[yStr];
                  if (!allYearsStore[yNum]) allYearsStore[yNum] = { attendance: {}, configs: {} };
                  if (yObj.attendance) {
                    for (let m = 1; m <= 12; m++) {
                      if (yObj.attendance[m]) {
                        allYearsStore[yNum].attendance[m] = yObj.attendance[m];
                        localStorage.setItem(`att_${yNum}_${m}`, JSON.stringify(yObj.attendance[m]));
                        if (yNum === currentYear) monthlyStore[m] = yObj.attendance[m];
                      }
                    }
                  }
                  if (yObj.annualLeaveTotalManual !== undefined) {
            allYearsStore[yNum].annualLeaveTotalManual = yObj.annualLeaveTotalManual;
          }
          if (yObj.annualLeaveUsedManual !== undefined) {
            allYearsStore[yNum].annualLeaveUsedManual = yObj.annualLeaveUsedManual;
          }
          if (yObj.annualLeaveTotal !== undefined) {
            allYearsStore[yNum].annualLeaveTotal = yObj.annualLeaveTotal;
          }
          if (yObj.configs) {
                    for (let m = 1; m <= 12; m++) {
                      if (yObj.configs[m]) {
                        const norm = normalizeConfig(yObj.configs[m]);
                        allYearsStore[yNum].configs[m] = norm;
                        localStorage.setItem(`cfg_${yNum}_${m}`, JSON.stringify(norm));
                        if (yNum === currentYear) monthlyConfigStore[m] = norm;
                      }
                    }
                  }
                }
              });
            } else if (cloud.attendance) {
              const legacyYear = cloud.year || currentYear;
              addAvailableYear(legacyYear);
              for (let m = 1; m <= 12; m++) {
                if (cloud.attendance[m]) {
                  if (legacyYear === currentYear) monthlyStore[m] = cloud.attendance[m];
                  localStorage.setItem(`att_${legacyYear}_${m}`, JSON.stringify(cloud.attendance[m]));
                }
              }
              if (cloud.configs) {
                for (let m = 1; m <= 12; m++) {
                  if (cloud.configs[m]) {
                    const norm = normalizeConfig(cloud.configs[m]);
                    if (legacyYear === currentYear) monthlyConfigStore[m] = norm;
                    localStorage.setItem(`cfg_${legacyYear}_${m}`, JSON.stringify(norm));
                  }
                }
              }
            }
            loadConfigStoreToInputs(currentMonth);
            renderUnifiedTable();
            renderMultiYearSummary();
            showToast("⚡ Dữ liệu vừa được cập nhật từ thiết bị khác!");
          }
        }
      } catch(err) {}
    });
    firebaseEventSource.onopen = () => {
      updateCloudBadge(true, "Firebase Realtime (Đồng bộ tức thì)");
    };
    firebaseEventSource.onerror = () => {
      // Tự động kết nối lại ngầm
    };
  } catch (err) {}
}

// ========================================================
// ĐIỀU KHIỂN GIAO DIỆN RESPONSIVE MOBILE & DESKTOP
// ========================================================
let currentMobileViewMode = "attendance"; // 'attendance' | 'salary' | 'both'

function setMobileViewMode(mode) {
  currentMobileViewMode = mode;
  const colAtt = document.getElementById("colAttendance");
  const colSal = document.getElementById("colSalary");
  const btnAtt = document.getElementById("btnMobileShowAttendance");
  const btnSal = document.getElementById("btnMobileShowSalary");
  const btnBoth = document.getElementById("btnMobileShowBoth");
  const jumpText = document.getElementById("mobileJumpBtnText");
  const jumpIcon = document.getElementById("mobileJumpBtnIcon");

  if (!colAtt || !colSal) return;

  const activeClasses = ["bg-blue-600", "text-white", "shadow-xs"];
  const inactiveClasses = ["text-slate-700", "hover:text-blue-700"];

  function styleBtn(btn, isActive) {
    if (!btn) return;
    if (isActive) {
      btn.classList.add(...activeClasses);
      btn.classList.remove(...inactiveClasses);
    } else {
      btn.classList.remove(...activeClasses);
      btn.classList.add(...inactiveClasses);
    }
  }

  if (mode === "attendance") {
    colAtt.classList.remove("hidden");
    colSal.classList.add("hidden");
    styleBtn(btnAtt, true);
    styleBtn(btnSal, false);
    styleBtn(btnBoth, false);
    if (jumpText) jumpText.innerText = "Xem Lương";
    if (jumpIcon) jumpIcon.className = "fa-solid fa-arrow-right";
  } else if (mode === "salary") {
    colAtt.classList.add("hidden");
    colSal.classList.remove("hidden");
    styleBtn(btnAtt, false);
    styleBtn(btnSal, true);
    styleBtn(btnBoth, false);
    if (jumpText) jumpText.innerText = "Chấm Công";
    if (jumpIcon) jumpIcon.className = "fa-solid fa-arrow-left";
  } else { // both
    colAtt.classList.remove("hidden");
    colSal.classList.remove("hidden");
    styleBtn(btnAtt, false);
    styleBtn(btnSal, false);
    styleBtn(btnBoth, true);
    if (jumpText) jumpText.innerText = "Xem Lương";
    if (jumpIcon) jumpIcon.className = "fa-solid fa-arrow-down";
  }
}

function setupMobileResponsiveControls() {
  const btnAtt = document.getElementById("btnMobileShowAttendance");
  const btnSal = document.getElementById("btnMobileShowSalary");
  const btnBoth = document.getElementById("btnMobileShowBoth");
  const btnJump = document.getElementById("btnMobileJumpToSalary");

  if (btnAtt) btnAtt.addEventListener("click", () => setMobileViewMode("attendance"));
  if (btnSal) btnSal.addEventListener("click", () => setMobileViewMode("salary"));
  if (btnBoth) btnBoth.addEventListener("click", () => setMobileViewMode("both"));

  if (btnJump) {
    btnJump.addEventListener("click", () => {
      if (window.innerWidth < 1280) {
        if (currentMobileViewMode === "attendance") {
          setMobileViewMode("salary");
          window.scrollTo({ top: 120, behavior: "smooth" });
        } else {
          setMobileViewMode("attendance");
          window.scrollTo({ top: 120, behavior: "smooth" });
        }
      } else {
        const colSal = document.getElementById("colSalary");
        if (colSal) colSal.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Handle screen resize across the 1280px (xl) breakpoint
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1280) {
      const colAtt = document.getElementById("colAttendance");
      const colSal = document.getElementById("colSalary");
      if (colAtt) colAtt.classList.remove("hidden");
      if (colSal) colSal.classList.remove("hidden");
    } else {
      setMobileViewMode(currentMobileViewMode);
    }
  });

  // Default mode on init for small screens: show Attendance
  if (window.innerWidth < 1280) {
    setMobileViewMode("attendance");
  }
}

// Khởi chạy khi tải trang
window.addEventListener("DOMContentLoaded", async () => {
  initEmployees();
  setupEmployeeEventListeners();
  setupMobileResponsiveControls();
  setupAuthenticationControls();
  checkAuthentication();
  await checkBackendStatus();
  // 1. Nạp từ CSDL / localStorage tách biệt theo nhân viên hiện tại (currentEmpId)
  await loadAllMonthsFromBackendOrStorage(currentYear, currentEmpId);
  await loadFromBackendOrStorage(currentMonth, currentYear, currentEmpId);
  loadConfigStoreToInputs(currentMonth);
  renderUnifiedTable();

  // 2. Tự động đồng bộ 2 chiều với Firebase Realtime Cloud (Máy tính ↔ Điện thoại)
  await pullFromFirebase(true);
  listenFirebaseRealtime();

  // 3. Nút bấm "Đồng bộ Cloud" thủ công
  const btnManual = document.getElementById("btnManualSyncCloud");
  if (btnManual) {
    btnManual.addEventListener("click", async () => {
      showToast("⏳ Đang đồng bộ với Firebase Cloud...", "info");
      await pushToFirebase(false);
    });
  }
});
