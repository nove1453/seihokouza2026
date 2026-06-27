const DB_NAME = "seiho-study-content";
const DB_VERSION = 1;
const STORE_NAME = "questions";
const CATALOG_URL = "./data/catalog.json";
const FALLBACK_PACK = "./data/questions.json";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(mode, operation) {
  return openDatabase().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = operation(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) return [];
  return choices.map((choice, index) => {
    if (typeof choice === "string") {
      return { label: String.fromCharCode(65 + index), text: choice };
    }
    return { label: text(choice.label), text: text(choice.text) };
  }).filter((choice) => choice.label && choice.text);
}

export function normalizeQuestion(input) {
  const choices = normalizeChoices(input.choices);
  const answer = text(input.answer);
  const answerText = text(input.answerText) || choices.find((choice) => choice.label === answer)?.text || "";
  const evidence = input.evidence || {};
  return {
    id: text(input.id),
    subject: text(input.subject),
    year: Number(input.year) || 0,
    form: text(input.form),
    questionNumber: Number(input.questionNumber) || 0,
    category: text(input.category),
    questionType: text(input.questionType),
    question: text(input.question),
    choices,
    answer,
    answerText,
    explanation: text(input.explanation),
    keyPoint: text(input.keyPoint),
    commonMistake: text(input.commonMistake),
    difficulty: text(input.difficulty) || "標準",
    tags: Array.isArray(input.tags) ? input.tags.map(text).filter(Boolean) : text(input.tags).split(/[、,]/).map(text).filter(Boolean),
    chapter: text(input.chapter || evidence.chapter),
    section: text(input.section || evidence.section),
    evidence: {
      textbook: text(evidence.textbook),
      chapter: text(evidence.chapter || input.chapter),
      section: text(evidence.section || input.section),
      page: text(evidence.page) || "要確認",
      quote: text(evidence.quote || evidence.summary),
    },
  };
}

export function validateQuestion(input) {
  const question = normalizeQuestion(input);
  const errors = [];
  if (!question.id) errors.push("ID");
  if (!question.subject) errors.push("科目");
  if (!question.year) errors.push("年度");
  if (!question.form) errors.push("フォーム");
  if (!question.questionNumber) errors.push("問題番号");
  if (!question.questionType) errors.push("問題形式");
  if (!question.question) errors.push("問題文");
  if (!question.choices.length) errors.push("選択肢");
  if (!question.answer) errors.push("正解");
  if (question.answer && !question.choices.some((choice) => choice.label === question.answer)) errors.push("正解に対応する選択肢");
  return { question, errors };
}

async function loadBaseQuestions() {
  let paths = [FALLBACK_PACK];
  try {
    const response = await fetch(CATALOG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    const catalog = await response.json();
    paths = catalog.packs.map((pack) => pack.path).filter(Boolean);
  } catch {
    // Backward-compatible fallback for older deployments.
  }
  const packs = await Promise.all(paths.map(async (path) => {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error(`問題パックを読み込めません: ${path}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : payload.questions || [];
  }));
  return packs.flat().map(normalizeQuestion);
}

async function loadOverrides() {
  try {
    return await new Promise(async (resolve, reject) => {
      const db = await openDatabase();
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result.map(normalizeQuestion));
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
}

export async function loadQuestions() {
  const [base, overrides] = await Promise.all([loadBaseQuestions(), loadOverrides()]);
  const merged = new Map(base.map((question) => [question.id, question]));
  overrides.forEach((question) => merged.set(question.id, question));
  return [...merged.values()].sort((a, b) =>
    a.subject.localeCompare(b.subject, "ja") ||
    a.year - b.year ||
    a.form.localeCompare(b.form, "ja") ||
    a.questionNumber - b.questionNumber
  );
}

export async function saveQuestion(question) {
  const checked = validateQuestion(question);
  if (checked.errors.length) throw new Error(`必須項目を確認してください: ${checked.errors.join("、")}`);
  await transaction("readwrite", (store) => store.put(checked.question));
  notifyChange();
  return checked.question;
}

export async function saveQuestions(records) {
  if (!Array.isArray(records)) throw new Error("問題データは配列で指定してください");
  const checked = records.map(validateQuestion);
  const invalid = checked.map((result, index) => ({ ...result, index })).filter((result) => result.errors.length);
  if (invalid.length) {
    const first = invalid[0];
    throw new Error(`${first.index + 1}件目の必須項目を確認してください: ${first.errors.join("、")}`);
  }
  await transaction("readwrite", (store) => checked.forEach(({ question }) => store.put(question)));
  notifyChange();
  return checked.map(({ question }) => question);
}

export async function deleteQuestionOverride(id) {
  await transaction("readwrite", (store) => store.delete(id));
  notifyChange();
}

export async function exportQuestions() {
  return loadQuestions();
}

export function notifyChange() {
  try {
    const channel = new BroadcastChannel("seiho-question-data");
    channel.postMessage({ type: "questions-updated", at: new Date().toISOString() });
    channel.close();
  } catch {
    // BroadcastChannel is an enhancement; reload still works without it.
  }
}
