// ダイキン公式「リモコン・フィルタ等のご購入」の別売品データ（daikin-options.tsv）から
// data/daikin-airpurifier.json を作る。 使い方: node data-src/daikin-convert.mjs
// TSVの列：品番 / 品名 / 税込価格 / 適用機種（カンマ区切り、色記号なし）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const rows = fs.readFileSync(path.join(ROOT, 'data-src/daikin-options.tsv'), 'utf8')
  .split('\n').filter(Boolean).map(l => l.split('\t'));

// 公式の製品ページ（MCK70Z・MCK55Z 2023年モデル）で交換めやすを確認できた部品
const HG = 'MCK70Z（2023年モデル）の公式製品ページの記載。';
const TW = 'MCK55Z（2023年モデル）の公式製品ページの記載。';
const DUST10 = n => [{ unit: 'year', value: 10, label: '約10年（交換不要）' }, n + 'JEM1467の試験方法で、タバコを1日5本吸う環境での目安。使用状況によって短くなることがあります。'];
const HUM10 = n => [{ unit: 'year', value: 10, label: '約10シーズン' }, n + '1日8時間・1シーズン6カ月使い、定期的にお手入れした場合に、加湿能力が半分になるまでの目安。水質によって早まることがあります。'];
const DEO0 = n => [{ unit: 'none', value: 0, label: '交換不要（メーカー公表）' }, n + '使用環境や使用状況により交換が必要になる場合があります。'];
const STR10 = n => [{ unit: 'year', value: 10, label: '約10年' }, n + '風量自動・1日24時間運転・タバコ1日5本の条件での目安。使用環境により早まることがあります。'];
const KNOWN = {
  KAFP102A4: DUST10(HG), KNME108A4: HUM10(HG), KAD108A4: DEO0(HG), BFE089A41: STR10(HG),
  KAFP097A4: DUST10(TW), KNME109A4: HUM10(TW), KAD109A4: DEO0(TW), BFE089A4: STR10(TW),
  KAFP017B4: [{ unit: 'year', value: 10, label: '約10年' }, 'ダイキン公式通販の記載。タバコを1日5本吸う家庭での目安。'],
  BAFP101A4: [{ unit: 'year', value: 1, label: '約1年に1回' }, 'ダイキン公式通販の記載。'],
  BAFP105A4: [{ unit: 'year', value: 1, label: '約1年に1回' }, 'ダイキン公式通販の記載。'],
};
const NO_LIFE = 'ダイキン公式通販には交換めやすの記載がありません。お使いの機種の取扱説明書で確認してください。';

function kindOf(id, name) {
  if (/ストリーマ/.test(name)) return 'streamer';
  if (/バイオ抗体|チタンアパタイト/.test(name)) return 'bio';
  if (/加湿/.test(name)) return 'humid';
  if (/脱臭/.test(name)) return 'deo';
  if (/集じん|プリーツ|光触媒|トリプルダッシュ/.test(name)) return 'dust';
  throw new Error('種類不明: ' + id + ' ' + name);
}

const parts = rows.map(([id, rawName, price, models]) => {
  const m = rawName.match(/(\d+)(枚|個)入り|（(\d+)枚／ロール）/);
  const pack = m ? Number(m[1] || m[3]) : 1;
  const name = rawName.replace(/（(枠なし・)?\d+(枚|個)入り）/, s => s.includes('枠なし') ? '（枠なし）' : '').replace(/（\d+枚／ロール）/, '');
  const kind = kindOf(id, rawName);
  const [life, lifeNote] = KNOWN[id] || [null, NO_LIFE];
  const p = { id, name, kind, pack };
  if (pack > 1) p.packLabel = m[3] ? `${pack}枚／ロール` : `${pack}${m[2]}入り`;
  if (/^KAD114|^KAFP114|^KAF114|^KAFC114/.test(id)) p.packLabel = '2枚入り・1回で2枚使用';
  if (/^KNME(097|102|108|109)/.test(id)) p.packLabel = '2枚入り・両面交換';
  p.price = Number(price);
  p.life = life; p.lifeNote = lifeNote;
  if (kind === 'bio') p.typeLabel = 'バイオ抗体フィルターとチタンアパタイトフィルターは併用できません';
  p.models = models.split(',').sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});

