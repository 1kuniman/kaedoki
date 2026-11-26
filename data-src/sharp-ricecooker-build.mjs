// シャープ公式サポート「炊飯器 別売オプション品」のデータから data/sharp-ricecooker.json を作る。
// 出典：https://jp.sharp/support/ricecooker/option.html （ページが読み込む option_data.js・product_option_data.js の内容。2026-11-26 取得）
// 使い方: node data-src/sharp-ricecooker-build.mjs
// 取得した内容は data-src/sharp-ricecooker-options.tsv に転記してある（機種は「KS-」を省略。列：部品番号・品名・税込価格・注記・適用機種）。
// 取得元の「部品:機種」503組・78機種・122部品と一致することをハッシュで検査する。
// 取扱説明書（2349160349）は交換部品ではないので、サイトには載せない。
// 炊飯器の別売品ページには交換めやすの記載がないため、hideLife: true で交換めやすの欄を出さない。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://jp.sharp/support/ricecooker/option.html';

const kindOf = name => {
  if (/^内(なべ|釜)/.test(name)) return 'pot';
  if (/パッキン$/.test(name)) return 'packing';
  if (/^(内ぶた|ふた加熱板)/.test(name)) return 'lid';
  if (/^蒸気/.test(name)) return 'steam';
  return 'acc';
};

// Amazonの出品（2026-11-26に部品番号で検索して確認）
// ASIN：商品名に部品番号と「シャープ」または「純正」が入っている出品
const ASIN = {
  '2343800350': 'B0GWCL6V16', '2343800292': 'B0GBD61K5Q', '2343800349': 'B0GKMXBH1M', '2343800352': 'B0HNMXZX47', '2343800353': 'B0GKV6VZ5M',
  '2341170678': 'B0FWR49QWJ', '2341170676': 'B0GQFFLPZW', '2341170688': 'B0GQK3RRN7', '2341170689': 'B0GQFK5HQN',
  '2343920072': 'B01MT1DMOA', '2343920140': 'B0H6WL4JPL', '2343920131': 'B0G38TWJ8R',
  '2349340027': 'B0FRYXK5CY', '2349460021': 'B0G4GL3Z37', '2349460022': 'B0FX9591KT', '2349340026': 'B0G4J795LH',
};
// 部品番号の検索で出品が見つかったが、商品名だけではメーカー名・純正の確認ができなかったもの。部品番号の検索結果へ案内する
const SEARCH = ['2343800308', '2343800340', '2343920091', '2343440100', '2341170672', '2343800346', '2343800300', '2343800299', '2343800305', '2343920099', '2344250067', '2344250068', '2349340025', '2341170667', '2349460024', '2349340028', '2343920137', '2343320014', '2341170684', '2344250072', '2343440124', '2343800322', '2343800319', '3629390001'];
// 上のどちらにもない部品は、検索しても出品が見つからなかった。Amazonのボタンを出さない（noAmazon）

const lines = fs.readFileSync(path.join(ROOT, 'data-src/sharp-ricecooker-options.tsv'), 'utf8').split('\n').filter(Boolean).map(l => l.split('\t'));
const alias = Object.fromEntries(lines.filter(r => r[0].startsWith('@')).map(r => [r[0], r[1].split(',')]));
const rows = lines.filter(r => !r[0].startsWith('@')).map(([id, name, price, note, list]) => ({ id, name, price: price ? Number(price) : null, note, models: list.split(',').flatMap(t => alias[t] || [t]).map(m => 'KS-' + m) }));

const pairs = rows.flatMap(r => r.models.map(m => `${r.id}:${m}`)).sort().join('|');
let h = 0; for (const ch of pairs) h = (h * 31 + ch.charCodeAt(0)) % 1000000007;
if (h !== 631337641 || pairs.length !== 9430 || rows.length !== 122) throw new Error(`転記が取得元と一致しない: hash=${h} len=${pairs.length} rows=${rows.length}`);

const parts = rows.filter(r => r.name !== '取扱説明書').map(r => {
  const p = { id: r.id, name: r.name, kind: kindOf(r.name), pack: 1 };
  if (r.note) p.typeLabel = r.note;
  if (r.price) p.price = r.price;
  if (ASIN[r.id]) p.asin = ASIN[r.id];
  else if (SEARCH.includes(r.id)) p.amazonQuery = r.id;
  else p.noAmazon = true;
  p.life = null;
  p.lifeNote = 'シャープ公式の別売品ページには交換めやすの記載がありません。';
  p.models = r.models.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});
