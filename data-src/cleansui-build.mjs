// クリンスイ（三菱ケミカル・クリンスイ）の浄水カートリッジ
// 出典：公式「浄水カートリッジ交換ガイド」 https://cleansui.com/cartridge-guide （本体→カートリッジの対応・生産終了品の対応）
//       公式オンラインストアの各カートリッジのページ（希望販売価格・交換目安・対応機種）
// 確認日 2026-11-12。使い方: node data-src/cleansui-build.mjs
// ガイドの記載「同じシリーズなら、どの交換用浄水カートリッジでもご利用いただけます」（蛇口直結型）にもとづき、
// 蛇口直結型は、そのシリーズの全機種（現行＋生産終了品）を各カートリッジの適用機種にしている。
// ストアのページの機種名についた色記号（-GR、(GR) など）は外している。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOP = 'https://shop.cleansui.com';
const GUIDE = 'https://cleansui.com/cartridge-guide';
const shopUrl = p => SHOP + encodeURI(p);
const M3 = { unit: 'month', value: 3, label: '約3か月' };
const M6 = { unit: 'month', value: 6, label: '約6か月' };
const Y1 = { unit: 'year', value: 1, label: '約1年' };
const NOLIFE = '公式ストアの商品ページに交換目安の記載がありません。本体の取扱説明書で確認してください。';

const POT = ['CP508', 'CP504', 'CP503', 'CP407', 'CP405', 'CP012', 'GP001JP', 'CSP4', 'CP005', 'CP007', 'CP002', 'CP205', 'CP207', 'CP006', 'CP025', 'CP013', 'CP015', 'JP100-C', 'JP101-C', 'JP407-R', 'JP407-T', 'JP407-D'];
// ガイドは「CP601」、HGC9Sのストアページは「CSP601」と表記。どちらも公式の表記なので両方載せる
const CSP = ['CSP901', 'CSP811', 'CSP501', 'CSP801', 'CSP1', 'CSP2', 'CSP3', 'CSP9', 'CSPUD', 'CP601', 'CSP601', 'CSP602', 'CSP701', 'CSP801i', 'CSPX'];
const MONO = ['MD301', 'MD211', 'MD111', 'MD101', 'MD1', 'MD301i', 'MD102', 'MD103', 'MD201'];
const CB = ['CB093', 'CB073', 'CB023', 'CB096', 'CB026', 'CB073i', 'CB013'];

// [品番, 品名, 入数, 税込価格, 交換めやす, 適用機種, ストアのパス, 追加]
const rows = [
  ['CPC5W', 'ポット型 交換用浄水カートリッジ', 2, 6160, M3, POT, '/カートリッジ製品/カートリッジ製品全般/CPC5W-NW.html'],
  ['CPC7W', 'ポット型 アルカリポット用 交換カートリッジ', 2, 8580, null, POT, '/カートリッジ製品/カートリッジ製品全般/CPC7W-NW.html'],
  ['HGC9S', 'CSPシリーズ 交換用浄水カートリッジ', 1, 5500, M3, CSP, '/カートリッジ製品/カートリッジ製品全般/HGC9S.html'],
  ['HGC9SW', 'CSPシリーズ 交換用浄水カートリッジ', 2, 10340, M3, CSP, '/カートリッジ製品/カートリッジ製品全般/HGC9SW.html'],
  ['MDC01S', 'MONOシリーズ 交換用浄水カートリッジ（除去物質17+3）', 1, 5500, M3, MONO, '/カートリッジ製品/カートリッジ製品全般/MDC01S.html'],
  ['MDC01SW', 'MONOシリーズ 交換用浄水カートリッジ（除去物質17+3）', 2, 10340, M3, MONO, '/カートリッジ製品/カートリッジ製品全般/MDC01SW.html'],
  ['MDC03SW', 'MONOシリーズ 交換用浄水カートリッジ（除去物質11+3）', 2, 7260, M3, MONO, '/カートリッジ製品/カートリッジ製品全般/MDC03SW.html'],
  ['CBC03W', 'CBシリーズ 交換用浄水カートリッジ（3か月交換タイプ・ホワイト）', 2, 7260, M3, CB, '/カートリッジ製品/カートリッジ製品全般/CBC03W.html'],
  ['CBC06', 'CBシリーズ 交換用浄水カートリッジ（6か月交換タイプ・グレー）', 1, null, M6, CB, null, { lifeNote: '交換ガイドの「6ヶ月交換タイプ」の記載。価格は公式オンラインストアで確認できませんでした。' }],
  ['CGC4W', 'CGシリーズ 交換用浄水カートリッジ', 2, 5940, null, ['CG104'], '/カートリッジ製品/カートリッジ製品全般/CGC4W.html'],
  ['PPC4440W', 'ピクシーシリーズ 交換用浄水カートリッジ', 2, 8360, M3, ['PZ934', 'PP945', 'PS956', 'PT923', 'PX912', 'PA902', 'PA901'], '/カートリッジ製品/カートリッジ製品全般/PPC4440W.html'],
  ['XTC2100W', 'デミシリーズ 交換用浄水カートリッジ', 2, 8360, M3, ['CT753', 'FT774', 'GX784', 'FX773', 'BX762', 'CX751', 'LX713', 'L711'], '/カートリッジ製品/カートリッジ製品全般/XTC2100W.html'],
  ['SYC202', '浄水シャワー 交換用カートリッジ', 1, 1980, null, ['SY102', 'SY101', 'SD104'], '/カートリッジ製品/カートリッジ製品全般/SYC202.html'],
  ['SYC202W', '浄水シャワー 交換用カートリッジ', 2, 3740, null, ['SY102', 'SY101', 'SD104'], '/カートリッジ製品/カートリッジ製品全般/SYC202W.html'],
  ['SKC205W', '浄水シャワー 交換用カートリッジ', 2, 3520, null, ['SK105W', 'SK106W'], '/カートリッジ製品/カートリッジ製品全般/SKC205W.html'],
  ['SMC302', '浄水シャワーヘッド 交換用カートリッジ', 3, 3960, null, ['SM302', 'WS301'], '/浄水シャワー/浄水シャワーカートリッジ/SMC302.html'],
  ['EMC0731A', 'エミネント 交換用カートリッジ（Aカートリッジ＋Bカートリッジ）', 1, 24200, Y1, ['EM801', 'EM802'], '/カートリッジ製品/カートリッジ製品全般/EMC0731A.html', { packLabel: 'A・B各1個' }],
  ['SSC8800', 'Super STX 交換用カートリッジ', 1, 14960, null, ['SSX880', 'STX810'], '/カートリッジ製品/カートリッジ製品全般/SSC8800.html'],
];

