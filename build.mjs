// カエドキ 静的サイト生成スクリプト（依存パッケージなし）
// 使い方: node build.mjs  → dist/ に全ページを書き出す
// data/*.json を1ファイル＝1メーカー×1カテゴリとして読み込む
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');

// ---------- 部品の種類 ----------
const KINDS = {
  vapor:    { label: '気化フィルター', cls: 'b-care', order: 1 },
  humid:    { label: '加湿フィルター', cls: 'b-care', order: 1 },
  dust:     { label: '集じんフィルター', cls: 'b-dust', order: 2 },
  deo:      { label: '脱臭フィルター', cls: 'b-dust', order: 3 },
  combo:    { label: '集じん・脱臭一体型', cls: 'b-dust', order: 2 },
  set:      { label: '集じん・脱臭フィルターセット', cls: 'b-dust', order: 2 },
  air:      { label: 'エアフィルター', cls: 'b-air', order: 4 },
  ag:       { label: 'Ag+イオンカートリッジ', cls: 'b-air', order: 5 },
  ion:      { label: 'イオン発生ユニット', cls: 'b-air', order: 6 },
  pre:      { label: 'プレフィルター', cls: 'b-disp', order: 7 },
  humidpre: { label: '加湿プレフィルター', cls: 'b-disp', order: 8 },
  jokin:    { label: '除菌フィルター', cls: 'b-air', order: 4 },
  agatt:    { label: 'Ag+抗菌アタッチメント', cls: 'b-air', order: 5 },
  tray:     { label: 'トレイカバー', cls: 'b-disp', order: 9 },
  pfilter:  { label: '交換フィルター', cls: 'b-dust', order: 2 },
  vfilter:  { label: '掃除機フィルター', cls: 'b-dust', order: 3 },
  battery:  { label: 'バッテリー', cls: 'b-air', order: 1 },
  bio:      { label: 'バイオ抗体／チタンアパタイト', cls: 'b-air', order: 5 },
  streamer: { label: 'ストリーマユニット', cls: 'b-air', order: 6 },
  clean:    { label: 'クリーニングフィルター', cls: 'b-care', order: 1 },
  jokinzai: { label: '除菌剤', cls: 'b-air', order: 5 },
  cartridge: { label: '浄水カートリッジ', cls: 'b-care', order: 1 },
};

// ---------- データ読み込み ----------
const datasets = fs.readdirSync(path.join(ROOT, 'data'))
  .filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')))
  .map(prepare);

function prepare(ds) {
  const maker = ds.maker;
  const series = (ds.series || []).map(s => ({ ...s, re: new RegExp(s.re) }));
  const seriesOf = m => series.find(s => s.re.test(m)) || { key: 'other', name: 'その他' };
  const partById = Object.fromEntries(ds.parts.map(p => [p.id, { ...p, maker }]));
  const models = {};
  for (const p of ds.parts) for (const m of p.models) (models[m] ||= { id: m, parts: [] }).parts.push(p.id);
  const primary = new Set(ds.primaryKinds || []);
  const modelList = Object.values(models)
    .filter(m => m.parts.some(pid => primary.has(partById[pid].kind)))
    .map(m => ({ ...m, series: seriesOf(m.id), source: (ds.modelSources || {})[m.id] || (ds.modelSourceUrl ? ds.modelSourceUrl.replace('{id}', m.id) : undefined) }))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  return { ...ds, seriesDefs: series, seriesOf, partById, modelList, hasPage: new Set(modelList.map(m => m.id)), parts: ds.parts.map(p => partById[p.id]) };
}

const allParts = datasets.flatMap(d => d.parts.map(p => ({ ...p, ds: d })));
const partIndex = Object.fromEntries(allParts.map(p => [p.id, p]));

// ---------- ユーティリティ ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => '¥' + n.toLocaleString('ja-JP');
const amazonUrl = q => {
  const u = new URL('https://www.amazon.co.jp/s');
  u.searchParams.set('k', q);
  if (cfg.amazonTag) u.searchParams.set('tag', cfg.amazonTag);
  return u.toString();
};
const slug = s => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');
// サイドバー用：部品が多いメーカーは適用機種の多い主要部品12点に絞る
const sideParts = ds => (ds.parts.length <= 12 ? [...ds.parts] : [...ds.parts].filter(p => (ds.primaryKinds || []).includes(p.kind) || p.kind === 'ag').sort((a, b) => b.models.length - a.models.length).slice(0, 12))
  .sort((a, b) => KINDS[a.kind].order - KINDS[b.kind].order || b.models.length - a.models.length);
// シリーズ内で使われる主要部品を、使う機種の多い順に返す
const mainParts = (ds, models) => { const cnt = {}; models.flatMap(m => m.parts).filter(id => (ds.primaryKinds || []).includes(ds.partById[id].kind)).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; }); return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]); };
const more = (xs, n) => xs.length > n ? `<span class="sub"> ほか${xs.length - n}点</span>` : '';
const lifeLabel = p => p.life ? p.life.label : '取扱説明書で確認';
const modelUrl = (ds, m) => `/${ds.maker.id}/${slug(m)}/`;
const partUrl = p => `/parts/${slug(p)}/`;
const makerUrl = ds => `/${ds.maker.id}/`;
const fmtDate = d => d.replace(/-/g, '/');
// 部品に asin（data-src/asins.json）があれば商品ページへ、なければ部品番号で検索
const ASINS = fs.existsSync(path.join(ROOT, 'data-src/asins.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data-src/asins.json'), 'utf8')) : {};
const partAmazonUrl = (makerName, p) => {
  const asin = p.asin || ASINS[p.id];
  if (!asin) return amazonUrl(`${makerName} ${p.id}`);
  const u = new URL(`https://www.amazon.co.jp/dp/${asin}`);
  if (cfg.amazonTag) u.searchParams.set('tag', cfg.amazonTag);
  return u.toString();
};
// 購入ボックス：部品ごとに価格・交換めやす・Amazonボタン
const amzBtn = (ds, p, label = 'Amazonで見る', cls = 'btn-amz btn-s') => `<a class="${cls}" href="${esc(partAmazonUrl(ds.maker.name, p))}" rel="sponsored nofollow noopener" target="_blank">${label}</a>`;
function buyBox(ds, parts, heading, note = '') {
  if (!parts.length) return '';
  return `<section class="buy"><h2 class="h2">${esc(heading)}</h2>${note ? `<p class="sub">${note}</p>` : ''}
<ul class="buy-list">${parts.map(p => `<li><div class="buy-info"><a class="pn" href="${partUrl(p.id)}">${p.id}</a> <span class="sub">${esc(p.kind === 'vapor' ? `気化フィルター（${p.type === 'care' ? 'お手入れ' : '使い捨て'}）` : KINDS[p.kind].label)}${p.packLabel ? `・${esc(p.packLabel)}` : p.pack > 1 ? `・${p.pack}個入り` : ''}</span><br><span class="sub">${p.price ? `${esc(ds.priceLabel || '直販価格')} ${yen(p.price)}・` : ''}交換のめやす：${esc(lifeLabel(p))}・${p.models.length}機種で共通</span></div>${amzBtn(ds, p)}</li>`).join('')}</ul></section>`;
}
const topPartsOf = (ds, n, filter = () => true) => [...ds.parts].filter(p => (ds.primaryKinds || []).includes(p.kind) && filter(p)).sort((a, b) => b.models.length - a.models.length).slice(0, n);
const lifeMonths = l => !l ? 9999 : l.unit === 'month' ? l.value : l.unit === 'season' ? l.value * 6 : l.unit === 'year' ? l.value * 12 : 5000;

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function groupBySeries(ds, list) {
  const map = new Map();
  for (const m of list) {
    const s = m.series || ds.seriesOf(m.id);
    if (!map.has(s.key)) map.set(s.key, { key: s.key, name: s.name, models: [] });
    map.get(s.key).models.push(m);
  }
  const order = ds.seriesDefs.map(s => s.key);
  return [...map.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function typeBadge(p) {
  if (p.kind === 'vapor') return p.type === 'care' ? '<span class="badge b-care">お手入れ</span>' : '<span class="badge b-disp">使い捨て</span>';
  const k = KINDS[p.kind];
  return `<span class="badge ${k.cls}">${esc(k.label)}</span>`;
}
const shortType = p => p.kind === 'vapor' ? (p.type === 'care' ? '気化・お手入れ' : '気化・使い捨て') : KINDS[p.kind].label;

// 使い捨て／お手入れの累計コスト（ダイニチ）
function costs(care, disp, years = 5, months = 6) {
  const seasons = years * months / 6;
  const careCount = Math.ceil(seasons / care.life.value);
  const packs = Math.ceil(Math.ceil(months / disp.life.value) * years / disp.pack);
  return { care: careCount * care.price, careCount, disp: packs * disp.price, packs, washes: months * years };
}

// ---------- レイアウト ----------
function layout({ title, desc, canonical, crumbs = [], body, ds = null, jsonld = [], scripts = [], aside = true, noindex = false, pr = false }) {
  const crumbLd = crumbs.length ? [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'トップ', url: '/' }, ...crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(c.url ? { item: SITE + c.url } : {}) })),
  }] : [];
  const ld = [...crumbLd, ...jsonld].map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}${canonical}">
<meta property="og:site_name" content="${esc(cfg.siteName)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/style.css">
${ld}
${cfg.ga4Id ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.ga4Id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.ga4Id)}');</script>` : ''}${cfg.vercelAnalytics ? `<script defer src="/_vercel/insights/script.js"></script>` : ''}
</head>
<body>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="logo" href="/"><span class="logo-main">${esc(cfg.siteName)}</span><span class="logo-sub">${esc(cfg.tagline)}</span></a>
    <form class="head-search" action="/search/" method="get" role="search">
      <label class="vh" for="q">型番で検索</label>
      <input id="q" name="q" type="search" autocomplete="off" placeholder="型番・部品番号で検索（例：HD-RX520、KI-RS50、F-VXW70）">
      <button type="submit">検索</button>
    </form>
  </div>
  <nav class="gnav"><div class="wrap">
    ${datasets.map(d => `<a href="${makerUrl(d)}">${esc(d.maker.navName || d.maker.name)}</a>`).join('')}<a href="/parts/">部品番号一覧</a><a href="/guide/dainichi-filter-life/">ダイニチ交換時期</a><a href="/guide/sharp-filter-schedule/">シャープ交換時期</a><a href="/guide/dainichi-filter-cost/">費用比較</a>
  </div></nav>
</header>
${crumbs.length ? `<div class="wrap crumbs"><a href="/">トップ</a>${crumbs.map(c => c.url ? ` &gt; <a href="${c.url}">${esc(c.name)}</a>` : ` &gt; <span>${esc(c.name)}</span>`).join('')}</div>` : ''}
<div class="wrap cols${aside ? '' : ' cols-full'}">
<main>
${body}
</main>
${aside ? sidebar(ds) : ''}
</div>
<footer class="site-foot">
  <div class="wrap">
    <p class="foot-links"><a href="/about/">運営者情報</a><a href="/privacy/">プライバシーポリシー・免責事項</a><a href="/contact/">お問い合わせ</a><a href="/parts/">部品番号一覧</a><a href="/guide/find-model-number/">型番の確認方法</a><a href="/compare/">部品の比較</a></p>
    <p class="foot-note">Amazonのアソシエイトとして、${esc(cfg.siteName)}は適格販売により収入を得ています。価格はメーカー直販サイトまたはメーカーカタログの掲載価格（税込）で、確認日時点のものです。購入前に販売ページで適用機種を必ずご確認ください。</p>
    <p class="copy">&copy; ${new Date().getFullYear()} ${esc(cfg.siteName)}</p>
  </div>
