// シャープ公式サポート「加湿セラミックファンヒーター 別売オプション品」のデータから data/sharp-heater.json を作る。
// 出典：https://jp.sharp/support/heater/option.html （ページが読み込む option_data.js・product_option_data.js の内容。2026-11-26 取得）
// 使い方: node data-src/sharp-heater-build.mjs
// 取得した内容は data-src/sharp-heater-options.tsv に転記してある（機種は「HX-」を省略）。
// 取得元の「部品:機種」216組・46機種と一致することをハッシュで検査する。
// Ag+イオンカートリッジ（FZ-AG01K1/K2/K4）は、空気清浄機・加湿機のデータに部品ページの本体があるので shared: true にしている。
// この3点の価格は、ヒーターの別売品ページでは 990／1,980／3,960円、空気清浄機・加湿機の別売品ページでは 1,210／2,200／4,400円と食い違っている。
// サイト内で価格を1つにそろえるため、ここでは価格を書かず、build.mjs が本体の部品の価格を表示する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://jp.sharp/support/heater/option.html';
const S1 = { unit: 'season', value: 1, label: '1シーズン（約6か月）' };
const S3 = { unit: 'season', value: 3, label: '3シーズン（約18か月）' };
const Y1 = { unit: 'year', value: 1, label: '約1年' };
const Y2 = { unit: 'year', value: 2, label: '2年（約24か月）' };
const EOL = '生産終了（シャープ公式の別売品ページの表示）';
const FEW = '在庫僅少（シャープ公式の別売品ページの表示）';

// 部品ごとの種類・交換めやす・注記（TSVの note 欄を読んで人が振り分けたもの）
const META = {
  '2523370039': { kind: 'filter', stockNote: EOL },
  '2523370082': { kind: 'filter', typeLabel: '2523370075・2523370079の代用品' },
  '2523960004': { kind: 'pump', typeLabel: '2523960001・2523960003の代用品' },
  'FZ-AG01K1': { kind: 'ag', life: Y1, shared: true },
  'FZ-AG01K2': { kind: 'ag', life: Y1, shared: true, pack: 2, packLabel: '2個' },
  'FZ-AG01K4': { kind: 'ag', life: Y1, shared: true, pack: 4, packLabel: '4個' },
  'HX-F36': { kind: 'deo', life: Y2 },
  'HX-F38': { kind: 'deo', life: Y2, stockNote: FEW },
  'HX-FK1': { kind: 'humid', life: S1 },
  'HX-FK2': { kind: 'humid', life: S1, stockNote: FEW },
  'HX-FK5': { kind: 'humid', life: S3, typeLabel: 'HX-FK2/FK3/FX4の代用品（公式ページの表記のまま）' },
  'HX-FK6': { kind: 'humid', life: S3, typeLabel: 'HX-FK5の代用品' },
};

