# ダイソン公式「交換用パーツ」(dyson.co.jp/spare-parts) の機種別ページから転記したデータ（2026-11-03確認）
# 使い方: python3 data-src/dyson-build-data.py → data/dyson.json
import json, os
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SP = 'https://www.dyson.co.jp/spare-parts/'
LAMP = {'unit': 'lamp', 'value': 0, 'label': '本体・アプリが知らせたら'}
LAMP_NOTE = 'ダイソン公式のよくある質問では、空気清浄機がフィルターの寿命を確認し、交換時期になるとLCDディスプレイまたはMyDyson™アプリで知らせるとしています。フィルターは洗えません。'
BATT = {'unit': 'none', 'value': 0, 'label': '運転時間が短くなったら'}
BATT_NOTE = 'ダイソン公式は、運転時間が短くなったり充電が続かなくなった場合はバッテリー交換が必要な可能性があるとしています。V8などは同じシリーズでもバッテリーの種類が違うので、適合する型式を必ず確認してください。'
WASH = {'unit': 'none', 'value': 0, 'label': '洗って使う（傷んだら交換）'}
WASH_NOTE = 'ダイソン公式のよくある質問では、掃除機のフィルターは取り外して水道水で洗い、24時間以上完全に乾かしてから取り付けるとしています。'
HUM = {'unit': 'none', 'value': 0, 'label': '取扱説明書で確認'}

P = []  # id, name, kind, price, models, extra
def part(id, name, kind, price, models, **kw):
    life, note = {'pfilter': (LAMP, LAMP_NOTE), 'battery': (BATT, BATT_NOTE), 'vfilter': (WASH, WASH_NOTE), 'humid': (None, 'ダイソン公式の交換用パーツページには交換めやすの記載がありません。取扱説明書で確認してください。')}[kind]
    d = {'id': id, 'name': name, 'kind': kind, 'pack': 1, 'price': price, 'life': life, 'lifeNote': note, 'models': models}
    d.update(kw)
    P.append(d)

# 空気清浄機・加湿空気清浄機
part('965432-01', '一体型リサイクルグラスHEPA・活性炭フィルター', 'pfilter', 7700,
     ['HP10', 'TP10', 'HP09', 'TP09', 'HP07', 'TP7A', 'TP07', 'HP04', 'TP04', 'PH04', 'PH03', 'PH01'])
part('972426-01', 'Dyson Pure シリーズ交換用リサイクルフィルター', 'pfilter', 6600, ['TP03', 'TP02', 'TP00', 'AM11', 'BP01'])
part('972425-01', '一体型360°グラスHEPA・活性炭フィルター', 'pfilter', 6600, ['HP00', 'HP01', 'HP02', 'HP03', 'DP01', 'DP03'],
     stockNote='公式ストアでは在庫なし（2026/11/03時点）')
part('967161-11', 'フィルター＋フィルターカバー（シルバー）', 'pfilter', 6600, ['HP00', 'HP01', 'HP02', 'HP03'])
part('975009-01', '静電HEPAフィルター', 'pfilter', 9900, ['SP01'])
part('972132-01', 'HEPAフィルター', 'pfilter', 12980, ['BP02', 'BP03'])
part('972133-01', '活性炭フィルター', 'pfilter', 11990, ['BP02'])
part('972133-03', '活性炭フィルター', 'pfilter', 11990, ['BP03'], stockNote='公式ストアでは在庫なし（2026/11/03時点）')
part('970718-01', '加湿フィルター', 'humid', 5500, ['PH04', 'PH03', 'PH01'])

# コードレス掃除機：バッテリー
part('974815-01', 'V8バッテリー（タイプD）', 'battery', 9900, ['V8', 'V8 Focus Clean'],
     typeLabel='適合：SV10の一部・SV25・SV37・HH15。本体上部のプレフィルターが星形、またはつまみ付きの丸形で接続部が公式ページの図の形状のもの')
part('967834-06', 'V8バッテリー（タイプE）', 'battery', 9900, ['V8'],
     typeLabel='適合：SV10の一部。本体上部のプレフィルターがつまみ付きの丸形で接続部が公式ページの図の形状のもの')