</footer>
<script src="/assets/search.js" defer></script>
${cfg.ga4Id ? '<script src="/assets/track.js" defer></script>' : ''}
${scripts.map(s => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

function sidebar(ds) {
  const makersBox = `<section class="side-box"><h2>メーカーから探す</h2><ul class="side-list">${datasets.map(d => `<li><a href="${makerUrl(d)}">${esc(d.maker.name)} ${esc(d.maker.category)}</a><span class="n">${d.modelList.length}</span></li>`).join('')}</ul></section>`;
  if (!ds) return `<aside class="side">
  <section class="side-box"><h2>型番はどこに書いてある？</h2><p>多くの家電は、本体の側面か背面のシールに型番が印字されています。</p><p><a href="/guide/find-model-number/">確認方法をくわしく</a></p></section>
  ${makersBox}
</aside>`;
  return `<aside class="side">
  <section class="side-box"><h2>型番はどこに書いてある？</h2><p>${esc(ds.maker.modelLabelHint)}</p><p><a href="/guide/find-model-number/">確認方法をくわしく</a></p></section>
  <section class="side-box"><h2>${esc(ds.maker.name)} シリーズから探す</h2><ul class="side-list">${groupBySeries(ds, ds.modelList).map(g => `<li><a href="${makerUrl(ds)}#s-${g.key}">${esc(g.name)}</a><span class="n">${g.models.length}</span></li>`).join('')}</ul></section>
  <section class="side-box"><h2>部品番号から探す</h2><ul class="side-list">${sideParts(ds).map(p => `<li><a href="${partUrl(p.id)}">${p.id}</a><span class="n">${esc(shortType(p))}</span></li>`).join('')}</ul>${ds.parts.length > 12 ? `<p><a href="/parts/#${ds.maker.id}">全${ds.parts.length}点を見る</a></p>` : ''}</section>
  ${makersBox}
</aside>`;
}

// ---------- 機種ページ ----------
function modelPage(ds, m) {
  const maker = ds.maker;
  const ps = m.parts.map(id => ds.partById[id]).sort((a, b) => KINDS[a.kind].order - KINDS[b.kind].order || (a.type === 'care' ? -1 : 1));
  const hasPrice = ps.some(p => p.price);
  const priceLabel = ds.priceLabel || '直販価格';
  const primary = ps.find(p => (ds.primaryKinds || []).includes(p.kind));

  const partRows = ps.map(p => `<tr><th>${esc(p.kind === 'vapor' ? `気化フィルター（${p.type === 'care' ? 'お手入れ' : '使い捨て'}）` : KINDS[p.kind].label)}</th>
<td><a class="pn" href="${partUrl(p.id)}">${p.id}</a> ${typeBadge(p)}<br><span class="sub">${esc(p.name)}${p.packLabel ? (p.name.includes(p.packLabel) ? '' : `（${esc(p.packLabel)}）`) : p.pack > 1 && !/\d(個|枚)入/.test(p.name) ? `（${p.pack}個入り）` : ''}・${esc(lifeLabel(p))}${p.typeLabel && !['vapor', 'agatt', 'bio'].includes(p.kind) ? `<br>${esc(p.typeLabel)}` : ''}${p.stockNote ? `<br><strong>${esc(p.stockNote)}</strong>` : ''}</span></td>
${hasPrice ? `<td class="price">${p.price ? yen(p.price) : '—'}</td>` : ''}
<td class="act">${amzBtn(ds, p)}${p.source ? `<a class="off-link" href="${esc(p.source)}" rel="noopener" target="_blank">公式通販で見る</a>` : ''}</td></tr>`).join('\n');

  // ダイニチ：お手入れ／使い捨ての費用比較
  let costHtml = '';
  const care = ps.find(p => p.kind === 'vapor' && p.type === 'care');
  const disp = ps.find(p => p.kind === 'vapor' && p.type === 'disposable');
  if (ds.showCost && care && disp && !care.noCost) {
    const c = costs(care, disp);
    costHtml = `
<h2 class="h2">お手入れタイプと使い捨てタイプ、どちらが得か</h2>
<p>${m.id} の気化フィルターは2種類から選べます。違いは「価格」と「洗う手間」です。メーカーの交換めやす（1シーズン＝6カ月、1日8時間運転）で5シーズン使った場合を計算しました。</p>
<table class="tbl cmp">
<thead><tr><th></th><th>お手入れタイプ<br><span class="sub">${care.id}</span></th><th>使い捨てタイプ<br><span class="sub">${disp.id}</span></th></tr></thead>
<tbody>
<tr><th>1回の購入額</th><td>${yen(care.price)}（1個）</td><td>${yen(disp.price)}（${disp.pack}個入り）</td></tr>
<tr><th>交換のめやす</th><td>${esc(care.life.label)}</td><td>${esc(disp.life.label)}</td></tr>
<tr><th>5シーズンの購入数</th><td>${c.careCount}個</td><td>${c.packs}箱</td></tr>
<tr><th>5シーズンの総額</th><td class="price">${yen(c.care)}</td><td class="price">${yen(c.disp)}</td></tr>
<tr><th>お手入れ</th><td>月1回のクエン酸洗浄（5シーズンで約${c.washes}回）</td><td>不要（汚れたら交換）</td></tr>
</tbody>
</table>
<p class="calc-note">差額は <strong>${yen(c.disp - c.care)}</strong>。使い捨てタイプは「約${c.washes}回のクエン酸洗浄を、1回あたり約${yen(Math.round((c.disp - c.care) / c.washes))}で買う」選択です。お手入れタイプの総額にクエン酸代は含めていません。洗浄をさぼると1シーズンもたないこともあるため、洗う習慣がなければ使い捨てのほうが結果的に安くつく場合があります。</p>
<div class="calc" data-calc data-care-price="${care.price}" data-care-life="${care.life.value}" data-disp-price="${disp.price}" data-disp-pack="${disp.pack}" data-disp-life="${disp.life.value}">
  <p class="calc-h">自分の使い方で計算する</p>
  <label>1年に使う月数 <select data-months>${[3,4,5,6,7,8,9,10,11,12].map(n => `<option${n === 6 ? ' selected' : ''}>${n}</option>`).join('')}</select> カ月</label>
  <label>何年分 <select data-years>${[1,2,3,4,5].map(n => `<option${n === 5 ? ' selected' : ''}>${n}</option>`).join('')}</select> 年</label>
  <p class="calc-out" data-out aria-live="polite"></p>
</div>`;
  }

  // 交換めやすが月・シーズン単位の部品が2つ以上あるとき：1か月あたりの費用
  let monthHtml = '';
  const mcs = ps.filter(p => monthlyCost(p));
  if (!ds.showCost && mcs.length >= 2) monthHtml = `<h2 class="h2">1か月あたりの費用</h2>
<p>交換のめやすどおりに使った場合の、1か月あたりの費用です（${esc(priceLabel)} ÷ 交換のめやすの月数。1シーズン＝6か月、複数個入りは個数分の月数）。</p>
<table class="tbl cmp"><thead><tr><th>部品</th><th>価格</th><th>交換のめやす</th><th>1か月あたり</th></tr></thead><tbody>
${mcs.sort((a, b) => monthlyCost(a) - monthlyCost(b)).map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a><br><span class="sub">${esc(p.packLabel || `${p.pack}個`)}</span></td><td class="price">${yen(p.price)}</td><td>${esc(lifeLabel(p))}</td><td class="price">約${yen(monthlyCost(p))}</td></tr>`).join('')}
</tbody></table>${comparesOf(mcs[0].id).length ? `<p>違いをくわしく → ${comparesOf(mcs[0].id).map(([a, b]) => `<a href="${compareUrl(a, b)}">${a} と ${b} の違い</a>`).join('、')}</p>` : ''}`;

  // シャープ：交換頻度でまとめる
  let freqHtml = '';
  if (ds.showFrequency !== false) {
    const buckets = [
      { name: '毎月', test: p => p.life && p.life.unit === 'month' && p.life.value <= 1, note: 'いちばん買う頻度が高いもの。まとめ買いしておくと切らしません。' },
      { name: '数か月ごと', test: p => p.life && ((p.life.unit === 'month' && p.life.value > 1) || (p.life.unit === 'season' && p.life.value <= 1)), note: '年に何回か買い替えるもの。複数個入りを選ぶと注文の回数が減ります。' },
      { name: '数シーズンごと', test: p => p.life && p.life.unit === 'season' && p.life.value > 1, note: 'シーズンの区切り（使い始めや片付けの前）に状態を確かめます。' },
      { name: '毎年', test: p => p.life && p.life.unit === 'year' && p.life.value === 1, note: '冬の加湿シーズン前に替えるのが目安です。' },
      { name: '数年に1回', test: p => p.life && p.life.unit === 'year' && p.life.value > 1 && p.life.value < 10, note: '' },
      { name: '約10年に1回', test: p => p.life && p.life.unit === 'year' && p.life.value >= 10, note: '本来は長持ちします。洗っても汚れやニオイが取れないときだけ交換します。' },
      { name: 'ランプが点滅したら', test: p => p.life && p.life.unit === 'lamp', note: '本体の交換ランプで知らせてくれます。' },
    ];
    if (ps.filter(p => p.life).length >= 2) freqHtml = `<h2 class="h2">交換の頻度で分けると</h2>
<p>${m.id} の消耗品を、メーカーが公表している交換めやすで並べ替えました。${buckets.filter(b => ps.some(b.test)).length >= 2 ? '「フィルター交換」と言っても、替える時期は部品によって大きく違います。' : ''}</p>
<table class="tbl freq"><thead><tr><th>頻度</th><th>部品</th><th>メモ</th></tr></thead><tbody>
${buckets.map(b => { const xs = ps.filter(b.test); return xs.length ? `<tr><th>${b.name}</th><td>${xs.map(p => `<a class="pn" href="${partUrl(p.id)}">${p.id}</a> <span class="sub">${esc(KINDS[p.kind].label)}</span>`).join('<br>')}</td><td class="sub">${esc(b.note)}</td></tr>` : ''; }).join('')}
</tbody></table>`;
  }

  const siblings = primary ? primary.models.filter(x => x !== m.id && ds.hasPage.has(x)) : [];
  const title = ds.modelTitle ? ds.modelTitle.replace(/\{id\}/g, m.id) : `${m.id} のフィルター交換｜部品番号・${hasPrice ? '価格・' : ''}交換時期（${maker.name} ${maker.category}）`;
  const keyIds = ps.filter(p => ((ds.primaryKinds || []).includes(p.kind) || p.kind === 'air') && p.kind !== 'battery').map(p => p.id);
  const batIds = ps.filter(p => p.kind === 'battery').map(p => p.id);
  const desc = `${maker.name} ${m.id}（${maker.category}）の${keyIds.length ? `${ds.partWord || 'フィルター'}交換に使う純正部品の部品番号は${keyIds.join('・')}${batIds.length ? `、交換バッテリーは${batIds.join('・')}` : ''}` : `交換バッテリーの部品番号は${batIds.join('・')}`}。${hasPrice ? `${priceLabel}と` : ''}交換のめやすをメーカー資料から確認できます。`;
  // 冒頭の結論：汚れ・ニオイで替えるフィルターを、交換めやすの短い順に
  const FIX = ['vapor', 'humid', 'humidpre', 'pre', 'ag', 'dust', 'deo', 'combo', 'set', 'pfilter', 'vfilter'];
  const fixParts = ps.filter(p => FIX.includes(p.kind)).sort((a, b) => lifeMonths(a.life) - lifeMonths(b.life)).slice(0, 5);
  const fixLabel = p => p.kind === 'vapor' ? `気化フィルター（${p.type === 'care' ? 'お手入れ' : '使い捨て'}）` : ['pfilter', 'vfilter'].includes(p.kind) && p.name !== KINDS[p.kind].label ? `${KINDS[p.kind].label}（${p.name}）` : KINDS[p.kind].label;
  const vaporBoth = fixParts.some(p => p.kind === 'vapor' && p.type === 'care') && fixParts.some(p => p.kind === 'vapor' && p.type === 'disposable');
  const allLong = fixParts.every(p => p.life && ['year', 'season', 'none'].includes(p.life.unit) && lifeMonths(p.life) >= 60);
  const answerHtml = fixParts.length ? `<div class="answer">
<p class="answer-h">フィルターが汚れた・臭うときに確認する部品</p>
<ul class="answer-list">${fixParts.map(p => `<li><span>${esc(fixLabel(p))}：<a class="pn" href="${partUrl(p.id)}">${p.id}</a><span class="sub">（交換のめやす：${esc(lifeLabel(p))}${p.price ? `・${yen(p.price)}` : ''}）</span></span>${amzBtn(ds, p, 'Amazon', 'btn-amz btn-xs')}</li>`).join('')}</ul>
${vaporBoth ? '<p>気化フィルターは「お手入れタイプ」か「使い捨てタイプ」の<strong>どちらか一方</strong>を使います。お手入れタイプの「最大5シーズン」は、月1回のクエン酸洗浄をした場合の目安です。</p>' : ''}${allLong ? '<p>この機種のフィルターは、どれも交換の間隔が長い（または交換不要の）部品です。汚れやニオイが気になるときは、買い替える前に取扱説明書のお手入れ方法を確認してください。</p>' : ''}
<p class="sub">交換のめやすの短い順。めやすはメーカー公表の値です。価格と購入先は下の表にあります。</p>
</div>` : '';
  const srcUrl = m.source || ds.sourceUrl || maker.officialShop;
  const srcName = ds.modelSourceLabel ? ds.modelSourceLabel.replace('{id}', m.id) : ds.modelSourceName ? ds.modelSourceName.replace('{id}', m.id) : m.source ? `${maker.name} ${m.id} 取扱説明書（PDF）` : ds.sourceName || `${maker.name} 公式 別売部品ページ`;
  const srcKind = (ds.modelSourceName || ds.modelSourceLabel) ? ds.sourceKind : m.source ? '取扱説明書' : ds.sourceKind || 'メーカー直販サイト';

  const body = `
<h1 class="h1">${ds.modelTitle ? `${esc(maker.name)} ${m.id} の交換部品` : `${m.id} のフィルター交換｜部品番号と交換時期`}</h1>
<p class="lead">${esc(maker.nameFull)}の${esc(maker.category)}「${m.id}」に適合する純正の交換部品です。${srcKind}の記載（${fmtDate(ds.checkedAt)}確認）にもとづいています。</p>
${answerHtml}
<table class="tbl spec"><tbody>
<tr><th>メーカー</th><td>${esc(maker.nameFull)}</td></tr>
<tr><th>製品</th><td>${esc(maker.category)}</td></tr>
<tr><th>シリーズ</th><td><a href="${makerUrl(ds)}#s-${m.series.key}">${esc(m.series.name)}</a></td></tr>
</tbody></table>

<h2 class="h2">適合する交換部品</h2>
<table class="tbl parts">
<thead><tr><th>部品</th><th>部品番号</th>${hasPrice ? `<th>${priceLabel}</th>` : ''}<th>購入先</th></tr></thead>
<tbody>
${partRows}
</tbody>
</table>
<p class="sub">${hasPrice ? (ds.priceLabel ? `${priceLabel}は${esc(ds.sourceKind || 'メーカーカタログ')}記載の税込価格です。` : '直販価格はメーカー直販サイトの税込価格です。') : ''}Amazonの価格は出品者によって変わります。</p>

${costHtml}${monthHtml}${freqHtml}${ds.maker.id === 'dainichi' ? `<p>フィルターの交換時期の条件（「最大5シーズン」は月1回のクエン酸洗浄が前提）は → <a href="/guide/dainichi-filter-life/">ダイニチ加湿器のフィルター交換時期</a></p><p>お手入れタイプの洗い方（クエン酸4Lに約25g・30分〜2時間）は → <a href="/guide/dainichi-filter-citric-acid/">抗菌気化フィルターの洗い方</a></p><p>互換品と迷っているなら → <a href="/guide/dainichi-filter-genuine-vs-compatible/">純正品と互換品の違い（ダイニチ公式の比較結果）</a></p>` : ''}${ds.maker.id === 'sharp' && ps.some(p => p.kind === 'humid') ? `<p>加湿フィルターは、交換する前に洗うと長持ちします。→ <a href="/guide/sharp-humidifier-filter-care/">クエン酸・重曹での洗い方</a></p>` : ''}

<h2 class="h2">買う前に確認すること</h2>
<ul class="notes">
<li>${esc(maker.genuineNote)}Amazonで買う場合は、商品名に部品番号${primary ? `「${primary.id}」` : ''}が入っていること、出品者がメーカーまたは信頼できる販売店であることを確かめてください。</li>
<li>${esc(maker.modelNote)}</li>
<li>${esc(maker.partsPolicy)}</li>
${maker.partialNote ? `<li>${esc(maker.partialNote)}</li>` : ''}
</ul>

${primary ? `<h2 class="h2">同じ${esc(KINDS[primary.kind].label)}（${primary.id}）が使える機種</h2>
<p class="sub">${primary.id} は全${primary.models.length}機種で共通です。家に複数台あれば、まとめ買いできます。<a href="${partUrl(primary.id)}">全${primary.models.length}機種の一覧</a></p>
${siblings.length && siblings.length <= 40 ? `<ul class="model-grid">${siblings.map(x => `<li><a href="${modelUrl(ds, x)}">${x}</a></li>`).join('')}</ul>` : ''}` : ''}

<p class="src">出典：<a href="${esc(srcUrl)}" rel="noopener" target="_blank">${esc(srcName)}</a>（${fmtDate(ds.checkedAt)}確認）</p>`;

  return layout({
    title, desc, canonical: modelUrl(ds, m.id), ds, pr: true,
    crumbs: [{ name: `${maker.name} ${maker.category}`, url: makerUrl(ds) }, { name: m.series.name, url: `${makerUrl(ds)}#s-${m.series.key}` }, { name: m.id }],
    body, scripts: costHtml ? ['/assets/calc.js'] : [],
  });
}