const lines = fs.readFileSync(path.join(ROOT, 'data-src/sharp-heater-options.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const alias = Object.fromEntries(lines.filter(r => r[0].startsWith('@')).map(r => [r[0], r[1].split(',')]));
const rows = lines.filter(r => !r[0].startsWith('@')).map(([id, name, price, note, eol, list]) => ({ id, name, price: price ? Number(price) : null, note, eol, models: list.split(',').flatMap(t => alias[t] || [t]).map(m => 'HX-' + m) }));

const pairs = rows.flatMap(r => r.models.map(m => `${r.id}:${m}`)).sort().join('|');
let h = 0; for (const ch of pairs) h = (h * 31 + ch.charCodeAt(0)) % 1000000007;
if (h !== 624741599 || pairs.length !== 3803) throw new Error(`転記が取得元と一致しない: hash=${h} len=${pairs.length}`);

// Amazonに出品が見つからなかった部品（2026-11-26に部品番号で検索して確認）。Amazonのボタンを出さない
const NO_AMAZON = ['2523370039', 'HX-F36', 'HX-F38', 'HX-FK1'];

const parts = rows.map(r => {
  const x = META[r.id];
  if (!x) throw new Error('META がない: ' + r.id);
  const p = { id: r.id, name: r.name, kind: x.kind, pack: x.pack || 1 };
  if (x.shared) p.shared = true;
  if (x.packLabel) p.packLabel = x.packLabel;
  if (x.typeLabel) p.typeLabel = x.typeLabel;
  if (x.stockNote) p.stockNote = x.stockNote;
  if (NO_AMAZON.includes(r.id)) p.noAmazon = true;
  if (r.price && !x.shared) p.price = r.price;
  p.life = x.life || null;
  p.lifeNote = x.life ? 'シャープ公式の別売品ページに記載の交換目安。使い方や水質によって変わります。' : 'シャープ公式の別売品ページには交換めやすの記載がありません。お使いの機種の取扱説明書で確認してください。';
  p.models = r.models.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});

const series = [
  { re: '^HX-\\d', key: 'num', name: 'HX-120CX・129CX・12E9ほか（数字で始まる形名）' },
  { re: '^HX-[A-F]', key: 'af', name: 'HX-A〜F（HX-A120・C120・F120ほか）' },
  { re: '^HX-[G-L]', key: 'gl', name: 'HX-G〜L（HX-G120・J120・L120ほか）' },
  { re: '^HX-[P-T]', key: 'pt', name: 'HX-P〜T（HX-PK12・RK12・SK12・TK12ほか）' },
];
const res = series.map(s => new RegExp(s.re));
const allModels = [...new Set(parts.flatMap(p => p.models))];
const unmatched = allModels.filter(m => !res.some(r => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));
if (allModels.length !== 46) throw new Error('機種数が取得元（46）と違う: ' + allModels.length);
const primaryKinds = ['humid', 'deo', 'filter'];
const noPrimary = allModels.filter(m => !parts.some(p => primaryKinds.includes(p.kind) && p.models.includes(m)));
if (noPrimary.length) throw new Error('主要部品がない機種: ' + noPrimary.join(' '));

const ds = {
  maker: {
    id: 'sharp-heater', name: 'シャープ', navName: 'シャープ ヒーター', nameFull: 'シャープ', category: '加湿セラミックファンヒーター',
    modelLabelHint: '形名は本体に貼られたラベルと、取扱説明書の表紙に書かれています。「HX-」から始まる英数字です。',
    modelNote: '形名の末尾の「-W」「-A」「-T」などは本体色を表す記号です。検索するときは省いて入力してください。',
    partsPolicy: 'シャープ公式の別売品ページには、購入はお買いあげの販売店かシャープ製品取扱店へ相談するよう書かれています。一部は公式ストア「COCORO STORE」でも購入できます。',
    partialNote: '部品番号・価格・交換目安は、シャープ公式サポート「加湿セラミックファンヒーター 別売オプション品」の内容です。価格の記載がない部品は「—」と表示しています。「生産終了」「在庫僅少」の表示がある部品は、在庫がないことがあります。',
    officialShop: SRC,
    genuineNote: 'Amazonには互換フィルターも多く出品されています。純正品は商品名に品番（例：HX-FK6）と「シャープ」「純正」が入っています。品番で照合してください。',
  },
  checkedAt: '2026-11-26',
  sourceUrl: SRC,
  sourceName: 'シャープ 加湿セラミックファンヒーター 別売オプション品',
  sourceKind: 'メーカー公式の別売品検索',
  priceLabel: '希望小売価格',
  modelSourceUrl: 'https://jp.sharp/support/heater/option_result.html?productId={id}',
  modelSourceName: 'シャープ {id} の別売オプション品',
  primaryKinds,
  answerPrimaryFirst: true,
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/sharp-heater.json'), JSON.stringify(ds, null, 1) + '\n');
console.log(`sharp-heater: ${parts.length} parts, ${allModels.length} models`);