part('968670-21', 'V7バッテリー', 'battery', 9900, ['V7'])
part('969352-01', 'V10バッテリー', 'battery', 9900, ['V10'])
part('970343-08', 'V11ボタン着脱式バッテリー＆充電器セット', 'battery', 9900, ['V11'],
     typeLabel='ボタンを押して着脱できるタイプ（SV15）用', stockNote='公式ストアでは在庫なし（2026/11/03時点）')
part('970145-06', 'V11バッテリー（ネジ固定式）', 'battery', 9900, ['V11'],
     typeLabel='ネジで固定するタイプ（SV14）用', stockNote='公式ストアでは在庫なし（2026/11/03時点）')
part('970938-01', 'V15バッテリー', 'battery', 9900, ['V15 Detect'])
part('972382-03', 'Gen5detectバッテリー（アイアン）', 'battery', 14960, ['Gen5detect'], variants='ブルーの 972382-04 もあります（同価格）。')
part('965363-01', 'Dyson Microバッテリー', 'battery', 9900, ['Micro 1.5kg'])
part('970774-01', 'SV18/SV57 バッテリー', 'battery', 14960, ['Digital Slim'])
part('975446-01', 'バッテリー', 'battery', 9900, ['V10 Optic', 'V8 Cyclone'])

# コードレス掃除機：フィルター
part('965661-01', 'プレフィルター', 'vfilter', 1650, ['V6', 'V7', 'DC62'])
part('967478-05', 'ポストフィルター（パープル）', 'vfilter', 2200, ['V7', 'V8 Slim'])
part('969082-01', 'フィルター（大）', 'vfilter', 6600, ['V10'], typeLabel='本体＋フィルターが大型タイプ（排気のスリットが6つ×2列）用')
part('969082-02', 'フィルター（小）', 'vfilter', 6600, ['V10'], typeLabel='本体＋フィルターが小型タイプ用')
part('970013-02', 'フィルター', 'vfilter', 6600, ['V11', 'V15 Detect'])
part('970013-03', 'V15 Detect用HEPAフィルター', 'vfilter', 7700, ['V15 Detect'])
part('972126-02', 'HEPAフィルター', 'vfilter', 7700, ['V12 Detect Slim'])
part('972126-03', 'Gen5detect用 HEPAフィルター', 'vfilter', 7700, ['Gen5detect'], stockNote='公式ストアでは在庫なし（2026/11/03時点）')
part('971178-01', 'フィルター', 'vfilter', 6600, ['Micro 1.5kg'])
part('970612-01', 'Dyson Digital Slim用フィルター', 'vfilter', 6600, ['Digital Slim'])

