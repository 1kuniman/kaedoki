// シャープ公式「交換用フィルター・別売品」検索のデータ（sharp-options.tsv）から
// data/sharp-airpurifier.json を作る。 使い方: node data-src/sharp-convert.mjs
// TSVの列：部品番号 / 部品名 / メーカー希望小売価格（税込） / 適用形名（カンマ区切り）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = fs.readFileSync(path.join(ROOT, 'data-src/sharp-options.tsv'), 'utf8')
  .split('\n').filter(Boolean).map(l => l.split('\t'));

// 取扱説明書で交換めやすを確認できた部品
const Y10 = { unit: 'year', value: 10, label: '約10年に1回' };
const KNOWN = {
  'FZ-L75MF': [Y10, '1日8時間の加湿空気清浄運転で、加湿能力が半分になるまでの目安。水質によっては早まります。洗っても水アカやニオイが取れないときは早めに交換します。'],
  'FZ-Y80MF': [Y10, '1日8時間の加湿空気清浄運転での目安。水質によっては早まります。'],
  'FZ-G70MF': [Y10, '1日8時間の使用での目安。水質によっては早まります。'],
  'FZ-E100MF': [Y10, '取扱説明書記載の目安。水質によっては早まります。'],
  'FZ-H40MF': [{ unit: 'year', value: 5, label: '約5年に1回' }, '取扱説明書記載の目安。水質や使い方によっては早まります。'],
  'FZ-D50HF': [Y10, 'タバコ5本分の粉じんを毎日吸い込んだ場合の目安。10本なら約5年です。ニオイの強い環境では数週間〜数カ月でニオイが出ることがあります。'],
  'FZ-E75HF': [Y10, 'タバコ5本分の粉じんを毎日吸い込んだ場合の目安。'],
  'FZ-D70HF': [Y10, 'タバコ5本分の粉じんを毎日吸い込んだ場合の目安。'],
  'FZ-F50DF': [Y10, 'タバコ5本分のニオイを毎日吸い込んだ場合の目安。ニオイの強い環境では早まります。'],
  'FZ-F70DF': [Y10, 'タバコ5本分のニオイを毎日吸い込んだ場合の目安。ニオイの強い環境では早まります。'],
  'FZ-G40SF': [{ unit: 'year', value: 2, label: '約2年に1回' }, '取扱説明書記載の目安。タバコを吸う部屋などでは早まります。'],
};
// 種類ごとに共通の交換めやす（シャープの取扱説明書で共通の記載）
const BY_KIND = {
  ag: [{ unit: 'year', value: 1, label: '約1年に1回' }, '取扱説明書記載の目安。付けなくても加湿はできますが、ヌメリやニオイを抑える効果がなくなります。'],
  ion: [{ unit: 'lamp', value: 0, label: '交換ランプが点滅したら' }, '本体の交換お知らせ表示が点滅したら交換します。'],
  pre: [{ unit: 'month', value: 1, label: '約1カ月に1回' }, '使い捨てタイプ。汚れたら取り替えます。'],
  humidpre: [{ unit: 'month', value: 1, label: '約1カ月に1回' }, '使い捨てタイプ。加湿フィルターに水アカが付きにくくなります。'],
};
const NO_LIFE = '公式の別売品ページには交換めやすの記載がありません。お使いの機種の取扱説明書で確認してください。';

function kindOf(id) {
  if (/^IZ-/.test(id)) return 'ion';
  if (/^FZ-AG/.test(id)) return 'ag';
  if (/^FZ-PF\d+MF$/.test(id)) return 'humidpre';
  if (/PF\d*$|^FZ-PF/.test(id)) return 'pre';
  if (/MF\d?$/.test(id)) return 'humid';
  if (/HF\d?$/.test(id)) return 'dust';
  if (/DF\d?$/.test(id)) return 'deo';
  if (/SF$/.test(id)) return 'combo';
  throw new Error('種類不明: ' + id);
}

const parts = rows.map(([id, rawName, price, models]) => {
  const m = rawName.match(/^(.*?)（([^（）]*?(\d+)(枚|個)[^（）]*?)）$/);
  const name = m ? m[1] : rawName;
  const pack = m ? Number(m[3]) : 1;
  const kind = kindOf(id);
  const [life, lifeNote] = KNOWN[id] || ((kind !== 'pre' || /使い捨て/.test(name)) && BY_KIND[kind]) || [null, NO_LIFE];
  const p = { id, name, kind, pack };
  if (m && pack > 1) p.packLabel = m[2].replace(/^(\d+)枚$/, '$1枚入り').replace(/^(\d+)個$/, '$1個一組').replace('2枚一組', '2枚一組');
  p.price = Number(price);
  p.life = life; p.lifeNote = lifeNote;
  if (id === 'FZ-AG01K1') p.variants = '2個入り FZ-AG01K2 / 4個入り FZ-AG01K4 もあります（機種により記載が異なります）。';
  p.models = models.split(',').sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});

