import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXAM = (ROOT / "work/text/exam.txt").read_text(encoding="utf-8")


def tidy(value: str) -> str:
    value = re.sub(r"===== PDF PAGE \d+ =====", "", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n[ \t]+", "\n", value)
    value = re.sub(r"(?<=[^\n。！？])\n(?=[^\n])", "", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


form_a = re.sub(r"===== PDF PAGE \d+ =====", "", EXAM)
form_a = form_a.split("試 験 問 題【 フ ォ ー ムＡ 】", 1)[1]
form_a = form_a.split("〈2022 年度〉生命保険講座「生命保険総論」試験問題【フォームＡ】 解答一覧", 1)[0]

answers = {
    1: "ケ", 2: "ウ", 3: "エ", 4: "イ", 5: "キ",
    6: "ウ", 7: "ア", 8: "キ", 9: "カ", 10: "イ",
    11: "ク", 12: "ウ", 13: "キ", 14: "カ", 15: "コ",
    16: "エ", 17: "ケ", 18: "イ", 19: "オ", 20: "コ",
    21: "イ", 22: "ウ", 23: "イ", 24: "ア", 25: "ウ",
    26: "ア", 27: "ウ", 28: "イ", 29: "ア", 30: "ウ",
    31: "正", 32: "正", 33: "誤", 34: "誤", 35: "正",
    36: "正", 37: "正", 38: "正", 39: "誤", 40: "誤",
    41: "ウ", 42: "オ", 43: "イ", 44: "イ", 45: "エ",
    46: "ア", 47: "ア", 48: "エ", 49: "オ", 50: "ア",
}

chapters = {
    "生命保険の仕組み": "第1章 生命保険の仕組み",
    "生命保険契約の特殊性": "第1章 生命保険の仕組み",
    "生命保険契約の要素": "第1章 生命保険の仕組み",
    "生命保険の技術的基礎": "第1章 生命保険の仕組み",
    "生命保険商品の基本型": "第1章 生命保険の仕組み",
    "保険の歴史": "第2章 保険の生成・発展",
    "日本における生命保険の発展": "第2章 保険の生成・発展",
    "生命保険と社会経済": "第3章 生命保険と社会経済",
    "社会保障": "第3章 生命保険と社会経済",
    "介護保険制度": "第3章 生命保険と社会経済",
    "保険業法": "第4章 生命保険会社の経営に関する法的規制",
    "隣接業界": "第5章 民間生命保険の隣接業界",
    "少額短期保険業": "第5章 民間生命保険の隣接業界",
    "今後の生命保険会社のあり方": "第6章 民間生命保険会社の今後のあり方",
}

meta = {
    **{n: ("生命保険契約の特殊性", "生命保険契約の特殊性", "7-9") for n in range(1, 11)},
    **{n: ("今後の生命保険会社のあり方", "社会構造の変化", "181-183") for n in range(11, 21)},
    21: ("生命保険契約の要素", "被保険者", "13"),
    22: ("保険の歴史", "アームストロング調査", "63-64"),
    23: ("介護保険制度", "介護保険制度の概要", "140-142"),
    24: ("保険業法", "保険業法の概要", "149-150"),
    25: ("少額短期保険業", "少額短期保険業", "176-177"),
    26: ("生命保険の仕組み", "保険の対象となる危険の種類", "4-5"),
    27: ("生命保険の技術的基礎", "危険の選択", "16-18"),
    28: ("保険の歴史", "賦課式保険の問題点", "56-57"),
    29: ("日本における生命保険の発展", "近代的生命保険の導入", "72-76"),
    30: ("生命保険と社会経済", "資産運用の原則", "108-110"),
    31: ("生命保険の技術的基礎", "責任準備金", "24-26"),
    32: ("生命保険商品の基本型", "生死混合保険", "31"),
    33: ("保険の歴史", "エクイタブル・ソサエティーの誕生", "57-58"),
    34: ("保険の歴史", "金融革命の進展と生命保険事業", "67-70"),
    35: ("生命保険と社会経済", "世帯加入状況", "103-105"),
    36: ("今後の生命保険会社のあり方", "資産運用", "200-202"),
    37: ("保険業法", "相互会社と株式会社", "160-164"),
    38: ("隣接業界", "JA共済", "166-169"),
    39: ("隣接業界", "損害保険", "174-175"),
    40: ("今後の生命保険会社のあり方", "消費構造の変化", "184-186"),
    41: ("生命保険契約の要素", "保険契約者", "13"),
    42: ("生命保険の技術的基礎", "死亡表", "15-16"),
    43: ("生命保険の技術的基礎", "契約者配当", "27-30"),
    44: ("保険の歴史", "友愛組合", "58-59"),
    45: ("生命保険の技術的基礎", "死亡表", "15-16"),
    46: ("生命保険と社会経済", "生命保険会社の資金の性格", "108"),
    47: ("社会保障", "私的保障と社会保障", "119-126"),
    48: ("保険業法", "生命保険業の監督の方法", "148-149"),
    49: ("隣接業界", "こくみん共済 coop〈全労済〉", "169-170"),
    50: ("今後の生命保険会社のあり方", "生保業界におけるシステム動向", "197-200"),
}

summaries = {
    1: "生命保険取引も私的自治（契約自由）を原則とし、当事者の合意を前提とする。",
    2: "契約内容の給付と反対給付は、当事者間の債権債務関係として構成される。",
    3: "生命保険は経済的な本質と技術的基礎を持つため、一般契約とは異なる法的特殊性が生じる。",
    4: "保険法は保険契約の基本規律を定め、共済契約も適用対象に含める。",
    5: "旧商法の保険規定は商行為としての保険を主な規律対象としていた。",
    6: "約款は大量・定型取引の基礎となり、一般に契約当事者を拘束する効力が認められる。",
    7: "約款の拘束力の根拠には法規範説、意思推定説、慣習法説などがある。",
    8: "生命保険は大量かつ定型的に処理される取引であり、統一的な約款が必要となる。",
    9: "法律に強行規定がない限り、当事者間ではまず保険約款が適用される。",
    10: "強行規定は約款や合意に優先して適用される。",
    11: "平均寿命の伸長は高齢化を進める主要因の一つである。",
    12: "国連の従来基準では、65歳以上人口が7％を超える社会を高齢化社会とする。",
    13: "日本の高齢化は諸外国と比べて速いテンポで進んだ。",
    14: "高齢化により現役世代の高齢者扶養負担が重くなる。",
    15: "高齢者扶養の指標では、65歳以上人口を15～64歳人口が何人で支えるかを見る。",
    16: "社会保障給付費では年金給付が大きな割合を占める。",
    17: "生涯医療費は高齢期に集中し、旧資料では約半分が70歳以上で必要とされた。",
    18: "少子化の代表的指標は合計特殊出生率である。",
    19: "死亡数が出生数を上回ると自然減となり、人口減少につながる。",
    20: "女性の就業状況を見る代表的な指標として労働力率が用いられる。",
    21: "被保険者は自然人である必要があるが、1契約に複数人を定めることもできる。",
    22: "1906年のニューヨーク州法は、猶予期間や不可争期間など契約者保護の契約条項を整備した。",
    23: "第1号被保険者は65歳以上で、原因を問わず要介護・要支援状態なら給付対象となる。",
    24: "保険業法には行政的監督規定と、保険会社の組織・業務に関する規定が併存する。",
    25: "少額短期保険業者にも情報開示、責任準備金、早期是正措置などの契約者保護規制がある。",
    26: "保険対象となる危険は、経済主体の制御を超える性格を持つ必要があるため、選択肢アの否定表現が誤り。",
    27: "高危険者ほど加入意欲が強い現象は逆選択であり、第1次選択ではない。",
    28: "賦課式生命保険では死亡率上昇により、給付一定なら分担金は増加し、分担金一定なら給付は減少する。",
    29: "福沢諭吉が紹介したのは主にイギリスの保険制度であり、ドイツではない。",
    30: "特別勘定でも換金需要への備えは必要で、流動性を考慮せず収益性だけを追求するわけではない。",
    31: "平準保険料方式の責任準備金は将来給付と将来保険料の差額で、自然保険料方式では基本的に生じにくい。",
    32: "生死混合保険は、期間内死亡の死亡保険金と満期生存時の生存保険金を組み合わせる。",
    33: "1762年に設立された世界最初の科学的生命保険会社はエクイタブル・ソサエティーである。",
    34: "ユニバーサル保険は払込の自在性を持つが、引出しは死亡保障額などに影響し得るため記述は誤り。",
    35: "民間生保の世帯加入率は高度成長期まで急伸し、その後は微増、1994年をピークに停滞傾向となった。",
    36: "デリバティブの活用や大口与信管理は、効率的で統制された資産運用体制の要素である。",
    37: "2000年改正で端株相当を換価して金銭交付できるようになり、株式会社化の実務が容易になった。",
    38: "JA共済は生命系と損害系の双方を扱い、大型保障性商品にも注力している。",
    39: "損害保険は原則として実際の損害を填補する保険で、定額給付を定義とする記述は誤り。",
    40: "現在は外的要素に流される方向ではなく、比較・検討して納得できる商品を選ぶ姿勢が強まっている。",
    41: "保険契約者が保険者に支払う対価は保険金ではなく保険料である。",
    42: "経験生命表には総合表・選択表・終局表があり、終局表は選択効果消滅後の死亡率を示す。",
    43: "利差配当率は予定利率と経過年数を考慮し、責任準備金を反映して計算する。",
    44: "英国の共済的組織は友愛組合で、ギルドの精神を受け継いだとされる。",
    45: "第三分野用標準生命表の死亡率は、死亡保険用とほぼ同率に設定された。",
    46: "保険契約準備金は資産ではなく負債の大部分を占め、その中心が責任準備金である。",
    47: "社会保険の権利は保険料拠出を前提とし、公的扶助は資力調査を要件とする。",
    48: "日本は実体的監督主義を採り、主務大臣は内閣総理大臣と財務大臣である。",
    49: "生協法に基づく労働者共済の全国組織で最大規模なのは、こくみん共済 coop〈全労済〉である。",
    50: "共同契約が必要となる代表例は団体定期保険で、生保共同センター（LINC）が共通基盤となる。",
}

year_note = (
    "この設問の数値・表現は2022年度問題に基づく。2026年版テキストでは統計時点が更新されているため、"
    "試験では最新版の本文数値も確認する。"
)


def options_from(block: str) -> list[dict]:
    matches = list(re.finditer(r"(?m)^([アイウエオカキクケコ])．", block))
    result = []
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        text = tidy(block[match.end():end])
        text = re.split(r"\n\s*(?:＜|語群|copyright)", text)[0].strip()
        result.append({"label": match.group(1), "text": text})
    return result


questions = []
group_pages = [(2, range(1, 6)), (3, range(6, 11)), (4, range(11, 16)), (5, range(16, 21))]
page_chunks = {
    page: EXAM.split(f"===== PDF PAGE {page} =====", 1)[1].split(f"===== PDF PAGE {page + 1} =====", 1)[0]
    for page, _ in group_pages
}

for page, numbers in group_pages:
    block = page_chunks[page]
    stem = block.split("語群", 1)[0]
    stem = re.sub(r"^\s*［[^\n]+］\s*", "", stem, count=1)
    stem = re.sub(r"文中の空欄.*?選んでください。\s*", "", stem, count=1, flags=re.S)
    stem = tidy(stem)
    choices = options_from(block.split("語群", 1)[1])
    for number in numbers:
        category, section, page_ref = meta[number]
        answer_label = answers[number]
        answer_text = next(item["text"] for item in choices if item["label"] == answer_label)
        questions.append({
            "id": f"2022-A-{number:03d}",
            "year": 2022,
            "form": "A",
            "subject": "生命保険総論",
            "questionNumber": number,
            "questionType": "語群選択",
            "category": category,
            "chapter": chapters[category],
            "section": section,
            "question": f"次の文章の空欄［{number}］に入る最も適切なものを選んでください。\n\n{stem}",
            "choices": choices,
            "answer": answer_label,
            "answerText": answer_text,
            "explanation": summaries[number] + (f"\n\n{year_note}" if 11 <= number <= 20 else ""),
            "keyPoint": f"空欄［{number}］は「{answer_text}」。前後の語句とのつながりまでセットで覚える。",
            "commonMistake": "語句だけを暗記せず、本文中で何と対比・修飾されているかを確認する。",
            "difficulty": "標準",
            "tags": ["2022年度", "フォームA"],
            "evidence": {
                "textbook": "2026年版 生命保険講座 生命保険総論",
                "page": page_ref,
                "chapter": chapters[category],
                "section": section,
                "quote": summaries[number],
            },
        })

markers = []
for number in range(21, 51):
    match = re.search(rf"(?:［\s*{number}\s*］|(?m:^{number}［))", form_a)
    markers.append((number, match.start()))

for index, (number, start) in enumerate(markers):
    end = markers[index + 1][1] if index + 1 < len(markers) else len(form_a)
    block = form_a[start:end].strip()
    block = re.sub(rf"^(?:［\s*{number}\s*］|{number}［)", "", block)
    if number <= 30:
        title, rest = block.split("\n", 1)
        rest = re.sub(r"^次の文章のうち、.*?選んでください。\s*", "", rest, count=1, flags=re.S)
        choices = options_from(rest)
        question_text = title.strip()
    elif number <= 40:
        title = block.split("］", 1)[0].strip()
        rest = block.split("］", 1)[1]
        rest = re.sub(r"^\s*次の文章について、.*?選んでください。\s*", "", rest, count=1, flags=re.S)
        rest = re.sub(r"\n正\s*\n誤\s*.*$", "", rest, flags=re.S)
        choices = [{"label": "正", "text": "正しい"}, {"label": "誤", "text": "誤っている"}]
        question_text = f"{title}\n\n{tidy(rest)}"
    else:
        title = block.split("］", 1)[0].strip()
        rest = block.split("］", 1)[1]
        rest = re.sub(r"^\s*次の文章について、.*?記号Ｃ\s*を選択してください。\s*", "", rest, count=1, flags=re.S)
        choices = options_from(rest)
        first_option = re.search(r"(?m)^ア．", rest)
        question_text = f"{title}\n\n{tidy(rest[:first_option.start()])}"

    category, section, page_ref = meta[number]
    answer_label = answers[number]
    try:
        answer_text = next(item["text"] for item in choices if item["label"] == answer_label)
    except StopIteration as error:
        raise RuntimeError(f"Could not find answer {answer_label} for question {number}: {choices}") from error
    qtype = (
        "正しいものを1つ選ぶ" if number <= 25 else
        "誤っているものを1つ選ぶ" if number <= 30 else
        "正誤問題" if number <= 40 else
        "適切な組み合わせ"
    )
    questions.append({
        "id": f"2022-A-{number:03d}",
        "year": 2022,
        "form": "A",
        "subject": "生命保険総論",
        "questionNumber": number,
        "questionType": qtype,
        "category": category,
        "chapter": chapters[category],
        "section": section,
        "question": question_text,
        "choices": choices,
        "answer": answer_label,
        "answerText": answer_text,
        "explanation": summaries[number],
        "keyPoint": summaries[number],
        "commonMistake": "正誤を決める語句（年齢・主体・増減・制度名）を拾い、正しい部分だけで判断しない。",
        "difficulty": "標準",
        "tags": ["2022年度", "フォームA"],
        "evidence": {
            "textbook": "2026年版 生命保険講座 生命保険総論",
            "page": page_ref,
            "chapter": chapters[category],
            "section": section,
            "quote": summaries[number],
        },
    })

questions.sort(key=lambda item: item["questionNumber"])
assert len(questions) == 50
assert all(item["choices"] for item in questions)
assert all(any(c["label"] == item["answer"] for c in item["choices"]) for item in questions)

destination = ROOT / "data/questions.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(questions, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"wrote {len(questions)} questions to {destination}")
