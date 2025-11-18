// ===== Datos en localStorage =====
const STORAGE_KEY = "asistencia_unicen_acta_v1";

/**
 * Estructura:
 * {
 *   docentes: {...},
 *   currentDocenteId,
 *   currentClaseId,
 *   gestionAcademica,
 *   periodo,
 *   studentsByClass: {
 *     [claseId]: [ { id, ru, ci, name, email } ]
 *   },
 *   recordsByClass: {
 *     [claseId]: {
 *       [date]: {
 *         [studentId]: { status, time }
 *       }
 *     }
 *   }
 * }
 */

let appData = {
  docentes: {},
  currentDocenteId: null,
  currentClaseId: null,
  gestionAcademica: "",
  periodo: "",
  studentsByClass: {},
  recordsByClass: {}
};

// ===== Utilidades de almacenamiento =====
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      appData.docentes = parsed.docentes || {};
      appData.currentDocenteId = parsed.currentDocenteId || null;
      appData.currentClaseId = parsed.currentClaseId || null;
      appData.gestionAcademica = parsed.gestionAcademica || "";
      appData.periodo = parsed.periodo || "";
      appData.studentsByClass = parsed.studentsByClass || {};
      appData.recordsByClass = parsed.recordsByClass || {};
    } catch (e) {
      console.warn("No se pudo leer localStorage, iniciando datos vacíos.");
    }
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

// ===== Helpers de docente / clase =====
function getDocenteById(id) {
  return appData.docentes[id] || null;
}

function getCurrentDocente() {
  return getDocenteById(appData.currentDocenteId);
}

function getCurrentClase() {
  const docente = getCurrentDocente();
  if (!docente) return null;
  if (!appData.currentClaseId) return null;
  return docente.clases[appData.currentClaseId] || null;
}

function getStudentsForCurrentClass() {
  const clase = getCurrentClase();
  if (!clase) return [];
  return appData.studentsByClass[clase.id] || [];
}

function getAttendanceForCurrentClassAndDate(date) {
  const clase = getCurrentClase();
  if (!clase) return {};
  const byClass = appData.recordsByClass[clase.id] || {};
  return byClass[date] || {};
}

function setAttendanceForCurrentClassAndDate(date, studentId, status, time) {
  const clase = getCurrentClase();
  if (!clase) return;
  if (!appData.recordsByClass[clase.id]) appData.recordsByClass[clase.id] = {};
  if (!appData.recordsByClass[clase.id][date]) appData.recordsByClass[clase.id][date] = {};
  appData.recordsByClass[clase.id][date][studentId] = { status, time };
  saveData();
}

function getDatesForCurrentClass() {
  const clase = getCurrentClase();
  if (!clase) return [];
  const classRecords = appData.recordsByClass[clase.id] || {};
  return Object.keys(classRecords).sort();
}

function getCurrentDate() {
  const dateInput = document.getElementById("attendanceDate");
  return dateInput.value;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString();
}

function sanitizeFilename(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-]/g, "");
}

// ===== Render login (lista de docentes) =====
function renderDocentesLista() {
  const cont = document.getElementById("docentesLista");
  const docentesArr = Object.values(appData.docentes);
  if (!docentesArr.length) {
    cont.innerHTML = "<em>No hay docentes registrados aún.</em>";
    return;
  }
  const spans = docentesArr
    .map(d => `<span>${d.nombre}</span>`)
    .join("");
  cont.innerHTML = `<strong>Docentes registrados:</strong> ${spans}`;
}

// ===== Render clases del docente =====
function renderClasesSelect() {
  const select = document.getElementById("selectClase");
  const docente = getCurrentDocente();
  select.innerHTML = `<option value="">Seleccionar...</option>`;
  if (!docente) return;
  const clasesEntries = Object.entries(docente.clases || {});
  clasesEntries.forEach(([id, c]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = `${c.carrera} - ${c.materia} (${c.paralelo})`;
    select.appendChild(opt);
  });
  if (appData.currentClaseId && docente.clases[appData.currentClaseId]) {
    select.value = appData.currentClaseId;
  }
}