// ---------- 部品ページ ----------
function partPage(ds, p) {
  const maker = ds.maker;
  const pair = p.pairId ? ds.partById[p.pairId] : null;
  const withPage = p.models.filter(x => ds.hasPage.has(x));
  const grouped = groupBySeries(ds, withPage.map(x => ({ id: x })));
  const noPage = p.models.filter(x => !ds.hasPage.has(x));
  const title = `${p.id} ${p.name}の対応機種（適用機種）一覧｜全${p.models.length}機種・${maker.name} ${maker.category}`;
  const desc = `${maker.name}の${p.name}（${p.id}）が使える${maker.category}の型番${p.models.length}機種の一覧。${p.price ? `${ds.priceLabel || '直販価格'}${yen(p.price)}、` : ''}交換のめやす、購入時の注意をまとめています。`;
  const srcs = p.source ? [[p.source, `${maker.name} 公式 ${p.id}`]] : ds.sourceUrl ? [[ds.sourceUrl, ds.sourceName]] : withPage.map(x => ds.modelList.find(m => m.id === x)).filter(m => m && m.source).map(m => [m.source, `${m.id} 取扱説明書`]);

  const body = `
<h1 class="h1">${p.id} ${esc(p.name)} ${typeBadge(p)}<span class="h1-sub">対応機種（適用機種）${p.models.length}機種</span></h1>
<table class="tbl spec"><tbody>
<tr><th>部品番号</th><td><strong class="pn-big">${p.id}</strong>${p.replaces ? `<span class="sub">（旧番号 ${p.replaces.join('・')} はこの番号に統合）</span>` : ''}</td></tr>
<tr><th>部品名</th><td>${esc(p.name)}${p.typeLabel ? `（${esc(p.typeLabel)}）` : ''}${p.stockNote ? `<br><strong>${esc(p.stockNote)}</strong>` : ''}</td></tr>
<tr><th>入数</th><td>${esc(p.packLabel || `${p.pack}個`)}</td></tr>
${p.price ? `<tr><th>${ds.priceLabel === '希望小売価格' ? 'メーカー希望小売価格' : ds.priceLabel || 'メーカー直販価格'}</th><td class="price">${yen(p.price)}<span class="sub">（税込・${fmtDate(ds.checkedAt)}確認）</span></td></tr>` : ''}
<tr><th>交換のめやす</th><td>${esc(lifeLabel(p))}<br><span class="sub">${esc(p.lifeNote)}</span></td></tr>
${p.variants ? `<tr><th>入数違い</th><td>${esc(p.variants)}</td></tr>` : ''}
<tr><th>適用機種数</th><td>${p.models.length}機種</td></tr>
</tbody></table>
<div class="buy">
  <a class="btn-amz" href="${esc(partAmazonUrl(maker.name, p))}" rel="sponsored nofollow noopener" target="_blank">Amazonで ${p.id} を見る</a>
  ${p.source ? `<a class="off-link" href="${esc(p.source)}" rel="noopener" target="_blank">公式通販で見る</a>` : ''}
</div>

${comparesOf(p.id).length ? `<p>比べて選ぶ：${comparesOf(p.id).map(([a, b]) => `<a href="${compareUrl(a, b)}">${a} と ${b} の違い</a>`).join('、')}</p>` : ''}
${pair ? `<h2 class="h2">${pair.id}（${esc(pair.typeLabel)}）との違い</h2>
<p>同じ機種で使える気化フィルターに、${p.type === 'care' ? '洗わずに捨てられる使い捨てタイプ' : '洗って長く使うお手入れタイプ'}の <a href="${partUrl(pair.id)}">${pair.id}</a>（${yen(pair.price)}・${esc(pair.life.label)}）があります。${p.noCost ? '' : '5シーズン使った場合の費用比較は<a href="/guide/dainichi-filter-cost/">こちら</a>。'}</p>` : ''}

<h2 class="h2">適用機種一覧（${p.models.length}機種）</h2>
<p class="sub">${p.source ? 'メーカー直販サイトの適用機種表' : ds.sourceUrl ? `${esc(ds.sourceKind || 'メーカー総合カタログ')}の適用機種表` : '各機種の取扱説明書の記載'}を、シリーズ別に並べたものです。</p>
${grouped.map(g => `<h3 class="h3">${esc(g.name)}</h3><ul class="model-grid">${g.models.map(x => `<li><a href="${modelUrl(ds, x.id)}">${x.id}</a></li>`).join('')}</ul>`).join('')}
${noPage.length ? `<h3 class="h3">その他の適用機種</h3><ul class="model-grid">${noPage.map(x => `<li><span>${x}</span></li>`).join('')}</ul>` : ''}

<p class="src">出典：${srcs.slice(0, 8).map(([u, n]) => `<a href="${esc(u)}" rel="noopener" target="_blank">${esc(n)}</a>`).join('、')}${srcs.length > 8 ? ` ほか${srcs.length - 8}件` : ''}（${fmtDate(ds.checkedAt)}確認）</p>`;

  return layout({ title, desc, canonical: partUrl(p.id), ds, pr: true, crumbs: [{ name: '部品番号一覧', url: '/parts/' }, { name: p.id }], body });
}

// ---------- メーカーページ ----------
function makerPage(ds) {
  const maker = ds.maker;
  const pw = ds.partWord || 'フィルター';
  const topIds = mainParts(ds, ds.modelList);
  const groups = groupBySeries(ds, ds.modelList);
  const primaryOf = g => mainParts(ds, g.models);
  const body = `
<h1 class="h1">${esc(maker.name)} ${esc(maker.category)}の交換${pw} 機種別一覧</h1>
<p class="lead">${ds.modelList.length}機種を収録。形名を選ぶと、その機種に合う交換部品の部品番号と交換のめやすが表示されます。</p>
${datasets.filter(d => d !== ds && d.maker.name === maker.name).map(d => `<p class="sub">${esc(maker.name)}の${esc(d.maker.category)}（${d.modelList.length}機種）は → <a href="${makerUrl(d)}">${esc(maker.name)} ${esc(d.maker.category)}の交換フィルター一覧</a></p>`).join('')}
${buyBox(ds, topPartsOf(ds, 6), `よく使われる${pw}（使える機種が多い順）`, `${esc(maker.name)}の${esc(maker.category)}で、適用機種の多い純正部品です。自分の機種に合うかは、下の一覧から型番を選んで確認してください。`)}
<div class="jump">${groups.map(g => `<a href="#s-${g.key}">${esc(g.name)}</a>`).join('')}</div>
${groups.map(g => `<h2 class="h2" id="s-${g.key}">${esc(g.name)}<span class="h2-n">${g.models.length}機種</span></h2>
<p class="sub">主なフィルター：${primaryOf(g).slice(0, 6).map(id => `<a href="${partUrl(id)}">${id}</a>（${esc(shortType(ds.partById[id]))}・<a href="${esc(partAmazonUrl(maker.name, ds.partById[id]))}" rel="sponsored nofollow noopener" target="_blank">Amazon</a>）`).join('、')}${more(primaryOf(g), 6)}</p>
<ul class="model-grid">${g.models.map(m => `<li><a href="${modelUrl(ds, m.id)}">${m.id}</a></li>`).join('')}</ul>`).join('')}
<p class="src">出典：<a href="${esc(ds.sourceUrl || maker.officialShop)}" rel="noopener" target="_blank">${esc(ds.sourceName || `${maker.name} 公式サポート`)}</a>${ds.modelSources ? '・各機種の取扱説明書' : ''}（${fmtDate(ds.checkedAt)}確認）。ここにない形名は、まだ収録していないか、メーカーの部品供給が終わっている可能性があります。</p>`;
  return layout({
    title: `${maker.name} ${maker.category}の交換${pw}・部品 型番別一覧｜${topIds.slice(0, 2).join('・')}など${ds.modelList.length}機種`,
    desc: `${maker.name}の${maker.category}の交換${pw}・部品を型番から探せます。${topIds.slice(0, 3).join('・')}など、${ds.modelList.length}機種それぞれに合う純正部品の部品番号と価格をメーカー公式の情報から一覧にしています。`,
    canonical: makerUrl(ds), ds, crumbs: [{ name: `${maker.name} ${maker.category}` }], body,
  });
}

