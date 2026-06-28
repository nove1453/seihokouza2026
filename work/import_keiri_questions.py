import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("/Users/taisuke/Desktop/生保講座/data/questions/seiho-keiri-math")
DESTINATION = ROOT / "data" / "questions" / "seiho-keiri-math"
CATALOG_PATH = ROOT / "data" / "catalog.json"
UPDATED_AT = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

SUBJECT = "生命保険計理"
SUBJECT_SLUG = "seiho-keiri-math"
TEXTBOOK = {
    "textbookId": "seiho-keiri-math-2026",
    "title": "2026年版 生命保険講座 生命保険計理",
    "pdfPath": "data/textbooks/seiho-keiri-math-2026.pdf",
}
PDF_PAGE_OFFSET = 8


def first_page(value):
    match = re.search(r"\d+", str(value or ""))
    return int(match.group()) if match else None


def useful_label(value):
    value = str(value or "").strip()
    return value not in {"", "要確認", "該当項目", "生命保険計理"}


def normalized_category(question):
    category = str(question.get("category") or "").strip()
    evidence = question.get("evidence") or {}
    malformed = not category or category == "要確認" or category.startswith("～")
    generic = category == "生命保険計理"
    if malformed or generic:
        if useful_label(evidence.get("section")):
            return str(evidence["section"]).strip()
        if malformed and useful_label(evidence.get("chapter")):
            return re.sub(r"^第\d+章\s*", "", str(evidence["chapter"])).strip()
        if malformed:
            return "生命保険計理"
    return category


catalog_forms = {}
all_ids = set()
total = 0
fixed_categories = 0
normalized_types = 0

for source_path in sorted(SOURCE.rglob("*.json")):
    payload = json.loads(source_path.read_text(encoding="utf-8-sig"))
    questions = payload if isinstance(payload, list) else payload.get("questions")
    if not isinstance(questions, list):
        raise ValueError(f"questions is not an array: {source_path}")
    if not questions:
        raise ValueError(f"questions is empty: {source_path}")

    year = int(payload.get("year") or questions[0].get("year"))
    form = str(payload.get("form") or questions[0].get("form")).upper()
    if len(questions) != 50:
        raise ValueError(f"{year} Form {form}: expected 50 questions, got {len(questions)}")

    for question in questions:
        question_id = str(question.get("id") or "")
        if not question_id or question_id in all_ids:
            raise ValueError(f"missing or duplicate id: {question_id}")
        all_ids.add(question_id)
        if question.get("subject") != SUBJECT:
            raise ValueError(f"unexpected subject: {question_id}")
        if int(question.get("year") or 0) != year or str(question.get("form")).upper() != form:
            raise ValueError(f"year/form mismatch: {question_id}")

        category = normalized_category(question)
        if category != question.get("category"):
            fixed_categories += 1
            question["category"] = category

        if question.get("questionType") == "適切な組み合わせ":
            normalized_types += 1
            question["questionType"] = "組み合わせ選択"

        evidence = question.setdefault("evidence", {})
        evidence["textbook"] = TEXTBOOK["title"]
        evidence["textbookId"] = TEXTBOOK["textbookId"]
        evidence["pdfPath"] = TEXTBOOK["pdfPath"]
        printed_page = first_page(evidence.get("page"))
        evidence["pdfPage"] = printed_page + PDF_PAGE_OFFSET if printed_page else None
        total += 1

    destination = DESTINATION / str(year) / f"{form}.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps({
        "version": 1,
        "subject": SUBJECT,
        "subjectSlug": SUBJECT_SLUG,
        "textbook": TEXTBOOK,
        "year": year,
        "form": form,
        "updatedAt": UPDATED_AT,
        "questions": questions,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    catalog_forms.setdefault(year, []).append({
        "form": form,
        "path": f"data/questions/{SUBJECT_SLUG}/{year}/{form}.json",
        "questionCount": len(questions),
        "updatedAt": UPDATED_AT,
    })

catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
subject_entry = next(
    (subject for subject in catalog.get("subjects", []) if subject.get("subjectSlug") == SUBJECT_SLUG),
    None,
)
if subject_entry is None:
    subject_entry = {"subject": SUBJECT, "subjectSlug": SUBJECT_SLUG}
    catalog.setdefault("subjects", []).append(subject_entry)
subject_entry["subject"] = SUBJECT
subject_entry["textbook"] = TEXTBOOK
subject_entry["years"] = [
    {"year": year, "forms": sorted(forms, key=lambda item: item["form"])}
    for year, forms in sorted(catalog_forms.items())
]
catalog["subjects"].sort(key=lambda item: item.get("subject", ""))
catalog["updatedAt"] = UPDATED_AT
CATALOG_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

print(json.dumps({
    "questionCount": total,
    "setCount": sum(len(forms) for forms in catalog_forms.values()),
    "fixedCategories": fixed_categories,
    "normalizedQuestionTypes": normalized_types,
    "catalogYears": sorted(catalog_forms),
}, ensure_ascii=False))
