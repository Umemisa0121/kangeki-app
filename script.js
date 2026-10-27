// ===== 保存した予定 =====
// ブラウザに保存した予定を読み込む(なければ空のリスト)
let events = [];
try {
  events = JSON.parse(localStorage.getItem("events")) || [];
} catch (e) {
  events = [];
}

// 予定のリストをブラウザに保存する
function saveEvents() {
  localStorage.setItem("events", JSON.stringify(events));
}

// 年・月・日を "2026-10-06" の形にする(日付の入力欄と同じ形にそろえる)
function toDateString(year, month, date) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(date).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// ===== 抽選の状況 =====
// applied:申込中 / won:当選・入金待ち / paid:入金済み
const STATUS_LABELS = {
  applied: "申込中",
  won: "当選・入金待ち",
  paid: "入金済み",
};

// 状況が保存されていない(前に作った)抽選は「申込中」として扱う
function getStatus(ev) {
  return ev.status || "applied";
}

// カレンダーに表示する色
function displayColor(ev) {
  return ev.color;
}

// ===== カレンダー =====
// いま表示している年と月(最初は今日の年月)
// ※ JavaScriptの月は0始まり(0 = 1月、11 = 12月)
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

const monthTitle = document.getElementById("month-title");
const daysEl = document.getElementById("days");

// 枠線だけのバー(当落・入金)を作る
function makeOutlineBar(ev, className, text) {
  const bar = document.createElement("div");
  bar.className = `event-bar ${className}`;
  bar.style.borderColor = displayColor(ev);
  bar.style.color = displayColor(ev);
  bar.textContent = text;
  bar.addEventListener("click", () => openDetail(ev.id));
  return bar;
}

// カレンダーを描画する関数
function renderCalendar() {
  monthTitle.textContent = `${currentYear}年${currentMonth + 1}月`;
  daysEl.innerHTML = "";

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const lastDate = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 1日の曜日まで、空白のマスを入れる
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "day empty";
    daysEl.appendChild(empty);
  }

  const today = new Date();
  for (let date = 1; date <= lastDate; date++) {
    const day = document.createElement("div");
    day.className = "day";

    // 日付の数字
    const num = document.createElement("span");
    num.className = "day-num";
    num.textContent = date;
    day.appendChild(num);

    // 日曜・土曜の色
    const weekday = (firstDay + date - 1) % 7;
    if (weekday === 0) day.classList.add("sun");
    if (weekday === 6) day.classList.add("sat");

    // 今日の日付
    if (
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth() &&
      date === today.getDate()
    ) {
      day.classList.add("today");
    }

    // この日が期間に入っている予定を探して、色のバーを出す
    const dateStr = toDateString(currentYear, currentMonth, date);
    const dayEvents = events.filter((ev) => ev.start <= dateStr && dateStr <= ev.end);

    dayEvents.forEach((ev) => {
      const bar = document.createElement("div");
      bar.className = "event-bar";
      bar.style.background = displayColor(ev);
      // 期間の初日だけ作品名を表示
      if (dateStr === ev.start) {
        bar.textContent = ev.title;
      }
      // タップしたら詳細画面を開く
      bar.addEventListener("click", () => openDetail(ev.id));
      day.appendChild(bar);
    });

    // 当落発表日に、当落の印を出す(点線の枠)
    events
      .filter((ev) => ev.resultDate === dateStr)
      .forEach((ev) => {
        day.appendChild(makeOutlineBar(ev, "result-bar", `当落 ${ev.title}`));
      });

    // 入金期限の日に、入金の印を出す(実線の枠)
    events
      .filter((ev) => ev.payDeadline === dateStr)
      .forEach((ev) => {
        const paid = getStatus(ev) === "paid";
        const bar = makeOutlineBar(ev, "pay-bar", `${paid ? "✓ " : ""}入金 ${ev.title}`);
        if (paid) bar.classList.add("done"); // 入金済みは薄く表示
        day.appendChild(bar);
      });

    daysEl.appendChild(day);
  }

  // 観劇タブ・抽選タブのリストも最新の状態にする
  renderKangekiList(false);
  renderChusenList(false);
}

// 前月ボタン
document.getElementById("prev-btn").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
});

// 翌月ボタン
document.getElementById("next-btn").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
});

// ===== 記録を追加の画面 =====
const addScreen = document.getElementById("add-screen");
const categoryButtons = document.querySelectorAll(".category-btn");
const chusenForm = document.getElementById("chusen-form");
const kangekiForm = document.getElementById("kangeki-form");
const goodsList = document.getElementById("goods-list");
const goodsTotal = document.getElementById("goods-total");
const addTitle = document.getElementById("add-title");

let selectedCategory = null; // "chusen" か "kangeki"
let editingId = null;        // 編集中の予定の番号(新しく追加するときはnull)

// 追加画面を最初の状態に戻す
function resetAddScreen() {
  categoryButtons.forEach((b) => b.classList.remove("selected"));
  selectedCategory = null;
  editingId = null;
  addTitle.textContent = "記録を追加";
  [chusenForm, kangekiForm].forEach((form) => {
    form.classList.remove("show");
    form.querySelectorAll("input, textarea").forEach((el) => {
      el.value = "";
    });
    // 色の選択も1つ目に戻す
    setSelectedColor(form, form.querySelector(".color-btn").dataset.color);
  });
  goodsList.innerHTML = "";
  updateTotal();
}