// ---------- 部品一覧 ----------
function partsIndex() {
  const body = `
<h1 class="h1">部品番号一覧</h1>
<p class="lead">収録している交換部品の一覧です。部品番号から適用機種を確認できます。</p>
${datasets.map(ds => {
  const hasPrice = ds.parts.some(p => p.price);
  return `<h2 class="h2" id="${ds.maker.id}">${esc(ds.maker.name)} ${esc(ds.maker.category)}<span class="h2-n">${ds.parts.length}点</span></h2>
<table class="tbl parts">
<thead><tr><th>部品番号</th><th>部品名</th><th>種類</th>${hasPrice ? `<th>${ds.priceLabel || '直販価格'}</th>` : ''}<th>交換めやす</th><th>適用機種</th></tr></thead>
<tbody>${[...ds.parts].sort((a, b) => KINDS[a.kind].order - KINDS[b.kind].order || a.id.localeCompare(b.id, 'en', { numeric: true })).map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a></td><td>${esc(p.name)}</td><td>${typeBadge(p)}</td>${hasPrice ? `<td class="price">${p.price ? yen(p.price) : '—'}</td>` : ''}<td>${esc(lifeLabel(p))}</td><td>${p.models.length}機種</td></tr>`).join('')}</tbody>
</table>`;
}).join('')}`;
  return layout({ title: `部品番号一覧｜${cfg.siteName}`, desc: '収録している家電の交換部品の部品番号・交換めやす・適用機種数の一覧。', canonical: '/parts/', crumbs: [{ name: '部品番号一覧' }], body });
}

// ---------- トップ ----------
function topPage() {
  const dn = datasets.find(d => d.maker.id === 'dainichi');
  const vparts = dn ? dn.parts.filter(p => p.kind === 'vapor') : [];
  const body = `
<section class="top-search">
  <h1 class="top-h">本体の型番から、合う交換部品がわかる</h1>
  <form action="/search/" method="get" role="search" class="big-search">
    <label class="vh" for="q2">型番</label>
    <input id="q2" name="q" type="search" autocomplete="off" placeholder="例：HD-RXT524、KI-RS50、F-VXW70" data-suggest>
    <button type="submit">部品を調べる</button>
  </form>
  <ul class="suggest" data-suggest-list hidden></ul>
  <p class="top-hint">型番は本体の側面か背面のシールに書いてあります。「HD-」「KI-」「FU-」「F-」を省いて入れても探せます。ダイキンは「MCK70Z」、ダイソンは「TP04」「V8」のように入力します。</p>
</section>

<h2 class="h2">収録しているメーカー</h2>
<table class="tbl">
<thead><tr><th>メーカー</th><th>製品</th><th>収録機種</th><th>部品</th><th>確認日</th></tr></thead>
<tbody>${datasets.map(d => `<tr><td><a href="${makerUrl(d)}">${esc(d.maker.nameFull)}</a></td><td>${esc(d.maker.category)}</td><td>${d.modelList.length}機種</td><td>${d.parts.length}点</td><td>${fmtDate(d.checkedAt)}</td></tr>`).join('')}</tbody>
</table>
<p class="sub">浄水器・掃除機の消耗品も順次追加します。</p>

${datasets.map(ds => `<h2 class="h2">シリーズから探す（${esc(ds.maker.name)} ${esc(ds.maker.category)}）</h2>
<table class="tbl series">
<thead><tr><th>シリーズ</th><th>主な型番</th><th>主なフィルター</th></tr></thead>
<tbody>${groupBySeries(ds, ds.modelList).map(g => {
  const vp = mainParts(ds, g.models);
  return `<tr><td><a href="${makerUrl(ds)}#s-${g.key}">${esc(g.name)}</a></td><td class="sub">${g.models.slice(-3).map(m => m.id).join('、')} ほか ${g.models.length}機種</td><td>${vp.slice(0, 4).map(id => `<a href="${partUrl(id)}">${id}</a>`).join(' / ')}${more(vp, 4)}</td></tr>`;
}).join('')}</tbody>
</table>`).join('')}

${vparts.length ? `<h2 class="h2">ダイニチ 気化フィルターの価格と交換めやす</h2>
<table class="tbl parts">
<thead><tr><th>部品番号</th><th>種類</th><th>直販価格</th><th>交換めやす</th></tr></thead>
<tbody>${vparts.map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a></td><td>${typeBadge(p)}</td><td class="price">${yen(p.price)}</td><td>${esc(p.life.label)}</td></tr>`).join('')}</tbody>
</table>
<p>使い捨てとお手入れ、5シーズンでいくら差が出るかは「<a href="/guide/dainichi-filter-cost/">ダイニチ加湿器フィルターの費用比較</a>」で計算しています。シャープの加湿空気清浄機は「<a href="/guide/sharp-filter-schedule/">フィルターの交換時期一覧</a>」で、毎月・毎年・10年ごとに替えるものを整理しています。</p>` : ''}`;

  return layout({
    title: `${cfg.siteName}｜家電の交換フィルター・部品を型番で検索`,
    desc: '加湿器・加湿空気清浄機などの家電の本体型番を入れると、合う純正交換フィルターの部品番号・交換のめやすがわかる検索サイト。',
    canonical: '/', body, scripts: ['/assets/suggest.js'],
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: SITE + '/', potentialAction: { '@type': 'SearchAction', target: `${SITE}/search/?q={q}`, 'query-input': 'required name=q' } }],
  });
}

function searchPage() {
  const body = `
<h1 class="h1">検索結果</h1>
<div data-search-results><p class="sub">検索しています…</p></div>
<noscript><p>検索にはJavaScriptが必要です。メーカーの機種一覧から探してください。</p></noscript>`;
  return layout({ title: `検索結果｜${cfg.siteName}`, desc: '型番検索の結果', canonical: '/search/', crumbs: [{ name: '検索結果' }], body, scripts: ['/assets/results.js'], noindex: true });
}

// ---------- ガイド ----------
function costGuide(ds) {
  const parts = ds.parts;
  const pairs = parts.filter(p => p.kind === 'vapor' && p.type === 'care' && !p.noCost).map(c => [c, ds.partById[c.pairId]]);
  const scenarios = [[6, 5], [4, 5], [9, 5], [6, 1]];
  const label = c => c.models.some(m => /^HD-LX|^HD-ELXC/.test(m)) ? 'LX・LXC・ELXCタイプ' : c.models.some(m => /^HD-N3|^HD-RX3/.test(m)) ? 'N3xx・RX3xx・30xx系など' : 'RX・RXT・N5xx〜9xx系など';
  const mid = pairs.find(([c]) => c.id === 'H060518') || pairs[0];
  const body = `
<h1 class="h1">ダイニチ加湿器のフィルター、お手入れタイプと使い捨てタイプはいくら違う？</h1>
<p class="lead">ダイニチの加湿器は、同じ機種で2種類の気化フィルターが使えます。洗って最大5シーズン使う「お手入れタイプ（青）」と、3カ月ごとに捨てる「使い捨てタイプ（赤紫）」です。メーカー直販価格と、メーカーが示す交換のめやすだけを使って、総額を比べました。</p>
<h2 class="h2">計算の前提</h2>
<ul class="notes">
<li>価格はダイニチWebShopの税込価格（${fmtDate(ds.checkedAt)}確認）。</li>
<li>お手入れタイプ：1シーズン（6カ月、1日8時間運転）で月1回クエン酸洗浄した場合に最大5シーズン。洗浄しないと1シーズンもたないこともある、とメーカーは注記しています。</li>
<li>使い捨てタイプ：1個あたり3カ月（1日8時間運転）。2個入りで販売。</li>
<li>クエン酸の費用は含めていません。</li>
</ul>
<h2 class="h2">5シーズン使った場合の総額</h2>
<table class="tbl cmp">
<thead><tr><th>対象シリーズ</th><th>お手入れタイプ</th><th>使い捨てタイプ</th><th>差額</th></tr></thead>
<tbody>${pairs.map(([c, d]) => { const r = costs(c, d); return `<tr><td>${label(c)}</td><td><a href="${partUrl(c.id)}">${c.id}</a><br><span class="price">${yen(r.care)}</span></td><td><a href="${partUrl(d.id)}">${d.id}</a><br><span class="price">${yen(r.disp)}</span></td><td class="price">${yen(r.disp - r.care)}</td></tr>`; }).join('')}</tbody>
</table>
${buyBox(ds, pairs.flat().filter(Boolean), '比較したフィルターの購入先')}
<h2 class="h2">使う月数を変えるとどうなるか</h2>
<p>RX・RXT・N5xx〜9xx系（${mid[0].id} / ${mid[1].id}）で計算しました。</p>
<table class="tbl cmp">
<thead><tr><th>使い方</th><th>お手入れ</th><th>使い捨て</th><th>洗浄回数</th><th>洗浄1回あたりの差額</th></tr></thead>
<tbody>${scenarios.map(([mo, y]) => { const r = costs(mid[0], mid[1], y, mo); return `<tr><td>年${mo}カ月・${y}年</td><td class="price">${yen(r.care)}</td><td class="price">${yen(r.disp)}</td><td>${r.washes}回</td><td>${yen(Math.round((r.disp - r.care) / r.washes))}</td></tr>`; }).join('')}</tbody>
</table>
<h2 class="h2">どちらを選ぶか</h2>
<p>金額だけならお手入れタイプが大きく安くなります。ただしこの差は、月1回のクエン酸洗浄をきちんと続けた場合の話です。洗浄を忘れがちで、1〜2シーズンごとに買い替えているなら差は縮みます。</p>
<p>使い捨てタイプは、洗浄1回をおよそ数百円で外注しているのと同じです。つけ置きの手間とにおいの心配を減らしたい人、加湿器を使う月が短い人には十分に見合います。</p>
<p>どちらも同じ機種で使えるので、片方を使い切ったあとに切り替えることもできます。自分の機種で計算したい場合は、<a href="${makerUrl(ds)}">機種一覧</a>から型番のページを開くと、使用月数を変えて試算できます。</p>
<p class="src">出典：<a href="${esc(ds.maker.officialShop)}" rel="noopener" target="_blank">ダイニチWebShop 加湿器別売部品</a>（各部品ページの適用機種・交換めやすの記載）</p>`;
  return layout({
    title: 'ダイニチ加湿器フィルター お手入れタイプと使い捨てタイプの費用比較（5シーズン総額）',
    desc: 'ダイニチ加湿器の気化フィルター、お手入れタイプ（H060518等）と使い捨てタイプ（H060524等）を5シーズン使った総額で比較。メーカー直販価格と交換めやすから計算。',
    canonical: '/guide/dainichi-filter-cost/', ds, crumbs: [{ name: 'フィルター費用の比較' }], body,
  });
}