// ===== Actualizar info de cabecera de clase =====
function updateClassInfoUI() {
  const docente = getCurrentDocente();
  const clase = getCurrentClase();
  document.getElementById("headerDocente").textContent = docente ? docente.nombre : "—";

  document.getElementById("infoCarrera").textContent = clase ? clase.carrera : "—";
  document.getElementById("infoMateria").textContent = clase ? clase.materia : "—";
  document.getElementById("infoParalelo").textContent = clase ? clase.paralelo : "—";

  const hint = document.getElementById("hintClaseActiva");
  if (clase) {
    hint.textContent = `Clase activa: ${clase.carrera} – ${clase.materia} (${clase.paralelo}).`;
  } else {
    hint.textContent = "Primero seleccione o cree una clase para habilitar el registro de estudiantes.";
  }

  renderClasesSelect();
}

// ===== Render tabla de asistencia =====
function renderAsistencia() {
  const tbody = document.getElementById("studentsTableBody");
  const emptyState = document.getElementById("emptyState");
  const clase = getCurrentClase();

  tbody.innerHTML = "";

  if (!clase) {
    emptyState.style.display = "block";
    emptyState.textContent = "No hay clase activa. Cree o seleccione una clase.";
    document.getElementById("statTotal").textContent = "0";
    document.getElementById("statPresentes").textContent = "0";
    document.getElementById("statAusentes").textContent = "0";
    return;
  }

  const students = getStudentsForCurrentClass();
  const date = getCurrentDate();
  const attendance = getAttendanceForCurrentClassAndDate(date);

  if (!students.length) {
    emptyState.style.display = "block";
    emptyState.textContent = "No hay estudiantes registrados en la clase activa.";
  } else {
    emptyState.style.display = "none";
  }

  let countPresente = 0;
  let countAusente = 0;

  students.forEach((student, index) => {
    const record = attendance[student.id] || {};
    const status = record.status || "sin-marcar";

    if (status === "presente") countPresente++;
    if (status === "ausente") countAusente++;

    const tr = document.createElement("tr");

    const tdIndex = document.createElement("td");
    tdIndex.textContent = index + 1;

    const tdRU = document.createElement("td");
    tdRU.textContent = student.ru;

    const tdCI = document.createElement("td");
    tdCI.textContent = student.ci;

    const tdEmail = document.createElement("td");
    tdEmail.textContent = student.email || "—";

    const tdName = document.createElement("td");
    tdName.textContent = student.name;

    const tdStatus = document.createElement("td");
    const statusSpan = document.createElement("span");
    statusSpan.classList.add("status-pill");
    if (status === "presente") {
      statusSpan.classList.add("status-presente");
      statusSpan.textContent = "Presente";
    } else if (status === "ausente") {
      statusSpan.classList.add("status-ausente");
      statusSpan.textContent = "Ausente";
    } else {
      statusSpan.classList.add("status-sin-marcar");
      statusSpan.textContent = "Sin marcar";
    }
    tdStatus.appendChild(statusSpan);

    const tdTime = document.createElement("td");
    tdTime.textContent = record.time || "-";

    const tdActions = document.createElement("td");
    tdActions.classList.add("no-print");

    const btnPresent = document.createElement("button");
    btnPresent.className = "btn btn-soft-success btn-sm btn-status";
    btnPresent.textContent = "Presente";
    btnPresent.dataset.id = student.id;
    btnPresent.dataset.status = "presente";

    const btnAbsent = document.createElement("button");
    btnAbsent.className = "btn btn-soft-danger btn-sm btn-status";
    btnAbsent.textContent = "Ausente";
    btnAbsent.dataset.id = student.id;
    btnAbsent.dataset.status = "ausente";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn btn-outline btn-icon btn-edit-student";
    btnEdit.textContent = "✏️";
    btnEdit.title = "Editar estudiante";
    btnEdit.dataset.id = student.id;

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn-soft-danger btn-icon btn-delete-student";
    btnDelete.textContent = "🗑️";
    btnDelete.title = "Eliminar estudiante";
    btnDelete.dataset.id = student.id;

    tdActions.appendChild(btnPresent);
    tdActions.appendChild(btnAbsent);
    tdActions.appendChild(btnEdit);
    tdActions.appendChild(btnDelete);

    tr.appendChild(tdIndex);
    tr.appendChild(tdRU);
    tr.appendChild(tdCI);
    tr.appendChild(tdEmail);
    tr.appendChild(tdName);
    tr.appendChild(tdStatus);
    tr.appendChild(tdTime);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  document.getElementById("statTotal").textContent = students.length;
  document.getElementById("statPresentes").textContent = countPresente;
  document.getElementById("statAusentes").textContent = countAusente;
}

// ===== Historial de fechas =====
function renderHistorialFechas() {
  const select = document.getElementById("selectFechaHistorial");
  const chips = document.getElementById("chipsFechas");
  const dates = getDatesForCurrentClass();
  const currentDate = getCurrentDate();

  select.innerHTML = `<option value="">Seleccionar...</option>`;
  chips.innerHTML = "";

  if (!dates.length) {
    const empty = document.createElement("span");
    empty.textContent = "Sin fechas registradas aún.";
    empty.style.fontSize = "0.85rem";
    empty.style.color = "#6b7280";
    chips.appendChild(empty);
    return;
  }

  dates.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);

    const chip = document.createElement("span");
    chip.className = "date-chip";
    chip.textContent = d;
    chip.dataset.date = d;
    if (d === currentDate) {
      chip.classList.add("active");
      select.value = d;
    }
    chips.appendChild(chip);
  });
}

