/* habits.js: Thói quen — danh sách "Hôm nay", tick/bỏ tick,
 * thêm/sửa qua bottom sheet (tên, emoji, màu), xóa có xác nhận
 * (xóa luôn logs của thói quen đó). T2; T3 sẽ thêm streak + chọn thứ.
 */

var DAY_OPTIONS = [
  { v: 0, l: "CN" }, { v: 1, l: "T2" }, { v: 2, l: "T3" }, { v: 3, l: "T4" },
  { v: 4, l: "T5" }, { v: 5, l: "T6" }, { v: 6, l: "T7" }
];

var CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
var PEN_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z"/></svg>';

var editingId = null;          // id thói quen đang sửa (null = đang thêm mới)
var sheetDays = [0, 1, 2, 3, 4, 5, 6];

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getHabit(id) {
  for (var i = 0; i < data.habits.length; i++) {
    if (data.habits[i].id === id) return data.habits[i];
  }
  return null;
}

// Guard: data cũ/hỏng thiếu days thì coi như cả tuần
function habitDays(h) {
  return Array.isArray(h.days) ? h.days : [0, 1, 2, 3, 4, 5, 6];
}

function isDoneToday(habit) {
  var ids = data.logs[todayStr()] || [];
  return ids.indexOf(habit.id) !== -1;
}

// T3: streak liên tiếp — tính ngược từ hôm nay (hoặc hôm qua nếu hôm nay chưa tick),
// BỎ QUA những ngày không cần làm (không nằm trong habit.days) nên streak không đứt
function calcStreak(habit) {
  var streak = isDoneToday(habit) ? 1 : 0;
  var d = new Date(Date.now() - 86400000); // bắt đầu từ ngày hôm qua

  for (var i = 0; i < 3650; i++) {
    var wd = d.getDay();
    if (habitDays(habit).indexOf(wd) !== -1) {
      var ids = data.logs[todayStr(d)] || [];
      if (ids.indexOf(habit.id) !== -1) streak++;
      else break; // đến ngày cần làm mà thiếu tick -> dừng
    }
    d = new Date(d.getTime() - 86400000);
  }
  return streak;
}

function toggleToday(habit) {
  var key = todayStr();
  var ids = data.logs[key] ? data.logs[key].slice() : [];
  var i = ids.indexOf(habit.id);
  if (i === -1) ids.push(habit.id);
  else ids.splice(i, 1);

  if (ids.length) data.logs[key] = ids;
  else delete data.logs[key];

  saveData(data);
}

function addHabit(fields) {
  data.habits.push({
    id: uid(),
    name: fields.name,
    days: fields.days ? fields.days.slice() : [0, 1, 2, 3, 4, 5, 6],
    createdAt: Date.now()
  });
  saveData(data);
}

function updateHabit(id, fields) {
  var h = getHabit(id);
  if (!h) return;
  if (typeof fields.name === "string") h.name = fields.name;
  if (Array.isArray(fields.days)) h.days = fields.days.slice().sort(function (a, b) { return a - b; });
  saveData(data);
}

function deleteHabit(id) {
  data.habits = data.habits.filter(function (h) { return h.id !== id; });
  Object.keys(data.logs).forEach(function (key) {
    var ids = data.logs[key].filter(function (x) { return x !== id; });
    if (ids.length) data.logs[key] = ids;
    else delete data.logs[key];
  });
  saveData(data);
}

// ===== Render tab "Hôm nay" (app.js gọi hàm này) =====
var DAY_NAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

function renderTodayList(panel) {
  if (!data.habits.length) {
    panel.innerHTML =
      '<p class="placeholder">Chưa có thói quen nào.<br>' +
      'Chạm nút <b>+</b> để thêm thói quen đầu tiên.</p>';
    return;
  }

  // T3: chỉ hiện thói quen đúng ngày hôm nay
  var wd = new Date().getDay();
  var todays = data.habits.filter(function (h) { return habitDays(h).indexOf(wd) !== -1; });
  if (!todays.length) {
    panel.innerHTML = '<p class="placeholder">Hôm nay (' + DAY_NAMES[wd] + ') không có thói quen nào cần làm.</p>';
    return;
  }

  var html = '<ul class="habit-list">';
  todays.forEach(function (h, i) {
    var done = isDoneToday(h);
    var streak = calcStreak(h);
    html +=
      '<li class="habit-card' + (done ? " done" : "") + '" data-id="' + h.id + '">' +
        '<span class="habit-idx" aria-hidden="true">' + String(i + 1).padStart(2, "0") + '</span>' +
        '<span class="habit-name">' + escapeHtml(h.name) + '</span>' +
        '<span class="habit-streak"' + (streak > 0 ? ' title="Streak ' + streak + ' ngày">' + streak + ' ngày' : '>') + '</span>' +
        '<span class="habit-check" aria-hidden="true">' + (done ? CHECK_SVG : "") + '</span>' +
        '<button class="habit-edit" type="button" data-id="' + h.id + '" aria-label="Sửa">' + PEN_SVG + '</button>' +
      '</li>';
  });
  html += '</ul>';
  panel.innerHTML = html;

  // Tick / bỏ tick: chạm thân thẻ
  var cards = panel.querySelectorAll(".habit-card");
  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      var h = getHabit(card.getAttribute("data-id"));
      if (!h) return;
      toggleToday(h);
      renderTodayList(panel);
    });
  });

  // Nút Sửa: mở sheet (không tick)
  var editBtns = panel.querySelectorAll(".habit-edit");
  editBtns.forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openSheet(btn.getAttribute("data-id"));
    });
  });
}