SRC = {
 'TP04': 'air-treatment/purifiers/pure-cool-tower-advanced', 'HP04': 'air-treatment/purifiers/pure-hot-cool-advanced',
 'TP07': 'air-treatment/purifiers/purifier-cool', 'TP7A': 'air-treatment/purifiers/purifier-cool-autoreact', 'HP07': 'air-treatment/purifiers/purifier-hot-cool',
 'TP09': 'air-treatment/purifiers/purifier-cool-formaldehyde', 'HP09': 'air-treatment/purifiers/purifier-hot-cool-formaldehyde',
 'TP10': 'air-treatment/purifiers/purifier-cool-gen1', 'HP10': 'air-treatment/purifiers/purifier-hot-cool-gen1',
 'SP01': 'air-treatment/purifiers/hushjet', 'BP02': 'air-treatment/purifiers/purifier-big-quiet-bp02', 'BP03': 'air-treatment/purifiers/purifier-big-quiet-formaldehyde-bp03',
 'BP01': 'air-treatment/purifiers/pure-cool-me', 'TP02': 'air-treatment/purifiers/pure-cool-link-tower', 'TP03': 'air-treatment/purifiers/pure-cool-link-tower',
 'TP00': 'air-treatment/purifiers/pure-cool-tower', 'AM11': 'air-treatment/purifiers/pure-cool-tower',
 'HP00': 'air-treatment/purifiers/pure-hot-cool', 'HP01': 'air-treatment/purifiers/pure-hot-cool', 'HP02': 'air-treatment/purifiers/pure-hot-cool-link', 'HP03': 'air-treatment/purifiers/pure-hot-cool-link',
 'DP01': 'air-treatment/purifiers/pure-cool-link-desk', 'DP03': 'air-treatment/purifiers/pure-cool-link-desk',
 'PH01': 'air-treatment/purifier-humidifiers/pure-humidify-cool', 'PH03': 'air-treatment/purifier-humidifiers/purifier-humidify-cool', 'PH04': 'air-treatment/purifier-humidifiers/purifier-humidify-cool-formaldehyde',
 'V6': 'vacuum-cleaners/cordless/v6', 'V7': 'vacuum-cleaners/cordless/v7', 'V8': 'vacuum-cleaners/cordless/v8', 'V8 Slim': 'vacuum-cleaners/cordless/v8-slim',
 'V8 Cyclone': 'vacuum-cleaners/cordless/cyclone-ds20', 'V8 Focus Clean': 'vacuum-cleaners/handhelds/micro1', 'V10': 'vacuum-cleaners/cordless/cyclone-v10',
 'V10 Optic': 'vacuum-cleaners/cordless/v10-optic', 'V11': 'vacuum-cleaners/cordless/v11', 'V12 Detect Slim': 'vacuum-cleaners/cordless/v12-detect-slim',
 'V15 Detect': 'vacuum-cleaners/cordless/v15-detect', 'Gen5detect': 'vacuum-cleaners/cordless/gen5detect', 'Micro 1.5kg': 'vacuum-cleaners/cordless/micro',
 'Digital Slim': 'vacuum-cleaners/cordless/digital-slim', 'DC62': 'vacuum-cleaners/cordless/dc62',
}
ds = {
 'maker': {
  'id': 'dyson', 'name': 'ダイソン', 'nameFull': 'ダイソン', 'category': '空気清浄機・掃除機',
  'modelLabelHint': '空気清浄機は「TP04」「HP07」などの型式、コードレス掃除機は「V8」「V11」などのシリーズ名か「SV10」などの型式で探せます。型式は本体（掃除機はバッテリー底部）のシールに書かれています。',
  'modelNote': '同じ「V8」「V10」「V11」でも、バッテリーやフィルターの種類が分かれています。下の注記で形状を確認してから選んでください。',
  'partsPolicy': 'ダイソン公式は、純正以外の部品（模倣品）を使うと保証が無効になることがあるとしています。',
  'partialNote': '部品番号と価格はダイソン公式「交換用パーツ」の機種別ページの内容です。リモコン・ツール・ヘッドなどは載せていません。在庫切れの部品も、公式に掲載がある場合は載せています。',
  'officialShop': SP,
  'genuineNote': 'Amazonではダイソン純正品より互換品のほうが多く出品されています。純正品は商品名に品番（例：965432-01）が入っているので、品番で照合してください。',
 },
 'checkedAt': '2026-11-03',
 'sourceUrl': SP, 'sourceName': 'ダイソン公式 交換用パーツ', 'sourceKind': 'メーカー公式ストア',
 'priceLabel': '公式ストア価格',
 'modelTitle': 'ダイソン {id} の交換フィルター・バッテリー 品番と価格｜純正パーツ',
 'primaryKinds': ['pfilter', 'humid', 'battery', 'vfilter'],
 'showFrequency': False,
 'modelSources': {k: SP + v for k, v in SRC.items()},
 'modelSourceLabel': 'ダイソン公式 交換用パーツ（{id}）',
 'aliases': {'SV07': 'V6', 'SV08': 'V6', 'SV09': 'V6', 'SV10': 'V8', 'SV25': 'V8', 'SV37': 'V8', 'HH15': 'V8 Focus Clean', 'SV14': 'V11', 'SV15': 'V11', 'SV18': 'Digital Slim', 'SV57': 'Digital Slim'},
 'series': [
  {'re': '^(TP|HP|SP|BP|DP|AM|PH)', 'key': 'air', 'name': '空気清浄機・加湿空気清浄機'},
  {'re': '^(V|Gen5|Micro|Digital|DC)', 'key': 'vac', 'name': 'コードレス掃除機'},
 ],
 'parts': P,
}
open(os.path.join(ROOT, 'data/dyson.json'), 'w').write(json.dumps(ds, ensure_ascii=False, indent=1) + '\n')
print(len(P), 'parts', len({m for p in P for m in p['models']}), 'models')