for (const id of [...Object.keys(ASIN), ...SEARCH]) if (!parts.some(p => p.id === id)) throw new Error('Amazonの表にあるが部品にない: ' + id);

const series = [
  { re: '^KS-[A-E]', key: 'ae', name: 'KS-A〜D（KS-AC5・C5L・CF05E・DC5ほか）' },
  { re: '^KS-[FG]', key: 'fg', name: 'KS-F・G（KS-F5E8・FA10・GC5・GX10Aほか）' },
  { re: '^KS-H', key: 'h', name: 'KS-H（KS-H59・HA10・HF05B・HF10Bほか）' },
  { re: '^KS-[I-P]', key: 'ip', name: 'KS-I〜P（KS-KC5・MX10B・NC5・PX10Bほか）' },
  { re: '^KS-[S-Z]', key: 'sz', name: 'KS-S〜Z（KS-S10J・SF05H・WM10B・Z101）' },
];
const res = series.map(s => new RegExp(s.re));
const allModels = [...new Set(parts.flatMap(p => p.models))];
const unmatched = allModels.filter(m => !res.some(r => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));
if (allModels.length !== 78) throw new Error('機種数が取得元（78）と違う: ' + allModels.length);
const noPot = allModels.filter(m => !parts.some(p => p.kind === 'pot' && p.models.includes(m)));
if (noPot.length) throw new Error('内釜・内なべがない機種: ' + noPot.join(' '));

const ds = {
  maker: {
    id: 'sharp-ricecooker', name: 'シャープ', navName: 'シャープ炊飯器', nameFull: 'シャープ', category: '炊飯器',
    modelLabelHint: '形名は本体に貼られたラベルと、取扱説明書の表紙に書かれています。「KS-」から始まる英数字です。',
    modelNote: '形名の末尾の「-W」「-B」「-R」などは本体色を表す記号です。検索するときは省いて入力してください。内ぶたなど、本体色によって部品番号が違うものがあります。',
    partsPolicy: 'シャープ公式の別売品ページには、購入はお買いあげの販売店かシャープ製品取扱店へ相談するよう書かれています。一部は公式ストア「COCORO STORE」でも購入できます。',
    partialNote: '部品番号と価格は、シャープ公式サポート「炊飯器 別売オプション品」の内容です。価格の記載がない部品は「—」と表示しています。Amazonのボタンは、部品番号で検索して出品が見つかった部品にだけ付けています（2026/11/26確認）。',
    officialShop: SRC,
    genuineNote: '内釜・内なべは機種ごとに部品番号が違います。Amazonでは部品番号が「234 380 0349」のように区切って書かれていることがあります。数字が同じかを照合してください。',
  },
  checkedAt: '2026-11-26',
  sourceUrl: SRC,
  sourceName: 'シャープ 炊飯器 別売オプション品',
  sourceKind: 'メーカー公式の別売品検索',
  priceLabel: '希望小売価格',
  modelSourceUrl: 'https://jp.sharp/support/ricecooker/option_result.html?productId={id}',
  modelSourceName: 'シャープ {id} の別売オプション品',
  partWord: '内釜',
  makerH1: 'シャープ 炊飯器の内釜・内ぶた・パッキン 機種別一覧',
  makerTitle: 'シャープ 炊飯器の内釜・内ぶた・パッキン 型番別一覧｜KS-シリーズ78機種の部品番号と価格',
  makerDesc: 'シャープの炊飯器（KS-シリーズ）の内釜（内なべ）・内ぶた・パッキンなどの部品を型番から探せます。78機種それぞれに合う純正部品の部品番号と希望小売価格を、メーカー公式の別売品情報から一覧にしています。',
  modelTitle: '{id} の内釜・内ぶた・パッキン｜部品番号と価格（シャープ 炊飯器）',
  primaryKinds: ['pot'],
  answerKinds: ['pot', 'lid'],
  answerTitle: '内釜（内なべ）・内ぶたを買い替えるときの部品',
  answerPrimaryFirst: true,
  hideLife: true,
  showFrequency: false,
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/sharp-ricecooker.json'), JSON.stringify(ds, null, 1) + '\n');
const c = k => parts.filter(p => p.kind === k).length;
console.log(`sharp-ricecooker: ${parts.length} parts (pot ${c('pot')}, lid ${c('lid')}, packing ${c('packing')}, steam ${c('steam')}, acc ${c('acc')}), ${allModels.length} models, Amazon直リンク ${parts.filter(p => p.asin).length}・検索 ${parts.filter(p => p.amazonQuery).length}・なし ${parts.filter(p => p.noAmazon).length}`);
