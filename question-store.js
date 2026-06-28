export const CATALOG_URL = "./data/catalog.json";

export const SUBJECT_SLUGS = Object.freeze({
  "生命保険総論": "seiho-souron",
  "生命保険経理": "seiho-keiri",
  "危険選択": "kiken-sentaku",
  "生命保険計理": "seiho-keiri-math",
  "約款と法律": "yakkan-houritsu",
});

function text(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeChoices(choices) {
  if (!Array.isArray(choices)) return [];
  return choices.map((choice, index) => {
    if (typeof choice === "string") {
      return { label: String.fromCharCode(65 + index), text: text(choice) };
    }
    return { label: text(choice?.label), text: text(choice?.text) };
  }).filter((choice) => choice.label && choice.text);
}

export function normalizeQuestion(input = {}) {
  const choices = normalizeChoices(input.choices);
  const answer = text(input.answer);
  const evidence = input.evidence || {};
  return {
    id: text(input.id),
    subject: text(input.subject),
    year: Number(input.year) || 0,
    form: text(input.form).toUpperCase(),
    questionNumber: Number(input.questionNumber) || 0,
    category: text(input.category),
    questionType: text(input.questionType),
    question: text(input.question),
    choices,
    answer,
    answerText: text(input.answerText) || choices.find((choice) => choice.label === answer)?.text || "",
    explanation: text(input.explanation),
    keyPoint: text(input.keyPoint),
    commonMistake: text(input.commonMistake),
    difficulty: text(input.difficulty) || "標準",
    tags: Array.isArray(input.tags)
      ? input.tags.map(text).filter(Boolean)
      : text(input.tags).split(/[、,]/).map(text).filter(Boolean),
    chapter: text(input.chapter || evidence.chapter),
    section: text(input.section || evidence.section),
    evidence: {
      textbook: text(evidence.textbook),
      textbookId: text(evidence.textbookId),
      pdfPath: text(evidence.pdfPath),
      pdfPage: Number(evidence.pdfPage) > 0 ? Number(evidence.pdfPage) : null,
      chapter: text(evidence.chapter || input.chapter),
      section: text(evidence.section || input.section),
      page: text(evidence.page),
      quote: text(evidence.quote || evidence.summary),
    },
  };
}

export function subjectSlugFor(subject, supplied = "") {
  const known = SUBJECT_SLUGS[text(subject)];
  if (known) return known;
  const candidate = text(supplied).toLowerCase();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) return candidate;
  return "";
}

export function questionSetPath(subjectSlug, year, form) {
  return `data/questions/${subjectSlug}/${Number(year)}/${text(form).toUpperCase()}.json`;
}

export function catalogEntries(catalog) {
  if (Array.isArray(catalog?.packs)) return catalog.packs.filter((entry) => entry.path);
  const entries = [];
  for (const subject of catalog?.subjects || []) {
    for (const year of subject.years || []) {
      for (const form of year.forms || []) {
        entries.push({
          subject: subject.subject,
          subjectSlug: subject.subjectSlug,
          textbook: subject.textbook || null,
          year: Number(year.year),
          ...form,
        });
      }
    }
  }
  return entries;
}

export async function loadCatalog() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`catalog.json を読み込めません（${response.status}）`);
  const catalog = await response.json();
  if (!Array.isArray(catalog.subjects) && !Array.isArray(catalog.packs)) {
    throw new Error("catalog.json の形式が正しくありません");
  }
  return catalog;
}