const parts = rows.map(([id, name, pack, price, life, models, shop, extra = {}]) => {
  const p = { id, name, kind: 'cartridge', pack };
  if (pack > 1) p.packLabel = `${pack}個入り`;
  if (extra.packLabel) p.packLabel = extra.packLabel;
  if (price) p.price = price;
  p.life = life;
  p.lifeNote = extra.lifeNote || (life ? '公式オンラインストアの商品ページの記載。使用量や水質によって変わります。' : NOLIFE);
  if (shop) p.source = shopUrl(shop);
  p.models = [...new Set(models)].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  return p;
});

const series = [
  { re: '^(CP[0245]\\d\\d|GP|JP|CSP4$)', key: 'pot', name: 'ポット型（CP508・CP012ほか）' },
  { re: '^(CSP|CP601)', key: 'csp', name: '蛇口直結型 CSPシリーズ' },
  { re: '^MD', key: 'mono', name: '蛇口直結型 MONOシリーズ' },
  { re: '^CB', key: 'cb', name: '蛇口直結型 CBシリーズ' },
  { re: '^CG', key: 'cg', name: '蛇口直結型 CGシリーズ' },
  { re: '^P[APSTXZ]\\d', key: 'pixie', name: 'ピクシーシリーズ' },
  { re: '^(CT|FT|GX|FX|BX|CX|LX|L)\\d', key: 'demi', name: 'デミシリーズ' },
  { re: '^(SY|SD|SK|SM|WS)', key: 'shower', name: '浄水シャワー' },
  { re: '^(EM|SSX|STX)', key: 'stand', name: '据置型（エミネント・Super STX）' },
];
const res = series.map(s => new RegExp(s.re));
const allModels = [...new Set(parts.flatMap(p => p.models))];
const unmatched = allModels.filter(m => !res.some(r => r.test(m)));
if (unmatched.length) throw new Error('シリーズ未分類: ' + unmatched.join(' '));

const ds = {
  maker: {
    id: 'cleansui', name: 'クリンスイ', nameFull: '三菱ケミカル・クリンスイ', category: '浄水器',
    modelLabelHint: '品番は本体の側面・底面、または取扱説明書の表紙に書かれています。「CSP」「MD」「CB」「CP」などから始まる英数字です。',
    modelNote: '品番の末尾の「-WT」「-GR」などは本体色を表す記号です。検索するときは省いて入力してください。',
    partsPolicy: '公式の交換ガイドには「同じシリーズなら、どの交換用浄水カートリッジでもご利用いただけます」（蛇口直結型）と書かれています。生産終了した本体も、ガイドに載っているものは現行のカートリッジが使えます。',
    partialNote: 'このページは、公式「浄水カートリッジ交換ガイド」と公式オンラインストアの内容です。ビルトイン型（アンダーシンク・スパウトイン・カウンターオン）と業務用はまだ載せていません。',
    officialShop: SHOP + '/',
    genuineNote: 'Amazonには互換カートリッジも多く出品されています。純正品は商品名に品番（例：HGC9SW）と「クリンスイ」が入っています。品番で照合してください。',
  },
  checkedAt: '2026-11-12',
  sourceUrl: GUIDE,
  sourceName: 'クリンスイ 浄水カートリッジ交換ガイド',
  sourceKind: 'メーカー公式サイト',
  priceLabel: '公式ストア価格',
  partWord: 'カートリッジ',
  modelTitle: '{id} のカートリッジ交換｜交換用カートリッジの品番・価格・交換時期（クリンスイ 浄水器）',
  primaryKinds: ['cartridge'],
  series,
  parts,
};
fs.writeFileSync(path.join(ROOT, 'data/cleansui.json'), JSON.stringify(ds, null, 1) + '\n');
console.log(`cleansui: ${parts.length} parts, ${allModels.length} models`);
