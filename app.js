import { loadQuestions } from "./question-store.js";

const STORAGE_KEY = "seiho-study-history-v1";
const DAILY_GOAL = 20;

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const dataDialog = document.querySelector("#dataDialog");
const subjectScope = document.querySelector("#subjectScope");

let questions = [];
let history = loadHistory();
let route = "dashboard";
let listFilter = "all";
let session = null;
let activeSubject = localStorage.getItem("seiho-study-subject") || "all";

function scopedQuestions() {
  return activeSubject === "all" ? questions : questions.filter((question) => question.subject === activeSubject);
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function blankRecord() {
  return {
    answerCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    lastAnsweredAt: null,
    consecutiveCorrect: 0,
    status: "未学習",
    bookmarked: false,
    attempts: [],
  };
}

function recordFor(id) {
  return history[id] || blankRecord();
}

function todayKey(date = new Date()) {
  return date.toLocaleDateString("sv-SE");
}

function calculateStats(source = scopedQuestions()) {
  const records = source.map((q) => recordFor(q.id));
  const answered = records.filter((r) => r.answerCount > 0).length;
  const mastered = records.filter((r) => r.status === "習得済み").length;
  const review = records.filter((r) => r.status === "復習待ち" || r.status === "苦手").length;
  const totalAnswers = records.reduce((sum, r) => sum + r.answerCount, 0);
  const correct = records.reduce((sum, r) => sum + r.correctCount, 0);
  const today = records.reduce((sum, r) => sum + r.attempts.filter((a) => a.day === todayKey() || a.at.startsWith(todayKey())).length, 0);
  return {
    answered,
    unlearned: source.length - answered,
    mastered,
    review,
    totalAnswers,
    today,
    accuracy: totalAnswers ? Math.round((correct / totalAnswers) * 100) : 0,
    progress: source.length ? Math.round((mastered / source.length) * 100) : 0,
  };
}

function categoryStats() {
  const source = scopedQuestions();
  return [...new Set(source.map((q) => q.category))].map((category) => {
    const items = source.filter((q) => q.category === category);
    const stats = calculateStats(items);
    return { category, items, ...stats };
  });
}

function statusClass(status) {
  if (status === "習得済み") return "mastered";
  if (status === "復習待ち") return "review";
  if (status === "苦手") return "weak";
  return "";
}

function escapeHTML(value = "") {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function setRoute(next, options = {}) {
  route = next;
  document.body.classList.toggle("quiz-mode", next === "quiz");
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === (next === "quiz" ? "practice" : next));
  });
  if (next === "dashboard") renderDashboard();
  if (next === "practice") renderModes();
  if (next === "questions") renderQuestionList(options.category);
  if (next === "categories") renderCategories();
  if (next === "quiz") renderQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderDashboard() {
  const source = scopedQuestions();
  const stats = calculateStats();
  const weak = categoryStats().sort((a, b) => {
    const scoreA = a.totalAnswers ? a.accuracy : 101;
    const scoreB = b.totalAnswers ? b.accuracy : 101;
    return scoreA - scoreB;
  }).slice(0, 3);

  app.innerHTML = `
    <div class="page-head">
      <div><p class="eyebrow">DASHBOARD</p><h1>今日も、ひとつずつ。</h1><p class="muted">弱点を拾って、確実に定着させましょう。</p></div>
    </div>
    <section class="hero-grid">
      <article class="hero-card">
        <div class="hero-top">
          <div><p class="eyebrow">OVERALL PROGRESS</p><h2>${stats.mastered ? "習得が積み上がっています。" : "最初の1問から始めましょう。"}</h2><p class="muted">${stats.answered} / ${source.length}問を学習済み</p></div>
          <div class="ring" style="--progress:${stats.progress}%"><div class="ring-value">${stats.progress}%<small>習得率</small></div></div>
        </div>
        <div class="hero-actions">
          <button class="primary-button" data-start-mode="priority">おすすめ復習 <span>→</span></button>
          <button class="text-button" data-nav="practice">モードを選ぶ</button>
        </div>
      </article>
      <article class="today-card">
        <p class="eyebrow">TODAY</p><p class="today-number">${stats.today}</p><p>問 学習しました</p>
        <p class="muted">1日の目標 ${DAILY_GOAL}問</p>
        <div class="mini-progress"><i style="width:${Math.min(100, stats.today / DAILY_GOAL * 100)}%"></i></div>
      </article>
    </section>
    <section class="section">
      <div class="section-head"><h2>学習サマリー</h2></div>
      <div class="stats-grid">
        <article class="stat-card"><p class="stat-label"><i class="stat-dot"></i>正答率</p><div class="stat-value">${stats.accuracy}<small>%</small></div></article>
        <article class="stat-card"><p class="stat-label"><i class="stat-dot"></i>解答済み</p><div class="stat-value">${stats.answered}<small> / ${source.length}問</small></div></article>
        <article class="stat-card"><p class="stat-label"><i class="stat-dot amber"></i>復習待ち</p><div class="stat-value">${stats.review}<small>問</small></div></article>
        <article class="stat-card"><p class="stat-label"><i class="stat-dot red"></i>未学習</p><div class="stat-value">${stats.unlearned}<small>問</small></div></article>
      </div>
    </section>
    <section class="section">
      <div class="section-head"><h2>弱点ジャンル</h2><button class="text-button" data-nav="categories">すべて見る →</button></div>
      <div class="category-snapshot">
        ${weak.map((item, index) => `
          <button class="category-card" data-category="${escapeHTML(item.category)}">
            <p class="eyebrow">${index + 1 < 10 ? `0${index + 1}` : index + 1}</p>
            <h3>${escapeHTML(item.category)}</h3>
            <div class="bar ${item.accuracy < 60 && item.totalAnswers ? "danger" : ""}"><i style="width:${item.totalAnswers ? item.accuracy : 0}%"></i></div>
            <div class="bar-row"><span>正答率</span><b>${item.totalAnswers ? `${item.accuracy}%` : "未学習"}</b></div>
          </button>`).join("")}
      </div>
    </section>
  `;
}

