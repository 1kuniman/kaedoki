// シャープ公式サポート「加湿器 別売オプション品」のデータから data/sharp-humidifier.json を作る。
// 出典：https://jp.sharp/support/humid_con/option.html （ページが読み込む option_data.js・product_option_data.js の内容。2026-11-22 取得）
// 使い方: node data-src/sharp-humidifier-build.mjs
// 適用機種は「HV-」を省いて書いている。取得元の「部品:機種」432組と一致することをハッシュで検査する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://jp.sharp/support/humid_con/option.html';

const S8 = { unit: 'season', value: 8, label: '8シーズン（約48か月）' };
const S3 = { unit: 'season', value: 3, label: '3シーズン（約18か月）' };
const S1 = { unit: 'season', value: 1, label: '1シーズン（約6か月）' };
const Y1 = { unit: 'year', value: 1, label: '約1年' };
const Y2 = { unit: 'year', value: 2, label: '約2年' };
const EOL = '生産終了（シャープ公式の別売品ページの表示）';
const AG = '30E1,50E1,70E1,C30,C50,C70,D30,D30E2,D50,D50E2,D70,D70E2,E30,E30E3,E50,E50E3,E70,E70E3,EX30,F30,F30E4,F50,F50E4,F70,F70E4,G30,G30E5,G50,G50E5,G70,G70E5,H30,H30E6,H55,H55E6,H75,H75E6,J30,J30E7,J55,J55E7,J75,J75E7,L30,L30E8,L55,L55E8,L75,L75E8,P30,P30E9,P55,P55E9,P75,P75E9,R30,R55,R75,R120,S55,S75,T55,T75';