function dainichiLifeGuide(ds) {
  const U = '/guide/dainichi-filter-life/';
  const vapor = ds.parts.filter(p => p.kind === 'vapor');
  const cares = vapor.filter(p => p.type === 'care');
  const label = c => c.models.some(m => /^HD-(1500F|1800F|2400F|1[58]\d|24\d|PC|PN)/.test(m)) ? '大型（HD-152・PC・PNタイプなど）' : c.models.some(m => /^HD-LX|^HD-ELXC/.test(m)) ? 'LX・LXC・ELXCタイプ' : c.models.some(m => /^HD-N3|^HD-RX3/.test(m)) ? 'N3xx・RX3xx・30xx系など' : 'RX・RXT・ERXT・N5xx〜9xx系など';
  const others = ds.parts.filter(p => p.kind !== 'vapor');
  const body = `
<h1 class="h1">ダイニチ加湿器のフィルター交換時期｜お手入れタイプは最大5シーズン、使い捨ては3カ月</h1>
<p class="lead">ダイニチのハイブリッド式加湿器の気化フィルターには、洗って使う「お手入れタイプ（青）」と、洗わずに替える「使い捨てタイプ（赤紫）」の2種類があります。交換の時期はタイプでまったく違います。ダイニチ直営のWebShopに書かれている条件をそのまま整理しました。</p>

<h2 class="h2">交換のめやす</h2>
<table class="tbl freq">
<thead><tr><th>部品</th><th>交換のめやす</th><th>メーカーの前提条件</th></tr></thead>
<tbody>
<tr><th>抗菌気化フィルター<br><span class="sub">お手入れタイプ（青）</span></th><td><strong>最大5シーズン</strong></td><td>1シーズン6カ月・1日8時間運転・水道水の硬度50mg/L（全国平均）・<strong>月1回クエン酸洗浄</strong>した場合</td></tr>
<tr><th>カンタン取替えフィルター<br><span class="sub">使い捨てタイプ（赤紫）</span></th><td><strong>3カ月</strong></td><td>1日8時間運転・水道水の硬度50mg/Lの場合。洗浄は不要</td></tr>
<tr><th>抗菌エアフィルター・Ag+抗菌アタッチメント・トレイカバー・除菌フィルター</th><td>記載なし</td><td>販売ページに交換周期の記載はありません。取扱説明書で確認してください</td></tr>
</tbody></table>

<h2 class="h2">「最大5シーズン」は洗っている場合の話</h2>
<ul class="notes">
<li>お手入れタイプの5シーズンは、<strong>月に1回クエン酸で洗浄した場合</strong>の最大値です。クエン酸で洗わずに使い続けると寿命が短くなり、<strong>1シーズンに満たなくても交換が必要になる</strong>ことがあるとメーカーは書いています。</li>
<li>水道水の硬度が高い地域では、5シーズンより早くなることがあります。</li>
<li>めやすの期間内でも、汚れや水アカが落ちなくなったとき、傷みや型くずれがひどいときは交換します。</li>
<li>クエン酸洗浄の分量と手順は「<a href="/guide/dainichi-filter-citric-acid/">抗菌気化フィルターの洗い方</a>」にまとめています。</li>
<li>運転中にフィルターの上部が乾いているときは、クエン酸洗浄をします。何度洗っても上部が硬く乾いたままなら交換のサインです（ダイニチのよくある質問より）。</li>
</ul>

<h2 class="h2">機種別の部品番号と価格</h2>
<table class="tbl parts">
<thead><tr><th>対象</th><th>お手入れタイプ</th><th>使い捨てタイプ</th></tr></thead>
<tbody>${cares.map(c => { const d = ds.partById[c.pairId]; return `<tr><td>${esc(label(c))}<br><span class="sub">${c.models.length}機種</span></td><td><a class="pn" href="${partUrl(c.id)}">${c.id}</a><br><span class="price">${yen(c.price)}</span>${c.pack > 1 ? `<span class="sub">（${c.pack}個入り）</span>` : ''}</td><td>${d ? `<a class="pn" href="${partUrl(d.id)}">${d.id}</a><br><span class="price">${yen(d.price)}</span><span class="sub">（${d.pack}個入り）</span>` : '—'}</td></tr>`; }).join('')}</tbody>
</table>
<p class="sub">価格はダイニチWebShopの税込価格（${fmtDate(ds.checkedAt)}確認）。自分の型番に合う部品は、<a href="${makerUrl(ds)}">機種一覧</a>から型番のページを開くと確認できます。</p>
<p>お手入れタイプと使い捨てタイプで5シーズンの総額がいくら違うかは、「<a href="/guide/dainichi-filter-cost/">お手入れタイプと使い捨てタイプの費用比較</a>」で計算しています。</p>

<h2 class="h2">ほかの消耗品</h2>
<table class="tbl parts">
<thead><tr><th>部品番号</th><th>部品名</th><th>直販価格</th><th>適用機種</th></tr></thead>
<tbody>${others.map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a></td><td>${esc(p.name)}${p.typeLabel && p.kind === 'agatt' ? `（${esc(p.typeLabel)}）` : ''}${p.packLabel && !p.name.includes(p.packLabel) ? `<span class="sub">（${esc(p.packLabel)}）</span>` : ''}</td><td class="price">${yen(p.price)}</td><td>${p.models.length}機種</td></tr>`).join('')}</tbody>
</table>

<h2 class="h2">買うときの注意</h2>
<ul class="notes">
<li>ダイニチは、ダイニチ製を模した安価なコピー商品が出回っていると注意しています。純正品以外のフィルターを使うと規定の湿度まで上がらないことがあり、それが原因の不具合は<strong>保証期間内でも有償</strong>になります。</li>
<li>フィルターなどの消耗部品の保有期間は製造打ち切り後14年です。検索しても出てこない古い型式は、部品の供給が終わっている可能性があります。</li>
<li>型式は本体の側面または後面のシールに書かれています。末尾の「E3」「E6」なども含めて確認してください。</li>
</ul>

${buyBox(ds, [...vapor].sort((a, b) => b.models.length - a.models.length).slice(0, 6), '気化フィルターの購入先（使える機種が多い順）')}
<p class="src">出典：<a href="${esc(ds.maker.officialShop)}" rel="noopener" target="_blank">ダイニチWebShop 加湿器 別売部品</a>（各部品ページの適用機種・交換の期間の記載）、<a href="https://www.dainichi-net.co.jp/support/faq/hd/hd1504_2.html" rel="noopener" target="_blank">ダイニチ よくあるご質問（加湿器）</a>（${fmtDate(ds.checkedAt)}確認）</p>`;
  return layout({
    title: 'ダイニチ加湿器のフィルター交換時期｜お手入れタイプ最大5シーズン・使い捨て3カ月の条件',
    desc: 'ダイニチ加湿器の抗菌気化フィルター（お手入れタイプ）は最大5シーズン、カンタン取替えフィルター（使い捨て）は3カ月。メーカーの前提条件、交換のサイン、機種別の部品番号と直販価格をまとめました。',
    canonical: U, ds, crumbs: [{ name: 'ダイニチの交換時期' }], body,
  });
}

function dainichiCompatGuide(ds) {
  const U = '/guide/dainichi-filter-genuine-vs-compatible/';
  const SRC = 'https://www.dainichi-net.co.jp/products/mainichi-plus/46788/';
  const vapor = [...ds.parts].filter(p => p.kind === 'vapor').sort((a, b) => b.models.length - a.models.length);
  const body = `
<h1 class="h1">ダイニチ加湿器のフィルター、純正品と互換品の違い<span class="h1-sub">メーカーが挙げる4つの点と、Amazonで純正品を見分ける方法</span></h1>
<p class="lead">Amazonなどでは、ダイニチの気化フィルターと同じ形の「互換品」が純正品より安く売られています。ダイニチは公式サイトで、純正品と互換品を比べた試験の結果を公開しています。ここではその内容を要約し、純正品の部品番号と見分け方をまとめました。</p>

<h2 class="h2">純正品と互換品とは</h2>
<p>純正品はダイニチ工業が販売している気化フィルターです。互換品は、同じ機種に取り付けられるように他社が作ったものです。</p>

<h2 class="h2">ダイニチ公式が挙げている違い（要約）</h2>
<p class="sub">以下はダイニチ工業が自社で行った比較試験の結果として公開している内容です。カエドキで試験したものではありません。</p>
<ol class="notes">
<li><strong>加湿量</strong>：新品どうしで比べると、純正品は互換品（3メーカー）より加湿量が6〜9%程度多かったとしています。</li>
<li><strong>電気代</strong>：互換品では、純正品に比べて電気代が3カ月で500円以上、1シーズン（6カ月）で1,000円以上多くかかるというシミュレーション結果を示しています。</li>
<li><strong>クエン酸洗浄後の回復</strong>：6カ月洗わずに使ったあとクエン酸で洗った試験で、純正品は使い始めの性能まで戻り、互換品は約95%までだったとしています（ダイニチは月1回の洗浄を推奨）。</li>
<li><strong>保証</strong>：本体の3年保証について、互換品のフィルターを使ったことによる故障は保証の対象外になる場合があるとしています。</li>
</ol>
<p class="src">出典：<a href="${SRC}" rel="noopener" target="_blank">ダイニチ工業「加湿器の気化フィルター、純正品と互換品は何がちがう？ 純正品をおススメする理由。」</a>（2026/11/14確認）</p>

<h2 class="h2">Amazonで純正品を見分ける方法</h2>
<ul class="notes">
<li><strong>部品番号で確かめる</strong>：カエドキに載せているダイニチ純正の気化フィルターは、どれも「H0605」で始まる部品番号です（H060518 など）。純正品は商品名にこの番号が入っています。互換品の商品名にも純正の番号が「対応機種」として並ぶことがあるので、ブランド名（ダイニチ／Dainichi）と出品者もあわせて見ます。</li>
<li><strong>色で確かめる</strong>：ダイニチの気化フィルターは、お手入れタイプが青、使い捨てタイプ（カンタン取替えフィルター）が赤紫です（ダイニチWebShopの記載）。</li>
<li><strong>自分の機種に合う番号を先に調べる</strong>：機種ごとに使える部品番号が決まっています。<a href="${makerUrl(ds)}">ダイニチの機種一覧</a>から型番を選ぶと、合う純正品の番号が分かります。</li>
</ul>

${buyBox(ds, vapor.slice(0, 6), 'ダイニチ純正の気化フィルター（使える機種が多い順）', 'ボタンはAmazonの純正品の商品ページ、または部品番号での検索結果に移動します。')}

<h2 class="h2">あわせて読む</h2>
<ul class="notes">
<li><a href="/guide/dainichi-filter-cost/">お手入れタイプと使い捨てタイプ、どちらが安い？（5シーズンの総額）</a></li>
<li><a href="/compare/h060518-vs-h060524/">H060518 と H060524 の違い</a></li>
<li><a href="/guide/dainichi-filter-life/">ダイニチ加湿器のフィルター交換時期</a></li>
<li><a href="/guide/dainichi-filter-citric-acid/">お手入れタイプのクエン酸での洗い方</a></li>
</ul>`;
  return layout({
    title: 'ダイニチ加湿器のフィルター 純正品と互換品の違い｜メーカー公表の比較結果と純正品の見分け方',
    desc: 'ダイニチ加湿器の気化フィルターの純正品と互換品の違いを、ダイニチ公式の比較試験（加湿量・電気代・洗浄後の回復・保証）から要約。Amazonで純正品を見分ける方法と部品番号も。',
    canonical: U, ds, pr: true, crumbs: [{ name: 'ダイニチ 加湿器', url: makerUrl(ds) }, { name: '純正品と互換品の違い' }], body,
  });
}

function dainichiCareGuide(ds) {
  const U = '/guide/dainichi-filter-citric-acid/';
  const cares = ds.parts.filter(p => p.kind === 'vapor' && p.type === 'care');
  const body = `
<h1 class="h1">ダイニチ加湿器の抗菌気化フィルターの洗い方｜クエン酸は4Lに25g、つけ置き30分〜2時間</h1>
<p class="lead">ダイニチのお手入れタイプのフィルターが「最大5シーズン」もつのは、月1回クエン酸で洗った場合です。分量・時間・頻度を、ダイニチの取扱説明書と公式のよくある質問の記載どおりにまとめました。</p>

<h2 class="h2">洗う頻度</h2>
<table class="tbl freq">
<thead><tr><th>タイミング</th><th>やること</th></tr></thead>
<tbody>
<tr><th>給水のたび</th><td>タンクに少し水を入れて振り洗いし、新しい水道水に入れ替える</td></tr>
<tr><th>お手入れサイン（赤）が点滅したとき</th><td>抗菌気化フィルターを水洗いし、やわらかい布で汚れをふく。トレイも水洗い<br><span class="sub">サインは電源プラグを挿している時間が累計約2週間で点滅します</span></td></tr>
<tr><th>お手入れの2回に1回<br>（1カ月に1回程度）</th><td><strong>クエン酸で洗浄する</strong></td></tr>
<tr><th>吹き出す風が臭うとき</th><td>重曹（機種によっては指定の洗剤）で洗浄する</td></tr>
<tr><th>運転中にフィルターの上部が乾いているとき</th><td>クエン酸で洗浄する。くり返しても上部が硬く乾くなら交換</td></tr>
</tbody></table>
<p class="sub">使用時間が長い場合や、水道水の硬度が高い地域では、間隔を早めるようメーカーは案内しています。</p>