export async function loadContentLibrary() {
  const catalog = await loadCatalog();
  const entries = catalogEntries(catalog);
  const loaded = await Promise.all(entries.map(async (entry) => {
    const response = await fetch(`./${entry.path.replace(/^\.?\//, "")}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`問題JSONを読み込めません: ${entry.path}`);
    const raw = await response.json();
    const records = Array.isArray(raw) ? raw : raw.questions;
    if (!Array.isArray(records)) throw new Error(`${entry.path}: questions が配列ではありません`);
    const subject = text(raw.subject || entry.subject || records[0]?.subject);
    const year = Number(raw.year || entry.year || records[0]?.year);
    const form = text(raw.form || entry.form || records[0]?.form).toUpperCase();
    const subjectSlug = subjectSlugFor(subject, raw.subjectSlug || entry.subjectSlug);
    const textbook = raw.textbook || entry.textbook || {};
    const questions = records.map((record) => {
      const question = normalizeQuestion(record);
      question.evidence.textbook ||= text(textbook.title);
      question.evidence.textbookId ||= text(textbook.textbookId);
      question.evidence.pdfPath ||= text(textbook.pdfPath);
      return question;
    });
    return {
      path: entry.path,
      set: {
        version: Number(raw.version) || 1,
        subject,
        subjectSlug,
        textbook: {
          textbookId: text(textbook.textbookId),
          title: text(textbook.title),
          pdfPath: text(textbook.pdfPath),
        },
        year,
        form,
        updatedAt: raw.updatedAt || entry.updatedAt || catalog.updatedAt,
        questions,
      },
    };
  }));
  const sets = new Map(loaded.map(({ path, set }) => [path, set]));
  const questions = loaded.flatMap(({ set }) => set.questions).sort(compareQuestions);
  return { catalog, sets, questions };
}

export async function loadQuestions() {
  return (await loadContentLibrary()).questions;
}

export function compareQuestions(a, b) {
  return a.subject.localeCompare(b.subject, "ja") ||
    a.year - b.year ||
    a.form.localeCompare(b.form, "ja") ||
    a.questionNumber - b.questionNumber ||
    a.id.localeCompare(b.id, "ja");
}

export function validateQuestion(input, index = 0) {
  const question = normalizeQuestion(input);
  const errors = [];
  const warnings = [];
  const add = (field, message) => errors.push({ index, id: question.id, field, message });
  const warn = (field, message) => warnings.push({ index, id: question.id, field, message });
  if (!question.id) add("id", "id は必須です");
  if (!question.subject) add("subject", "subject は必須です");
  if (!question.year) add("year", "year は必須です");
  if (!question.form) add("form", "form は必須です");
  if (!question.questionNumber) add("questionNumber", "questionNumber は必須です");
  if (!question.questionType) add("questionType", "questionType は必須です");
  if (!question.question) add("question", "question は必須です");
  if (!Array.isArray(input?.choices)) add("choices", "choices は配列で指定してください");
  else if (!question.choices.length) add("choices", "choices に選択肢が必要です");
  if (!question.answer) add("answer", "answer は必須です");
  if (question.answer && !question.choices.some((choice) => choice.label === question.answer)) {
    add("answer", `answer「${question.answer}」が choices.label にありません`);
  }
  if (question.questionType === "正誤問題") {
    const labels = question.choices.map((choice) => choice.label);
    if (labels.length !== 2 || !labels.includes("正") || !labels.includes("誤")) {
      add("choices", "正誤問題の choices.label は「正」「誤」にしてください");
    }
    if (!["正", "誤"].includes(question.answer)) add("answer", "正誤問題の answer は「正」または「誤」です");
  }
  if (question.questionNumber >= 31 && question.questionNumber <= 40 && !["正", "誤"].includes(question.answer)) {
    add("answer", "31〜40問の answer は「正」または「誤」です");
  }
  if (!input?.evidence || typeof input.evidence !== "object") add("evidence", "evidence は必須です");
  if (!question.evidence.page) add("evidence.page", "evidence.page は必須です（不明時は「要確認」）");
  if (!question.evidence.quote) add("evidence.quote", "evidence.quote は必須です（不明時は「要確認」）");
  if (!question.evidence.textbookId) warn("evidence.textbookId", "textbookId がありません。catalogの科目設定があれば補完されます");
  if (!question.evidence.pdfPath) warn("evidence.pdfPath", "pdfPath がありません。保存はできますがPDF表示は無効です");
  if (!question.evidence.pdfPage) warn("evidence.pdfPage", "pdfPage がありません。pageから数値を取得できる場合は代用します");
  return { question, errors, warnings };
}

export function validateQuestions(records) {
  if (!Array.isArray(records)) {
    return { questions: [], errors: [{ index: -1, id: "", field: "questions", message: "questions が配列ではありません" }], warnings: [] };
  }
  const checked = records.map((record, index) => validateQuestion(record, index));
  const errors = checked.flatMap((result) => result.errors);
  const warnings = checked.flatMap((result) => result.warnings);
  const seen = new Map();
  checked.forEach(({ question }, index) => {
    if (!question.id) return;
    if (seen.has(question.id)) {
      errors.push({ index, id: question.id, field: "id", message: `id「${question.id}」が重複しています（${seen.get(question.id) + 1}件目と重複）` });
    } else {
      seen.set(question.id, index);
    }
  });
  return { questions: checked.map((result) => result.question), errors, warnings };
}

export function buildCatalog(sets, updatedAt = new Date().toISOString(), baseCatalog = null) {
  const grouped = new Map();
  for (const subject of baseCatalog?.subjects || []) {
    if (!subject.textbook) continue;
    const subjectKey = `${subject.subject}\u0000${subject.subjectSlug}`;
    grouped.set(subjectKey, {
      subject: subject.subject,
      subjectSlug: subject.subjectSlug,
      textbook: {
        textbookId: text(subject.textbook.textbookId),
        title: text(subject.textbook.title),
        pdfPath: text(subject.textbook.pdfPath),
      },
      years: new Map(),
    });
  }
  for (const [path, set] of sets) {
    if (!set.questions?.length) continue;
    const subjectKey = `${set.subject}\u0000${set.subjectSlug}`;
    const inferredEvidence = set.questions.find((question) => question.evidence?.pdfPath || question.evidence?.textbookId)?.evidence || {};
    if (!grouped.has(subjectKey)) grouped.set(subjectKey, {
      subject: set.subject,
      subjectSlug: set.subjectSlug,
      textbook: {
        textbookId: text(set.textbook?.textbookId || inferredEvidence.textbookId),
        title: text(set.textbook?.title || inferredEvidence.textbook),
        pdfPath: text(set.textbook?.pdfPath || inferredEvidence.pdfPath),
      },
      years: new Map(),
    });
    const subject = grouped.get(subjectKey);
    if (!subject.textbook.pdfPath && (set.textbook?.pdfPath || inferredEvidence.pdfPath)) {
      subject.textbook = {
        textbookId: text(set.textbook?.textbookId || inferredEvidence.textbookId),
        title: text(set.textbook?.title || inferredEvidence.textbook),
        pdfPath: text(set.textbook?.pdfPath || inferredEvidence.pdfPath),
      };
    }
    if (!subject.years.has(set.year)) subject.years.set(set.year, []);
    subject.years.get(set.year).push({
      form: set.form,
      path,
      questionCount: set.questions.length,
      updatedAt: set.updatedAt || updatedAt,
    });
  }
  return {
    version: 1,
    updatedAt,
    subjects: [...grouped.values()]
      .sort((a, b) => a.subject.localeCompare(b.subject, "ja"))
      .map((subject) => ({
        subject: subject.subject,
        subjectSlug: subject.subjectSlug,
        ...(subject.textbook.pdfPath || subject.textbook.textbookId ? { textbook: subject.textbook } : {}),
        years: [...subject.years.entries()]
          .sort(([a], [b]) => a - b)
          .map(([year, forms]) => ({ year, forms: forms.sort((a, b) => a.form.localeCompare(b.form, "ja")) })),
      })),
  };
}
