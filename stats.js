/* stats.js: Thống kê — % hoàn thành 7 ngày gần nhất, streak dài nhất,
 * tổng lượt tick, lưới lịch tháng tô màu theo % hoàn thành + nút tháng trước/sau. T4.
 * Phụ thuộc: storage.js (loadData/todayStr), habits.js (habitDays, data).
 */

var calYear = null;   // tháng đang hiển thị (giữ nguyên khi chuyển tab)
var calMonth = null;

function pad2(n) { return String(n).padStart(2, "0"); }

// Chuỗi YYYY-MM-DD của n ngày gần nhất (kể cả hôm nay), theo giờ địa phương
function lastNDays(n) {
  var out = [];
  for (var i = n - 1; i >= 0; i--) {
    out.push(todayStr(new Date(Date.now() - i * 86400000)));
  }
  return out;
}

// Số thói quen cần làm vào ngày có thứ wd
function requiredOn(wd) {
  return data.habits.filter(function (h) { return habitDays(h).indexOf(wd) !== -1; }).length;
}

// % hoàn thành 7 ngày gần nhất: tổng tick đúng / tổng số việc cần làm trong 7 ngày
function rateLast7() {
  var sumDone = 0, sumReq = 0;
  lastNDays(7).forEach(function (key) {
    var wd = new Date(key + "T00:00:00").getDay(); // parse cục bộ, không lệch múi giờ
    var req = requiredOn(wd);
    sumReq += req;
    if (!req) return;
    var ids = data.logs[key] || [];
    data.habits.forEach(function (h) {
      if (habitDays(h).indexOf(wd) !== -1 && ids.indexOf(h.id) !== -1) sumDone++;
    });
  });
  return sumReq ? Math.round(100 * sumDone / sumReq) : null; // null = không có việc nào
}

// Streak dài nhất TỪ TRƯỚC ĐẾN NAY của 1 thói quen (đếm qua cả quá khứ)
function longestStreakFor(habit) {
  var keys = Object.keys(data.logs);
  if (!keys.length) return 0;
  keys.sort();

  var d = new Date(keys[0] + "T00:00:00");
  var end = new Date(); end.setHours(0, 0, 0, 0);
  var best = 0, run = 0;

  for (var i = 0; i < 3660 && d <= end; i++) {
    if (habitDays(habit).indexOf(d.getDay()) !== -1) {
      var ids = data.logs[todayStr(d)] || [];
      if (ids.indexOf(habit.id) !== -1) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    d = new Date(d.getTime() + 86400000);
  }
  return best;
}

function longestStreak() {
  var best = 0;
  data.habits.forEach(function (h) {
    var s = longestStreakFor(h);
    if (s > best) best = s;
  });
  return best;
}

// Tổng lượt tick trong toàn bộ logs
function totalTicks() {
  var n = 0;
  Object.keys(data.logs).forEach(function (k) {
    var ids = data.logs[k];
    if (Array.isArray(ids)) n += ids.length;
  });
  return n;
}

// Tỷ lệ hoàn thành của 1 ngày: null = không có việc cần làm, 0..1
function dayRate(key) {
  var wd = new Date(key + "T00:00:00").getDay();
  var req = 0, done = 0;
  var ids = data.logs[key] || [];
  data.habits.forEach(function (h) {
    if (habitDays(h).indexOf(wd) === -1) return;
    req++;
    if (ids.indexOf(h.id) !== -1) done++;
  });
  return req ? done / req : null;
}

function monthGrid(y, m) {
  var names = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
               "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

  var firstWd = new Date(y, m, 1).getDay();      // CN = 0
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var todayK = todayStr();

  var html =
    '<div class="cal-head">' +
      '<button class="cal-nav" type="button" id="cal-prev" aria-label="Tháng trước">‹</button>' +
      '<span class="cal-title">' + names[m] + " " + y + '</span>' +
      '<button class="cal-nav" type="button" id="cal-next" aria-label="Tháng sau">›</button>' +
    '</div>' +
    '<div class="cal-grid" role="grid">';

  ["CN", "T2", "T3", "T4", "T5", "T6", "T7"].forEach(function (l) {
    html += '<span class="cal-wd">' + l + '</span>';
  });

  for (var i = 0; i < firstWd; i++) html += '<span class="cal-cell empty"></span>';

  for (var day = 1; day <= daysInMonth; day++) {
    var key = y + "-" + pad2(m + 1) + "-" + pad2(day);
    var rate = dayRate(key);
    var cls = "cal-cell";
    if (key > todayK) cls += " future";
    else if (rate === null) cls += " none";
    else if (rate >= 1) cls += " full";     // làm đủ -> cam đậm
    else if (rate >= 0.5) cls += " half";   // từ nửa trở lên -> cam nhạt; dưới nửa -> không tô màu
    if (key === todayK) cls += " today";
    html += '<span class="' + cls + '" title="' + key + (rate === null ? "" : " — " + Math.round(rate * 100) + "%") + '">' + day + '</span>';
  }
  html += "</div>";
  return html;
}

function goMonth(delta) {
  var m = calMonth + delta;
  var y = calYear;
  if (m < 0) { m = 11; y--; }
  if (m > 11) { m = 0; y++; }
  calMonth = m; calYear = y;
  renderStatsPanel(document.getElementById("panel-stats"));
}

// ===== Entry point: app.js gọi hàm này =====
function renderStatsPanel(panel) {
  if (!calYear) {
    var now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }

  if (!data.habits.length) {
    panel.innerHTML = '<p class="placeholder">Chưa có thói quen nào — thống kê sẽ hiện ở đây.</p>';
    return;
  }

  var r7 = rateLast7();
  var html =
    '<div class="stat-cards">' +
      '<div class="stat-card"><div class="stat-num">' + (r7 === null ? "—" : r7 + "%") + '</div><div class="stat-lab">Hoàn thành 7 ngày</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + longestStreak() + '</div><div class="stat-lab">Streak dài nhất</div></div>' +
      '<div class="stat-card"><div class="stat-num">' + totalTicks() + '</div><div class="stat-lab">Tổng lượt tick</div></div>' +
    '</div>' +
    monthGrid(calYear, calMonth);

  panel.innerHTML = html;

  document.getElementById("cal-prev").addEventListener("click", function () { goMonth(-1); });
  document.getElementById("cal-next").addEventListener("click", function () { goMonth(1); });
}