// [品番, 品名, 種類, 税込価格(なければnull), 交換めやす, 適用機種, 追加]
const rows = [
  ['HV-FY5', '加湿フィルター', 'humid', 2750, S8, '500CX,50E1,50E4J,50E5J,50E6,50E7,50E8,50E9,700CX,70E1,70E4J,70E5J,70E6,70E7,70E8,70E9,A50,A70,B50,B70,C50,C70,D50,D50E2,D70,D70E2,E50,E50E3,E70,E70E3,F50,F50E4,F70,F70E4,G50,G50E5,G70,G70E5,S50CX,S50E2,S70CX,S70E2,T50CX,T50E3,T70CX,T70E3,U50CX,U70CX,W50CX,W70CX,Y50CX,Y70CX,Z50CX,Z70CX', { typeLabel: 'HV-FS5の代用品' }],
  ['HV-FY3', '加湿フィルター', 'humid', 2420, S8, '300CX,310CX,30E1,30E4J,30E5J,30E6,30E7,30E8,30E9,A30,B30,C30,D30,D30E2,E30,E30E3,F30,F30E4,G30,G30E5,H30,H30E6,J30,J30E7,L30,L30E8,P30,P30E9,R30,S30CX,S30E2,T30CX,T30E3,U30CX,W30CX,Y30CX,Z30CX', { typeLabel: 'HV-FS3の代用品' }],
  ['HV-FH7', '加湿フィルター', 'humid', 3190, S8, 'H55,H55E6,H75,H75E6,J55,J55E7,J75,J75E7,L55,L55E8,L75,L75E8,P55,P55E9,P75,P75E9,R55,R75,S55,S75,T55,T75'],
  ['HV-FP5', '加湿フィルター', 'humid', 2420, S1, '50V6C,50V7C,70V6C,70V7C,P50CX,P70CX,R50CX,R70CX'],
  ['HV-FY301', '加湿フィルター', 'humid', 1980, S8, '300,301,302', { typeLabel: 'HV-FW300の代用品', stockNote: EOL }],
  ['HV-FEX3', '加湿フィルター', 'humid', 2420, S8, 'EX30'],
  ['HV-FR12', '加湿フィルター', 'humid', 7260, S8, 'R120'],
  ['HV-FR3', '加湿フィルター', 'humid', 1980, S1, 'R30CX', { stockNote: EOL }],
  ['HV-FW300', '加湿フィルター', 'humid', 1760, S3, '300', { stockNote: EOL }],
  ['HV-FW800', '加湿フィルター', 'humid', 3520, S3, '800', { stockNote: '生産終了・販売終了（シャープ公式の別売品ページの表示）' }],
  ['FZ-AG01K1', 'Ag+イオンカートリッジ（1個）', 'ag', 1210, Y1, AG, { shared: true }],
  ['FZ-AG01K2', 'Ag+イオンカートリッジ（2個）', 'ag', 2200, Y1, AG, { pack: 2, packLabel: '2個' }],
  ['FZ-AG01K4', 'Ag+イオンカートリッジ（4個）', 'ag', 4400, Y1, AG, { pack: 4, packLabel: '4個' }],
  ['IZ-C90MR', 'プラズマクラスターイオン発生ユニット（1個）', 'ion', 3410, Y2, 'R120', { shared: true, lifeNote: '1日24時間使用した場合の目安（シャープ公式の別売品ページの記載）。' }],
  ['2791010188', 'エアフィルター', 'air', 880, null, 'H55,H55E6,H75,H75E6,J55,J55E7,J75,J75E7,L55,L55E8,L75,L75E8,P55,P55E9,P75,P75E9,R55,R75,S55,S75,T55,T75', { typeLabel: '色：ホワイト系' }],
  ['2791010189', 'エアフィルター', 'air', 880, null, 'H55,H75,J55,J75,L55,L75,P55,P75,R55,R75', { typeLabel: '色：ブルー系' }],
  ['2791010191', 'エアフィルター', 'air', 880, null, 'S55,S75,T55,T75', { typeLabel: '色：ブラウン系' }],
  ['2791010153', 'エアフィルター', 'air', null, null, '50E7,50E8,70E7,70E8,A50,A70,B50,B70,C50,C70,D50,D50E2,D70,D70E2,E50,E50E3,E70,E70E3,F50,F50E4,F70,F70E4,Y50CX,Y70CX,Z50CX,Z70CX', { typeLabel: '色：ホワイト系' }],
  ['2791010183', 'エアフィルター', 'air', null, null, 'G30,G30E5,H30,H30E6,J30,J30E7,L30,L30E8,P30,P30E9,R30', { typeLabel: '色：ホワイト系' }],
  ['2791010171', 'エアフィルター', 'air', null, null, '30E9,B30,C30,D30,D30E2,E30,E30E3,F30,F30E4', { typeLabel: '色：ホワイト系' }],
  ['2791010158', 'エアフィルター', 'air', null, null, '50E1,50E6,50E9,70E1,70E6,70E9', { typeLabel: '色：ホワイト系' }],
  ['2791010184', 'エアフィルター', 'air', null, null, 'G50,G50E5,G70,G70E5', { typeLabel: '色：ホワイト系' }],
  ['2791010190', 'エアフィルター', 'air', null, null, 'R120'],
  ['2791580332', 'エアフィルター', 'air', null, null, 'EX30', { typeLabel: '色：ホワイト系' }],
  ['2791010149', 'エアフィルター', 'air', null, null, '30E7,30E8,A30,Y30CX,Z30CX', { typeLabel: '色：ホワイト系', stockNote: EOL }],
  ['2791010117', 'エアフィルター', 'air', null, null, '50E5J,70E5J,W50CX,W70CX', { stockNote: EOL }],
  ['2791010114', 'エアフィルター', 'air', null, null, '30E5J,W30CX', { stockNote: EOL }],
  ['2791010151', 'エアフィルター', 'air', null, null, 'Y50CX,Y70CX', { typeLabel: '色：ピンク系', stockNote: EOL }],
  ['2791010157', 'エアフィルター', 'air', null, null, '50E6,70E6', { typeLabel: '色：ピンク系', stockNote: EOL }],
  ['2791010155', 'エアフィルター', 'air', null, null, 'Y30CX', { typeLabel: '色：ピンク系', stockNote: EOL }],
  ['2791010159', 'エアフィルター', 'air', null, null, '30E6', { typeLabel: '色：ピンク系', stockNote: EOL }],
  ['2791010160', 'エアフィルター', 'air', null, null, '30E6', { typeLabel: '色：ホワイト系', stockNote: EOL }],
  ['2791010176', 'エアフィルター', 'air', null, null, '30E1', { typeLabel: '色：ホワイト系', stockNote: EOL }],
];