// +ボタンで開く
document.getElementById("add-btn").addEventListener("click", () => {
  addScreen.classList.add("open");
});

// ×ボタンで閉じる
document.getElementById("close-btn").addEventListener("click", () => {
  resetAddScreen();
  addScreen.classList.remove("open");
});

// カテゴリを選んだら、対応するフォームだけ表示
categoryButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    categoryButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedCategory = btn.dataset.category;

    chusenForm.classList.toggle("show", selectedCategory === "chusen");
    kangekiForm.classList.toggle("show", selectedCategory === "kangeki");
  });
});

// ===== 色の選択(フォームごとに1つ選べる) =====
// 色のボタンを選択状態にする
function selectColorBtn(btn) {
  btn.closest(".color-list").querySelectorAll(".color-btn").forEach((b) => {
    b.classList.remove("selected");
  });
  btn.classList.add("selected");
}

// よく使う色のボタン
document.querySelectorAll(".color-btn:not(.color-custom)").forEach((btn) => {
  btn.addEventListener("click", () => selectColorBtn(btn));
});

// 🎨ボタンに、選んだ色をセットする
function setCustomColor(label, color) {
  label.dataset.color = color;
  label.style.background = color;
  label.querySelector(".color-picker").value = color;
}

// 🎨ボタンで色を選んだら、その色を選択状態にする
document.querySelectorAll(".color-custom").forEach((label) => {
  label.querySelector(".color-picker").addEventListener("input", (e) => {
    setCustomColor(label, e.target.value);
    selectColorBtn(label);
  });
});

// そのフォームで選ばれている色を取り出す
function getSelectedColor(form) {
  return form.querySelector(".color-btn.selected").dataset.color;
}

// そのフォームで、指定した色を選択状態にする(編集のときに使う)
// よく使う色になければ、🎨ボタンにその色を入れて選択する
function setSelectedColor(form, color) {
  let found = false;
  form.querySelectorAll(".color-btn:not(.color-custom)").forEach((b) => {
    const match = b.dataset.color === color;
    b.classList.toggle("selected", match);
    if (match) found = true;
  });
  const custom = form.querySelector(".color-custom");
  custom.classList.toggle("selected", !found);
  if (found) {
    custom.style.background = ""; // よく使う色なら、🎨ボタンは虹色に戻す
  } else {
    setCustomColor(custom, color);
  }
}

// ===== グッズリスト =====
// グッズの入力行を1行追加する
// (編集のときは、保存してあったグッズ g の中身を入れた状態で追加する)
function addGoodsRow(g) {
  const row = document.createElement("div");
  row.className = "goods-row";
  row.innerHTML = `
    <input type="text" class="goods-name" placeholder="品名">
    <input type="number" class="goods-price" placeholder="0" min="0" inputmode="numeric">
    <input type="number" class="goods-qty" value="1" min="1" inputmode="numeric">
    <button type="button" class="goods-delete" aria-label="この行を削除">×</button>
  `;
  if (g) {
    row.querySelector(".goods-name").value = g.name;
    row.querySelector(".goods-price").value = g.price;
    row.querySelector(".goods-qty").value = g.qty;
  }
  row.querySelector(".goods-delete").addEventListener("click", () => {
    row.remove();
    updateTotal();
  });
  goodsList.appendChild(row);
}

// 全部の行の「単価 × 数量」を足して、合計を表示する
function updateTotal() {
  let total = 0;
  goodsList.querySelectorAll(".goods-row").forEach((row) => {
    const price = Math.max(0, Number(row.querySelector(".goods-price").value) || 0);
    const qty = Math.max(0, Number(row.querySelector(".goods-qty").value) || 0);
    total += price * qty;
  });
  goodsTotal.textContent = `¥${total.toLocaleString()}`;
}

document.getElementById("add-goods-btn").addEventListener("click", () => addGoodsRow());

// グッズリストのどの欄に入力しても、合計を計算し直す
goodsList.addEventListener("input", updateTotal);

// ===== 保存の共通処理 =====
// 新しく追加するときはリストに足し、編集のときは同じ番号の予定を上書きする
// (編集では、抽選の状況など入力欄にない情報はそのまま残す)
function saveEvent(data) {
  if (editingId) {
    const index = events.findIndex((e) => e.id === editingId);
    events[index] = { ...events[index], ...data, id: editingId };
  } else {
    events.push({ ...data, id: Date.now() });
  }
}

// 保存して、画面を閉じて、その日の月のカレンダーを表示する
function finishSave(dateStr) {
  saveEvents();
  resetAddScreen();
  addScreen.classList.remove("open");

  const [y, m] = dateStr.split("-");
  currentYear = Number(y);
  currentMonth = Number(m) - 1;
  renderCalendar();
}

// ===== 抽選期間の保存 =====
document.getElementById("save-btn").addEventListener("click", () => {
  const title = document.getElementById("chusen-title").value.trim();
  const start = document.getElementById("chusen-start").value;
  const end = document.getElementById("chusen-end").value;
  const resultDate = document.getElementById("result-date").value;

  if (!title) {
    alert("作品名を入力してください");
    return;
  }
  if (!start || !end) {
    alert("抽選開始日と抽選締切日を選んでください");
    return;
  }
  if (end < start) {
    alert("抽選締切日は、抽選開始日と同じか後の日付にしてください");
    return;
  }
  if (resultDate && resultDate < end) {
    alert("当落発表日は、抽選締切日と同じか後の日付にしてください");
    return;
  }

  const data = {
    category: "chusen",
    title: title,
    start: start,
    end: end,
    resultDate: resultDate,
    payDeadline: document.getElementById("pay-deadline").value,
    payAmount: Number(document.getElementById("pay-amount").value) || 0,
    color: getSelectedColor(chusenForm),
    memo: document.getElementById("chusen-memo").value,
  };
  // 新しく登録する抽選は「申込中」から始まる
  if (!editingId) data.status = "applied";

  saveEvent(data);
  finishSave(start);
});

