import {
  buildCatalog,
  compareQuestions,
  loadContentLibrary,
  normalizeQuestion,
  questionSetPath,
  subjectSlugFor,
  validateQuestion,
  validateQuestions,
} from "./question-store.js";
import { makeZip } from "./zip-utils.js";

const PAGE_SIZE = 100;
const rows = document.querySelector("#questionRows");
const dialog = document.querySelector("#editorDialog");
const form = document.querySelector("#questionForm");
const toast = document.querySelector("#toast");
const validationPanel = document.querySelector("#validationPanel");
const validationErrors = document.querySelector("#validationErrors");
const importResult = document.querySelector("#importResult");
const downloadPanel = document.querySelector("#downloadPanel");
const downloadLinks = document.querySelector("#downloadLinks");
const directSaveButton = document.querySelector("#directSaveButton");

let sets = new Map();
let catalog = null;
let questions = [];
let filtered = [];
let page = 1;
let sort = { key: "year", direction: 1 };
let editingId = null;
let dirtyPaths = new Set();
let downloadUrls = [];

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
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function clearErrors() {
  validationPanel.hidden = true;
  validationErrors.innerHTML = "";
}

function showImportResult({ added = 0, updated = 0, deleted = 0, total = questions.length, paths = [] }) {
  const actions = [
    added ? `${added}問追加` : "",
    updated ? `${updated}問更新` : "",
    deleted ? `${deleted}問削除` : "",
  ].filter(Boolean).join("・") || "変更なし";
  document.querySelector("#importResultTitle").textContent = `処理完了：${actions}`;
  const unchanged = added === 0 && updated > 0
    ? "すべて既存IDの更新なので、登録問題の総数は変わりません。"
    : "";
  document.querySelector("#importResultText").textContent =
    `登録問題は合計${total.toLocaleString()}問です。${unchanged} 対象：${paths.join("、") || "なし"}`;
  importResult.hidden = false;
}

function clearPreparedDownloads() {
  downloadUrls.forEach((url) => URL.revokeObjectURL(url));
  downloadUrls = [];
  downloadLinks.innerHTML = "";
  downloadPanel.hidden = true;
}

