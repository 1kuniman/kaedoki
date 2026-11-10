// パナソニック公式「加湿機をかしこく使うためのオプション（別売品）」（PDF、2025-08版）から
// data/panasonic-humidifier.json を作る。 使い方: node data-src/panasonic-humidifier-build.mjs
// PDFは文字が画像化されているため、表を目視で転記した（2026-11-10）。
// 適用機種欄は「FE-KX07C／KX05C／…」のように頭の「FE-」「F-」が省略されているので、直前の頭の記号を引き継いで展開する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://panasonic.jp/content/dam/panasonic/jp/ja/kashitsu/contents/pdf/250801/option.pdf';

const Y10 = { unit: 'year', value: 10, label: '約10年（約120か月）' };
const S4 = { unit: 'season', value: 4, label: '約4シーズン（約24か月）' };
const S2 = { unit: 'season', value: 2, label: '約2シーズン（約12か月）' };
const S1 = { unit: 'season', value: 1, label: '約1シーズン（約6か月）' };
const NOTE = '1日8時間運転した場合の目安（パナソニック公式資料の記載）。';
const SERVICE = 'サービスルート扱いのみ（販売店・修理窓口で注文）';

// [品番, 品名, 税込価格, 交換めやす, 適用機種（PDFの表記のまま）, 追加項目]
const rows = [
  ['FE-ZKE07', '交換用加湿フィルター', 4950, Y10, 'FE-KX07C/KX05C/KF07C/KXY07/KXY05/KFY07/KXW07/KXW05/KFW07/KXU07/KXU05/KFU07/KFU05/KXT07/KXT05/KFT07/KFT05/KXS07/KXS05/KFS07/KFS05/KXR07/KXR05/KFR07/KFR05/KXP07/KXP05/KFP07/KFP05/KXM07/KXM05/KFM07/KFM05/KXL07/KXL05/KFL07/KFL05/KXK07/KXK05/KFK07/KFK05'],
  ['FE-ZGE07', '交換用加湿フィルター', 5170, Y10, 'FE-KXJ07/KXH07/KXG07/KFJ07/KFH07/KFG07'],
  ['FE-ZGE05', '交換用加湿フィルター', 4950, Y10, 'FE-KXJ05/KXH05/KXG05/KFJ05/KFH05/KFG05'],
  ['FE-ZHE03', '交換用加湿フィルター', 3850, Y10, 'FE-KFU03/KFT03/KFS03/KFR03/KFP03/KFM03/KFL03/KFK03/KFJ03/KFH03'],
  ['FE-ZDE05', '交換用加湿フィルター', 5170, Y10, 'FE-KXF07/KLF07/KXF05/KLF05/KXE07/KLE07/KXE05/KLE05/7KLE6/5KLE6/KXD07/KLD07/KXD05/KLD05/7KLE5/5KLE5/F-VXJ35/VXH35/VXG35/VXGB35/VXH35B2/VXF35/VXE40/VXD50/VXD40'],
  ['FE-ZDE03', '交換用加湿フィルター', 4620, Y10, 'FE-KLG03/KLF03/KLE03/KLD03'],
  ['FE-ZPE23', '交換用加湿フィルター', 8250, Y10, 'FE-KXP23/KXP20', { pack: 2, packLabel: '2枚入り・1枠分', typeLabel: 'この機種は1台に2枠・4枚使います' }],
  ['FE-ZEE10', '交換用加湿フィルター', 8910, Y10, 'FE-KXF15/KFE15/KFE10'],
  ['FE-ZBH07', '交換用加湿フィルター', 2750, S4, 'FE-KXC07/KLC07/7KLE4/KLB07/7KLE3'],
  ['FE-ZBH05', '交換用加湿フィルター', 2420, S4, 'FE-KXC05/KLC05/5KLE4/KBLC05/KXB05/KLB05/5KLE3/KBLB05'],
  ['FE-ZBE07', '交換用加湿フィルター', 2750, S4, 'FE-KFB05/KLA07/KFA05/7KLE2/07KLZ/05KFZ/7KLV7'],
  ['FE-ZBE05', '交換用加湿フィルター', 2420, S4, 'F-VXC30/VDC30/VXB30/VX30E4/FE-KLA05/5KLE2/KBLA05/05KLZ/5KLV7/05KBLZ'],
  ['FE-ZBE03', '交換用加湿フィルター', 2200, S4, 'FE-03TLD/KLC03/KLB03/03TLB/KLA03/03TLA/03KLZ'],
  ['FE-Z05EWK', '交換用加湿フィルター', 3168, S1, 'FE-05KLY/5KLXV6/05KBLY/05KLW/05KBLW'],
  ['FE-Z03EWK', '交換用加湿フィルター', 3058, S1, 'FE-03KLY/03KLW'],
  ['FE-Z07EVK', '交換用加湿フィルター', 3278, S1, 'FE-07KLY/07KLW/07KLV'],
  ['FE-Z05EUK', '交換用加湿フィルター', 3058, S1, 'FE-05KLV/05KBLV/05KLU'],
  ['FE-Z06ETK', '交換用加湿フィルター', 3498, S1, 'FE-07KKLV/07KLU/06KLT'],
  ['FE-Z07ESK', '交換用加湿フィルター', 4708, S1, 'FE-14KFWP/14KFW/07KFW/14KFS/07KFS', { typeLabel: 'FE-14KFWP・14KFW・14KFSは1台に2個使います' }],
  ['FE-ZHG10', '交換用加湿フィルター', 3850, Y10, 'F-GMHK10/VKK20/VKJ20'],
  ['FKA0330076', '交換用クリーニングフィルター', 1210, S1, 'FE-KHA05/04KTP/05KTP/04KTR/05KTR/04AHY/04KHS/05KHS/05KTS/04KTT/04KHT/05KHT/05KHY/05KJT/04KHU/04KHV', { pack: 2, packLabel: '2枚入り', kind: 'clean', stockNote: SERVICE }],
  ['FKA0330104', '交換用クリーニングフィルター', 660, S1, 'FE-KHA05/04KTP/05KTP/04KTR/05KTR/04AHY/04KHS/05KHS/05KTS/04KTT/04KHT/05KHT/05KHY/05KJT/04KHU/04KHV', { kind: 'clean', stockNote: SERVICE }],
  ['FKA0330075', '交換用クリーニングフィルター', 1210, S1, 'FE-03KTP/03KTR/03KHS/03KTS/03KHT/03KHU', { pack: 2, packLabel: '2枚入り', kind: 'clean', stockNote: SERVICE }],
  ['FKA0330103', '交換用クリーニングフィルター', 660, S1, 'FE-03KTP/03KTR/03KHS/03KTS/03KHT/03KHU', { kind: 'clean', stockNote: SERVICE }],
  ['FE-ZPM07', '交換用除菌剤', 1650, S2, 'FE-KXP23/KXP20', { kind: 'jokinzai' }],
];