// ===== 観劇の保存 =====
document.getElementById("kangeki-save-btn").addEventListener("click", () => {
  const title = document.getElementById("kangeki-title").value.trim();
  const date = document.getElementById("kangeki-date").value;

  if (!title) {
    alert("作品名を入力してください");
    return;
  }
  if (!date) {
    alert("観劇日を選んでください");
    return;
  }

  // グッズの行をデータにまとめる(品名が空の行は保存しない)
  const goods = [];
  goodsList.querySelectorAll(".goods-row").forEach((row) => {
    const name = row.querySelector(".goods-name").value.trim();
    if (!name) return;
    goods.push({
      name: name,
      price: Math.max(0, Number(row.querySelector(".goods-price").value) || 0),
      qty: Math.max(0, Number(row.querySelector(".goods-qty").value) || 0),
    });
  });

  const data = {
    category: "kangeki",
    title: title,
    start: date,      // 観劇は1日だけなので、開始日と終了日を同じにする
    end: date,
    theater: document.getElementById("kangeki-theater").value.trim(),
    openTime: document.getElementById("open-time").value,
    startTime: document.getElementById("start-time").value,
    goods: goods,
    color: getSelectedColor(kangekiForm),
    memo: document.getElementById("kangeki-memo").value,
  };
  saveEvent(data);
  finishSave(date);
});

// ===== 予定の詳細画面 =====
const detailScreen = document.getElementById("detail-screen");
const detailBody = document.getElementById("detail-body");
const statusActions = document.getElementById("status-actions");
let openedEventId = null; // いま開いている予定の番号

// 入力された文字をそのまま安全に表示するための変換
// (メモに「<」などが入っていても画面が崩れないようにする)
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// "2026-10-13" → "2026年10月13日"
function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

// 項目を1つ表示する(中身が空なら表示しない)
function detailRow(label, value) {
  if (!value) return "";
  return `
    <div class="detail-row">
      <span class="field-label">${label}</span>
      <p class="detail-value">${escapeHtml(value)}</p>
    </div>`;
}

// 予定の番号を受け取って、詳細画面を開く
function openDetail(id) {
  const ev = events.find((e) => e.id === id);
  if (!ev) return;
  openedEventId = id;

  // 作品名(左の線を予定の色にする)
  let html = `<div class="detail-title" style="border-left-color:${displayColor(ev)}">${escapeHtml(ev.title)}</div>`;

  if (ev.category === "chusen") {
    html += detailRow("状況", STATUS_LABELS[getStatus(ev)]);
    html += detailRow("抽選期間", `${formatDate(ev.start)} 〜 ${formatDate(ev.end)}`);
    html += detailRow("当落発表日", formatDate(ev.resultDate));
    html += detailRow("入金期限", formatDate(ev.payDeadline));
    if (ev.payAmount) {
      html += detailRow("入金金額", `¥${ev.payAmount.toLocaleString()}`);
    }
  } else {
    html += detailRow("カテゴリ", "観劇");
    html += detailRow("観劇日", formatDate(ev.start));
    html += detailRow("劇場", ev.theater);
    html += detailRow("開場時間", ev.openTime);
    html += detailRow("開演時間", ev.startTime);

    // グッズの一覧と合計
    if (ev.goods && ev.goods.length > 0) {
      let total = 0;
      let rows = "";
      ev.goods.forEach((g) => {
        const subtotal = g.price * g.qty;
        total += subtotal;
        rows += `
          <div class="detail-goods-row">
            <span>${escapeHtml(g.name)}</span>
            <span>¥${g.price.toLocaleString()} × ${g.qty}</span>
            <span>¥${subtotal.toLocaleString()}</span>
          </div>`;
      });
      html += `
        <div class="detail-row">
          <span class="field-label">グッズ</span>
          ${rows}
          <p class="goods-total">合計 <span>¥${total.toLocaleString()}</span></p>
        </div>`;
    }
  }

  html += detailRow("メモ", ev.memo);

  detailBody.innerHTML = html;
  renderStatusActions(ev);
  detailScreen.classList.add("open");
}

// ===== 当落発表までの日数 =====
// 今日の日付を "2026-10-20" の形で返す
function todayString() {
  const t = new Date();
  return toDateString(t.getFullYear(), t.getMonth(), t.getDate());
}