function showErrors(errors, title = "保存できませんでした") {
  document.querySelector("#validationTitle").textContent = `${title}（${errors.length}件）`;
  validationErrors.innerHTML = errors.slice(0, 200).map((error) => {
    const position = error.index >= 0 ? `${error.index + 1}件目` : "全体";
    return `<li><b>${escapeHTML(position)}${error.id ? ` / ${error.id}` : ""}</b><code>${escapeHTML(error.field)}</code>${escapeHTML(error.message)}</li>`;
  }).join("");
  validationPanel.hidden = false;
  validationPanel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function rebuildQuestionIndex() {
  questions = [...sets.values()].flatMap((set) => set.questions).sort(compareQuestions);
  catalog = buildCatalog(sets);
  document.querySelector("#dirtyCount").textContent = dirtyPaths.size ? `${dirtyPaths.size}ファイルに未出力の変更` : "未出力の変更なし";
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
  page = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
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
      <td>${escapeHTML(question.id)}</td><td>${escapeHTML(question.subject)}</td><td>${question.year}</td>
      <td>${escapeHTML(question.form)}</td><td>${question.questionNumber}</td><td>${escapeHTML(question.category)}</td>
      <td>${escapeHTML(question.questionType)}</td><td>${escapeHTML(question.difficulty)}</td>
      <td><span class="${question.explanation ? "yes" : "no"}">${question.explanation ? "登録済" : "未登録"}</span></td>
      <td><span class="${question.evidence?.quote ? "yes" : "no"}">${question.evidence?.quote ? "登録済" : "未登録"}</span></td>
      <td><button class="edit-button" data-edit-id="${escapeHTML(question.id)}">編集</button></td>
    </tr>`).join("") || `<tr class="empty-row"><td colspan="11">条件に一致する問題はありません。</td></tr>`;
}

async function reload() {
  const library = await loadContentLibrary();
  sets = new Map([...library.sets].map(([path, set]) => [path, { ...set, questions: set.questions.map(normalizeQuestion) }]));
  dirtyPaths.clear();
  clearPreparedDownloads();
  importResult.hidden = true;
  clearErrors();
  rebuildQuestionIndex();
  refreshFilterOptions();
  updateSummary();
  applyFilters();
}

function choicesToText(choices) {
  return choices.map((choice) => `${choice.label}｜${choice.text}`).join("\n");
}

function parseChoices(value) {
  return String(value).split(/\r?\n/).map((line) => {
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
    id: data.get("id"), subject: data.get("subject"), year: Number(data.get("year")),
    form: data.get("form"), questionNumber: Number(data.get("questionNumber")),
    questionType: data.get("questionType"), category: data.get("category"),
    difficulty: data.get("difficulty"),
    tags: String(data.get("tags")).split(/[、,]/).map((value) => value.trim()).filter(Boolean),
    question: data.get("question"), choices: parseChoices(data.get("choices")),
    answer: data.get("answer"), answerText: data.get("answerText"),
    explanation: data.get("explanation"), keyPoint: data.get("keyPoint"),
    commonMistake: data.get("commonMistake"),
    evidence: {
      textbook: data.get("textbook"), chapter: data.get("chapter"), section: data.get("section"),
      page: data.get("page"), quote: data.get("quote"),
    },
  };
}

function locationForId(id) {
  for (const [path, set] of sets) {
    const index = set.questions.findIndex((question) => question.id === id);
    if (index >= 0) return { path, set, index };
  }
  return null;
}

function stageQuestions(records, suppliedSlug = "") {
  const checked = validateQuestions(records);
  const errors = [...checked.errors];
  checked.questions.forEach((question, index) => {
    const slug = subjectSlugFor(question.subject, suppliedSlug);
    if (!slug) errors.push({
      index, id: question.id, field: "subjectSlug",
      message: `科目「${question.subject}」の subjectSlug をJSONのルートに指定してください`,
    });
    const existing = locationForId(question.id);
    if (existing) {
      const sameSet = existing.set.subject === question.subject && existing.set.year === question.year && existing.set.form === question.form;
      if (!sameSet && records.filter((item) => item.id === question.id).length > 1) {
        errors.push({ index, id: question.id, field: "id", message: "同じidを複数の年度・フォームへ登録できません" });
      }
    }
  });
  if (errors.length) return { saved: [], errors };

  const existingIds = new Set(checked.questions.filter((question) => locationForId(question.id)).map((question) => question.id));
  const now = new Date().toISOString();
  checked.questions.forEach((question) => {
    const previous = locationForId(question.id);
    if (previous) {
      previous.set.questions.splice(previous.index, 1);
      previous.set.updatedAt = now;
      dirtyPaths.add(previous.path);
    }
    const subjectSlug = subjectSlugFor(question.subject, suppliedSlug);
    const path = questionSetPath(subjectSlug, question.year, question.form);
    if (!sets.has(path)) {
      sets.set(path, {
        version: 1, subject: question.subject, subjectSlug, year: question.year,
        form: question.form, updatedAt: now, questions: [],
      });
    }
    const target = sets.get(path);
    target.subject = question.subject;
    target.subjectSlug = subjectSlug;
    target.year = question.year;
    target.form = question.form;
    target.updatedAt = now;
    target.questions.push(question);
    target.questions.sort(compareQuestions);
    dirtyPaths.add(path);
  });
  for (const [path, set] of [...sets]) if (!set.questions.length) sets.delete(path);
  clearErrors();
  rebuildQuestionIndex();
  refreshFilterOptions();
  updateSummary();
  applyFilters();
  clearPreparedDownloads();
  return {
    saved: checked.questions,
    added: checked.questions.length - existingIds.size,
    updated: existingIds.size,
    paths: [...new Set(checked.questions.map((question) =>
      questionSetPath(subjectSlugFor(question.subject, suppliedSlug), question.year, question.form)
    ))],
    errors: [],
  };
}

function parseCSV(source) {
  const table = [];
  let row = [], cell = "", quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index], next = source[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell); table.push(row); row = []; cell = "";
    } else cell += character;
  }
  if (cell || row.length) { row.push(cell); table.push(row); }
  const headers = table.shift()?.map((header) => header.trim()) || [];
  return table.filter((values) => values.some(Boolean)).map((values) => {
    const item = Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
    let choices = [];
    try { choices = JSON.parse(item.choices); } catch { choices = parseChoices(String(item.choices || "").replaceAll("\\n", "\n")); }
    let tags = [];
    try { tags = JSON.parse(item.tags); } catch { tags = String(item.tags || "").split(/[、;|]/).filter(Boolean); }
    return {
      ...item, year: Number(item.year), questionNumber: Number(item.questionNumber), choices, tags,
      evidence: {
        textbook: item.textbook || item["evidence.textbook"], chapter: item.chapter || item["evidence.chapter"],
        section: item.section || item["evidence.section"], page: item.page || item["evidence.page"],
        quote: item.quote || item["evidence.quote"],
      },
    };
  });
}

async function importFile(file, type) {
  try {
    const source = await file.text();
    const parsed = type === "json" ? JSON.parse(source) : parseCSV(source);
    const records = Array.isArray(parsed) ? parsed : parsed?.questions;
    const suppliedSlug = Array.isArray(parsed) ? "" : parsed?.subjectSlug;
    const result = stageQuestions(records, suppliedSlug);
    if (result.errors.length) {
      showErrors(result.errors, "インポートを中止しました");
      showToast("JSONにエラーがあります。変更は反映していません");
      return;
    }
    showImportResult({ ...result, total: questions.length });
    showToast(`${result.added}問追加・${result.updated}問更新しました。出力ファイルを準備してください`);
  } catch (error) {
    showErrors([{ index: -1, id: "", field: "JSON", message: error.message || "読み込みに失敗しました" }], "インポートを中止しました");
  } finally {
    document.querySelector(type === "json" ? "#jsonInput" : "#csvInput").value = "";
  }
}

function makeDownloadLink(blob, filename, label, secondary = false) {
  const url = URL.createObjectURL(blob);
  downloadUrls.push(url);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.className = `download-link${secondary ? " secondary" : ""}`;
  anchor.textContent = label;
  return anchor;
}

function jsonBlob(payload) {
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

function dataFiles() {
  const now = new Date().toISOString();
  const currentCatalog = buildCatalog(sets, now);
  const files = [{ path: "data/catalog.json", content: JSON.stringify(currentCatalog, null, 2) }];
  for (const [path, set] of [...sets].sort(([a], [b]) => a.localeCompare(b))) {
    files.push({
      path,
      content: JSON.stringify({ ...set, questions: [...set.questions].sort(compareQuestions) }, null, 2),
    });
  }
  return files;
}

function prepareDownloads(catalogOnly = false) {
  clearPreparedDownloads();
  const files = dataFiles();
  if (!catalogOnly) {
    downloadLinks.append(makeDownloadLink(
      makeZip(files),
      `seiho-data-${new Date().toISOString().slice(0, 10)}.zip`,
      "data一式のZIPをダウンロード"
    ));
  }
  const visibleFiles = catalogOnly
    ? files.filter((file) => file.path === "data/catalog.json" || dirtyPaths.has(file.path))
    : files.filter((file) => file.path === "data/catalog.json" || dirtyPaths.has(file.path));
  visibleFiles.forEach((file) => {
    const filename = file.path === "data/catalog.json" ? "catalog.json" : file.path.split("/").at(-1);
    downloadLinks.append(makeDownloadLink(
      new Blob([file.content], { type: "application/json" }),
      filename,
      file.path,
      true
    ));
  });
  if (visibleFiles.length === 1 && dirtyPaths.size === 0) {
    const note = document.createElement("span");
    note.className = "muted";
    note.textContent = "変更済み問題JSONはありません";
    downloadLinks.append(note);
  }
  downloadPanel.hidden = false;
  downloadPanel.scrollIntoView({ behavior: "smooth", block: "center" });
  showToast("ダウンロードリンクを作成しました");
}

async function detectDirectSave() {
  try {
    const response = await fetch("./api/admin/capabilities", { cache: "no-store" });
    if (!response.ok) return;
    const capabilities = await response.json();
    if (!capabilities.fileWrite) return;
    directSaveButton.hidden = false;
    directSaveButton.title = `保存先: ${capabilities.root}/data`;
  } catch {
    // 静的ホスティングではダウンロード出力だけを表示する。
  }
}

async function saveDirectlyToData() {
  directSaveButton.disabled = true;
  const originalText = directSaveButton.textContent;
  directSaveButton.textContent = "保存中…";
  try {
    const response = await fetch("./api/admin/save-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: dataFiles() }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "dataフォルダへ保存できませんでした");
    dirtyPaths.clear();
    rebuildQuestionIndex();
    clearPreparedDownloads();
    document.querySelector("#importResultTitle").textContent = `dataフォルダへ保存完了（${result.count}ファイル）`;
    document.querySelector("#importResultText").textContent =
      "問題JSONとcatalog.jsonをプロジェクトへ直接保存しました。学習画面を再読み込みすると反映されます。";
    importResult.hidden = false;
    showToast("プロジェクトのdataフォルダへ直接保存しました");
  } catch (error) {
    showErrors([{ index: -1, id: "", field: "data保存", message: error.message }], "dataフォルダへ保存できません");
  } finally {
    directSaveButton.disabled = false;
    directSaveButton.textContent = originalText;
  }
}

Object.values(fields).forEach((field) => field.addEventListener("input", () => { page = 1; applyFilters(); }));
document.querySelector("#clearFilters").addEventListener("click", () => {
  Object.values(fields).forEach((field) => { field.value = ""; });
  page = 1; applyFilters();
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
document.querySelector("#closeValidation").addEventListener("click", clearErrors);
document.querySelector("#deleteQuestion").addEventListener("click", () => {
  if (!editingId || !confirm(`${editingId} を問題JSONから削除しますか？`)) return;
  const located = locationForId(editingId);
  if (!located) return;
  located.set.questions.splice(located.index, 1);
  located.set.updatedAt = new Date().toISOString();
  dirtyPaths.add(located.path);
  if (!located.set.questions.length) sets.delete(located.path);
  dialog.close();
  rebuildQuestionIndex(); refreshFilterOptions(); updateSummary(); applyFilters();
  clearPreparedDownloads();
  showImportResult({ deleted: 1, total: questions.length, paths: [located.path] });
  showToast("作業データから削除しました。出力ファイルを準備してください");
});
rows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-id]");
  if (button) openEditor(questions.find((question) => question.id === button.dataset.editId));
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const candidate = formQuestion();
  const checked = validateQuestion(candidate);
  const duplicate = !editingId && locationForId(checked.question.id);
  if (duplicate) checked.errors.push({ index: 0, id: checked.question.id, field: "id", message: "このidはすでに登録されています" });
  if (checked.errors.length) {
    dialog.close();
    showErrors(checked.errors, "問題を保存できません");
    return;
  }
  const result = stageQuestions([candidate]);
  if (result.errors.length) {
    dialog.close();
    showErrors(result.errors, "問題を保存できません");
    return;
  }
  dialog.close();
  showImportResult({ ...result, total: questions.length });
  showToast("作業データへ保存しました。出力ファイルを準備してください");
});
document.querySelector("#jsonInput").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0], "json"));
document.querySelector("#csvInput").addEventListener("change", (event) => event.target.files[0] && importFile(event.target.files[0], "csv"));
document.querySelector("#exportButton").addEventListener("click", () => {
  prepareDownloads(true);
});
document.querySelector("#backupButton").addEventListener("click", () => {
  prepareDownloads(false);
});
directSaveButton.addEventListener("click", saveDirectlyToData);

try {
  await reload();
  await detectDirectSave();
} catch (error) {
  showErrors([{ index: -1, id: "", field: "起動", message: error.message }], "問題データを読み込めません");
}
