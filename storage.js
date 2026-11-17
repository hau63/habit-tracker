/* storage.js: lưu trữ dữ liệu trong localStorage (key "habit_tracker_v1")
 * - loadData(): đọc dữ liệu, hợp nhất với cấu trúc mặc định, chịu được dữ liệu trống/hỏng
 * - saveData(data): ghi dữ liệu an toàn (bắt lỗi khi localStorage bị chặn/đầy)
 * - todayStr(): chuỗi ngày hôm nay "YYYY-MM-DD" theo GIỜ ĐỊA PHƯƠNG
 * - uid(): tạo id ngắn ngẫu nhiên
 */

var STORAGE_KEY = "habit_tracker_v1";

function defaultData() {
  return {
    habits: [],
    logs: {},            // { "YYYY-MM-DD": [habitId, ...] }
    settings: { dark: false }
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Dữ liệu đọc ra phải đủ cấu trúc; thiếu gì bổ sung từ mặc định, hỏng toàn bộ thì trả về mặc định.
// T6: lọc thêm entries hỏng (thói quen thiếu id/name, logs không phải mảng chuỗi)
function normalizeData(raw) {
  var d = defaultData();
  if (!isPlainObject(raw)) return d;

  if (Array.isArray(raw.habits)) {
    d.habits = raw.habits.filter(function (h) {
      return h && typeof h === "object" && !Array.isArray(h) &&
        typeof h.id === "string" && h.id &&
        typeof h.name === "string" && h.name;
    });
  }

  if (isPlainObject(raw.logs)) {
    Object.keys(raw.logs).forEach(function (k) {
      var v = raw.logs[k];
      if (Array.isArray(v) && v.every(function (x) { return typeof x === "string"; })) {
        d.logs[k] = v.slice();
      } // sai kiểu -> bỏ qua entry này, không crash khi đọc streak/total
    });
  }

  if (isPlainObject(raw.settings)) {
    d.settings.dark = raw.settings.dark === true;
  }

  return d;
}

function loadData() {
  var raw = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    raw = null; // localStorage bị chặn hoặc hỏng
  }

  if (raw === null || raw === "") return defaultData();

  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return defaultData(); // JSON hỏng -> dữ liệu mặc định
  }

  return normalizeData(parsed);
}

function saveData(data) {
  var safe = normalizeData(data);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return true;
  } catch (e) {
    // localStorage đầy hoặc bị chặn — không ném lỗi ra UI
    return false;
  }
}

// "YYYY-MM-DD" theo giờ địa phương (KHÔNG dùng toISOString)
function todayStr(d) {
  var date = d || new Date();
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

// Id ngắn, đụng độ cực hiếm
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
