import { loadQuestions, saveQuestion, saveQuestions, exportQuestions, deleteQuestionOverride } from "./question-store.js";

const PAGE_SIZE = 100;
const HISTORY_KEY = "seiho-study-history-v1";
const rows = document.querySelector("#questionRows");
const dialog = document.querySelector("#editorDialog");
const form = document.querySelector("#questionForm");
const pasteDialog = document.querySelector("#pasteDialog");
const pasteForm = document.querySelector("#pasteForm");
const toast = document.querySelector("#toast");

let questions = [];
let filtered = [];
let page = 1;
let sort = { key: "year", direction: 1 };
let editingId = null;

const fields = {
  search: document.querySelector("#searchInput"),
  subject: document.querySelector("#subjectFilter"),
  year: document.querySelector("#yearFilter"),
  form: document.querySelector("#formFilter"),
  category: document.querySelector("#categoryFilter"),
  number: document.querySelector("#numberFilter"),
};

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function valuesFor(key) {
  return [...new Set(questions.map((question) => String(question[key])).filter(Boolean))].sort((a, b) =>
    key === "year" ? Number(b) - Number(a) : a.localeCompare(b, "ja")
  );
}

function fillSelect(select, key, label) {
  const current = select.value;
  select.innerHTML = `<option value="">すべての${label}</option>${valuesFor(key).map((value) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join("")}`;
  select.value = current;
}

function refreshFilterOptions() {
  fillSelect(fields.subject, "subject", "科目");
  fillSelect(fields.year, "year", "年度");
  fillSelect(fields.form, "form", "フォーム");
  fillSelect(fields.category, "category", "ジャンル");
}

function updateSummary() {
  document.querySelector("#totalCount").textContent = questions.length.toLocaleString();
  document.querySelector("#explainedCount").textContent = questions.filter((question) => question.explanation).length.toLocaleString();
  document.querySelector("#quotedCount").textContent = questions.filter((question) => question.evidence?.quote).length.toLocaleString();
}

function applyFilters() {
  const term = fields.search.value.trim().toLowerCase();
  filtered = questions.filter((question) => {
    const haystack = [question.id, question.subject, question.question, question.category].join(" ").toLowerCase();
    return (!term || haystack.includes(term)) &&
      (!fields.subject.value || question.subject === fields.subject.value) &&
      (!fields.year.value || String(question.year) === fields.year.value) &&
      (!fields.form.value || question.form === fields.form.value) &&
      (!fields.category.value || question.category === fields.category.value) &&
      (!fields.number.value || String(question.questionNumber) === fields.number.value);
  }).sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    if (typeof left === "number" && typeof right === "number") return (left - right) * sort.direction;
    return String(left).localeCompare(String(right), "ja") * sort.direction;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, pageCount);
  renderRows();
}

function renderRows() {
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  document.querySelector("#resultCount").textContent = `${filtered.length.toLocaleString()}件`;
  document.querySelector("#pageLabel").textContent = `${page} / ${pageCount}`;
  document.querySelector("#previousPage").disabled = page <= 1;
  document.querySelector("#nextPage").disabled = page >= pageCount;
  rows.innerHTML = visible.map((question) => `
    <tr>
      <td>${escapeHTML(question.id)}</td>
      <td>${escapeHTML(question.subject)}</td>
      <td>${question.year}</td>
      <td>${escapeHTML(question.form)}</td>
      <td>${question.questionNumber}</td>
      <td>${escapeHTML(question.category)}</td>
      <td>${escapeHTML(question.questionType)}</td>
      <td>${escapeHTML(question.difficulty)}</td>
      <td><span class="${question.explanation ? "yes" : "no"}">${question.explanation ? "登録済" : "未登録"}</span></td>
      <td><span class="${question.evidence?.quote ? "yes" : "no"}">${question.evidence?.quote ? "登録済" : "未登録"}</span></td>
      <td><button class="edit-button" data-edit-id="${escapeHTML(question.id)}">編集</button></td>
    </tr>`).join("") || `<tr class="empty-row"><td colspan="11">条件に一致する問題はありません。</td></tr>`;
}

async function reload() {
  questions = await loadQuestions();
  refreshFilterOptions();
  updateSummary();
  applyFilters();
}

function choicesToText(choices) {
  return choices.map((choice) => `${choice.label}｜${choice.text}`).join("\n");
}

function parseChoices(value) {
  return value.split(/\r?\n/).map((line) => {
    const separator = line.includes("｜") ? "｜" : line.includes("|") ? "|" : ",";
    const [label, ...parts] = line.split(separator);
    return { label: label.trim(), text: parts.join(separator).trim() };
  }).filter((choice) => choice.label && choice.text);
}

function openEditor(question = null) {
  editingId = question?.id || null;
  form.reset();
  document.querySelector("#editorTitle").textContent = question ? "問題を編集" : "新規問題を追加";
  const value = question || {
    id: "", subject: "", year: new Date().getFullYear(), form: "A", questionNumber: "",
    questionType: "", category: "", difficulty: "標準", tags: [], question: "",
    choices: [], answer: "", answerText: "", explanation: "", keyPoint: "", commonMistake: "",
    evidence: { textbook: "", chapter: "", section: "", page: "", quote: "" },
  };
  const assign = (name, fieldValue) => { form.elements[name].value = fieldValue ?? ""; };
  ["id", "subject", "year", "form", "questionNumber", "questionType", "category", "difficulty", "question", "answer", "answerText", "explanation", "keyPoint", "commonMistake"].forEach((name) => assign(name, value[name]));
  assign("tags", value.tags?.join(", "));
  assign("choices", choicesToText(value.choices || []));
  assign("textbook", value.evidence?.textbook);
  assign("chapter", value.evidence?.chapter);
  assign("section", value.evidence?.section);
  assign("page", value.evidence?.page);
  assign("quote", value.evidence?.quote);
  form.elements.id.readOnly = Boolean(question);
  form.elements.id.title = question ? "学習履歴との紐付けを保つため、既存IDは変更できません" : "";
  document.querySelector("#deleteQuestion").hidden = !question;
  dialog.showModal();
}