const allModels = [...new Set(parts.flatMap(p => p.models))].sort();
const series = [
  { re: '^(MCK90|ACK90)', key: 'k90', name: 'MCK904A〜907A・ACK907A（加湿・90タイプ）' },
  { re: '^(MCK70[YZ]|MCK70[4-7]A|ACK70[YZ]|ACK70[57]A|TCKB?70Y|ACKB70)', key: 'k70n', name: 'MCK70Y・70Z・704A〜707A（加湿・70タイプ）' },
  { re: '^(MCK70|ACK70|TCK70)', key: 'k70', name: 'MCK70M〜70X・ACK70系（加湿・70タイプ旧モデル）' },
  { re: '^(MCK55[YZ]|MCK55[4-7]A|ACK55[YZ]|ACK55[57]A|MCKJT456)', key: 'k55n', name: 'MCK55Y・55Z・554A〜557A（加湿・55タイプ）' },
  { re: '^(MCK55|ACK55|TCK55)', key: 'k55', name: 'MCK55L〜55X・ACK55系（加湿・55タイプ旧モデル）' },
  { re: '^(MCK40|MCK50)', key: 'k40', name: 'MCK40・MCK50系（加湿・小型）' },
  { re: '^(MCZ70|ACZ70)', key: 'z70', name: 'MCZ70・ACZ70系（除加湿）' },
  { re: '^(MCZ65|ACZ65)', key: 'z65', name: 'MCZ65・ACZ65（除加湿・旧モデル）' },
  { re: '^(MC757A|ACM757A)', key: 'c757', name: 'MC757A・ACM757A（空気清浄機）' },
  { re: '^(MC55|ACM55|MCA55)', key: 'c55', name: 'MC55・ACM55系（空気清浄機）' },
  { re: '^ACB', key: 'acb', name: 'ACB50系（UV）' },
  { re: '^(MCK65|MCK75|ACK75|MC75|MC80|ACM75[K-P]|ACM80|ACM70|MCA75[KLMP]|MCA80[RSTU]|TCM)', key: 'k75', name: 'MCK75・MC75・MC80系（旧モデル）' },
  { re: '^(MC|ACM|MCA)', key: 'old', name: 'MC70x・ACM65ほか（旧モデル）' },
];
const res = series.map(s => new RegExp(s.re));
const unmatched = allModels.filter(m => !res.some(r => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));

const SHOP = 'https://ec.daikinaircon.com/betubai2/category_air.html';
const ds = {
  maker: {
    id: 'daikin', name: 'ダイキン', nameFull: 'ダイキン工業', category: '空気清浄機',
    modelLabelHint: '機種名は本体の側面または背面のラベルに書かれています。「MCK」「ACK」「MC」「MCZ」などから始まる英数字です。',
    modelNote: '機種名の末尾の「-W」「-T」「-C」などは本体色を表す記号です。検索するときは省いて入力してください。',
    partsPolicy: 'ダイキン公式通販では、お客様都合の返品は受け付けていません。購入前に適用機種をよく確認してください。',
    partialNote: '部品番号と価格はダイキン公式通販「リモコン・フィルタ等のご購入」の内容です。販売を終了した部品は載せていません。交換のめやすは公式の製品ページなどで確認できたものだけ載せています。',
    officialShop: SHOP,
    genuineNote: '互換品はサイズや性能がメーカーの想定と異なる場合があります。純正品は品番がそのまま商品名に入っているので、品番で照合してください。',
  },
  checkedAt: '2026-11-03',
  sourceUrl: SHOP,
  sourceName: 'ダイキン リモコン・フィルタ等のご購入（空気清浄機関連付属品・別売品）',
  sourceKind: 'メーカー公式通販',
  priceLabel: '公式通販価格',
  primaryKinds: ['humid', 'dust', 'deo'],
  showFrequency: true,
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/daikin-airpurifier.json'), JSON.stringify(ds, null, 1) + '\n');
console.log(`daikin: ${parts.length} parts, ${allModels.length} models`);