const modes = [
  ["all", "◎", "全問題モード", "登録問題を順番に学習"],
  ["unlearned", "○", "未学習のみ", "まだ解いていない問題"],
  ["incorrect", "!", "間違えた問題のみ", "不正解履歴のある問題"],
  ["review", "↻", "復習待ちのみ", "いま復習すべき問題"],
  ["exclude-mastered", "△", "習得済みを除外", "学習中の問題に集中"],
  ["random", "※", "ランダム出題", "順番をシャッフル"],
  ["priority", "↑", "復習優先モード", "苦手・不正解を高頻度で"],
  ["mock", "□", "模擬試験モード", "対象問題をランダム出題"],
];

function renderModes() {
  app.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">PRACTICE</p><h1>学習モード</h1><p class="muted">今日の目的に合わせて選びましょう。</p></div></div>
    <div class="mode-grid">
      ${modes.map(([id, icon, title, text]) => `
        <button class="mode-card" data-start-mode="${id}">
          <span class="mode-icon">${icon}</span><b>${title}</b><small>${text}</small>
        </button>`).join("")}
      <button class="mode-card" data-nav="categories">
        <span class="mode-icon">◇</span><b>ジャンル別</b><small>分野を絞って学習</small>
      </button>
    </div>`;
}

function filteredQuestions(mode, category) {
  let pool = category ? scopedQuestions().filter((q) => q.category === category) : [...scopedQuestions()];
  if (mode === "unlearned") pool = pool.filter((q) => recordFor(q.id).answerCount === 0);
  if (mode === "incorrect") pool = pool.filter((q) => recordFor(q.id).incorrectCount > 0);
  if (mode === "review") pool = pool.filter((q) => ["復習待ち", "苦手"].includes(recordFor(q.id).status));
  if (mode === "exclude-mastered") pool = pool.filter((q) => recordFor(q.id).status !== "習得済み");
  if (mode === "random" || mode === "mock") pool.sort(() => Math.random() - .5);
  if (mode === "priority") {
    pool = pool
      .filter((q) => recordFor(q.id).status !== "習得済み")
      .sort((a, b) => {
        const ar = recordFor(a.id);
        const br = recordFor(b.id);
        const aScore = ar.incorrectCount * 3 + (ar.status === "苦手" ? 5 : 0) + (ar.status === "復習待ち" ? 3 : 0) - ar.consecutiveCorrect;
        const bScore = br.incorrectCount * 3 + (br.status === "苦手" ? 5 : 0) + (br.status === "復習待ち" ? 3 : 0) - br.consecutiveCorrect;
        return bScore - aScore || Math.random() - .5;
      });
  }
  return pool;
}

function startSession(mode = "all", category = null, startId = null) {
  const pool = filteredQuestions(mode, category);
  if (!pool.length) {
    showToast("この条件に該当する問題はありません");
    return;
  }
  const startIndex = startId ? Math.max(0, pool.findIndex((q) => q.id === startId)) : 0;
  session = { mode, category, questions: pool, index: startIndex, selected: null, answered: false };
  setRoute("quiz");
}

function currentQuestion() {
  return session?.questions[session.index];
}

function renderQuiz() {
  const q = currentQuestion();
  if (!q) return setRoute("practice");
  const record = recordFor(q.id);
  const progress = ((session.index + 1) / session.questions.length) * 100;
  app.innerHTML = `
    <div class="practice-layout">
      <div class="practice-top">
        <button class="icon-button" data-nav="practice" aria-label="演習を終了">←</button>
        <div><div class="practice-meta"><span>問題 ${session.index + 1} / ${session.questions.length}</span><span>${Math.round(progress)}%</span></div><div class="bar"><i style="width:${progress}%"></i></div></div>
        <button class="icon-button" id="bookmarkButton" aria-label="ブックマーク">${record.bookmarked ? "★" : "☆"}</button>
      </div>
      <article class="question-card">
        <div class="question-tags"><span class="tag">${escapeHTML(q.category)}</span><span class="tag neutral">${escapeHTML(q.subject)}</span><span class="tag neutral">${escapeHTML(q.questionType)}</span><span class="tag neutral">${escapeHTML(String(q.year))} ${escapeHTML(q.form)}-${q.questionNumber}</span><span class="tag neutral">${escapeHTML(q.difficulty)}</span></div>
        <div class="question-text">${escapeHTML(q.question)}</div>
        <div class="choice-list">
          ${q.choices.map((choice) => {
            const classes = ["choice"];
            if (session.selected === choice.label) classes.push("selected");
            if (session.answered && choice.label === q.answer) classes.push("correct");
            if (session.answered && session.selected === choice.label && choice.label !== q.answer) classes.push("incorrect");
            return `<button class="${classes.join(" ")}" data-choice="${choice.label}" ${session.answered ? "disabled" : ""}><span class="choice-letter">${choice.label}</span><span>${escapeHTML(choice.text)}</span></button>`;
          }).join("")}
        </div>
        ${session.answered ? "" : `<div class="submit-zone"><button class="primary-button" id="answerButton" ${session.selected ? "" : "disabled"}>回答する</button></div>`}
      </article>
      ${session.answered ? explanationHTML(q, session.selected) : ""}
    </div>`;
}

function explanationHTML(q, selected) {
  const correct = selected === q.answer;
  const selectedText = q.choices.find((choice) => choice.label === selected)?.text || "未回答";
  return `
    <div class="result-banner ${correct ? "correct" : "incorrect"}">
      <span class="result-icon">${correct ? "✓" : "×"}</span>
      <div><h2>${correct ? "正解です" : "もう一歩です"}</h2><p>${correct ? "この調子で定着させましょう。" : "根拠を確認して、次は迷わない形に。"}</p></div>
    </div>
    <article class="explanation-card">
      <div class="answer-summary">
        <div class="answer-box correct"><small>正解</small><b>${q.answer}．${escapeHTML(q.answerText)}</b></div>
        <div class="answer-box"><small>あなたの回答</small><b>${selected}．${escapeHTML(selectedText)}</b></div>
      </div>
      <section class="explain-section"><h3>解説</h3><p>${escapeHTML(q.explanation)}</p></section>
      <section class="explain-section"><h3>覚えるポイント</h3><p>${escapeHTML(q.keyPoint)}</p></section>
      <section class="explain-section"><h3>間違えやすいポイント</h3><p>${escapeHTML(q.commonMistake)}</p></section>
      <section class="explain-section">
        <h3>テキスト根拠</h3>
        <div class="evidence">
          <div class="evidence-grid">
            <div><p class="eyebrow">${escapeHTML(q.evidence.textbook)}</p><h3>${escapeHTML(q.evidence.chapter)}</h3><p class="muted">${escapeHTML(q.evidence.section)}</p></div>
            <div class="page-badge"><div><small>PAGE</small>${escapeHTML(String(q.evidence.page))}</div></div>
          </div>
          <p>${escapeHTML(q.evidence.quote || "要確認")}</p>
        </div>
      </section>
    </article>
    <div class="practice-actions">
      <button class="secondary-button" id="bookmarkButtonBottom">${recordFor(q.id).bookmarked ? "★" : "☆"}</button>
      <button class="secondary-button" id="retryButton">もう一度</button>
      <button class="primary-button" id="nextButton">${session.index + 1 >= session.questions.length ? "結果を見る" : "次の問題 →"}</button>
    </div>`;
}

function submitAnswer() {
  if (!session?.selected || session.answered) return;
  const q = currentQuestion();
  const correct = session.selected === q.answer;
  const record = { ...recordFor(q.id) };
  record.answerCount += 1;
  record.lastAnsweredAt = new Date().toISOString();
  record.attempts = [...record.attempts, { at: new Date().toISOString(), day: todayKey(), answer: session.selected, correct }].slice(-100);
  if (correct) {
    record.correctCount += 1;
    record.consecutiveCorrect += 1;
    record.status = record.consecutiveCorrect >= 3 ? "習得済み" : "学習中";
  } else {
    record.incorrectCount += 1;
    record.consecutiveCorrect = 0;
    record.status = record.incorrectCount >= 3 ? "苦手" : "復習待ち";
  }
  history[q.id] = record;
  saveHistory();
  session.answered = true;
  renderQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleBookmark() {
  const q = currentQuestion();
  if (!q) return;
  const record = { ...recordFor(q.id), bookmarked: !recordFor(q.id).bookmarked };
  history[q.id] = record;
  saveHistory();
  renderQuiz();
  showToast(record.bookmarked ? "ブックマークしました" : "ブックマークを外しました");
}

function nextQuestion() {
  if (session.index + 1 >= session.questions.length) {
    const completed = session.questions.length;
    session = null;
    setRoute("dashboard");
    showToast(`${completed}問のセッションを完了しました`);
    return;
  }
  session.index += 1;
  session.selected = null;
  session.answered = false;
  renderQuiz();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderQuestionList(category = null) {
  if (category) listFilter = category;
  const source = scopedQuestions();
  const categories = [...new Set(source.map((q) => q.category))];
  const visible = listFilter === "all" ? source : source.filter((q) => q.category === listFilter);
  app.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">QUESTION BANK</p><h1>問題一覧</h1><p class="muted">${visible.length}問を表示中</p></div></div>
    <div class="filter-row">
      <button class="chip ${listFilter === "all" ? "active" : ""}" data-list-filter="all">すべて</button>
      ${categories.map((categoryName) => `<button class="chip ${listFilter === categoryName ? "active" : ""}" data-list-filter="${escapeHTML(categoryName)}">${escapeHTML(categoryName)}</button>`).join("")}
    </div>
    <div class="question-list">
      ${visible.map((q) => {
        const record = recordFor(q.id);
        return `<button class="question-row" data-open-question="${q.id}">
          <span class="q-number">${q.questionNumber}</span>
          <span><h3>${escapeHTML(q.question.split("\n")[0])}</h3><p>${escapeHTML(q.subject)} ・ ${q.year} ${escapeHTML(q.form)} ・ ${escapeHTML(q.category)} ・ ${escapeHTML(q.questionType)}</p></span>
          <span class="status-pill ${statusClass(record.status)}">${record.status}${record.bookmarked ? " ★" : ""}</span>
        </button>`;
      }).join("") || `<div class="empty">該当する問題はありません。</div>`}
    </div>`;
}