// "2026-10-31" まであと何日か
function daysUntil(str) {
  const [y, m, d] = str.split("-").map(Number);
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

// まだ当落発表の前かどうか
// (当落発表日があればその日の前まで、なければ抽選締切日まで)
function isBeforeResult(ev) {
  if (ev.resultDate) return todayString() < ev.resultDate;
  return todayString() <= ev.end;
}

// 当落発表の前に出すメッセージ
function waitMessage(ev) {
  if (ev.resultDate) {
    const [, m, d] = ev.resultDate.split("-").map(Number);
    return `⏳ 当落発表まで あと<strong>${daysUntil(ev.resultDate)}日</strong>(${m}/${d})`;
  }
  const [, m, d] = ev.end.split("-").map(Number);
  return `📝 抽選受付中(${m}/${d}まで)`;
}

// ===== 抽選の状況に合わせたボタン =====
// チケットの形のボタン(観劇日の詳細を入力する)
function ticketButton(id, title, sub) {
  return `
    <button class="ticket-btn" id="${id}">
      <span class="ticket-main">
        <span class="ticket-title">🎭 ${title}</span>
        <span class="ticket-sub">${sub}</span>
      </span>
      <span class="ticket-stub">›</span>
    </button>`;
}

function renderStatusActions(ev) {
  statusActions.innerHTML = "";
  if (ev.category !== "chusen") return; // 観劇の予定にはボタンなし

  const status = getStatus(ev);

  if (status === "applied") {
    if (isBeforeResult(ev)) {
      // 当落発表の前:まだ入力できないので、あと何日かを表示する
      statusActions.innerHTML = `<div class="wait-box">${waitMessage(ev)}</div>`;
    } else {
      // 当落発表の日から:当選したら、ここから観劇日の詳細を入力する
      statusActions.innerHTML = ticketButton("detail-input-btn", "観劇日の詳細を入力する", "当選したらここから");
      document.getElementById("detail-input-btn").addEventListener("click", () => openWinScreen(ev));
    }
    return;
  }

  // 当選後:入金のボタンと、複数公演当たったとき用の「別の観劇日も追加」
  let html = "";
  if (status === "won") {
    html += `<button class="paid-btn" id="paid-btn">✓ 入金した</button>`;
  }
  html += `<button class="text-link" id="more-btn">別の観劇日も追加する</button>`;
  statusActions.innerHTML = html;

  if (status === "won") {
    document.getElementById("paid-btn").addEventListener("click", () => {
      ev.status = "paid";
      saveEvents();
      renderCalendar();
      openDetail(ev.id);
    });
  }
  document.getElementById("more-btn").addEventListener("click", () => openWinScreen(ev));
}

// ===== 観劇の詳細を入力する画面 =====
const winScreen = document.getElementById("win-screen");
let winEventId = null;

function openWinScreen(ev) {
  winEventId = ev.id;
  winScreen.querySelectorAll("input").forEach((el) => {
    el.value = "";
  });
  // 作品名と、先に分かっていた入金の情報は入れておく
  document.getElementById("win-title").value = ev.title;
  document.getElementById("win-pay-deadline").value = ev.payDeadline || "";
  document.getElementById("win-pay-amount").value = ev.payAmount || "";

  detailScreen.classList.remove("open");
  winScreen.classList.add("open");
}

document.getElementById("win-close-btn").addEventListener("click", () => {
  winScreen.classList.remove("open");
  openDetail(winEventId); // 詳細画面に戻る
});

document.getElementById("win-save-btn").addEventListener("click", () => {
  const ev = events.find((e) => e.id === winEventId);
  if (!ev) return;

  const date = document.getElementById("win-date").value;
  if (!date) {
    alert("観劇日を選んでください");
    return;
  }

  // 観劇の予定を新しく作る(作品名と色は抽選から引き継ぐ)
  events.push({
    id: Date.now(),
    category: "kangeki",
    title: ev.title,
    start: date,
    end: date,
    theater: document.getElementById("win-theater").value.trim(),
    openTime: document.getElementById("win-open-time").value,
    startTime: document.getElementById("win-start-time").value,
    goods: [],
    color: ev.color,
    memo: "",
    fromChusenId: ev.id,
  });

  // 抽選の方は「当選・入金待ち」にして、入金の情報を更新する
  if (getStatus(ev) === "applied") ev.status = "won";
  ev.payDeadline = document.getElementById("win-pay-deadline").value;
  ev.payAmount = Number(document.getElementById("win-pay-amount").value) || 0;
  saveEvents();

  // 画面を閉じて、観劇日の月のカレンダーを表示する
  winScreen.classList.remove("open");
  const [y, m] = date.split("-");
  currentYear = Number(y);
  currentMonth = Number(m) - 1;
  renderCalendar();
});

// ===== 詳細画面のボタン =====
// ×で詳細画面を閉じる
document.getElementById("detail-close-btn").addEventListener("click", () => {
  detailScreen.classList.remove("open");
});

// 削除ボタン:確認してから、その予定をリストから消す
document.getElementById("delete-btn").addEventListener("click", () => {
  if (!confirm("この予定を削除しますか?")) return;

  events = events.filter((e) => e.id !== openedEventId); // その番号以外を残す
  saveEvents();
  detailScreen.classList.remove("open");
  renderCalendar();
});

// 編集ボタン:詳細画面を閉じて、入力済みの状態で追加画面を開く
document.getElementById("edit-btn").addEventListener("click", () => {
  const ev = events.find((e) => e.id === openedEventId);
  if (!ev) return;

  resetAddScreen();
  editingId = ev.id;
  addTitle.textContent = "予定を編集";

  // カテゴリを選んだ状態にして、そのフォームを表示
  document.querySelector(`.category-btn[data-category="${ev.category}"]`).click();

  if (ev.category === "chusen") {
    document.getElementById("chusen-title").value = ev.title;
    document.getElementById("chusen-start").value = ev.start;
    document.getElementById("chusen-end").value = ev.end;
    document.getElementById("result-date").value = ev.resultDate || "";
    document.getElementById("pay-deadline").value = ev.payDeadline || "";
    document.getElementById("pay-amount").value = ev.payAmount || "";
    document.getElementById("chusen-memo").value = ev.memo || "";
    setSelectedColor(chusenForm, ev.color);
  } else {
    document.getElementById("kangeki-title").value = ev.title;
    document.getElementById("kangeki-date").value = ev.start;
    document.getElementById("kangeki-theater").value = ev.theater || "";
    document.getElementById("open-time").value = ev.openTime || "";
    document.getElementById("start-time").value = ev.startTime || "";
    document.getElementById("kangeki-memo").value = ev.memo || "";
    (ev.goods || []).forEach((g) => addGoodsRow(g));
    updateTotal();
    setSelectedColor(kangekiForm, ev.color);
  }

  detailScreen.classList.remove("open");
  addScreen.classList.add("open");
});

// ===== 下のナビ(ページの切り替え) =====
const kangekiPage = document.getElementById("kangeki-page");
const kangekiList = document.getElementById("kangeki-list");
const listMonth = document.getElementById("list-month");
const filterYear = document.getElementById("filter-year");
const filterTheater = document.getElementById("filter-theater");
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ホーム・観劇タブ・抽選タブを切り替える
function showPage(page) {
  const isHome = page === "home";
  document.querySelector(".top-tabs").style.display = isHome ? "" : "none";
  document.querySelector(".calendar").style.display = isHome ? "" : "none";
  kangekiPage.classList.toggle("show", page === "kangeki");
  chusenPage.classList.toggle("show", page === "chusen");

  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });

  if (page === "kangeki") {
    renderKangekiList(true); // これからの観劇の位置までスクロール
  } else if (page === "chusen") {
    renderChusenList(true);  // まだ終わっていない抽選の位置までスクロール
  } else {
    window.scrollTo(0, 0);
  }
}