function formQuestion() {
  const data = new FormData(form);
  return {
    id: data.get("id"),
    subject: data.get("subject"),
    year: Number(data.get("year")),
    form: data.get("form"),
    questionNumber: Number(data.get("questionNumber")),
    questionType: data.get("questionType"),
    category: data.get("category"),
    difficulty: data.get("difficulty"),
    tags: data.get("tags").split(/[、,]/).map((value) => value.trim()).filter(Boolean),
    question: data.get("question"),
    choices: parseChoices(data.get("choices")),
    answer: data.get("answer"),
    answerText: data.get("answerText"),
    explanation: data.get("explanation"),
    keyPoint: data.get("keyPoint"),
    commonMistake: data.get("commonMistake"),
    evidence: {
      textbook: data.get("textbook"),
      chapter: data.get("chapter"),
      section: data.get("section"),
      page: data.get("page"),
      quote: data.get("quote"),
    },
  };
}

function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function parseCSV(source) {
  const table = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell); table.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); table.push(row); }
  const headers = table.shift().map((header) => header.trim());
  return table.filter((values) => values.some(Boolean)).map((values) => {
    const item = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    let choices = [];
    try { choices = JSON.parse(item.choices); } catch { choices = parseChoices(String(item.choices || "").replaceAll("\\n", "\n")); }
    let tags = [];
    try { tags = JSON.parse(item.tags); } catch { tags = String(item.tags || "").split(/[、;|]/).filter(Boolean); }
    return {
      ...item,
      year: Number(item.year),
      questionNumber: Number(item.questionNumber),
      choices,
      tags,
      evidence: {
        textbook: item.textbook || item["evidence.textbook"],
        chapter: item.chapter || item["evidence.chapter"],
        section: item.section || item["evidence.section"],
        page: item.page || item["evidence.page"],
        quote: item.quote || item["evidence.quote"],
      },
    };
  });
}

async function importFile(file, type) {
  try {
    const source = await file.text();
    const parsed = type === "json" ? JSON.parse(source) : parseCSV(source);
    await importPayload(parsed);
  } catch (error) {
    showToast(error.message || "インポートに失敗しました");
  }
}

async function importPayload(parsed) {
  const records = Array.isArray(parsed) ? parsed : parsed?.questions;
  if (!Array.isArray(records)) throw new Error("問題配列または questions を含むJSONを指定してください");
  const saved = await saveQuestions(records);
  await reload();
  showToast(`${saved.length}問を追加・更新しました`);
  return saved;
}

Object.values(fields).forEach((field) => field.addEventListener("input", () => { page = 1; applyFilters(); }));
document.querySelector("#clearFilters").addEventListener("click", () => {
  Object.values(fields).forEach((field) => { field.value = ""; });
  page = 1;
  applyFilters();
});
document.querySelectorAll("th[data-sort]").forEach((header) => header.addEventListener("click", () => {
  const key = header.dataset.sort;
  sort = { key, direction: sort.key === key ? sort.direction * -1 : 1 };
  applyFilters();
}));
document.querySelector("#previousPage").addEventListener("click", () => { page -= 1; renderRows(); });
document.querySelector("#nextPage").addEventListener("click", () => { page += 1; renderRows(); });
document.querySelector("#addButton").addEventListener("click", () => openEditor());
document.querySelector("#closeEditor").addEventListener("click", () => dialog.close());
document.querySelector("#cancelEditor").addEventListener("click", () => dialog.close());
document.querySelector("#deleteQuestion").addEventListener("click", async () => {
  if (!editingId || !confirm(`${editingId} の管理者追加・編集データを削除しますか？`)) return;
  await deleteQuestionOverride(editingId);
  dialog.close();
  await reload();
  showToast("管理者追加・編集データを削除しました");
});
rows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (!button) return;
  openEditor(questions.find((question) => question.id === button.dataset.editId));
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await saveQuestion(formQuestion());
    dialog.close();
    await reload();
    showToast("問題データを保存しました");
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector("#jsonInput").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0], "json"));
document.querySelector("#csvInput").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0], "csv"));
document.querySelector("#pasteJsonButton").addEventListener("click", () => {
  document.querySelector("#pasteJsonText").value = "";
  pasteDialog.showModal();
});
document.querySelector("#closePaste").addEventListener("click", () => pasteDialog.close());
document.querySelector("#cancelPaste").addEventListener("click", () => pasteDialog.close());
pasteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await importPayload(JSON.parse(document.querySelector("#pasteJsonText").value));
    pasteDialog.close();
  } catch (error) {
    showToast(error.message || "JSONを取り込めませんでした");
  }
});
document.querySelector("#exportButton").addEventListener("click", async () => {
  downloadJSON(await exportQuestions(), `seiho-questions-${new Date().toISOString().slice(0, 10)}.json`);
});
document.querySelector("#backupButton").addEventListener("click", async () => {
  let history = {};
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || {}; } catch {}
  downloadJSON({
    version: 1,
    exportedAt: new Date().toISOString(),
    questions: await exportQuestions(),
    history,
  }, `seiho-full-backup-${new Date().toISOString().slice(0, 10)}.json`);
});

await reload();