// ===== Resumen de asistencia =====
function renderResumen() {
  const tbody = document.getElementById("summaryTableBody");
  const empty = document.getElementById("emptySummary");
  const clase = getCurrentClase();

  tbody.innerHTML = "";

  if (!clase) {
    empty.style.display = "block";
    empty.textContent = "No hay clase activa para calcular el resumen.";
    return;
  }

  const students = getStudentsForCurrentClass();
  const dates = getDatesForCurrentClass();
  const classRecords = appData.recordsByClass[clase.id] || {};

  if (!students.length || !dates.length) {
    empty.style.display = "block";
    empty.textContent = "No hay registros de asistencia para calcular el resumen.";
    return;
  }

  empty.style.display = "none";

  students.forEach((student, index) => {
    let presentes = 0;
    let ausentes = 0;

    dates.forEach(date => {
      const byDate = classRecords[date] || {};
      const rec = byDate[student.id];
      if (!rec) return;
      if (rec.status === "presente") presentes++;
      if (rec.status === "ausente") ausentes++;
    });

    const totalMarcado = presentes + ausentes;
    const pct = totalMarcado > 0 ? ((presentes / totalMarcado) * 100).toFixed(1) : "0.0";

    const tr = document.createElement("tr");

    const tdIndex = document.createElement("td");
    tdIndex.textContent = index + 1;

    const tdRU = document.createElement("td");
    tdRU.textContent = student.ru;

    const tdName = document.createElement("td");
    tdName.textContent = student.name;

    const tdPres = document.createElement("td");
    tdPres.textContent = presentes;

    const tdAus = document.createElement("td");
    tdAus.textContent = ausentes;

    const tdPct = document.createElement("td");
    tdPct.textContent = pct + " %";

    tr.appendChild(tdIndex);
    tr.appendChild(tdRU);
    tr.appendChild(tdName);
    tr.appendChild(tdPres);
    tr.appendChild(tdAus);
    tr.appendChild(tdPct);

    tbody.appendChild(tr);
  });
}

// ===== Lógica de asistencia =====
function setAttendance(studentId, status) {
  const clase = getCurrentClase();
  if (!clase) return;
  const date = getCurrentDate();
  let time = "";
  if (status === "presente") {
    time = formatTime();
  }
  setAttendanceForCurrentClassAndDate(date, studentId, status, time);
  renderAsistencia();
  renderHistorialFechas();
  renderResumen();
}

function markAllPresent() {
  const clase = getCurrentClase();
  if (!clase) return;
  const date = getCurrentDate();
  const students = getStudentsForCurrentClass();
  const now = formatTime();
  if (!appData.recordsByClass[clase.id]) appData.recordsByClass[clase.id] = {};
  if (!appData.recordsByClass[clase.id][date]) appData.recordsByClass[clase.id][date] = {};
  students.forEach(s => {
    appData.recordsByClass[clase.id][date][s.id] = {
      status: "presente",
      time: now
    };
  });
  saveData();
  renderAsistencia();
  renderHistorialFechas();
  renderResumen();
}