function expand(list) {
  let pfx = '';
  return list.split('/').map(t => {
    const m = t.match(/^(FE-|F-)(.+)$/);
    if (m) { pfx = m[1]; return t; }
    if (!pfx) throw new Error('頭の記号がない: ' + list);
    return pfx + t;
  });
}

const parts = rows.map(([id, name, price, life, list, extra = {}]) => {
  const models = expand(list);
  if (new Set(models).size !== models.length) throw new Error('重複: ' + id);
  const p = { id, name, kind: extra.kind || 'humid', pack: extra.pack || 1 };
  if (extra.packLabel) p.packLabel = extra.packLabel;
  if (extra.typeLabel) p.typeLabel = extra.typeLabel;
  if (extra.stockNote) p.stockNote = extra.stockNote;
  p.price = price;
  p.life = life;
  p.lifeNote = NOTE + (life === S1 && p.kind === 'humid' ? '1シーズンは約6か月です。' : '');
  p.models = models.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});

const series = [
  { re: '^FE-(KHA|0[345]K[HTJ]|04AHY)', key: 'steam', name: 'FE-05KHY・05KTSほか（クリーニングフィルターを使う機種）' },
  { re: '^FE-K[XF]', key: 'kx', name: 'FE-KX・FE-KF系' },
  { re: '^FE-K', key: 'kl', name: 'FE-KL・FE-KBL系' },
  { re: '^FE-\\d', key: 'num', name: 'FE-05KLY・07KLWほか（数字で始まる品番）' },
  { re: '^F-', key: 'f', name: 'F-VXJ35・F-VKK20ほか（「F-」で始まる品番）' },
];
const res = series.map(s => new RegExp(s.re));
const allModels = [...new Set(parts.flatMap(p => p.models))];
const unmatched = allModels.filter(m => !res.some(r => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));

const ds = {
  maker: {
    id: 'panasonic-humidifier', name: 'パナソニック', navName: 'パナソニック加湿機', nameFull: 'パナソニック', category: '加湿機',
    modelLabelHint: '品番は本体の側面または背面のラベルに書かれています。「FE-」から始まる英数字です（一部の機種は「F-」から始まります）。',
    modelNote: '品番の末尾の「-W」「-T」などは本体色を表す記号です。検索するときは省いて入力してください。',
    partsPolicy: '交換のめやすは、1日8時間運転した場合の目安です。クリーニングフィルターは、販売店や修理窓口から取り寄せる「サービスルート扱い」の部品です。',
    partialNote: 'このページの部品と価格は、パナソニック公式資料「加湿機をかしこく使うためのオプション（別売品）」に載っているものです。資料にない旧機種は、取扱説明書で確認してください。',
    officialShop: 'https://ec-plus.panasonic.jp/',
    genuineNote: '互換品はサイズや性能がメーカーの想定と異なる場合があります。純正品は品番が商品名に入っているので、品番で照合してください。',
  },
  checkedAt: '2026-11-10',
  sourceUrl: SRC,
  sourceName: 'パナソニック 加湿機をかしこく使うためのオプション（別売品）（PDF）',
  sourceKind: 'メーカー公式資料',
  priceLabel: '希望小売価格',
  primaryKinds: ['humid', 'clean'],
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/panasonic-humidifier.json'), JSON.stringify(ds, null, 1) + '\n');
console.log(`panasonic-humidifier: ${parts.length} parts, ${allModels.length} models`);