// Báo lỗi ngay trong sheet (thay cho alert của trình duyệt)
function setSheetError(msg) {
  var el = document.getElementById("h-error");
  if (el) el.textContent = msg;
}

// Hộp xác nhận ngay trong trang (thay cho confirm của trình duyệt)
function askConfirm(text, onOk) {
  var ov = document.getElementById("confirm-overlay");
  var ok = document.getElementById("confirm-ok");
  var cancel = document.getElementById("confirm-cancel");
  document.getElementById("confirm-text").textContent = text;

  function onKey(e) { if (e.key === "Escape") close(); }
  function close() {
    ov.hidden = true;
    ok.onclick = cancel.onclick = ov.onclick = null;
    document.removeEventListener("keydown", onKey);
  }
  ok.onclick = function () { close(); onOk(); };
  cancel.onclick = close;
  ov.onclick = function (e) { if (e.target === ov) close(); };
  document.addEventListener("keydown", onKey);

  ov.hidden = false;
  cancel.focus(); // mặc định focus vào Hủy cho an toàn
}

// ===== Bottom sheet thêm/sửa =====
function buildPickers() {
  // T3: chọn ngày trong tuần (bấm để bật/tắt)
  var daysRow = document.getElementById("h-days-row");
  daysRow.innerHTML = DAY_OPTIONS.map(function (d) {
    return '<button class="pick-day" type="button" data-day="' + d.v + '">' + d.l + '</button>';
  }).join("");
  daysRow.querySelectorAll(".pick-day").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = parseInt(b.getAttribute("data-day"), 10);
      var i = sheetDays.indexOf(v);
      if (i === -1) sheetDays.push(v);
      else sheetDays.splice(i, 1);
      sheetDays.sort(function (a, b) { return a - b; });
      setSheetError("");
      markPickers();
    });
  });
}

function markPickers() {
  document.querySelectorAll("#h-days-row .pick-day").forEach(function (b) {
    b.classList.toggle("selected", sheetDays.indexOf(parseInt(b.getAttribute("data-day"), 10)) !== -1);
  });
}

function openSheet(id) {
  editingId = id || null;
  var h = editingId ? getHabit(editingId) : null;

  document.getElementById("sheet-title").textContent = h ? "Sửa thói quen" : "Thêm thói quen";
  document.getElementById("h-name").value = h ? h.name : "";
  sheetDays = h ? (Array.isArray(h.days) ? h.days.slice() : [0, 1, 2, 3, 4, 5, 6]) : [0, 1, 2, 3, 4, 5, 6];
  markPickers();
  setSheetError("");

  document.getElementById("h-delete").style.display = h ? "" : "none";
  document.getElementById("sheet-overlay").hidden = false;
  document.body.classList.add("no-scroll");
}

function closeSheet() {
  editingId = null;
  document.getElementById("sheet-overlay").hidden = true;
  document.body.classList.remove("no-scroll");
}

function saveFromSheet() {
  var name = document.getElementById("h-name").value.trim();
  if (!name) {
    document.getElementById("h-name").focus();
    return;
  }
  if (!sheetDays.length) {
    setSheetError("Hãy chọn ít nhất 1 ngày trong tuần.");
    return;
  }
  var fields = { name: name, days: sheetDays.slice() };
  if (editingId) updateHabit(editingId, fields);
  else addHabit(fields);
  closeSheet();
  renderTodayList(document.getElementById("panel-today"));
}

function wireSheet() {
  document.getElementById("btn-add").addEventListener("click", function () { openSheet(null); });
  document.getElementById("h-cancel").addEventListener("click", closeSheet);
  document.getElementById("h-save").addEventListener("click", saveFromSheet);

  // Chạm vùng tối (ngoài sheet) để đóng
  document.getElementById("sheet-overlay").addEventListener("click", function (e) {
    if (e.target === this) closeSheet();
  });

  document.getElementById("h-delete").addEventListener("click", function () {
    var h = editingId ? getHabit(editingId) : null;
    if (!h) return;
    var delId = editingId;
    askConfirm('Bạn có muốn xóa thói quen "' + h.name + '" không? Toàn bộ dấu tick của nó cũng sẽ bị xóa.', function () {
      deleteHabit(delId);
      closeSheet();
      renderTodayList(document.getElementById("panel-today"));
    });
  });

  // Enter trong ô tên = lưu
  document.getElementById("h-name").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); saveFromSheet(); }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  buildPickers();
  wireSheet();
});