document.querySelectorAll(".nav-item").forEach((btn) => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});

// ===== 観劇タブ =====
// 絞り込みの選択肢を作り直す(選んでいたものは残す)
function setOptions(select, firstLabel, values) {
  const current = select.value;
  select.innerHTML =
    `<option value="">${firstLabel}</option>` +
    values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  select.value = values.includes(current) ? current : "";
}

// 観劇のリストを作る(scrollToNext が true なら、これからの観劇の位置までスクロール)
function renderKangekiList(scrollToNext) {
  // 観劇の予定だけを、日付の古い順に並べる
  const all = events
    .filter((e) => e.category === "kangeki")
    .sort((a, b) => (a.start + (a.startTime || "")).localeCompare(b.start + (b.startTime || "")));

  // 絞り込みの選択肢(年は新しい順、劇場は入力したものから自動で作る)
  const years = [...new Set(all.map((e) => e.start.slice(0, 4)))].sort().reverse();
  const theaters = [...new Set(all.map((e) => e.theater).filter(Boolean))].sort();
  setOptions(filterYear, "すべて", years);
  setOptions(filterTheater, "すべて", theaters);
  updateFilterButton();

  // 選んだ年・劇場で絞り込む
  const list = all.filter(
    (e) =>
      (!filterYear.value || e.start.startsWith(filterYear.value)) &&
      (!filterTheater.value || e.theater === filterTheater.value)
  );

  const today = todayString();
  let html = "";
  let lastMonth = "";
  let badgeDone = false;

  list.forEach((ev) => {
    const [y, m, d] = ev.start.split("-").map(Number);
    const monthLabel = `${y}年 ${m}月`;

    // 月が変わるところに見出しを入れる
    if (monthLabel !== lastMonth) {
      html += `<p class="k-month-label">${monthLabel}</p>`;
      lastMonth = monthLabel;
    }

    const past = ev.start < today; // 終わった観劇(今日の公演はまだ「これから」)

    // 一番近い観劇に「あと◯日」を付ける
    let badge = "";
    if (!past && !badgeDone) {
      const n = daysUntil(ev.start);
      badge = `<span class="k-badge">${n === 0 ? "今日" : `あと${n}日`}</span>`;
      badgeDone = true;
    }

    const times = [ev.openTime && `開場 ${ev.openTime}`, ev.startTime && `開演 ${ev.startTime}`]
      .filter(Boolean)
      .join(" / ");

    html += `
      <div class="k-card${past ? " past" : ""}" data-id="${ev.id}" data-month="${monthLabel}">
        <div class="k-date" style="background:${ev.color}">
          <span class="k-m">${m}月</span>
          <span class="k-d">${d}</span>
          <span class="k-w">(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})</span>
        </div>
        <div class="k-info">
          ${badge}
          <p class="k-title">${escapeHtml(ev.title)}</p>
          ${ev.theater ? `<p class="k-sub">📍 ${escapeHtml(ev.theater)}</p>` : ""}
          ${times ? `<p class="k-sub">${times}</p>` : ""}
        </div>
      </div>`;
  });

  if (list.length === 0) {
    html = `<p class="k-empty">観劇の予定はまだありません</p>`;
  }
  kangekiList.innerHTML = html;
  kangekiList.style.paddingBottom = "";

  // カードをタップしたら詳細画面を開く(終わった観劇も見られる)
  kangekiList.querySelectorAll(".k-card").forEach((card) => {
    card.addEventListener("click", () => openDetail(Number(card.dataset.id)));
  });

  // これからの観劇の位置までスクロール(上にスクロールすると終わった観劇)
  if (scrollToNext && kangekiPage.classList.contains("show")) {
    const headerHeight = document.querySelector(".list-header").offsetHeight;
    const next = kangekiList.querySelector(".k-card:not(.past)");
    if (next) {
      const prev = next.previousElementSibling;
      const target = prev && prev.classList.contains("k-month-label") ? prev : next;
      // 下に余白を足して、これからの観劇を画面の一番上まで持ってこられるようにする
      const below = kangekiList.getBoundingClientRect().bottom - target.getBoundingClientRect().top;
      const need = window.innerHeight - headerHeight - below - 90;
      if (need > 0) kangekiList.style.paddingBottom = `${need}px`;
      window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - headerHeight);
    } else {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }
  updateListMonth();
}