<h2 class="h2">クエン酸での洗い方（定期的に水アカを取る）</h2>
<ol class="steps">
<li>運転を止め、電源プラグを抜く。タンクを取り出し、トレイを引き出して抗菌気化フィルターを取り出す。</li>
<li>ぬるま湯（<strong>40℃以下</strong>）<strong>4.0L</strong>に、クエン酸を<strong>約25g（大さじ2杯半）</strong>溶かす。</li>
<li>抗菌気化フィルターを<strong>約30分〜2時間</strong>つけ置きする。水アカが取れにくいときは長め（最長2時間）に。</li>
<li>水道水でしっかりすすぐ（<strong>目安2分以上</strong>）。</li>
<li>フィルター・トレイ・タンクを本体に戻し、お手入れリセットボタンを「ピー」と鳴るまで約3秒押す。</li>
</ol>

<h2 class="h2">臭いが気になるとき</h2>
<p>吹き出す風が臭うときは、ぬるま湯4.0Lに<strong>重曹 約150g</strong>を溶かし、<strong>約60分</strong>つけ置きしてから2分以上すすぎます（HD-LXシリーズなどの取扱説明書の記載）。</p>
<p class="sub">古い機種（HD-5017E5など）の取扱説明書では、臭いのときは重曹ではなく指定の洗剤（花王「ワイドマジックリン」を4.0Lあたり約36g・約60分）となっています。お使いの機種の取扱説明書を確認してください。</p>

<h2 class="h2">やってはいけないこと</h2>
<ul class="notes">
<li><strong>クエン酸と重曹（または洗剤）を一緒に入れない。</strong></li>
<li>塩素系・酸性タイプの洗剤は使わない。有毒ガスが発生するおそれがあります。</li>
<li>40℃以上のお湯は使わない。部品が壊れる原因になります。</li>
<li>クエン酸を濃くしすぎない。濃度が高いと部品破損の原因になります。</li>
<li>フィルターに強い力を加えない。破れるおそれがあります。</li>
<li>すすぎが足りないと洗剤の成分が残り、臭いや故障の原因になります。</li>
<li>タンクキャップのAg+抗菌アタッチメントEXはクエン酸で洗わない（HD-LXシリーズの取扱説明書）。</li>
<li>フィルターを外したまま運転しない。</li>
</ul>

<h2 class="h2">洗っても戻らないときは交換</h2>
<p>くり返しクエン酸で洗っても上部が硬く乾く、汚れや水アカが落ちない、傷みや型くずれがひどいときは交換します。洗うのが面倒なら、洗浄不要の使い捨てタイプ（1個3カ月）に切り替える方法もあります。</p>
<table class="tbl parts">
<thead><tr><th>お手入れタイプ</th><th>直販価格</th><th>適用機種</th></tr></thead>
<tbody>${cares.map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a>${p.pack > 1 ? `<span class="sub">（${p.pack}個入り）</span>` : ''}</td><td class="price">${yen(p.price)}</td><td>${p.models.length}機種</td></tr>`).join('')}</tbody>
</table>
<p>交換時期の条件は「<a href="/guide/dainichi-filter-life/">ダイニチ加湿器のフィルター交換時期</a>」、お手入れタイプと使い捨てタイプの5シーズンの費用差は「<a href="/guide/dainichi-filter-cost/">費用比較</a>」にまとめています。自分の機種の部品番号は<a href="${makerUrl(ds)}">機種一覧</a>から確認できます。</p>

${buyBox(ds, [...cares].sort((a, b) => b.models.length - a.models.length).slice(0, 4), 'お手入れタイプの気化フィルター（交換用）', '洗っても汚れやにおいが取れなくなったら交換します。')}
<p class="src">出典：<a href="https://www.dainichi-net.co.jp/uploads/manual/humidifier/hd-lx1022_1222.pdf" rel="noopener" target="_blank">HD-LX1022・LX1222 取扱説明書</a>、<a href="https://www.dainichi-net.co.jp/uploads/manual/humidifier/hd5017e5.pdf" rel="noopener" target="_blank">HD-5017E5 取扱説明書</a>、<a href="https://www.dainichi-net.co.jp/support/faq/hd/hd1206_1.html" rel="noopener" target="_blank">ダイニチ よくあるご質問（定期的に水アカを取る）</a>、<a href="https://www.dainichi-net.co.jp/support/faq/hd/hd222.html" rel="noopener" target="_blank">同（お手入れサインが点滅している）</a>（2026/11/01確認）</p>`;
  return layout({
    title: 'ダイニチ加湿器のフィルターの洗い方｜クエン酸4Lに25g・30分〜2時間、重曹の分量と注意点',
    desc: 'ダイニチ加湿器の抗菌気化フィルターのクエン酸洗浄。ぬるま湯4Lにクエン酸約25g（大さじ2杯半）で30分〜2時間、臭いは重曹約150gで約60分。頻度、やってはいけないこと、交換の目安を取扱説明書からまとめました。',
    canonical: U, ds, crumbs: [{ name: 'ダイニチのフィルターの洗い方' }], body,
  });
}

function sharpScheduleGuide(ds) {
  const order = ['pre', 'humidpre', 'ag', 'combo', 'set', 'humid', 'dust', 'deo', 'ion'];
  const byKind = order.map(k => [k, ds.parts.filter(p => p.kind === k)]).filter(([, xs]) => xs.length);
  const top = (xs, n) => { const ys = [...xs].sort((a, b) => b.models.length - a.models.length); return ys.slice(0, n).map(p => `<a class="pn" href="${partUrl(p.id)}">${p.id}</a>`).join('<br>') + (ys.length > n ? `<br><span class="sub">ほか${ys.length - n}点</span>` : ''); };
  const lifeRows = byKind.flatMap(([k, xs]) => [...new Set(xs.map(lifeLabel))].sort((a, b) => (a === '取扱説明書で確認') - (b === '取扱説明書で確認')).map(l => [k, l, xs.filter(p => lifeLabel(p) === l)]));
  const groups = groupBySeries(ds, ds.modelList);
  const body = `
<h1 class="h1">シャープ加湿空気清浄機のフィルター交換時期一覧</h1>
<p class="lead">シャープの加湿空気清浄機には、毎月替えるもの、毎年替えるもの、約10年もつものが混在しています。「フィルターを替えたい」と思ったときに、まず何を買えばいいかを、シャープ公式の別売品データと取扱説明書の記載から整理しました。</p>

<h2 class="h2">交換のめやす（部品の種類別）</h2>
<table class="tbl freq">
<thead><tr><th>部品</th><th>交換のめやす</th><th>品番</th></tr></thead>
<tbody>${lifeRows.map(([k, l, xs]) => `<tr><th>${esc(KINDS[k].label)}</th><td>${esc(l)}</td><td>${top(xs, 5)}</td></tr>`).join('')}</tbody>
</table>
<p class="sub">加湿フィルターは機種によって「約5年」（FZ-H40MF）のものがあります。「取扱説明書で確認」は、公式の別売品ページに交換めやすの記載がなく、まだ取扱説明書で確かめていない部品です。品番は適用機種の多い順に5点まで表示しています。</p>

<h2 class="h2">「ニオイがする」「加湿が弱い」ときに先に見るもの</h2>
<ul class="notes">
<li><strong>Ag+イオンカートリッジ</strong>は約1年で交換です。付けなくても加湿はできますが、ヌメリやニオイを抑える効果がなくなります。毎年の冬の前に替えるのが目安です。</li>
<li><strong>加湿フィルター</strong>の約10年は、1日8時間運転で加湿能力が半分になるまでの目安です。水アカが落ちない、ニオイが取れないときは早めに替えます。</li>
<li><strong>集じん・脱臭フィルター</strong>の約10年は、タバコ5本分を毎日吸い込んだ場合の目安です。10本なら約5年。ニオイの強い環境ではもっと早くなります。</li>
<li><strong>使い捨てプレフィルター</strong>は月1回。6枚入りで約半年分です。</li>
</ul>

<h2 class="h2">シリーズ別の主な品番</h2>
<table class="tbl sg">
<thead><tr><th>シリーズ</th><th>加湿</th><th>集じん</th><th>脱臭</th></tr></thead>
<tbody>${groups.map(g => {
  const ids = k => { const cnt = {}; g.models.flatMap(m => m.parts).filter(id => ds.partById[id].kind === k || (k === 'dust' && ['combo', 'set'].includes(ds.partById[id].kind))).forEach(id => { cnt[id] = (cnt[id] || 0) + 1; }); return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]); };
  const cell = k => { const xs = ids(k); return xs.slice(0, 3).map(id => `<a href="${partUrl(id)}">${id}</a>`).join('<br>') + (xs.length > 3 ? `<br><span class="sub">ほか${xs.length - 3}点</span>` : ''); };
  const cell0 = k => cell(k) || (k === 'deo' && ids('dust').some(id => ['combo', 'set'].includes(ds.partById[id].kind)) ? '<span class="sub">一体型・セット</span>' : '—');
  return `<tr><td><a href="${makerUrl(ds)}#s-${g.key}">${esc(g.name)}</a><br><span class="sub">${g.models.length <= 6 ? g.models.map(m => m.id).join('、') : `${g.models.slice(0, 4).map(m => m.id).join('、')} ほか${g.models.length - 4}機種`}</span></td><td>${cell0('humid')}</td><td>${cell0('dust')}</td><td>${cell0('deo')}</td></tr>`;
}).join('')}</tbody>
</table>
<p>自分の機種の品番は、<a href="${makerUrl(ds)}">機種一覧</a>から形名のページを開くと一覧で確認できます。</p>
<p>加湿フィルターを洗う手順と分量は「<a href="/guide/sharp-humidifier-filter-care/">加湿フィルターの洗い方（クエン酸・重曹）</a>」にまとめています。</p>
${buyBox(ds, topPartsOf(ds, 6), 'よく使われる交換フィルター（使える機種が多い順）')}
<p class="src">出典：<a href="${esc(ds.sourceUrl)}" rel="noopener" target="_blank">${esc(ds.sourceName)}</a>（品番・適用機種）、各機種の取扱説明書（交換のめやす）。${fmtDate(ds.checkedAt)}確認</p>`;
  return layout({
    title: 'シャープ加湿空気清浄機のフィルター交換時期一覧｜毎月・毎年・10年ごとに替えるもの',
    desc: 'シャープ加湿空気清浄機（KI・KCシリーズ）の加湿フィルター・集じんフィルター・脱臭フィルター・Ag+イオンカートリッジ・プレフィルターの交換時期と品番を公式データと取扱説明書から一覧化。',
    canonical: '/guide/sharp-filter-schedule/', ds, crumbs: [{ name: 'シャープの交換時期' }], body,
  });
}