// 取得元の「部品:機種」の組と一致するか（Chromeで計算した値と同じ式）
const pairs = rows.flatMap(([id, , , , , list]) => list.split(',').map(m => `${id}:HV-${m}`)).sort().join('|');
let h = 0; for (const ch of pairs) h = (h * 31 + ch.charCodeAt(0)) % 1000000007;
if (h !== 443438368 || pairs.length !== 7489) throw new Error(`転記が取得元と一致しない: hash=${h} len=${pairs.length}`);

const parts = rows.map(([id, name, kind, price, life, list, extra = {}]) => {
  const p = { id, name, kind, pack: extra.pack || 1 };
  if (extra.shared) p.shared = true;
  if (extra.packLabel) p.packLabel = extra.packLabel;
  if (extra.typeLabel) p.typeLabel = extra.typeLabel;
  if (extra.stockNote) p.stockNote = extra.stockNote;
  if (price) p.price = price;
  p.life = life;
  p.lifeNote = extra.lifeNote || (life ? 'シャープ公式の別売品ページに記載の交換目安。使い方や水質によって変わります。' : 'シャープ公式の別売品ページには交換めやすの記載がありません。お使いの機種の取扱説明書で確認してください。');
  p.models = list.split(',').map(m => 'HV-' + m).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});

const series = [
  { re: '^HV-\\d', key: 'num', name: 'HV-300・50E7・70E9ほか（数字で始まる形名）' },
  { re: '^HV-[A-F]', key: 'af', name: 'HV-A〜F（HV-A50・C70・EX30・F50ほか）' },
  { re: '^HV-[G-L]', key: 'gl', name: 'HV-G〜L（HV-G50・H55・J75・L55ほか）' },
  { re: '^HV-[P-T]', key: 'pt', name: 'HV-P〜T（HV-P55・R75・R120・S55・T75ほか）' },
  { re: '^HV-[U-Z]', key: 'uz', name: 'HV-U〜Z（HV-U50CX・W70CX・Y50CX・Z70CXほか）' },
];
const res = series.map(s => new RegExp(s.re));
const allModels = [...new Set(parts.flatMap(p => p.models))];
const unmatched = allModels.filter(m => !res.some(r => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));
if (allModels.length !== 128) throw new Error('機種数が取得元（128）と違う: ' + allModels.length);

const ds = {
  maker: {
    id: 'sharp-humidifier', name: 'シャープ', navName: 'シャープ加湿機', nameFull: 'シャープ', category: '加湿機',
    modelLabelHint: '形名は本体の底面または背面のラベルに書かれています。「HV-」から始まる英数字です。',
    modelNote: '形名の末尾の「-W」「-A」「-T」などは本体色を表す記号です。検索するときは省いて入力してください。',
    partsPolicy: 'シャープ公式の別売品ページには、購入はお買いあげの販売店かシャープ製品取扱店へ相談するよう書かれています。一部は公式ストア「COCORO STORE」でも購入できます。',
    partialNote: '部品番号・価格・交換目安は、シャープ公式サポート「加湿器 別売オプション品」の内容です。価格の記載がない部品は「—」と表示しています。「生産終了」の表示がある部品は、在庫がないことがあります。',
    officialShop: SRC,
    genuineNote: 'Amazonには互換フィルターも多く出品されています。純正品は商品名に品番（例：HV-FY5）と「シャープ」「純正」が入っています。品番で照合してください。',
  },
  checkedAt: '2026-11-22',
  sourceUrl: SRC,
  sourceName: 'シャープ 加湿器 別売オプション品',
  sourceKind: 'メーカー公式の別売品検索',
  priceLabel: '希望小売価格',
  modelSourceUrl: 'https://jp.sharp/support/humid_con/option_result.html?productId={id}',
  modelSourceName: 'シャープ {id} の別売オプション品',
  primaryKinds: ['humid'],
  answerPrimaryFirst: true,
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/sharp-humidifier.json'), JSON.stringify(ds, null, 1) + '\n');
console.log(`sharp-humidifier: ${parts.length} parts, ${allModels.length} models`);