// 左上の「◯年 ◯月」を、画面の一番上に見えているカードの月にする
function updateListMonth() {
  const headerBottom = document.querySelector(".list-header").getBoundingClientRect().bottom;
  let label = "";
  for (const card of kangekiList.querySelectorAll(".k-card")) {
    if (card.getBoundingClientRect().bottom > headerBottom) {
      label = card.dataset.month;
      break;
    }
  }
  if (!label) {
    const t = new Date();
    label = `${t.getFullYear()}年 ${t.getMonth() + 1}月`;
  }
  listMonth.textContent = label;
}

window.addEventListener("scroll", () => {
  if (kangekiPage.classList.contains("show")) updateListMonth();
});

// 年・劇場を選び直したら、リストを作り直す
filterYear.addEventListener("change", () => renderKangekiList(true));
filterTheater.addEventListener("change", () => renderKangekiList(true));

// ===== 条件を絞る =====
const filterBtn = document.getElementById("filter-btn");
const filterPanel = document.getElementById("filter-panel");

// 「条件を絞る」で、年・劇場の選択欄を開いたり閉じたりする
filterBtn.addEventListener("click", () => {
  filterPanel.classList.toggle("open");
});

// 条件をリセット
document.getElementById("filter-reset").addEventListener("click", () => {
  filterYear.value = "";
  filterTheater.value = "";
  renderKangekiList(true);
});

// 絞り込み中なら、ボタンに件数を出して色を付ける
function updateFilterButton() {
  const count = [filterYear.value, filterTheater.value].filter(Boolean).length;
  filterBtn.textContent = count ? `🔍 条件を絞る(${count})` : "🔍 条件を絞る";
  filterBtn.classList.toggle("active", count > 0);
}

// ===== 抽選タブ =====
const chusenPage = document.getElementById("chusen-page");
const chusenList = document.getElementById("chusen-list");
const chusenListMonth = document.getElementById("chusen-list-month");
const chusenFilterYear = document.getElementById("chusen-filter-year");
const chusenFilterStatus = document.getElementById("chusen-filter-status");
const chusenFilterBtn = document.getElementById("chusen-filter-btn");
const chusenFilterPanel = document.getElementById("chusen-filter-panel");

// カードの右上に出す状況の札
const STATUS_CHIPS = {
  applied: "申込中",
  won: "入金待ち",
  paid: "入金済み",
};

// "2026-10-27" → "10/27"
function shortDate(str) {
  const [, m, d] = str.split("-").map(Number);
  return `${m}/${d}`;
}

// もう終わった抽選かどうか
// (入金済み、または当落発表日を過ぎても観劇日の詳細を入力していない)
function isChusenDone(ev) {
  const status = getStatus(ev);
  if (status === "paid") return true;
  if (status === "applied") return todayString() > (ev.resultDate || ev.end);
  return false;
}

// カードの一番下に出す「次にやること」
function chusenNextAction(ev) {
  const status = getStatus(ev);
  const today = todayString();

  if (status === "paid") return "✓ 入金済み";
  if (status === "won") {
    if (!ev.payDeadline) return "💴 入金待ち";
    const n = daysUntil(ev.payDeadline);
    if (n < 0) return `💴 入金期限 ${shortDate(ev.payDeadline)}(期限を過ぎています)`;
    return `💴 入金期限 ${shortDate(ev.payDeadline)}(${n === 0 ? "今日まで" : `あと${n}日`})`;
  }
  if (today <= ev.end) {
    const n = daysUntil(ev.end);
    return n === 0 ? "📝 今日が締切!" : `📝 締切まであと${n}日`;
  }
  if (ev.resultDate && today < ev.resultDate) return `⏳ 当落まであと${daysUntil(ev.resultDate)}日`;
  if (ev.resultDate && today === ev.resultDate) return "🎉 今日は当落発表!";
  return "当落発表済み";
}

