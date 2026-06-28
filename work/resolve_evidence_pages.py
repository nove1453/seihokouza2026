#!/usr/bin/env python3
"""Resolve evidence pages only when the source question still has usable text."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = ROOT / "data" / "questions"
UPDATED_AT = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def set_evidence(
    question: dict,
    *,
    page: int,
    chapter: str,
    section: str,
    summary: str,
) -> None:
    evidence = question["evidence"]
    evidence.update(
        {
            "chapter": chapter,
            "section": section,
            "page": page,
            "pdfPage": page + 8,
            "quote": summary,
        }
    )
    question["chapter"] = chapter
    question["section"] = section


def resolve_souron(question: dict) -> bool:
    qid = question["id"]
    number = int(question["questionNumber"])

    if qid.startswith("2024-A-") and 1 <= number <= 5:
        page = 15 if number <= 2 else 16
        set_evidence(
            question,
            page=page,
            chapter="第1章 生命保険の仕組み",
            section="生命保険の技術的基礎―死亡表",
            summary=(
                "死亡表には国民生命表と経験生命表があり、経験生命表は"
                "総合表・選択表・終局表に区分される。"
            ),
        )
        return True

    if qid.startswith("2024-A-") and 6 <= number <= 10:
        set_evidence(
            question,
            page=17,
            chapter="第1章 生命保険の仕組み",
            section="生命保険の技術的基礎―危険選択の手段",
            summary=(
                "危険選択は生命保険募集人、診査医、生命保険面接士、査定者・"
                "決定者によって行われ、告知も重要な手段となる。"
            ),
        )
        return True

    if qid.startswith("2024-C-") and 16 <= number <= 20:
        page = 201 if number <= 17 else 202
        set_evidence(
            question,
            page=page,
            chapter="第6章 民間生命保険会社の今後のあり方",
            section="子会社による金融関連業務への進出",
            summary=(
                "保険業法上の本体業務の範囲と、規制緩和・金融システム改革法後の"
                "子会社による金融関連業務の拡大について説明している。"
            ),
        )
        return True

    if qid in {"2024-C-025", "2024-B-039"}:
        set_evidence(
            question,
            page=182,
            chapter="第6章 民間生命保険会社の今後のあり方",
            section="社会構造の変化―高齢化・少子化",
            summary=(
                "高齢化に伴う扶養負担と社会保障給付費の増加、出生数減少による"
                "社会保険収支への影響を説明している。"
            ),
        )
        return True

    return False


def topic_position(question: dict) -> int:
    return (int(question["questionNumber"]) - 1) % 5 + 1


def resolve_keiri(question: dict) -> bool:
    text = question.get("question", "")
    category = question.get("category", "")
    position = topic_position(question)

    if (
        text == "要確認"
        or "問題文はPDF該当箇所を確認" in text
        or "本文は要確認" in text
    ):
        return False

    if "複利運用" in text or category == "複利運用":
        pages = {1: 20, 2: 20, 3: 21, 4: 22, 5: 29 if "毎年始" in text else 26}
        page = pages[position]
        set_evidence(
            question,
            page=page,
            chapter="第2章 現価と終価",
            section="複利運用",
            summary="複利計算、実利率、年平均利回り、現価・終価の計算式と例題を参照。",
        )
        return True

    if "生存率・生存数・平均余命・保険料計算" in text:
        pages = {1: 5, 2: 7, 3: 9, 4: 38, 5: 39}
        page = pages[position]
        section = "死亡率・生存率・平均余命" if position <= 3 else "1年定期保険の純保険料"
        chapter = "第1章 生命保険と死亡表" if position <= 3 else "第3章 保険料"
        set_evidence(
            question,
            page=page,
            chapter=chapter,
            section=section,
            summary=f"「{section}」の定義、計算式および例題を参照。",
        )
        return True

    if "死亡表の種類" in text:
        pages = {1: 11, 2: 11, 3: 12, 4: 13, 5: 13}
        page = pages[position]
        set_evidence(
            question,
            page=page,
            chapter="第1章 生命保険と死亡表",
            section="死亡表の種類",
            summary="国民生命表・経験生命表、総合表・選択表など死亡表の分類を参照。",
        )
        return True

    if "払済保険" in text:
        set_evidence(
            question,
            page=112,
            chapter="第5章 解約返戻金と契約変更",
            section="払済保険",
            summary=(
                "解約返戻金を一時払保険料に充当し、元契約と同じ基礎率で"
                "払済保険金を計算する方法を参照。"
            ),
        )
        return True

    mappings = {
        "死亡率": (
            5,
            "第1章 生命保険と死亡表",
            "死亡率",
            "死亡率、生存率および死亡率の補整についての説明を参照。",
        ),
        "生命保険契約と年齢": (
            15,
            "第1章 生命保険と死亡表",
            "生命保険契約と年齢",
            "保険年齢方式と満年齢方式による年齢の取り扱いを参照。",
        ),
        "予定利率": (
            38,
            "第3章 保険料",
            "計算基礎―予定利率",
            "保険期間や商品の特性に応じた予定利率の設定についての説明を参照。",
        ),
        "資産の平均利回り": (
            23,
            "第2章 現価と終価",
            "資産の平均利回りに関する公式",
            "ハーディによる資産の平均利回りの公式を参照。",
        ),
        "保険計理の基礎": (
            33,
            "第3章 保険料",
            "収支相等の原則",
            "大数の法則を前提に、収入保険料と保険金・諸経費の収支を均衡させる原則を参照。",
        ),
        "加入年齢方式による転換": (
            119,
            "第5章 解約返戻金と契約変更",
            "契約転換制度―加入年齢方式",
            "加入年齢方式（責任準備金差額払込み型）の価格と差額の払込方法を参照。",
        ),
        "アセット・シェア方式": (
            132,
            "第6章 剰余金と契約者配当",
            "契約者配当の割当方法―アセット・シェア方式",
            "モデル収支残と年度末責任準備金との差額を基準に配当額を決める方式を参照。",
        ),
    }
    if category in mappings:
        page, chapter, section, summary = mappings[category]
        set_evidence(
            question,
            page=page,
            chapter=chapter,
            section=section,
            summary=summary,
        )
        return True

    return False


def main() -> None:
    counts = {"seiho-souron": 0, "seiho-keiri-math": 0}
    for slug, resolver in (
        ("seiho-souron", resolve_souron),
        ("seiho-keiri-math", resolve_keiri),
    ):
        for path in sorted((QUESTIONS / slug).glob("*/*.json")):
            document = json.loads(path.read_text(encoding="utf-8"))
            changed = 0
            for question in document["questions"]:
                if question.get("evidence", {}).get("page") == "要確認" and resolver(question):
                    changed += 1
            if changed:
                document["updatedAt"] = UPDATED_AT
                path.write_text(
                    json.dumps(document, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8",
                )
                counts[slug] += changed
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()
