/* app.js: điều phối chung — chuyển tab, gọi hàm render riêng của từng tab,
 * khởi tạo ngày trên header. Các tab sẽ trỏ vào hàm render tương ứng
 * khi habits.js / stats.js / cài đặt được thêm (T2–T5).
 */

var data = loadData();

// Mỗi tab 1 hàm render riêng
function renderToday() {
  var panel = document.getElementById("panel-today");
  if (typeof renderTodayList === "function") {
    // T2: habits.js chịu trách nhiệm render danh sách hôm nay
    renderTodayList(panel);
    return;
  }
  panel.innerHTML = '<p class="placeholder">Chưa có gì ở đây — sẽ thêm thói quen ở bước tiếp theo.</p>';
}

function renderStats() {
  var panel = document.getElementById("panel-stats");
  if (typeof renderStatsPanel === "function") {
    // T4: stats.js chịu trách nhiệm render thống kê + lịch tháng
    renderStatsPanel(panel);
    return;
  }
  panel.innerHTML = '<p class="placeholder">Chưa có gì ở đây — sẽ thêm thống kê ở bước tiếp theo.</p>';
}

function renderSettings() {
  var panel = document.getElementById("panel-settings");
  var dark = data.settings.dark === true;
  panel.innerHTML =
    '<div class="settings-group">' +
      '<h2 class="settings-title">Dữ liệu</h2>' +
      '<button class="btn btn-ghost settings-row" id="btn-export" type="button">Xuất dữ liệu (.json)</button>' +
      '<button class="btn btn-ghost settings-row" id="btn-import" type="button">Nhập dữ liệu</button>' +
      '<p class="settings-hint" id="import-msg"></p>' +
    '</div>' +
    '<div class="settings-group">' +
      '<h2 class="settings-title">Giao diện</h2>' +
      '<label class="settings-row toggle-row">' +
        '<span>Chế độ tối</span>' +
        '<span class="switch">' +
          '<input type="checkbox" id="dark-toggle"' + (dark ? " checked" : "") + '>' +
          '<span class="knob"></span>' +
        '</span>' +
      '</label>' +
    '</div>';

  wireSettings();
}

// ===== T5: xuất / nhập / dark mode =====
function exportData() {
  var payload = JSON.stringify(normalizeData(data), null, 2);
  var blob = new Blob([payload], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "habit-tracker-backup-" + todayStr() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

// Kiểm tra trước khi ghi đè; trả về null nếu hợp lệ, chuỗi lỗi nếu không
function validateImport(parsed) {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "File không phải dữ liệu Habit Tracker hợp lệ.";
  }
  // Kiểm tra từng trường NẾU CÓ MẶT: sai kiểu = file hỏng
  if (parsed.habits !== undefined && !Array.isArray(parsed.habits)) {
    return "File hỏng: habits không phải danh sách.";
  }
  if (parsed.logs !== undefined && (typeof parsed.logs !== "object" || Array.isArray(parsed.logs))) {
    return "File hỏng: logs sai cấu trúc.";
  }
  if (parsed.settings !== undefined && (typeof parsed.settings !== "object" || Array.isArray(parsed.settings))) {
    return "File hỏng: settings sai cấu trúc.";
  }
  var d = normalizeData(parsed);
  for (var i = 0; i < d.habits.length; i++) {
    var h = d.habits[i];
    if (!h || typeof h !== "object" || Array.isArray(h) ||
        typeof h.id !== "string" || !h.id ||
        typeof h.name !== "string" || !h.name) {
      return "File hỏng: có thói quen thiếu tên/ID.";
    }
  }
  return null;
}

function importText(text) {
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return "File không phải JSON hợp lệ.";
  }
  var err = validateImport(parsed);
  if (err) return err; // KHÔNG ghi đè dữ liệu cũ

  data = normalizeData(parsed);
  var ok = saveData(data);
  applyDarkMode();
  return ok ? null : "Dữ liệu hợp lệ nhưng ghi vào bộ nhớ thất bại (đầy/chặn?).";
}

function wireSettings() {
  document.getElementById("btn-export").addEventListener("click", exportData);

  var fileInput = document.getElementById("import-file");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.id = "import-file";
    fileInput.type = "file";
    fileInput.accept = "application/json,.json";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);
  }

  var msg = document.getElementById("import-msg");
  document.getElementById("btn-import").addEventListener("click", function () {
    msg.textContent = "";
    msg.className = "settings-hint";
    fileInput.value = "";
    fileInput.click();
  });

  // Gắn listener MỘT LẦN (wireSettings chạy lại mỗi lần vào tab Cài đặt)
  if (!fileInput._wired) {
    fileInput._wired = true;
    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var err = importText(String(reader.result));
        var m = document.getElementById("import-msg");
        if (err) {
          m.textContent = err;
          m.className = "settings-hint err";
        } else {
          renderAll();
          m = document.getElementById("import-msg");
          m.textContent = "Đã nhập dữ liệu thành công.";
          m.className = "settings-hint ok";
        }
      };
      reader.onerror = function () {
        var m2 = document.getElementById("import-msg");
        if (m2) {
          m2.textContent = "Không đọc được file.";
          m2.className = "settings-hint err";
        }
      };
      reader.readAsText(f);
    });
  }

  document.getElementById("dark-toggle").addEventListener("change", function () {
    data.settings.dark = this.checked === true;
    saveData(data);
    applyDarkMode();
  });
}

function applyDarkMode() {
  if (data.settings.dark === true) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// Render lại tab đang hiển thị (dùng sau khi nhập dữ liệu)
function renderAll() {
  var tabs = Object.keys(RENDERERS);
  for (var i = 0; i < tabs.length; i++) {
    var btn = document.querySelector('.tab-btn[data-tab="' + tabs[i] + '"]');
    if (btn && btn.getAttribute("aria-selected") === "true") {
      RENDERERS[tabs[i]]();
      return;
    }
  }
  RENDERERS.today();
}

var RENDERERS = {
  today: renderToday,
  stats: renderStats,
  settings: renderSettings
};

var TAB_IDS = { today: "panel-today", stats: "panel-stats", settings: "panel-settings" };

function switchTab(tab) {
  var tabs = Object.keys(RENDERERS);
  if (tabs.indexOf(tab) === -1) return;

  var addBtn = document.getElementById("btn-add");
  if (addBtn) addBtn.hidden = tab !== "today"; // nút Thêm chỉ hiện ở tab Hôm nay

  // Ẩn tất cả panel, hiện panel đang chọn
  tabs.forEach(function (t) {
    var panel = document.getElementById(TAB_IDS[t]);
    if (t === tab) {
      panel.hidden = false;
    } else {
      panel.hidden = true;
    }
  });

  // Đánh dấu tab đang chọn
  var buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(function (btn) {
    btn.setAttribute("aria-selected", btn.getAttribute("data-tab") === tab ? "true" : "false");
  });

  RENDERERS[tab]();
}

function setHeaderDate() {
  var el = document.getElementById("header-date");
  if (!el) return;
  var names = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  var now = new Date();
  var d = String(now.getDate()).padStart(2, "0");
  var m = String(now.getMonth() + 1).padStart(2, "0");
  el.textContent = names[now.getDay()] + ", " + d + "/" + m + "/" + now.getFullYear();
}

function initApp() {
  setHeaderDate();
  applyDarkMode(); // T5: dark mode nhớ sau khi tải lại

  // Gắn sự kiện chạm/chọn cho 3 nút tab
  var buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  switchTab("today");
}

document.addEventListener("DOMContentLoaded", initApp);