// 抽選のリストを作る(scrollToNext が true なら、まだ終わっていない抽選の位置までスクロール)
function renderChusenList(scrollToNext) {
  // 抽選の予定だけを、締切日の古い順に並べる
  const all = events
    .filter((e) => e.category === "chusen")
    .sort((a, b) => a.end.localeCompare(b.end));

  // 絞り込みの選択肢(年は締切日の年から自動で作る)
  const years = [...new Set(all.map((e) => e.end.slice(0, 4)))].sort().reverse();
  setOptions(chusenFilterYear, "すべて", years);
  updateChusenFilterButton();

  // 選んだ年・状況で絞り込む
  const list = all.filter(
    (e) =>
      (!chusenFilterYear.value || e.end.startsWith(chusenFilterYear.value)) &&
      (!chusenFilterStatus.value || getStatus(e) === chusenFilterStatus.value)
  );

  let html = "";
  let lastMonth = "";

  list.forEach((ev) => {
    const [y, m, d] = ev.end.split("-").map(Number);
    const monthLabel = `${y}年 ${m}月`;

    // 月が変わるところに見出しを入れる
    if (monthLabel !== lastMonth) {
      html += `<p class="k-month-label">${monthLabel}</p>`;
      lastMonth = monthLabel;
    }

    const status = getStatus(ev);
    const done = isChusenDone(ev);

    html += `
      <div class="k-card c-card${done ? " past" : ""}" data-id="${ev.id}" data-month="${monthLabel}">
        <div class="c-date" style="border-color:${ev.color}; color:${ev.color}">
          <span class="c-label">${m}月 締切</span>
          <span class="k-d">${d}</span>
          <span class="k-w">(${WEEKDAYS[new Date(y, m - 1, d).getDay()]})</span>
        </div>
        <div class="k-info">
          <span class="c-status c-status-${status}">${STATUS_CHIPS[status]}</span>
          <p class="k-title">${escapeHtml(ev.title)}</p>
          <p class="k-sub">受付 ${shortDate(ev.start)}〜${shortDate(ev.end)}</p>
          <p class="c-next">${chusenNextAction(ev)}</p>
        </div>
      </div>`;
  });

  if (list.length === 0) {
    html = `<p class="k-empty">抽選の予定はまだありません</p>`;
  }
  chusenList.innerHTML = html;
  chusenList.style.paddingBottom = "";

  // カードをタップしたら詳細画面を開く(終わった抽選も見られる)
  chusenList.querySelectorAll(".k-card").forEach((card) => {
    card.addEventListener("click", () => openDetail(Number(card.dataset.id)));
  });

  // まだ終わっていない抽選の位置までスクロール(上にスクロールすると終わった抽選)
  if (scrollToNext && chusenPage.classList.contains("show")) {
    const headerHeight = chusenPage.querySelector(".list-header").offsetHeight;
    const next = chusenList.querySelector(".k-card:not(.past)");
    if (next) {
      const prev = next.previousElementSibling;
      const target = prev && prev.classList.contains("k-month-label") ? prev : next;
      const below = chusenList.getBoundingClientRect().bottom - target.getBoundingClientRect().top;
      const need = window.innerHeight - headerHeight - below - 90;
      if (need > 0) chusenList.style.paddingBottom = `${need}px`;
      window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - headerHeight);
    } else {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }
  updateChusenListMonth();
}

// 左上の「◯年 ◯月」を、画面の一番上に見えているカードの月にする
function updateChusenListMonth() {
  const headerBottom = chusenPage.querySelector(".list-header").getBoundingClientRect().bottom;
  let label = "";
  for (const card of chusenList.querySelectorAll(".k-card")) {
    if (card.getBoundingClientRect().bottom > headerBottom) {
      label = card.dataset.month;
      break;
    }
  }
  if (!label) {
    const t = new Date();
    label = `${t.getFullYear()}年 ${t.getMonth() + 1}月`;
  }
  chusenListMonth.textContent = label;
}

window.addEventListener("scroll", () => {
  if (chusenPage.classList.contains("show")) updateChusenListMonth();
});

// 条件を絞る(開く・閉じる、選び直し、リセット)
chusenFilterBtn.addEventListener("click", () => {
  chusenFilterPanel.classList.toggle("open");
});
chusenFilterYear.addEventListener("change", () => renderChusenList(true));
chusenFilterStatus.addEventListener("change", () => renderChusenList(true));
document.getElementById("chusen-filter-reset").addEventListener("click", () => {
  chusenFilterYear.value = "";
  chusenFilterStatus.value = "";
  renderChusenList(true);
});

// 絞り込み中なら、ボタンに件数を出して色を付ける
function updateChusenFilterButton() {
  const count = [chusenFilterYear.value, chusenFilterStatus.value].filter(Boolean).length;
  chusenFilterBtn.textContent = count ? `🔍 条件を絞る(${count})` : "🔍 条件を絞る";
  chusenFilterBtn.classList.toggle("active", count > 0);
}

// ===== 時間を選ぶ小さな窓 =====
const tsBg = document.getElementById("time-sheet-bg");
const tsSheet = document.getElementById("time-sheet");
const tsHour = document.getElementById("ts-hour");
const tsMinute = document.getElementById("ts-minute");

const ITEM_HEIGHT = 36; // 数字1つ分の高さ(CSSの .ts-item と同じ)
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")); // 00〜23
let tsTarget = null;        // いま時間を入れている欄
let tsOriginal = "";        // 窓を開いたときの時間(キャンセルで戻す用)
let tsWheelTouched = false; // スライドを指(マウス)で動かしたかどうか

// 列に数字を並べる
function fillColumn(col, values) {
  col.innerHTML = values.map((v) => `<div class="ts-item">${v}</div>`).join("");
}

// 列の真ん中に来ている数字を取り出す
function columnValue(col) {
  const items = col.querySelectorAll(".ts-item");
  const i = Math.min(items.length - 1, Math.max(0, Math.round(col.scrollTop / ITEM_HEIGHT)));
  return items[i].textContent;
}

// 真ん中の数字を太字にする
function markSelected(col) {
  const i = Math.round(col.scrollTop / ITEM_HEIGHT);
  col.querySelectorAll(".ts-item").forEach((el, j) => el.classList.toggle("selected", j === i));
}