function clearDayAttendance() {
  const clase = getCurrentClase();
  if (!clase) return;
  const date = getCurrentDate();
  if (appData.recordsByClass[clase.id] && appData.recordsByClass[clase.id][date]) {
    delete appData.recordsByClass[clase.id][date];
    saveData();
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  }
}

// ===== Edición / eliminación de estudiantes =====
function editStudent(studentId) {
  const clase = getCurrentClase();
  if (!clase) return;
  const list = appData.studentsByClass[clase.id] || [];
  const student = list.find(s => s.id === studentId);
  if (!student) return;

  const nuevoRU = prompt("Editar RU (Registro Universitario):", student.ru);
  if (nuevoRU === null) return;
  const ruTrim = nuevoRU.trim();
  if (!ruTrim) {
    alert("El RU no puede estar vacío.");
    return;
  }
  const repetido = list.find(s => s.ru.toLowerCase() === ruTrim.toLowerCase() && s.id !== studentId);
  if (repetido) {
    alert("Ya existe otro estudiante con ese RU en esta clase.");
    return;
  }

  const nuevoCI = prompt("Editar CI (con extensión):", student.ci);
  if (nuevoCI === null) return;
  const ciTrim = nuevoCI.trim();
  if (!ciTrim) {
    alert("El CI no puede estar vacío.");
    return;
  }

  const nuevoNombre = prompt("Editar nombre completo:", student.name);
  if (nuevoNombre === null) return;
  const nameTrim = nuevoNombre.trim();
  if (!nameTrim) {
    alert("El nombre no puede estar vacío.");
    return;
  }

  const nuevoEmail = prompt("Editar correo (opcional):", student.email || "");
  if (nuevoEmail === null) return;
  const emailTrim = nuevoEmail.trim();

  student.ru = ruTrim;
  student.ci = ciTrim;
  student.name = nameTrim;
  student.email = emailTrim;

  saveData();
  renderAsistencia();
  renderResumen();
}

function deleteStudent(studentId) {
  const clase = getCurrentClase();
  if (!clase) return;
  if (!confirm("¿Eliminar este estudiante y todos sus registros de asistencia de esta clase?")) return;

  const list = appData.studentsByClass[clase.id] || [];
  appData.studentsByClass[clase.id] = list.filter(s => s.id !== studentId);

  const classRecords = appData.recordsByClass[clase.id];
  if (classRecords) {
    for (const date in classRecords) {
      if (classRecords[date][studentId]) {
        delete classRecords[date][studentId];
      }
    }
  }

  saveData();
  renderAsistencia();
  renderHistorialFechas();
  renderResumen();
}