const allModels = [...new Set(parts.flatMap(p => p.models))].sort();
const series = [
  { re: '^KI-[A-Z]{1,2}100$', key: 'x100', name: 'KI-◯X100・◯P100（大型）' },
  { re: '^KI-([A-J]X\\d+|WF75|F75E3|750Y8|85Y40|[HJ]75YX|X75E[456])$', key: 'kiold', name: 'KI-AX〜JX・WF75ほか（旧モデル）' },
  { re: '^KI-[K-Z]X7[05]$', key: 'next', name: 'KI-◯X70・◯X75' },
  { re: '^KI-(X75E\\d|75XE\\d|[A-Z]75YX)$', key: 'x75v', name: 'KI-X75E◯・75XE◯・◯75YX' },
  { re: '^KI-(.S70|S70.\\d)$', key: 's70', name: 'KI-◯S70' },
  { re: '^KI-.S50$', key: 's50', name: 'KI-◯S50' },
  { re: '^KI-(S50E\\d|50SE\\d)$', key: 's50v', name: 'KI-S50E◯・50SE◯' },
  { re: '^KI-.S40$', key: 's40', name: 'KI-◯S40' },
  { re: '^KI-.D50$', key: 'd50', name: 'KI-◯D50（除加湿空気清浄機）' },
  { re: '^KI-M85', key: 'kim', name: 'KI-M850・M851' },
  { re: '^KC-([A-Z]D?70|700Y\\d|70E\\d|70TH\\d|E70A1)$', key: 'kc70', name: 'KC-◯70' },
  { re: '^KC-([A-Z]50|[A-Z]500Y|500Y\\d|50E\\d|50TH\\d|E50A1|F50E3|J50C|S50W)$', key: 'kc50', name: 'KC-◯50' },
  { re: '^KC-([A-Z]40|40P1|40TH\\d)$', key: 'kc40', name: 'KC-◯40' },
  { re: '^KC-([WYZ](45|65|80)|W45Y|450Y3|45Y2|650Y3|65E\\d|65Y2|C(70|100|150))$', key: 'kcold', name: 'KC-◯45・65・80、KC-C◯（旧モデル）' },
  { re: '^KC-(20|30|35|3500|51C1|Y30|W35)', key: 'kcs', name: 'KC-30・35クラスほか（小型）' },
  { re: '^KC-M', key: 'kcm', name: 'KC-M◯' },
];
const res = series.map(s => [s, new RegExp(s.re)]);
const unmatched = allModels.filter(m => !res.some(([, r]) => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));

const OPT = 'https://jp.sharp/support/air_purifier/doc/option_result.html?productId=';
const ds = {
  maker: {
    id: 'sharp', name: 'シャープ', nameFull: 'シャープ', category: '加湿空気清浄機',
    modelLabelHint: '形名は本体の側面または背面のラベルに書かれています。「KI-」「KC-」から始まる英数字です。',
    modelNote: '形名の末尾の「-W」「-T」「-H」などは本体色を表す記号です。検索するときは省いて入力してください。',
    partsPolicy: '取扱説明書には、消耗品は保証期間中でも有料での交換になると書かれています。',
    partialNote: '部品番号と価格はシャープ公式サポートの「交換用フィルター・別売品」検索の内容です。価格は改定されることがあるので、購入前に公式ページでも確認してください。交換のめやすは取扱説明書で確認できたものを載せています。',
    officialShop: 'https://jp.sharp/support/air_purifier/doc/filter_top.html',
    genuineNote: '互換品はサイズや性能がメーカーの想定と異なる場合があります。純正品は品番がそのまま商品名に入っているので、品番で照合してください。',
  },
  checkedAt: '2026-10-22',
  sourceUrl: 'https://jp.sharp/support/air_purifier/doc/filter_top.html',
  sourceName: 'シャープ 空気清浄機 交換用フィルター・別売品',
  sourceKind: 'メーカー公式の別売品検索',
  priceLabel: '希望小売価格',
  modelSourceUrl: OPT + '{id}',
  modelSourceName: 'シャープ {id} の交換用フィルター・別売品',
  primaryKinds: ['humid', 'dust', 'deo', 'combo'],
  showFrequency: true,
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/sharp-airpurifier.json'), JSON.stringify(ds, null, 1) + '\n');
console.log(`sharp: ${parts.length} parts, ${allModels.length} models`);