function renderCategories() {
  const items = categoryStats().sort((a, b) => a.category.localeCompare(b.category, "ja"));
  app.innerHTML = `
    <div class="page-head"><div><p class="eyebrow">CATEGORIES</p><h1>ジャンル別学習</h1><p class="muted">正答率と進捗を見ながら、分野を選べます。</p></div></div>
    <div class="category-full-grid">
      ${items.map((item) => `
        <button class="category-card" data-start-category="${escapeHTML(item.category)}">
          <p class="eyebrow">${item.items.length} QUESTIONS</p>
          <h3>${escapeHTML(item.category)}</h3>
          <div class="category-count">${item.accuracy}<small>%</small></div>
          <div class="bar"><i style="width:${item.progress}%"></i></div>
          <div class="bar-row"><span>習得進捗</span><b>${item.mastered} / ${item.items.length}問</b></div>
        </button>`).join("")}
    </div>`;
}

function exportHistory() {
  const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), history }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `seiho-study-${todayKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  showToast("学習履歴を書き出しました");
}

function importHistory(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      history = parsed.history || parsed;
      saveHistory();
      dataDialog.close();
      setRoute("dashboard");
      showToast("学習履歴を読み込みました");
    } catch {
      showToast("JSONを読み込めませんでした");
    }
  };
  reader.readAsText(file);
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) return setRoute(nav.dataset.nav);
  const mode = event.target.closest("[data-start-mode]");
  if (mode) return startSession(mode.dataset.startMode);
  const category = event.target.closest("[data-category]");
  if (category) return setRoute("questions", { category: category.dataset.category });
  const startCategory = event.target.closest("[data-start-category]");
  if (startCategory) return startSession("all", startCategory.dataset.startCategory);
  const filter = event.target.closest("[data-list-filter]");
  if (filter) {
    listFilter = filter.dataset.listFilter;
    return renderQuestionList();
  }
  const open = event.target.closest("[data-open-question]");
  if (open) return startSession("all", null, open.dataset.openQuestion);
  const choice = event.target.closest("[data-choice]");
  if (choice && session && !session.answered) {
    session.selected = choice.dataset.choice;
    return renderQuiz();
  }
  if (event.target.closest("#answerButton")) return submitAnswer();
  if (event.target.closest("#bookmarkButton") || event.target.closest("#bookmarkButtonBottom")) return toggleBookmark();
  if (event.target.closest("#retryButton")) {
    session.selected = null;
    session.answered = false;
    return renderQuiz();
  }
  if (event.target.closest("#nextButton")) return nextQuestion();
});

document.querySelector("#settingsButton").addEventListener("click", () => dataDialog.showModal());
subjectScope.addEventListener("change", () => {
  activeSubject = subjectScope.value;
  localStorage.setItem("seiho-study-subject", activeSubject);
  listFilter = "all";
  session = null;
  setRoute("dashboard");
});
document.querySelector("#exportButton").addEventListener("click", exportHistory);
document.querySelector("#importInput").addEventListener("change", (event) => {
  if (event.target.files[0]) importHistory(event.target.files[0]);
});
document.querySelector("#resetButton").addEventListener("click", () => {
  if (!confirm("すべての学習履歴をリセットしますか？")) return;
  history = {};
  saveHistory();
  dataDialog.close();
  setRoute("dashboard");
  showToast("学習履歴をリセットしました");
});

function renderSubjectOptions() {
  const subjects = [...new Set(questions.map((question) => question.subject))].sort((a, b) => a.localeCompare(b, "ja"));
  if (activeSubject !== "all" && !subjects.includes(activeSubject)) {
    activeSubject = "all";
    localStorage.setItem("seiho-study-subject", activeSubject);
  }
  subjectScope.innerHTML = `<option value="all">すべての科目（${questions.length}問）</option>${subjects.map((subject) => {
    const count = questions.filter((question) => question.subject === subject).length;
    return `<option value="${escapeHTML(subject)}">${escapeHTML(subject)}（${count}問）</option>`;
  }).join("")}`;
  subjectScope.value = activeSubject;
}

async function refreshQuestions() {
  questions = await loadQuestions();
  renderSubjectOptions();
}

try {
  await refreshQuestions();
  renderDashboard();
  try {
    const contentChannel = new BroadcastChannel("seiho-question-data");
    contentChannel.addEventListener("message", async () => {
      await refreshQuestions();
      listFilter = "all";
      session = null;
      setRoute("dashboard");
      showToast("問題データを更新しました");
    });
  } catch {
    // Browsers without BroadcastChannel can refresh manually.
  }
} catch (error) {
  app.innerHTML = `<div class="empty"><h2>問題データを読み込めませんでした</h2><p>ローカルサーバーから開いてください。</p><code>${escapeHTML(error.message)}</code></div>`;
}