// 指定した数字が真ん中に来るまでスクロールする(なければ何もしない)
function scrollColumnTo(col, value) {
  const i = [...col.children].findIndex((el) => el.textContent === value);
  if (i < 0) return;
  col.scrollTop = i * ITEM_HEIGHT;
  markSelected(col);
}

[tsHour, tsMinute].forEach((col) => {
  // スライドを触ったことを覚えておく
  ["pointerdown", "wheel", "touchstart"].forEach((type) => {
    col.addEventListener(type, () => { tsWheelTouched = true; }, { passive: true });
  });
  // スライドしたら、時間の欄にもすぐ反映する
  col.addEventListener("scroll", () => {
    markSelected(col);
    if (tsTarget && tsWheelTouched) {
      tsTarget.value = `${columnValue(tsHour)}:${columnValue(tsMinute)}`;
    }
  });
  // マウスのホイール・トラックパッドは、1回で1つずつだけ動かす
  let lastWheel = 0;
  col.addEventListener("wheel", (e) => {
    e.preventDefault(); // 勢いよく飛んでいかないようにする
    const now = Date.now();
    if (now - lastWheel < 150) return; // 速く回しても、0.15秒に1つまで
    lastWheel = now;
    const i = Math.round(col.scrollTop / ITEM_HEIGHT) + (e.deltaY > 0 ? 1 : -1);
    col.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" });
  }, { passive: false });
  // 数字をタップしたら、その数字まで動かす
  col.addEventListener("click", (e) => {
    const item = e.target.closest(".ts-item");
    if (!item) return;
    col.scrollTo({ top: [...col.children].indexOf(item) * ITEM_HEIGHT, behavior: "smooth" });
  });
});

// 欄に打った時間に合わせて、スライドも動かす
function syncWheelFromInput() {
  const time = normalizeTime(tsTarget.value);
  if (!/^\d{2}:\d{2}$/.test(time)) return;
  const [h, m] = time.split(":");
  scrollColumnTo(tsHour, h);
  scrollColumnTo(tsMinute, m);
}

// 小さな窓を、時間の欄のすぐ下に出す(下に入りきらないときは上に出す)
function positionSheet() {
  if (!tsTarget) return;
  const r = tsTarget.getBoundingClientRect();
  const w = tsSheet.offsetWidth;
  const h = tsSheet.offsetHeight;
  let left = Math.min(r.left, window.innerWidth - w - 12);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 6);
  tsSheet.style.left = `${Math.max(12, left)}px`;
  tsSheet.style.top = `${top}px`;
}

// 時間の欄を押したら、窓を開く
function openTimePicker(input) {
  if (tsTarget === input) return;
  tsTarget = input;
  tsOriginal = input.value;
  tsWheelTouched = false;

  const step = Number(input.dataset.step); // 開場は15分、開演は30分きざみ
  const minutes = [];
  for (let m = 0; m < 60; m += step) minutes.push(String(m).padStart(2, "0"));
  fillColumn(tsHour, HOURS);
  fillColumn(tsMinute, minutes);

  tsBg.classList.add("open");
  positionSheet();

  // 入っている時間(なければ初期の時間)の位置から始める
  const [h, m] = (input.value || input.dataset.default).split(":");
  scrollColumnTo(tsHour, h);
  scrollColumnTo(tsMinute, m);
}

// 窓を閉じる(apply が true なら時間を決定、false なら元に戻す)
function closeTimePicker(apply) {
  if (!tsTarget) return;
  if (apply) {
    if (tsTarget.value) tsTarget.value = normalizeTime(tsTarget.value);
  } else {
    tsTarget.value = tsOriginal;
  }
  tsBg.classList.remove("open");
  tsTarget.blur();
  tsTarget = null;
}

document.querySelectorAll(".time-input").forEach((el) => {
  // スマホではキーボードを出さず、スライドだけで選ぶ(パソコンは今まで通り打てる)
  if (window.matchMedia("(pointer: coarse)").matches) el.inputMode = "none";

  el.addEventListener("focus", () => openTimePicker(el));
  // 手で打ったら、スライドもその時間に動かす
  el.addEventListener("input", () => {
    tsWheelTouched = false;
    syncWheelFromInput();
  });
  // Enterキーで決定
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") closeTimePicker(true);
  });
});

document.getElementById("ts-ok").addEventListener("click", () => closeTimePicker(true));
document.getElementById("ts-cancel").addEventListener("click", () => closeTimePicker(false));

// 窓と時間の欄以外を押したら、時間を決定して閉じる
document.addEventListener("pointerdown", (e) => {
  if (!tsTarget) return;
  if (tsSheet.contains(e.target) || e.target === tsTarget) return;
  closeTimePicker(true);
});

// 画面をスクロールしても、窓が欄の下についていくようにする
document.addEventListener("scroll", positionSheet, true);

// 手打ちした時間を「13:00」の形にそろえる(全角や「1300」「13時」でもOK)
function normalizeTime(text) {
  const t = text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角数字→半角
    .replace(/[:：時]/g, ":")
    .replace(/[\s分]/g, "");
  let match = t.match(/^(\d{1,2}):?(\d{2})?$/);
  if (/^\d{3}$/.test(t)) match = [t, t.slice(0, 1), t.slice(1)]; // 「930」→ 9:30
  if (!match) return text;
  const h = Number(match[1]);
  const m = Number(match[2] || 0);
  if (h > 23 || m > 59) return text;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ===== 最初に1回描画する =====
renderCalendar();

