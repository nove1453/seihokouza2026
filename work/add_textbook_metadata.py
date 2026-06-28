import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TEXTBOOK = {
    "textbookId": "seiho-souron-2026",
    "title": "2026年版 生命保険講座 生命保険総論",
    "pdfPath": "data/textbooks/seiho-souron-2026.pdf",
}
PDF_PAGE_OFFSET = 8


def first_printed_page(value):
    match = re.search(r"\d+", str(value or ""))
    return int(match.group()) if match else None


updated_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
updated_questions = 0

for path in sorted((DATA / "questions" / "seiho-souron").rglob("*.json")):
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["textbook"] = TEXTBOOK
    for question in payload.get("questions", []):
        evidence = question.setdefault("evidence", {})
        evidence["textbookId"] = TEXTBOOK["textbookId"]
        evidence["pdfPath"] = TEXTBOOK["pdfPath"]
        printed_page = first_printed_page(evidence.get("page"))
        evidence["pdfPage"] = printed_page + PDF_PAGE_OFFSET if printed_page else None
        updated_questions += 1
    payload["updatedAt"] = updated_at
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

catalog_path = DATA / "catalog.json"
catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
for subject in catalog.get("subjects", []):
    if subject.get("subjectSlug") == "seiho-souron":
        subject["textbook"] = TEXTBOOK
catalog["updatedAt"] = updated_at
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

template_path = DATA / "import-template.json"
if template_path.exists():
    template = json.loads(template_path.read_text(encoding="utf-8"))
    template_questions = template if isinstance(template, list) else template.get("questions", [])
    for question in template_questions:
        evidence = question.setdefault("evidence", {})
        evidence.setdefault("textbookId", TEXTBOOK["textbookId"])
        evidence.setdefault("pdfPath", TEXTBOOK["pdfPath"])
        printed_page = first_printed_page(evidence.get("page"))
        evidence.setdefault("pdfPage", printed_page + PDF_PAGE_OFFSET if printed_page else None)
    template_path.write_text(json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"updated {updated_questions} questions and catalog textbook metadata")