// ===== Exportar CSV =====
function exportCsvForCurrentDate() {
  const clase = getCurrentClase();
  const docente = getCurrentDocente();
  if (!clase || !docente) return;

  const date = getCurrentDate();
  const students = getStudentsForCurrentClass();
  const attendance = getAttendanceForCurrentClassAndDate(date);

  let lines = [];
  lines.push(`Universidad,UNIVERSIDAD CENTRAL (UNICEN)`);
  lines.push(`Facultad,Facultad de Ciencias Empresariales`);
  lines.push(`Gestión académica,${appData.gestionAcademica || ""}`);
  lines.push(`Período,${appData.periodo || ""}`);
  lines.push(`Docente,${docente.nombre}`);
  lines.push(`Carrera / Nivel,${clase.carrera}`);
  lines.push(`Asignatura,${clase.materia}`);
  lines.push(`Paralelo / Grupo,${clase.paralelo}`);
  lines.push("");
  lines.push("Fecha,Docente,Carrera/Nivel,Asignatura,Paralelo,Gestión,Período,RU,CI,Nombre,Correo,Estado,Hora");

  students.forEach((student) => {
    const record = attendance[student.id] || {};
    const status = record.status || "";
    const time = record.time || "";
    const row = [
      date,
      `"${docente.nombre}"`,
      `"${clase.carrera}"`,
      `"${clase.materia}"`,
      `"${clase.paralelo}"`,
      `"${appData.gestionAcademica || ""}"`,
      `"${appData.periodo || ""}"`,
      `"${student.ru}"`,
      `"${student.ci}"`,
      `"${student.name}"`,
      `"${student.email || ""}"`,
      status,
      time
    ].join(",");
    lines.push(row);
  });

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const codDoc = sanitizeFilename(docente.nombre);
  const codCarrera = sanitizeFilename(clase.carrera);
  const codMateria = sanitizeFilename(clase.materia);
  const codParalelo = sanitizeFilename(clase.paralelo);

  const a = document.createElement("a");
  a.href = url;
  a.download = `acta_asistencia_unicen_${codDoc}_${codCarrera}_${codMateria}_${codParalelo}_${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Inicialización de eventos =====
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  const loginView = document.getElementById("loginView");
  const mainView = document.getElementById("mainView");

  const dateInput = document.getElementById("attendanceDate");
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;

  // Cargar gestión / periodo
  const gestionInput = document.getElementById("gestionAcademica");
  const periodoSelect = document.getElementById("periodoAcademico");
  gestionInput.value = appData.gestionAcademica || "";
  if (appData.periodo) {
    periodoSelect.value = appData.periodo;
  }

  gestionInput.addEventListener("input", () => {
    appData.gestionAcademica = gestionInput.value.trim();
    saveData();
  });

  periodoSelect.addEventListener("change", () => {
    appData.periodo = periodoSelect.value;
    saveData();
  });

  renderDocentesLista();

  if (appData.currentDocenteId && getCurrentDocente()) {
    loginView.style.display = "none";
    mainView.style.display = "block";
    updateClassInfoUI();
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  } else {
    loginView.style.display = "block";
    mainView.style.display = "none";
  }

  // ----- Login -----
  const loginForm = document.getElementById("loginForm");
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("loginNombre").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();
    if (!nombre || !pass) return;

    const docentesArr = Object.values(appData.docentes);
    const found = docentesArr.find(d => d.nombre.toLowerCase() === nombre.toLowerCase());
    if (!found) {
      alert("Docente no encontrado. Regístrelo primero.");
      return;
    }
    if (found.password !== pass) {
      alert("Contraseña incorrecta.");
      return;
    }
    appData.currentDocenteId = found.id;
    appData.currentClaseId = null;
    saveData();

    loginView.style.display = "none";
    mainView.style.display = "block";
    updateClassInfoUI();
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });

  document.getElementById("btnRegisterDocente").addEventListener("click", () => {
    const nombre = document.getElementById("loginNombre").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();
    if (!nombre || !pass) {
      alert("Ingrese nombre y contraseña para registrar al docente.");
      return;
    }
    const docentesArr = Object.values(appData.docentes);
    const exists = docentesArr.find(d => d.nombre.toLowerCase() === nombre.toLowerCase());
    if (exists) {
      alert("Ya existe un docente con ese nombre. Use otro nombre o inicie sesión.");
      return;
    }
    const id = "doc_" + Date.now().toString();
    appData.docentes[id] = {
      id,
      nombre,
      password: pass,
      clases: {}
    };
    appData.currentDocenteId = id;
    appData.currentClaseId = null;
    saveData();
    renderDocentesLista();

    alert("Docente registrado correctamente.");
    loginView.style.display = "none";
    mainView.style.display = "block";
    updateClassInfoUI();
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });

  // ----- Logout -----
  document.getElementById("btnLogout").addEventListener("click", () => {
    appData.currentDocenteId = null;
    appData.currentClaseId = null;
    saveData();
    document.getElementById("loginPassword").value = "";
    loginView.style.display = "block";
    mainView.style.display = "none";
    renderDocentesLista();
  });

  // ----- Crear clase -----
  const classConfigForm = document.getElementById("classConfigForm");
  classConfigForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const docente = getCurrentDocente();
    if (!docente) {
      alert("Primero inicie sesión como docente.");
      return;
    }
    const carrera = document.getElementById("carrera").value.trim();
    const materia = document.getElementById("materia").value.trim();
    const paralelo = document.getElementById("paralelo").value.trim();
    if (!carrera || !materia || !paralelo) return;

    const claseId = "clase_" + Date.now().toString();
    if (!docente.clases) docente.clases = {};
    docente.clases[claseId] = { id: claseId, carrera, materia, paralelo };
    appData.currentClaseId = claseId;
    if (!appData.studentsByClass[claseId]) appData.studentsByClass[claseId] = [];
    saveData();

    classConfigForm.reset();
    updateClassInfoUI();
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });

  // ----- Select de clase -----
  document.getElementById("selectClase").addEventListener("change", (e) => {
    const claseId = e.target.value;
    if (!claseId) {
      appData.currentClaseId = null;
    } else {
      appData.currentClaseId = claseId;
    }
    saveData();
    updateClassInfoUI();
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });

  // ----- Form estudiantes -----
  const studentForm = document.getElementById("studentForm");
  studentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const clase = getCurrentClase();
    if (!clase) {
      alert("Primero seleccione o cree una clase.");
      return;
    }
    const ruInput = document.getElementById("studentRU");
    const ciInput = document.getElementById("studentCI");
    const nameInput = document.getElementById("studentName");
    const emailInput = document.getElementById("studentEmail");

    const ru = ruInput.value.trim();
    const ci = ciInput.value.trim();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!ru || !ci || !name) return;

    if (!appData.studentsByClass[clase.id]) appData.studentsByClass[clase.id] = [];
    const list = appData.studentsByClass[clase.id];

    const exists = list.find(s => s.ru.toLowerCase() === ru.toLowerCase());
    if (exists) {
      alert("Ya existe un estudiante con ese RU en esta clase.");
      return;
    }

    const newStudent = {
      id: "st_" + Date.now().toString(),
      ru,
      ci,
      name,
      email
    };
    list.push(newStudent);
    saveData();
    studentForm.reset();
    renderAsistencia();
    renderResumen();
  });

  // ----- Cambio de fecha -----
  dateInput.addEventListener("change", () => {
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });

  // ----- Botones de estado / edición / eliminación -----
  const tbody = document.getElementById("studentsTableBody");
  tbody.addEventListener("click", (e) => {
    const target = e.target;
    if (target.classList.contains("btn-status")) {
      const id = target.dataset.id;
      const status = target.dataset.status;
      setAttendance(id, status);
    } else if (target.classList.contains("btn-edit-student")) {
      const id = target.dataset.id;
      editStudent(id);
    } else if (target.classList.contains("btn-delete-student")) {
      const id = target.dataset.id;
      deleteStudent(id);
    }
  });

  // ----- Botones de acciones -----
  document.getElementById("btnMarkAllPresent").addEventListener("click", () => {
    const clase = getCurrentClase();
    if (!clase) {
      alert("Primero seleccione una clase.");
      return;
    }
    markAllPresent();
  });

  document.getElementById("btnClearDay").addEventListener("click", () => {
    const clase = getCurrentClase();
    if (!clase) {
      alert("Primero seleccione una clase.");
      return;
    }
    if (confirm("¿Seguro que desea limpiar la asistencia de esta fecha para esta clase?")) {
      clearDayAttendance();
    }
  });

  document.getElementById("btnExportCsv").addEventListener("click", () => {
    const clase = getCurrentClase();
    if (!clase) {
      alert("Primero seleccione una clase.");
      return;
    }
    exportCsvForCurrentDate();
  });

  document.getElementById("btnPrintPdf").addEventListener("click", () => {
    const clase = getCurrentClase();
    if (!clase) {
      alert("Primero seleccione una clase.");
      return;
    }
    window.print();
  });

  // ----- Historial de fechas: select + chips -----
  document.getElementById("selectFechaHistorial").addEventListener("change", (e) => {
    const val = e.target.value;
    if (!val) return;
    document.getElementById("attendanceDate").value = val;
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });

  document.getElementById("chipsFechas").addEventListener("click", (e) => {
    const chip = e.target.closest(".date-chip");
    if (!chip) return;
    const date = chip.dataset.date;
    if (!date) return;
    document.getElementById("attendanceDate").value = date;
    renderAsistencia();
    renderHistorialFechas();
    renderResumen();
  });
});