function sharpCareGuide(ds) {
  const U = '/guide/sharp-humidifier-filter-care/';
  const humid = ds.parts.filter(p => p.kind === 'humid' && p.life && /^加湿/.test(p.name)).sort((a, b) => b.models.length - a.models.length);
  const body = `
<h1 class="h1">シャープ加湿空気清浄機の加湿フィルターの洗い方（クエン酸・重曹）</h1>
<p class="lead">加湿フィルターに白い固まりが付いた、吹き出す風がにおう。そんなときは、買い替える前にまず洗います。シャープの加湿フィルターは約10年もつ前提ですが、それは定期的にお手入れした場合の話です。手順と分量は、シャープ公式のお手入れページと取扱説明書の記載どおりにまとめました。</p>

<h2 class="h2">お手入れの頻度</h2>
<table class="tbl freq">
<thead><tr><th>部分</th><th>頻度</th><th>方法</th></tr></thead>
<tbody>
<tr><th>タンク</th><td>給水のたび</td><td>少量の水を入れて振り洗い。キャップのゴム部分も洗います。</td></tr>
<tr><th>加湿フィルター・トレー</th><td>約1カ月に1回</td><td>お手入れランプが点灯したとき、吹き出し口からにおうときも。下の手順で洗います。</td></tr>
<tr><th>後ろパネル・センサー部</th><td>約1カ月に1回</td><td>掃除機でほこりを吸い取ります。</td></tr>
<tr><th>集じん・脱臭フィルター</th><td>においが気になったとき</td><td>掃除機で表面のほこりを吸い取るだけ。<strong>水洗い・天日干しはしません。</strong></td></tr>
<tr><th>使い捨てプレフィルター</th><td>約1カ月に1回</td><td>洗わずに新しいものと交換します。</td></tr>
</tbody></table>
<p class="sub">取扱説明書（KI-SS50）の記載。機種によって細部が異なるので、お使いの機種の取扱説明書もあわせて確認してください。</p>

<h2 class="h2">クエン酸で洗う（白い固まり・水アカ）</h2>
<ol class="steps">
<li>水またはぬるま湯（<strong>40℃以下</strong>）1Lに、クエン酸を<strong>約6g</strong>（大さじ約2/3）溶かします。</li>
<li>加湿フィルターとトレーを<strong>約2時間</strong>つけ置きします。</li>
<li>クエン酸が残らないように、よくすすぎます。</li>
<li>汚れがひどいときは、何回か繰り返します。</li>
</ol>

<h2 class="h2">重曹で洗う（クエン酸のあとも水アカやにおいが残るとき）</h2>
<ol class="steps">
<li>水1Lに、重曹を<strong>約36g</strong>（大さじ約4）溶かします。</li>
<li><strong>30〜60分</strong>つけ置きします。</li>
<li>重曹が残らないように、よくすすぎます。</li>
</ol>

<h2 class="h2">やってはいけないこと</h2>
<ul class="notes">
<li><strong>クエン酸と重曹を混ぜない。</strong>泡が大量に出て、洗浄効果がなくなります。別々につけ置きします。</li>
<li>クエン酸や重曹が残ったまま使わない。においや変形・変色の原因になります。</li>
<li>水アカや白い固まりが付いたまま使わない。水漏れや異常音の原因になります。</li>
<li>加湿フィルターを分解して洗わない。形がくずれて加湿能力が落ちます。強くこするのも避けます。</li>
<li>シンナー・ベンジン・アルコール・漂白剤・クレンザーは使わない。</li>
<li>集じんフィルター・脱臭フィルターは水洗いしない。機能がなくなります。</li>
</ul>
<p class="sub">使い捨て加湿プレフィルターを付けている場合は、洗わずに新しいものに交換します。水やフィルターに赤・黄・白の色が付くのは、水道水のミネラルや鉄分によるもので、故障ではありません。</p>

<h2 class="h2">古い機種は分量が違います</h2>
<p>KC-C150・C100・C70 や KC-35C1 などの古い機種の公式ページでは、においを取る方法が「台所用合成洗剤（粉末）を水1Lに約9g・30〜60分」「重曹を水1Lに約60g・約30分」となっています。クエン酸（1Lに約6g・約2時間）は同じです。古い機種は取扱説明書の分量に従ってください。洗ったあとは運転を始めてから、リセットボタンを3秒以上押します。</p>

<h2 class="h2">洗っても落ちないときは交換</h2>
<p>洗っても水アカやにおいが取れない、変色や型くずれがひどいときは、10年たっていなくても交換します。主な加湿フィルターの部品番号です。</p>
<table class="tbl parts">
<thead><tr><th>部品番号</th><th>${esc(ds.priceLabel)}</th><th>交換のめやす</th><th>適用機種</th></tr></thead>
<tbody>${humid.slice(0, 8).map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a>${p.packLabel ? `<br><span class="sub">${esc(p.packLabel)}</span>` : ''}</td><td class="price">${yen(p.price)}</td><td>${esc(p.life.label)}</td><td>${p.models.length}機種</td></tr>`).join('')}</tbody>
</table>
<p>自分の機種の部品番号は、<a href="${makerUrl(ds)}">機種一覧</a>から形名のページを開くと確認できます。ほかの消耗品の交換時期は「<a href="/guide/sharp-filter-schedule/">シャープのフィルター交換時期一覧</a>」にまとめています。</p>

${buyBox(ds, humid.slice(0, 6), '交換用の加湿フィルター（使える機種が多い順）', '洗っても白い固まりやにおいが取れなくなったら交換します。')}
<p class="src">出典：<a href="https://jp.sharp/support/advice/air_purifier/care_06.html" rel="noopener" target="_blank">シャープ 空気清浄機のお手入れ（加湿フィルター・トレーの汚れやニオイが取れないとき）</a>、<a href="https://jp.sharp/restricted/support/manual/air_purifier/kiss50_mn.pdf" rel="noopener" target="_blank">KI-SS50 取扱説明書</a>、<a href="https://jp.sharp/support/advice/air_purifier/care_kc_c02a.html" rel="noopener" target="_blank">KC-C150・C100・C70 加湿フィルターのお手入れ</a>、<a href="https://jp.sharp/support/advice/air_purifier/care_kc_c05a.html" rel="noopener" target="_blank">KC-35C1 加湿フィルターのお手入れ</a>（2026/10/23確認）</p>`;
  return layout({
    title: 'シャープ加湿空気清浄機の加湿フィルターの洗い方｜クエン酸6g・2時間、重曹の分量と注意点',
    desc: 'シャープ加湿空気清浄機の加湿フィルターとトレーのお手入れ方法。クエン酸は水1Lに約6gで約2時間、重曹は約36gで30〜60分。混ぜてはいけない理由や、洗っても落ちないときの交換用部品番号も。',
    canonical: U, ds, crumbs: [{ name: '加湿フィルターの洗い方' }], body,
  });
}

function findModelGuide() {
  const body = `
<h1 class="h1">家電の型番（形名）の確認方法</h1>
<p class="lead">交換部品は本体の型番で決まります。シリーズ名やサイズだけでは特定できないので、本体に書かれた型番を確認してください。</p>
${datasets.map(ds => `<h2 class="h2">${esc(ds.maker.name)}の${esc(ds.maker.category)}</h2>
<ul class="notes">
<li>${esc(ds.maker.modelLabelHint)}</li>
<li>${esc(ds.maker.modelNote)}</li>
</ul>`).join('')}
<h2 class="h2">型番が見つからないとき</h2>
<p>取扱説明書の表紙や裏表紙、保証書にも型番が書かれています。このサイトで検索しても出てこない場合は、メーカーの部品供給が終わっているか、まだ収録していない機種です。</p>`;
  return layout({ title: '家電の型番（形名）の確認方法｜ダイニチ・シャープ・パナソニック', desc: '交換フィルターを探すための、加湿器・加湿空気清浄機本体の型番の確認場所と入力のコツ。', canonical: '/guide/find-model-number/', crumbs: [{ name: '型番の確認方法' }], body });
}

// ---------- 固定ページ ----------
function staticPages() {
  write('about/index.html', layout({
    title: `運営者情報｜${cfg.siteName}`, desc: `${cfg.siteName}の運営者情報とデータの集め方`, canonical: '/about/', crumbs: [{ name: '運営者情報' }],
    body: `<h1 class="h1">運営者情報</h1>
<table class="tbl spec"><tbody>
<tr><th>サイト名</th><td>${esc(cfg.siteName)}</td></tr>
<tr><th>URL</th><td>${SITE}/</td></tr>
<tr><th>運営</th><td>${esc(cfg.operator)}</td></tr>
<tr><th>お問い合わせ</th><td><a href="/contact/">お問い合わせページ</a></td></tr>
</tbody></table>
<h2 class="h2">このサイトについて</h2>
<p>家電の消耗品は、本体の型番がわかっても、どの部品番号を買えばいいのかが探しにくいものです。${esc(cfg.siteName)}は、型番を入れるだけで合う交換部品がわかるように、メーカーが公開している適用機種表や取扱説明書の記載を機種ごとに並べ直しています。</p>
<h2 class="h2">データの集め方</h2>
<ul class="notes">
<li>適用機種・部品番号・価格・交換のめやすは、メーカー直販サイトまたはメーカー公式の取扱説明書から転記しています。各ページに出典と確認日を記載しています。</li>
<li>費用比較などの計算は、メーカーの公表値だけを使って当サイトが行ったものです。</li>
<li>口コミや使用感の掲載は行っていません。</li>
<li>誤りを見つけた場合は、お問い合わせからお知らせください。確認のうえ修正します。</li>
</ul>`,
  }));
  write('privacy/index.html', layout({
    title: `プライバシーポリシー・免責事項｜${cfg.siteName}`, desc: 'プライバシーポリシー・広告について・免責事項', canonical: '/privacy/', crumbs: [{ name: 'プライバシーポリシー・免責事項' }],
    body: `<h1 class="h1">プライバシーポリシー・免責事項</h1>
<h2 class="h2">広告について</h2>
<p>当サイトは、Amazon.co.jpを宣伝しリンクすることによってサイトが紹介料を獲得できる手段を提供することを目的に設定されたアフィリエイトプログラムである、Amazonアソシエイト・プログラムの参加者です。Amazonのアソシエイトとして、${esc(cfg.siteName)}は適格販売により収入を得ています。</p>
<p>Amazonへのリンクにはアフィリエイト用の識別子が含まれます。リンクから購入されても、購入者の支払額は変わりません。</p>
<h2 class="h2">アクセス解析について</h2>
<p>当サイトでは、サイトの改善のためにアクセス解析ツールを使用する場合があります。これらのツールはCookie等を使用してトラフィックデータを収集しますが、個人を特定する情報は含みません。Cookieはブラウザの設定で無効にできます。</p>
${cfg.ga4Id ? '<p>現在、Google LLC の「Google アナリティクス」を使用しています。閲覧したページ、外部の販売サイトへのリンクを押したこと、ブラウザの種類などの情報が Google に送信されます。データの取り扱いは<a href="https://policies.google.com/technologies/partner-sites?hl=ja" rel="noopener" target="_blank">Google のポリシー</a>をご覧ください。</p>' : ''}${cfg.vercelAnalytics ? '<p>現在、Vercel Inc. の「Vercel Web Analytics」を使用しています。閲覧したページや参照元などが、個人を特定しない形で集計されます。</p>' : ''}
<p>Amazonアソシエイト・プログラムでは、リンク経由の購入を計測するためにAmazonがCookieを使用します。</p>
<h2 class="h2">免責事項</h2>
<p>掲載している適用機種・価格・交換のめやすは、確認日時点のメーカー公表情報にもとづきますが、正確性を保証するものではありません。部品の購入前に、販売ページおよび取扱説明書で適用機種を必ずご確認ください。当サイトの情報を利用したことによる損害について、当サイトは責任を負いかねます。</p>
<h2 class="h2">著作権</h2>
<p>当サイトの文章・計算結果の無断転載はご遠慮ください。出典としてメーカーのページを記載しています。</p>`,
  }));
  write('contact/index.html', layout({
    title: `お問い合わせ｜${cfg.siteName}`, desc: 'お問い合わせ', canonical: '/contact/', crumbs: [{ name: 'お問い合わせ' }],
    body: `<h1 class="h1">お問い合わせ</h1>
<p>掲載内容の誤り、収録してほしい機種、その他のご連絡は下記からお願いします。</p>
${cfg.contactUrl ? `<p><a class="btn-off" href="${esc(cfg.contactUrl)}" rel="noopener" target="_blank">お問い合わせフォームを開く</a></p>` : '<p class="sub">お問い合わせフォームは準備中です。</p>'}
<p class="sub">部品の在庫や注文については、各販売店またはメーカーへお問い合わせください。</p>`,
  }));
  write('404.html', layout({ title: `ページが見つかりません｜${cfg.siteName}`, desc: 'ページが見つかりません', canonical: '/404.html', aside: false, noindex: true,
    body: `<h1 class="h1">ページが見つかりません</h1><p>型番で検索するか、${datasets.map(d => `<a href="${makerUrl(d)}">${esc(d.maker.name)}の機種一覧</a>`).join('・')}から探してください。</p>` }));
}

// ---------- アセット ----------
function assets() {
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(OUT, 'assets', f));
  fs.copyFileSync(path.join(ROOT, 'src-root', 'favicon.svg'), path.join(OUT, 'favicon.svg'));
  const index = [
    ...datasets.flatMap(ds => ds.modelList.map(m => ({ k: m.id, u: modelUrl(ds, m.id), t: 'm', s: `${ds.maker.name}・${m.series.name}` }))),
    ...datasets.flatMap(ds => Object.entries(ds.aliases || {}).filter(([, id]) => ds.hasPage.has(id)).map(([a, id]) => ({ k: a, u: modelUrl(ds, id), t: 'm', s: `${ds.maker.name} ${id}（型式 ${a}）` }))),
    ...allParts.map(p => ({ k: p.id, u: partUrl(p.id), t: 'p', s: `${p.maker.name} ${p.name}（${shortType(p)}）` })),
  ];
  fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));
}

function seo(urls) {
  const latest = datasets.map(d => d.checkedAt).sort().pop();
  // データセットのページは、そのデータの確認日を lastmod にする
  // ページの作りを変えた日（全ページに影響する変更をしたら更新する）
  const TEMPLATE_UPDATED = '2026-11-14';
  const maxd = (a, b) => (a > b ? a : b);
  const dateOf0 = u => { const pm = u.match(/^\/parts\/([^/]+)\/$/); if (pm) { const hit = allParts.find(p => slug(p.id) === pm[1]); if (hit) return hit.ds.checkedAt; } const d = datasets.find(d => u.startsWith(makerUrl(d))); return d ? d.checkedAt : latest; };
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${maxd(dateOf0(u), TEMPLATE_UPDATED)}</lastmod></url>`).join('\n')}
</urlset>`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nDisallow: /search/\nSitemap: ${SITE}/sitemap.xml\n`);
}

