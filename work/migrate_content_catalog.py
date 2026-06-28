import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
UPDATED_AT = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

SUBJECT_SLUGS = {
    "生命保険総論": "seiho-souron",
    "生命保険経理": "seiho-keiri",
    "危険選択": "kiken-sentaku",
    "生命保険計理": "seiho-keiri-math",
    "約款と法律": "yakkan-houritsu",
}

sources = [
    DATA / "questions.json",
    DATA / "questions-2022-b.json",
    DATA / "questions-2022-c.json",
    DATA / "questions-2023-a.json",
    DATA / "2023-formB-seiho-souron-import-fixed.json",
    DATA / "2023-formC-seiho-souron-import-fixed.json",
    DATA / "2024-formA-seiho-souron-import.json",
    DATA / "2024-formB-seiho-souron-import.json",
    DATA / "2024-formC-seiho-souron-import.json",
]

groups = {}
for source in sources:
    if not source.exists():
        continue
    payload = json.loads(source.read_text(encoding="utf-8-sig"))
    questions = payload if isinstance(payload, list) else payload["questions"]
    for question in questions:
        key = (question["subject"], int(question["year"]), str(question["form"]))
        groups.setdefault(key, []).append(question)

subjects = []
for subject in sorted({key[0] for key in groups}):
    slug = SUBJECT_SLUGS.get(subject)
    if not slug:
        raise ValueError(f"subjectSlug is not defined: {subject}")
    years = []
    for year in sorted({key[1] for key in groups if key[0] == subject}):
        forms = []
        for form in sorted(key[2] for key in groups if key[0] == subject and key[1] == year):
            questions = sorted(groups[(subject, year, form)], key=lambda item: item["questionNumber"])
            relative = Path("data") / "questions" / slug / str(year) / f"{form}.json"
            destination = ROOT / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(json.dumps({
                "version": 1,
                "subject": subject,
                "subjectSlug": slug,
                "year": year,
                "form": form,
                "updatedAt": UPDATED_AT,
                "questions": questions,
            }, ensure_ascii=False, indent=2), encoding="utf-8")
            forms.append({
                "form": form,
                "path": relative.as_posix(),
                "questionCount": len(questions),
                "updatedAt": UPDATED_AT,
            })
        years.append({"year": year, "forms": forms})
    subjects.append({
        "subject": subject,
        "subjectSlug": slug,
        "years": years,
    })

(DATA / "catalog.json").write_text(json.dumps({
    "version": 1,
    "updatedAt": UPDATED_AT,
    "subjects": subjects,
}, ensure_ascii=False, indent=2), encoding="utf-8")

print(f"migrated {sum(map(len, groups.values()))} questions into {len(groups)} sets")
