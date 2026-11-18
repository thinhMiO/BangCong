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
window.currentMonth = currentMonth;
window.currentYear = currentYear;

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
  { id: "emp_default", name: "Nguyễn Công Thịnh", dept: "工程部 (Bộ phận Kỹ thuật)" }
];
let currentEmpId = "emp_default";
let employeesDataStore = {};
window.employeesList = employeesList;
window.currentEmpId = currentEmpId;
window.employeesDataStore = employeesDataStore;

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

  initializeDefaultData();
  loadConfigStoreToInputs(currentMonth);
}

function saveCurrentEmployeeData() {
  if (!currentEmpId) return;
  saveCurrentMonthInputsToConfigStore();
  saveYearToMemoryAndStorage(currentYear);

  const emp = employeesList.find(e => e.id === currentEmpId);
  if (emp) {
    const empNameEl = document.getElementById("empName");
    if (empNameEl && empNameEl.value.trim()) emp.name = empNameEl.value.trim();
    const empDeptEl = document.getElementById("empDept");
    if (empDeptEl && empDeptEl.value.trim()) emp.dept = empDeptEl.value.trim();
  }

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

function switchEmployee(targetEmpId) {
  if (!targetEmpId || targetEmpId === currentEmpId) return;
  saveCurrentEmployeeData();

  currentEmpId = targetEmpId;
  localStorage.setItem("app_current_emp_id", currentEmpId);

  loadEmployeeData(currentEmpId);
  renderEmployeeSelect();
  renderUnifiedTable();
  renderMultiYearSummary();
  triggerFirebaseAutoSync();

  const emp = employeesList.find(e => e.id === currentEmpId);
  if (emp) showToast(`👤 Đã chuyển sang nhân viên: ${emp.name}`);
}

function renderEmployeeSelect() {
  const selects = [
    document.getElementById("selectEmployee"),
    document.getElementById("selectEmployeeSummary")
  ];
  selects.forEach(sel => {
    if (!sel) return;
    sel.innerHTML = "";
    employeesList.forEach(emp => {
      const opt = document.createElement("option");
      opt.value = emp.id;
      opt.textContent = `${emp.name}${emp.dept ? ` (${emp.dept})` : ""}`;
      if (emp.id === currentEmpId) opt.selected = true;
      sel.appendChild(opt);
    });
  });
}

function addNewEmployee(name, dept, baseSalary, posAllowance, senAllowance, bankAccount, bankName) {
  saveCurrentEmployeeData();

  const newId = "emp_" + Date.now();
  const newEmp = {
    id: newId,
    name: name.trim() || "Nhân viên mới",
    dept: (dept || "").trim()
  };
  employeesList.push(newEmp);
  window.employeesList = employeesList;

  currentEmpId = newId;
  window.currentEmpId = currentEmpId;

  const customCfg = getDefaultSalaryConfig(currentMonth);
  if (baseSalary !== undefined && !isNaN(baseSalary) && baseSalary > 0) {
    customCfg.baseSalary = baseSalary;
  }
  customCfg.positionAllowance = (posAllowance !== undefined && !isNaN(posAllowance)) ? posAllowance : 0;
  customCfg.seniorityAllowance = (senAllowance !== undefined && !isNaN(senAllowance)) ? senAllowance : 0;
  customCfg.bankAccount = (bankAccount !== undefined && bankAccount !== null) ? bankAccount.trim() : "";
  customCfg.bankName = (bankName !== undefined && bankName !== null) ? bankName.trim() : "";

  const newCfgs = {};
  for (let m = 1; m <= 12; m++) {
    newCfgs[m] = Object.assign({}, customCfg);
  }

  const newYears = {};
  newYears[currentYear] = {
    attendance: {},
    configs: newCfgs
  };

  employeesDataStore[newId] = { years: newYears };
  try {
    localStorage.setItem("emp_data_" + newId, JSON.stringify(employeesDataStore[newId]));
    localStorage.setItem("app_employees_list", JSON.stringify(employeesList));
    localStorage.setItem("app_current_emp_id", currentEmpId);
  } catch (e) {}

  loadEmployeeData(currentEmpId);
  renderEmployeeSelect();
  renderUnifiedTable();
  renderMultiYearSummary();
  triggerFirebaseAutoSync();

  showToast(`🎉 Đã thêm và chuyển sang nhân viên mới: ${newEmp.name}!`);
}

function updateCurrentEmployeeInfo(name, dept, baseSalary, posAllowance, senAllowance, bankAccount, bankName) {
  const emp = employeesList.find(e => e.id === currentEmpId);
  if (!emp) return;
  if (name && name.trim()) emp.name = name.trim();
  if (dept !== undefined) emp.dept = dept.trim();

  const empNameEl = document.getElementById("empName");
  if (empNameEl) empNameEl.value = emp.name;
  const empDeptEl = document.getElementById("empDept");
  if (empDeptEl) empDeptEl.value = emp.dept;

  if (!monthlyConfigStore[currentMonth]) {
    monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
  }
  const cfg = monthlyConfigStore[currentMonth];
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
  } catch (e) {}

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
  const modalDept = document.getElementById("modalEmpDept");
  const modalSalaryRow = document.getElementById("modalSalaryRow");
  const modalSalary = document.getElementById("modalEmpBaseSalary");
  const modalPosAllowance = document.getElementById("modalEmpPosAllowance");
  const modalSenAllowance = document.getElementById("modalEmpSenAllowance");
  const modalBankAccount = document.getElementById("modalEmpBankAccount");
  const modalBankName = document.getElementById("modalEmpBankName");
  const btnClose = document.getElementById("btnCloseEmpModal");
  const btnCancel = document.getElementById("btnCancelEmpModal");
  const form = document.getElementById("formEmployee");

  const openModal = (mode) => {
    if (!modal) return;
    modalMode.value = mode;
    if (mode === "add") {
      modalTitle.innerHTML = `<i class="fa-solid fa-user-plus"></i> Thêm Nhân Viên Mới`;
      modalName.value = "";
      modalDept.value = "";
      if (modalSalary) modalSalary.value = "6300000";
      if (modalPosAllowance) modalPosAllowance.value = "0";
      if (modalSenAllowance) modalSenAllowance.value = "0";
      if (modalBankAccount) modalBankAccount.value = "";
      if (modalBankName) modalBankName.value = "";
    } else {
      modalTitle.innerHTML = `<i class="fa-solid fa-pen"></i> Chỉnh Sửa Hồ Sơ & Mức Lương Nhân Viên`;
      const emp = employeesList.find(e => e.id === currentEmpId);
      modalName.value = emp ? emp.name : "";
      modalDept.value = emp ? (emp.dept || "") : "";
      const cfg = monthlyConfigStore[currentMonth] || getDefaultSalaryConfig(currentMonth);
      if (modalSalary) modalSalary.value = cfg.baseSalary || 6300000;
      if (modalPosAllowance) modalPosAllowance.value = cfg.positionAllowance !== undefined ? cfg.positionAllowance : (currentEmpId === "emp_default" ? 2450000 : 0);
      if (modalSenAllowance) modalSenAllowance.value = cfg.seniorityAllowance !== undefined ? cfg.seniorityAllowance : (currentEmpId === "emp_default" ? 100000 : 0);
      if (modalBankAccount) modalBankAccount.value = cfg.bankAccount !== undefined ? cfg.bankAccount : (currentEmpId === "emp_default" ? "STK: 102884878810" : "");
      if (modalBankName) modalBankName.value = cfg.bankName !== undefined ? cfg.bankName : (currentEmpId === "emp_default" ? "VietinBank" : "");
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
      const dept = modalDept.value.trim();
      if (!name) return;
      const baseSal = modalSalary ? (parseFloat(modalSalary.value) || 6300000) : 6300000;
      const posAll = modalPosAllowance ? (parseFloat(modalPosAllowance.value) || 0) : 0;
      const senAll = modalSenAllowance ? (parseFloat(modalSenAllowance.value) || 0) : 0;
      const bankAcc = modalBankAccount ? modalBankAccount.value.trim() : "";
      const bankNm = modalBankName ? modalBankName.value.trim() : "";

      if (modalMode.value === "add") {
        addNewEmployee(name, dept, baseSal, posAll, senAll, bankAcc, bankNm);
      } else {
        updateCurrentEmployeeInfo(name, dept, baseSal, posAll, senAll, bankAcc, bankNm);
      }
      closeModal();
    });
  }

  // Tự động đồng bộ khi sửa trực tiếp họ tên / bộ phận trong bảng lương
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
  const yearsSet = new Set([2024, 2025, 2026, currentYear]);
  Object.keys(allYearsStore).forEach(y => {
    const n = parseInt(y);
    if (n && n >= 2000 && n <= 2100) yearsSet.add(n);
  });
  try {
    const savedList = localStorage.getItem("app_available_years");
    if (savedList) {
      JSON.parse(savedList).forEach(y => {
        const n = parseInt(y);
        if (n && n >= 2000 && n <= 2100) yearsSet.add(n);
      });
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k.match(/^(?:att|cfg)_(\d{4})_\d+$/);
      if (m) yearsSet.add(parseInt(m[1]));
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

function saveYearToMemoryAndStorage(year) {
  if (!year) year = currentYear;
  if (!allYearsStore[year]) allYearsStore[year] = {};
  allYearsStore[year].attendance = JSON.parse(JSON.stringify(monthlyStore));
  allYearsStore[year].configs = JSON.parse(JSON.stringify(monthlyConfigStore));

  // Sync vào kho của nhân viên hiện tại
  if (currentEmpId && employeesDataStore[currentEmpId]) {
    if (!employeesDataStore[currentEmpId].years) employeesDataStore[currentEmpId].years = {};
    employeesDataStore[currentEmpId].years[year] = {
      attendance: JSON.parse(JSON.stringify(monthlyStore)),
      configs: JSON.parse(JSON.stringify(monthlyConfigStore))
    };
    try {
      localStorage.setItem("emp_data_" + currentEmpId, JSON.stringify(employeesDataStore[currentEmpId]));
    } catch (e) {}
  }

  for (let m = 1; m <= 12; m++) {
    if (monthlyStore[m]) {
      localStorage.setItem(`att_${year}_${m}`, JSON.stringify(monthlyStore[m]));
    }
    if (monthlyConfigStore[m]) {
      localStorage.setItem(`cfg_${year}_${m}`, JSON.stringify(monthlyConfigStore[m]));
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
  const saved = localStorage.getItem(`att_${year}_${month}`);
  if (saved) {
    try { return JSON.parse(saved); } catch(e) {}
  }
  return null;
}

function getMonthConfigForYear(year, month) {
  if (year === currentYear && monthlyConfigStore[month]) {
    return monthlyConfigStore[month];
  }
  if (allYearsStore[year] && allYearsStore[year].configs && allYearsStore[year].configs[month]) {
    return allYearsStore[year].configs[month];
  }
  const saved = localStorage.getItem(`cfg_${year}_${month}`);
  if (saved) {
    try { return normalizeConfig(JSON.parse(saved)); } catch(e) {}
  }
  return getDefaultSalaryConfig(month);
}

function getDefaultSalaryConfig(m) {
  if (currentEmpId && currentEmpId !== "emp_default") {
    return {
      baseSalary: 6300000,
      positionAllowance: 0,
      seniorityAllowance: 0,
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
      bonusKPI: 3050000,
      isTaxExempt: 1,
      bankAccount: "",
      bankName: ""
    };
  }
  return {
    baseSalary: 6300000,
    positionAllowance: 2450000,
    seniorityAllowance: 100000,
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
    bonusKPI: 3050000,
    isTaxExempt: 1,
    bankAccount: "STK: 102884878810",
    bankName: "VietinBank"
  };
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
    bonusKPI: getNum("bonusKPI", oldCfg.bonusKPI !== undefined ? oldCfg.bonusKPI : 3050000),
    isTaxExempt: (document.getElementById("taxExemptToggle") && document.getElementById("taxExemptToggle").checked !== undefined) 
      ? (document.getElementById("taxExemptToggle").checked ? 1 : 0) 
      : (oldCfg.isTaxExempt !== undefined ? oldCfg.isTaxExempt : 1),
    bankAccount: getStr("bankAccount", oldCfg.bankAccount !== undefined ? oldCfg.bankAccount : fallbackBankAcc),
    bankName: getStr("bankName", oldCfg.bankName !== undefined ? oldCfg.bankName : fallbackBankName)
  };
  // Đồng bộ ngay lập tức vào localStorage để không bao giờ bị mất dữ liệu
  localStorage.setItem(`cfg_${currentYear}_${currentMonth}`, JSON.stringify(monthlyConfigStore[currentMonth]));

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

function loadConfigStoreToInputs(m) {
  if (!monthlyConfigStore[m]) {
    monthlyConfigStore[m] = getDefaultSalaryConfig(m);
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
  setVal("bonusKPI", cfg.bonusKPI);
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
function initializeDefaultData() {
  addAvailableYear(currentYear);
  monthlyStore = {};
  monthlyConfigStore = {};
  window.monthlyStore = monthlyStore;
  window.monthlyConfigStore = monthlyConfigStore;

  // Nếu trong allYearsStore đã có dữ liệu năm này thì nạp ngay
  if (allYearsStore[currentYear] && allYearsStore[currentYear].attendance && allYearsStore[currentYear].configs) {
    monthlyStore = JSON.parse(JSON.stringify(allYearsStore[currentYear].attendance));
    monthlyConfigStore = JSON.parse(JSON.stringify(allYearsStore[currentYear].configs));
    window.monthlyStore = monthlyStore;
    window.monthlyConfigStore = monthlyConfigStore;
    return;
  }

  for (let m = 1; m <= 12; m++) {
    monthlyConfigStore[m] = getDefaultSalaryConfig(m);
    
    // Check if saved in localStorage
    const savedCfg = localStorage.getItem(`cfg_${currentYear}_${m}`);
    if (savedCfg) {
      try {
        const p = JSON.parse(savedCfg);
        monthlyConfigStore[m] = {
          baseSalary: p.base_salary !== undefined ? p.base_salary : (p.baseSalary || 6300000),
          positionAllowance: p.pos_allowance !== undefined ? p.pos_allowance : (p.positionAllowance || 2450000),
          seniorityAllowance: p.sen_allowance !== undefined ? p.sen_allowance : (p.seniorityAllowance || 100000),
          kpiCoeff: p.kpi_coeff !== undefined ? p.kpi_coeff : (p.kpiCoeff || 1.0),
          allowanceGas: p.allowance_gas !== undefined ? p.allowance_gas : (p.allowanceGas || 500000),
          allowanceHouse: p.allowance_house !== undefined ? p.allowance_house : (p.allowanceHouse || 500000),
          allowanceChild: p.allowance_child !== undefined ? p.allowance_child : (p.allowanceChild || 0),
          allowanceSafety: p.allowance_safety !== undefined ? p.allowance_safety : (p.allowanceSafety || 0),
          allowanceNight: p.allowance_night !== undefined ? p.allowance_night : (p.allowanceNight !== undefined ? p.allowanceNight : 0),
          allowanceMealNight: p.allowance_meal_night !== undefined ? p.allowance_meal_night : (p.allowanceMealNight !== undefined ? p.allowanceMealNight : 0),
          isManualNight: p.is_manual_night !== undefined ? Boolean(p.is_manual_night) : Boolean(p.isManualNight),
          allowancePeriod: p.allowance_period !== undefined ? p.allowance_period : (p.allowancePeriod || 0),
          allowanceOther: p.allowance_other !== undefined ? p.allowance_other : (p.allowanceOther || 0),
          bonusAttendance: p.bonus_attendance !== undefined ? p.bonus_attendance : (p.bonusAttendance || 600000),
          bonusKPI: p.bonus_kpi !== undefined ? p.bonus_kpi : (p.bonusKPI || 3050000),
          isTaxExempt: p.is_tax_exempt !== undefined ? p.is_tax_exempt : (p.isTaxExempt !== undefined ? p.isTaxExempt : 1),
          bankAccount: p.bank_account || p.bankAccount || "STK: 102884878810",
          bankName: p.bank_name || p.bankName || "VietinBank"
        };
      } catch(e) {}
    }

    const totalDays = getDaysInMonth(currentYear, m);
    monthlyStore[m] = {};

    // 1. ƯU TIÊN SỐ 1: Nạp từ localStorage nếu người dùng đã từng lưu/chấm công tháng này
    if (currentEmpId === "emp_default") {
      const savedAtt = localStorage.getItem(`att_${currentYear}_${m}`);
      if (savedAtt) {
        try {
          const parsed = JSON.parse(savedAtt);
          if (parsed && Object.keys(parsed).length > 0) {
            monthlyStore[m] = parsed;
            continue; // ĐÃ CÓ DỮ LIỆU ĐƯỢC LƯU, GIỮ NGUYÊN DỮ LIỆU CỦA NGƯỜI DÙNG!
          }
        } catch(e) {}
      }
    }

    // 2. NẾU CHƯA CÓ LƯU THÌ MỚI DÙNG DỮ LIỆU MẪU BAN ĐẦU:
    if (currentEmpId === "emp_default" && m === 12) {
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
    } else if (currentEmpId === "emp_default" && m === 11) {
      // Month 11: Night Shift sample (Khớp chính xác 100% Ảnh 1)
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
      // Nhân viên mới hoặc các tháng khác: Khởi tạo bảng công sạch sẽ
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
    const parsedAct = parseLeaveAndHours(rData.actual);
    const parsedStd = parseLeaveAndHours(rData.std);
    const shiftUpper = (rData.shift || "").toString().trim().toUpperCase();
    const leaveCode = parsedAct.code || parsedStd.code || (LEAVE_CODES.includes(shiftUpper) ? shiftUpper : null);

    const shift = rData.shift || (parseVal(rData.ot130) > 0 ? "night" : (leaveCode ? leaveCode : (parseVal(rData.actual) > 0 ? "day" : "off")));
    if (shift === "night" || parseVal(rData.ot130) > 0) countNightShifts++;

    const rawAct = (rData.actual !== undefined && rData.actual !== null) ? rData.actual.toString().trim().toUpperCase() : "";
    const leaveBadgeClass = leaveCode ? getLeaveBadgeClass(leaveCode, rawAct) : "";
    const leaveTitle = leaveCode ? getLeaveTitle(leaveCode, rawAct) : "Nhập số giờ hoặc mã nghỉ (P, L, NB, N, KL, TD, 4P, 0.5P, 4KL, 0.5KL, 4TD...)";
    const isSpecialLeave = LEAVE_CODES.includes(shiftUpper) || LEAVE_CODES.includes(rawAct) || rawAct === "4";

    const tr = document.createElement("tr");
    tr.className = `border-b border-black text-center ${isSunday ? "bg-green-highlight" : "hover:bg-blue-50/50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-1 px-1 font-semibold whitespace-nowrap text-left">${dayName}</td>
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
}

window.setDayShift = function(day, shiftType) {
  applyShiftToDay(currentMonth, day, shiftType);
  if (monthlyStore[currentMonth]) {
    localStorage.setItem(`att_${currentYear}_${currentMonth}`, JSON.stringify(monthlyStore[currentMonth]));
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
        }
      }
      if (!monthlyConfigStore[currentMonth]) {
        monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
      }
      monthlyConfigStore[currentMonth].isManualNight = false; // Khi sửa giờ thì tự động tính lại tiền trợ cấp & ăn đêm
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

  const baseKPI = (cfg.bonusKPI !== undefined && cfg.bonusKPI !== null) ? cfg.bonusKPI : 3050000;
  const amountKPI = Math.round(baseKPI * kpiCoeff);
  const stdTotalBonus = baseBonusAtt + baseKPI;
  const totalBonus = bonusAtt + amountKPI;

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
    baseBonusAtt, bonusAtt, baseKPI, amountKPI, stdTotalBonus, totalBonus,
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
    localStorage.setItem(`cfg_${currentYear}_${currentMonth}`, JSON.stringify(monthlyConfigStore[currentMonth]));
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
  if (document.getElementById("amountBonusKPI")) {
    document.getElementById("amountBonusKPI").innerText = formatMoney(calc.amountKPI);
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
  saveCurrentMonthInputsToConfigStore();
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
    const isCur = (m === currentMonth);
    tr.className = `border-b border-black text-center ${isCur ? "bg-amber-100/90 font-bold ring-2 ring-inset ring-amber-400" : "hover:bg-slate-50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-2 px-2 font-bold text-slate-900">Tháng ${m} ${isCur ? "<span class='text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold ml-1 shadow-2xs'>Đang xem T" + m + "</span>" : ""}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-semibold text-slate-800 bg-slate-50/50">${formatMoney(calc.baseSalary)}</td>
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
  renderMultiYearSummary();
}

function calculateYearTotal(targetYear) {
  let yearStdDays = 0, yearActualHours = 0, yearOTHours = 0;
  let yearDayWages = 0, yearOTWages = 0, yearBonusAllow = 0;
  let yearGross = 0, yearDeductions = 0, yearNet = 0;

  for (let m = 1; m <= 12; m++) {
    const calc = calculateSalaryForMonth(m, targetYear);
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

  return {
    year: targetYear,
    yearStdDays,
    yearActualHours,
    yearOTHours,
    yearDayWages,
    yearOTWages,
    yearBonusAllow,
    yearGross,
    yearDeductions,
    yearNet,
    avgNet: Math.round(yearNet / 12)
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

    const isCurrent = (y === currentYear);
    const tr = document.createElement("tr");
    tr.className = `border-b border-black text-center ${isCurrent ? "bg-amber-100/90 font-bold ring-2 ring-inset ring-amber-400" : "hover:bg-slate-50"}`;

    tr.innerHTML = `
      <td class="border-r border-black py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
        Năm ${y} ${isCurrent ? "<span class='text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-bold ml-1 shadow-2xs'>Đang xem</span>" : ""}
      </td>
      <td class="border-r border-black py-2 px-1 num-font">${total.yearStdDays} ngày</td>
      <td class="border-r border-black py-2 px-1 num-font text-blue-800 font-semibold">${formatHours(total.yearActualHours)} h</td>
      <td class="border-r border-black py-2 px-1 num-font text-purple-800 font-semibold">${formatHours(total.yearOTHours)} h</td>
      <td class="border-r border-black py-2 px-2 num-font text-right">${formatMoney(total.yearDayWages)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right text-purple-700">${formatMoney(total.yearOTWages)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right text-emerald-700">${formatMoney(total.yearBonusAllow)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-bold text-slate-900">${formatMoney(total.yearGross)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right text-rose-700">${formatMoney(total.yearDeductions)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-bold text-emerald-800 text-sm bg-emerald-50/50">${formatMoney(total.yearNet)}</td>
      <td class="border-r border-black py-2 px-2 num-font text-right font-semibold text-slate-700">~${formatMoney(total.avgNet)} đ</td>
      <td class="border-r border-black py-1 px-1 no-print whitespace-nowrap">
        ${isCurrent ? "<span class='text-xs text-slate-400 italic font-normal'>Đang xem</span>" : `
          <button onclick="switchYear(${y})" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] rounded shadow-2xs transition font-semibold">
            <i class="fa-solid fa-folder-open"></i> Xem Năm ${y}
          </button>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (tfoot) {
    const avgAllNet = years.length > 0 ? Math.round(grandNet / (years.length * 12)) : 0;
    tfoot.innerHTML = `
      <tr class="bg-slate-900 text-white font-bold text-center text-xs md:text-sm">
        <td class="border border-black py-2.5 px-3">TỔNG (${years.length} NĂM)</td>
        <td class="border border-black py-2 px-1 num-font">${grandStdDays} ngày</td>
        <td class="border border-black py-2 px-1 num-font">${formatHours(grandActualHours)} h</td>
        <td class="border border-black py-2 px-1 num-font">${formatHours(grandOTHours)} h</td>
        <td class="border border-black py-2 px-2 num-font text-right">${formatMoney(grandDayWages)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-purple-300">${formatMoney(grandOTWages)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-emerald-300">${formatMoney(grandBonusAllow)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-amber-300 font-bold">${formatMoney(grandGross)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-rose-300">${formatMoney(grandDeductions)}</td>
        <td class="border border-black py-2.5 px-3 num-font text-right text-base text-yellow-300 font-extrabold bg-emerald-950">${formatMoney(grandNet)}</td>
        <td class="border border-black py-2 px-2 num-font text-right text-slate-300">~${formatMoney(avgAllNet)} đ/th</td>
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

  // 2. Cập nhật năm mới
  currentYear = newYear;
  addAvailableYear(newYear);

  const inputYear = document.getElementById("inputYear");
  if (inputYear) inputYear.value = currentYear;
  const summaryLabel = document.getElementById("summaryYearLabel");
  if (summaryLabel) summaryLabel.innerText = currentYear;
  const selectYearSummary = document.getElementById("selectYearSummary");
  if (selectYearSummary) selectYearSummary.value = currentYear.toString();

  // 3. Khởi tạo/nạp dữ liệu năm mới
  initializeDefaultData();
  await loadAllMonthsFromBackendOrStorage(currentYear);
  loadConfigStoreToInputs(currentMonth);

  // 4. Render lại toàn bộ giao diện
  renderUnifiedTable();
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

  localStorage.setItem(`att_${currentYear}_${m}`, JSON.stringify(monthlyStore[m]));
  localStorage.setItem(`cfg_${currentYear}_${m}`, JSON.stringify(monthlyConfigStore[m]));
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

  localStorage.setItem(`att_${currentYear}_${m}`, JSON.stringify(monthlyStore[m]));
  localStorage.setItem(`cfg_${currentYear}_${m}`, JSON.stringify(monthlyConfigStore[m]));
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

  localStorage.setItem(`att_${currentYear}_${currentMonth}`, JSON.stringify(monthlyStore[currentMonth]));
  localStorage.setItem(`cfg_${currentYear}_${currentMonth}`, JSON.stringify(monthlyConfigStore[currentMonth]));
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
    localStorage.setItem(`att_${currentYear}_${currentMonth}`, JSON.stringify(monthlyStore[currentMonth]));
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
      if (id === "allowanceNight" || id === "allowanceMealNight") {
        if (!monthlyConfigStore[currentMonth]) monthlyConfigStore[currentMonth] = getDefaultSalaryConfig(currentMonth);
        monthlyConfigStore[currentMonth].isManualNight = true; // Đánh dấu khi người dùng cố ý tự gõ số tiền
      }
      if (id === "kpiCoeff") {
        const inlineEl = document.getElementById("kpiCoeffInline");
        if (inlineEl) inlineEl.value = el.value;
      }
      saveCurrentMonthInputsToConfigStore();
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
document.getElementById("btnLoadSampleDec").addEventListener("click", () => {
  applyDayShiftToMonth(currentMonth);
});

document.getElementById("btnLoadSampleNov").addEventListener("click", () => {
  applyNightShiftToMonth(currentMonth);
});

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

document.getElementById("btnResetData").addEventListener("click", () => {
  if (confirm("Bạn có chắc chắn muốn làm mới toàn bộ số liệu cả 12 tháng về mặc định?")) {
    initializeDefaultData();
    renderUnifiedTable();
  }
});

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

  const empName = document.getElementById("empName") ? document.getElementById("empName").value : "Trần Văn A";
  const empDept = document.getElementById("empDept") ? document.getElementById("empDept").value : "Bộ phận Sản xuất";
  const stdWorkDays = document.getElementById("stdWorkDays") ? document.getElementById("stdWorkDays").innerText : "26";
  const stdWorkHours = document.getElementById("stdWorkHours") ? document.getElementById("stdWorkHours").innerText : "208";
  const baseSal = parseVal(document.getElementById("baseSalary") ? document.getElementById("baseSalary").value : 6300000);
  const hourly = document.getElementById("hourlyRate") ? document.getElementById("hourlyRate").innerText : "42.548";
  const posAllowance = parseVal(document.getElementById("positionAllowance") ? document.getElementById("positionAllowance").value : 2450000);
  const kpi = parseVal(document.getElementById("kpiCoeff") ? document.getElementById("kpiCoeff").value : 1.0);
  const senAllowance = parseVal(document.getElementById("seniorityAllowance") ? document.getElementById("seniorityAllowance").value : 100000);
  const insSal = document.getElementById("insuranceSalary") ? document.getElementById("insuranceSalary").innerText : "8.850.000";

  const rightRows = [
    ["Họ và tên", empName, "Ngày công chuẩn", stdWorkDays],
    ["Bộ phận", empDept, "Số giờ tiêu chuẩn", stdWorkHours],
    ["Lương cơ bản (LCB)", baseSal, "Đơn giá giờ", hourly],
    ["Phụ cấp chức vụ", posAllowance, "Hệ số KPI", kpi],
    ["Thâm niên", senAllowance, "Lương đóng BH", insSal],
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
    ["2. Tiền thưởng thành tích KPI", `Hệ số: ${kpi}`, parseVal(document.getElementById("bonusKPI") ? document.getElementById("bonusKPI").value : 3050000), document.getElementById("amountBonusKPI") ? document.getElementById("amountBonusKPI").innerText : ""],
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
    bonusKPI: cfg.bonus_kpi !== undefined ? cfg.bonus_kpi : (cfg.bonusKPI !== undefined ? cfg.bonusKPI : 3050000),
    isTaxExempt: cfg.is_tax_exempt !== undefined ? cfg.is_tax_exempt : (cfg.isTaxExempt !== undefined ? cfg.isTaxExempt : 1),
    bankAccount: cfg.bank_account || cfg.bankAccount || "STK: 102884878810",
    bankName: cfg.bank_name || cfg.bankName || "VietinBank"
  };
}

async function loadAllMonthsFromBackendOrStorage(year) {
  if (isBackendConnected) {
    try {
      // 1. Tải toàn bộ chấm công 12 tháng từ CSDL
      const resp = await fetch(`${API_BASE}/api/attendance/${year}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.months) {
          for (let m = 1; m <= 12; m++) {
            if (data.months[m] && Object.keys(data.months[m]).length > 0) {
              monthlyStore[m] = data.months[m];
              localStorage.setItem(`att_${year}_${m}`, JSON.stringify(monthlyStore[m]));
            }
          }
        }
      }
      // 2. Tải toàn bộ cấu hình lương 12 tháng từ CSDL
      const cfgResp = await fetch(`${API_BASE}/api/config/${year}`);
      if (cfgResp.ok) {
        const data = await cfgResp.json();
        if (data.configs) {
          for (let m = 1; m <= 12; m++) {
            if (data.configs[m]) {
              monthlyConfigStore[m] = normalizeConfig(data.configs[m]);
              localStorage.setItem(`cfg_${year}_${m}`, JSON.stringify(monthlyConfigStore[m]));
            }
          }
        }
      }
    } catch (e) {
      console.warn("Lỗi tải toàn bộ năm từ backend, dùng localStorage:", e);
    }
  } else {
    // Chế độ Offline: Đồng bộ từ localStorage của toàn bộ 12 tháng
    for (let m = 1; m <= 12; m++) {
      const sAtt = localStorage.getItem(`att_${year}_${m}`);
      if (sAtt) {
        try { monthlyStore[m] = JSON.parse(sAtt); } catch(e){}
      }
      const sCfg = localStorage.getItem(`cfg_${year}_${m}`);
      if (sCfg) {
        try { monthlyConfigStore[m] = normalizeConfig(JSON.parse(sCfg)); } catch(e){}
      }
    }
  }
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
          localStorage.setItem(`att_${year}_${month}`, JSON.stringify(monthlyStore[month]));
        }
      }

      // 2. Load salary config
      const cfgResp = await fetch(`${API_BASE}/api/config/${year}/${month}`);
      if (cfgResp.ok) {
        const cfg = await cfgResp.json();
        applyConfigToInputs(cfg);
        monthlyConfigStore[month] = normalizeConfig(cfg);
        localStorage.setItem(`cfg_${year}_${month}`, JSON.stringify(monthlyConfigStore[month]));
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
      try {
        const parsed = JSON.parse(localCfg);
        applyConfigToInputs(parsed);
        monthlyConfigStore[month] = normalizeConfig(parsed);
      } catch(e){}
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
  setVal("bonusKPI", cfg.bonus_kpi !== undefined ? cfg.bonus_kpi : cfg.bonusKPI);
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
          const s = localStorage.getItem(`att_${y}_${m}`);
          if (s) {
            try { finalAtt[m] = JSON.parse(s); } catch(e) {}
          }
        }
        if (cfgYear[m]) {
          finalCfg[m] = cfgYear[m];
        } else {
          const s = localStorage.getItem(`cfg_${y}_${m}`);
          if (s) {
            try { finalCfg[m] = JSON.parse(s); } catch(e) {}
          }
        }
      }
      yearsPayload[y] = {
        attendance: finalAtt,
        configs: finalCfg
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

      if (!employeesList.some(e => e.id === currentEmpId)) {
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
                localStorage.setItem(`att_${yNum}_${m}`, JSON.stringify(yObj.attendance[m]));
                if (yNum === currentYear) monthlyStore[m] = yObj.attendance[m];
              }
            }
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

              if (!employeesList.some(e => e.id === currentEmpId)) {
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

// Khởi chạy khi tải trang
window.addEventListener("DOMContentLoaded", async () => {
  initEmployees();
  setupEmployeeEventListeners();
  await checkBackendStatus();
  // 1. Nạp từ localStorage để hiển thị tức thì 0 giây
  await loadAllMonthsFromBackendOrStorage(currentYear);
  await loadFromBackendOrStorage(currentMonth, currentYear);
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