// ---------- 部品の比較ページ ----------
// 比べるのはデータにある事実（価格・入数・交換めやす・適用機種）と、各データの出典の記載だけ
const COMPARE = [
  ['H060518', 'H060524', '同じ機種で使える、お手入れタイプと使い捨てタイプの気化フィルターです。ダイニチの加湿器は、どちらか一方を使います。'],
  ['H060517', 'H060518'],
  ['H060523', 'H060524'],
  ['FZ-L75MF', 'FZ-Y80MF'],
  ['FZ-AX80MF', 'FZ-Y80MF'],
  ['FZ-D50HF', 'FZ-D50DF', 'シャープ公式の別売品では、集じんフィルターと脱臭フィルターは別の部品として分かれています。'],
  ['MDC01S', 'MDC03SW', 'どちらも MONO シリーズ用です。公式の交換ガイドでは、除去物質数が「17+3」（MDC01S）と「11+3」（MDC03SW）に分かれています。'],
  ['HGC9S', 'HGC9SW', '同じカートリッジの1個入り（HGC9S）と2個入り（HGC9SW）です。'],
  ['CBC03W', 'CBC06', '公式の交換ガイドでは、3ヶ月交換タイプ（ホワイト）と6ヶ月交換タイプ（グレー）に分かれています。'],
  ['FE-ZGE05', 'FE-ZGE07'],
];
const compareUrl = (a, b) => `/compare/${slug(a)}-vs-${slug(b)}/`;
const comparesOf = id => COMPARE.filter(([a, b]) => a === id || b === id);
// 価格 ÷ 交換めやすの月数（1シーズン＝6か月）。「1個あたり」の表記なら個数分の月数で割る
const monthlyCost = p => { if (!p.price || !p.life || !['month', 'season'].includes(p.life.unit)) return null; const m = p.life.unit === 'season' ? p.life.value * 6 : p.life.value; return Math.round(p.price / (m * (p.pack > 1 ? p.pack : 1))); };
function comparePage([aId, bId, note]) {
  const A = partIndex[aId], B = partIndex[bId];
  if (!A || !B) throw new Error(`比較の部品がない: ${aId} ${bId}`);
  const ds = A.ds;
  const ma = new Set(A.models), mb = new Set(B.models);
  const both = A.models.filter(x => mb.has(x)), onlyA = A.models.filter(x => !mb.has(x)), onlyB = B.models.filter(x => !ma.has(x));
  const mc = [monthlyCost(A), monthlyCost(B)];
  const typeOf = p => p.kind === 'vapor' ? `気化フィルター（${p.type === 'care' ? 'お手入れ' : '使い捨て'}）` : KINDS[p.kind].label;
  const modelLinks = (dsx, xs) => `<ul class="model-grid">${xs.map(x => dsx.hasPage.has(x) ? `<li><a href="${modelUrl(dsx, x)}">${x}</a></li>` : `<li><span>${x}</span></li>`).join('')}</ul>`;
  const facts = [];
  if (!both.length) facts.push(`<strong>使える機種が重なっていません。</strong>公式の適用機種表に、${aId} と ${bId} の両方が載っている機種はありません。どちらを買うかは、お使いの機種で決まります。`);
  else if (!onlyA.length && !onlyB.length) facts.push(`<strong>使える機種は同じです（${both.length}機種）。</strong>`);
  else facts.push(`両方が使える機種は ${both.length}機種。${aId} だけが ${onlyA.length}機種、${bId} だけが ${onlyB.length}機種です。`);
  if (A.price && B.price) facts.push(`価格は ${aId} が ${yen(A.price)}${A.pack > 1 ? `（${A.pack}個入り）` : ''}、${bId} が ${yen(B.price)}${B.pack > 1 ? `（${B.pack}個入り）` : ''}。`);
  facts.push(lifeLabel(A) !== lifeLabel(B) ? `交換のめやすは ${aId} が「${esc(lifeLabel(A))}」、${bId} が「${esc(lifeLabel(B))}」。` : `交換のめやすはどちらも「${esc(lifeLabel(A))}」。`);
  if (mc[0] && mc[1]) facts.push(`交換のめやすどおりに使った場合の1か月あたりの費用は、${aId} が約${yen(mc[0])}、${bId} が約${yen(mc[1])}。`);
  const row = (h, f) => `<tr><th>${h}</th><td>${f(A)}</td><td>${f(B)}</td></tr>`;
  const body = `
<h1 class="h1">${aId} と ${bId} の違い<span class="h1-sub">価格・交換時期・対応機種を比較（${esc(ds.maker.name)} ${esc(ds.maker.category)}）</span></h1>
${note ? `<p class="lead">${esc(note)}</p>` : ''}
<div class="answer"><p class="answer-h">違いのまとめ</p><ul>${facts.map(f => `<li>${f}</li>`).join('')}</ul></div>
<table class="tbl cmp">
<thead><tr><th></th><th><a class="pn" href="${partUrl(aId)}">${aId}</a></th><th><a class="pn" href="${partUrl(bId)}">${bId}</a></th></tr></thead>
<tbody>
${row('部品名', p => esc(p.name))}
${row('種類', p => esc(typeOf(p)) + (p.typeLabel && p.kind !== 'bio' ? `<br><span class="sub">${esc(p.typeLabel)}</span>` : ''))}
${row('入数', p => esc(p.packLabel || `${p.pack}個`))}
${row(esc(ds.priceLabel || '直販価格'), p => p.price ? `<span class="price">${yen(p.price)}</span>${p.pack > 1 ? `<br><span class="sub">1個あたり ${yen(Math.round(p.price / p.pack))}</span>` : ''}` : '—<br><span class="sub">公式で確認できず</span>')}
${row('交換のめやす', p => `${esc(lifeLabel(p))}<br><span class="sub">${esc(p.lifeNote || '')}</span>`)}
${mc[0] && mc[1] ? row('1か月あたり', p => `約${yen(monthlyCost(p))}`) : ''}
${row('使える機種', p => `${p.models.length}機種`)}
${row('購入', p => amzBtn(ds, p))}
</tbody></table>
${mc[0] && mc[1] ? '<p class="calc-note">1か月あたりの費用は「価格 ÷ 交換のめやすの月数」で計算しました（1シーズン＝6か月、複数個入りは個数分の月数）。使い方や水質で交換の時期は変わります。</p>' : ''}
${both.length ? `<h2 class="h2">両方が使える機種（${both.length}機種）</h2>${modelLinks(ds, both)}` : ''}
${onlyA.length ? `<h2 class="h2">${aId} だけが使える機種（${onlyA.length}機種）</h2>${modelLinks(ds, onlyA)}` : ''}
${onlyB.length ? `<h2 class="h2">${bId} だけが使える機種（${onlyB.length}機種）</h2>${modelLinks(B.ds, onlyB)}` : ''}
${[aId, bId].includes('H060518') && [aId, bId].includes('H060524') ? '<p>5シーズン使った総額の比較は → <a href="/guide/dainichi-filter-cost/">お手入れタイプと使い捨てタイプの費用比較</a></p>' : ''}
<p class="src">出典：<a href="${esc(ds.sourceUrl || ds.maker.officialShop)}" rel="noopener" target="_blank">${esc(ds.sourceName || `${ds.maker.name} 公式`)}</a>${A.source ? `、<a href="${esc(A.source)}" rel="noopener" target="_blank">${aId}</a>` : ''}${B.source ? `、<a href="${esc(B.source)}" rel="noopener" target="_blank">${bId}</a>` : ''}（${fmtDate(ds.checkedAt)}確認）</p>`;
  return layout({
    title: `${aId}と${bId}の違い｜価格・交換時期・対応機種を比較（${ds.maker.name} ${ds.maker.category}）`,
    desc: `${ds.maker.name}の${aId}と${bId}の違いを、メーカー公表の価格・入数・交換のめやす・適用機種で比較。${both.length ? `両方使える機種は${both.length}機種。` : '使える機種は重なっていません。'}`,
    canonical: compareUrl(aId, bId), ds, pr: true, crumbs: [{ name: '部品の比較', url: '/compare/' }, { name: `${aId}と${bId}` }], body,
  });
}
function compareIndex() {
  const body = `<h1 class="h1">交換部品の比較</h1>
<p class="lead">番号が似ていて迷いやすい部品を、メーカー公表の価格・交換のめやす・適用機種で比べました。</p>
<ul class="notes">${COMPARE.map(([a, b]) => `<li><a href="${compareUrl(a, b)}">${a} と ${b} の違い</a><span class="sub">（${esc(partIndex[a].ds.maker.name)} ${esc(partIndex[a].ds.maker.category)}）</span></li>`).join('')}</ul>`;
  return layout({ title: `交換部品の比較一覧｜${cfg.siteName}`, desc: '似た番号の交換フィルター・カートリッジの違いを、価格・交換時期・対応機種で比較した一覧。', canonical: '/compare/', crumbs: [{ name: '部品の比較' }], body });
}

// ---------- 実行 ----------
// 部品番号の重複チェック（URLが衝突するため）
const seen = new Set();
for (const p of allParts) { if (seen.has(p.id)) throw new Error(`部品番号が重複: ${p.id}`); seen.add(p.id); }

fs.rmSync(OUT, { recursive: true, force: true });
const urls = ['/', '/parts/', '/guide/find-model-number/', '/about/', '/privacy/', '/contact/'];
write('index.html', topPage());
write('parts/index.html', partsIndex());
write('search/index.html', searchPage());
write('guide/find-model-number/index.html', findModelGuide());
let nModels = 0;
for (const ds of datasets) {
  write(`${ds.maker.id}/index.html`, makerPage(ds)); urls.push(makerUrl(ds));
  for (const m of ds.modelList) { write(`${ds.maker.id}/${slug(m.id)}/index.html`, modelPage(ds, m)); urls.push(modelUrl(ds, m.id)); nModels++; }
  for (const p of ds.parts) { write(`parts/${slug(p.id)}/index.html`, partPage(ds, p)); urls.push(partUrl(p.id)); }
  if (ds.maker.id === 'dainichi') { write('guide/dainichi-filter-cost/index.html', costGuide(ds)); urls.push('/guide/dainichi-filter-cost/'); }
  if (ds.maker.id === 'dainichi') { write('guide/dainichi-filter-life/index.html', dainichiLifeGuide(ds)); urls.push('/guide/dainichi-filter-life/'); }
  if (ds.maker.id === 'dainichi') { write('guide/dainichi-filter-citric-acid/index.html', dainichiCareGuide(ds)); urls.push('/guide/dainichi-filter-citric-acid/'); }
  if (ds.maker.id === 'dainichi') { write('guide/dainichi-filter-genuine-vs-compatible/index.html', dainichiCompatGuide(ds)); urls.push('/guide/dainichi-filter-genuine-vs-compatible/'); }
  if (ds.maker.id === 'sharp') { write('guide/sharp-filter-schedule/index.html', sharpScheduleGuide(ds)); urls.push('/guide/sharp-filter-schedule/'); }
  if (ds.maker.id === 'sharp') { write('guide/sharp-humidifier-filter-care/index.html', sharpCareGuide(ds)); urls.push('/guide/sharp-humidifier-filter-care/'); }
}
write('compare/index.html', compareIndex()); urls.push('/compare/');
for (const c of COMPARE) { write(`compare/${slug(c[0])}-vs-${slug(c[1])}/index.html`, comparePage(c)); urls.push(compareUrl(c[0], c[1])); }
staticPages();
assets();
seo(urls);
console.log(`built: ${datasets.length} datasets, ${nModels} model pages, ${allParts.length} part pages, ${urls.length} urls${cfg.amazonTag ? '' : '  (amazonTag 未設定)'}`);
