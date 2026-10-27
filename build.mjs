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
const slug = s => s.toLowerCase();
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
const amzLink = (ds, p, text) => `<a href="${esc(partAmazonUrl(ds.maker.name, p))}" rel="sponsored nofollow noopener" target="_blank">${text}</a>`;
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
    ${datasets.map(d => `<a href="${makerUrl(d)}">${esc(d.maker.name)} ${esc(d.maker.category)}</a>`).join('')}<a href="/parts/">部品番号一覧</a><a href="/guide/dainichi-filter-life/">ダイニチ交換時期</a><a href="/guide/sharp-filter-schedule/">シャープ交換時期</a><a href="/guide/dainichi-filter-cost/">費用比較</a>
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
    <p class="foot-links"><a href="/about/">運営者情報</a><a href="/privacy/">プライバシーポリシー・免責事項</a><a href="/contact/">お問い合わせ</a><a href="/parts/">部品番号一覧</a><a href="/guide/find-model-number/">型番の確認方法</a></p>
    <p class="foot-note">Amazonのアソシエイトとして、${esc(cfg.siteName)}は適格販売により収入を得ています。価格はメーカー直販サイトまたはメーカーカタログの掲載価格（税込）で、確認日時点のものです。購入前に販売ページで適用機種を必ずご確認ください。</p>
    <p class="copy">&copy; ${new Date().getFullYear()} ${esc(cfg.siteName)}</p>
  </div>
</footer>
<script src="/assets/search.js" defer></script>
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
<td><a class="pn" href="${partUrl(p.id)}">${p.id}</a> ${typeBadge(p)}<br><span class="sub">${esc(p.name)}${p.packLabel ? (p.name.includes(p.packLabel) ? '' : `（${esc(p.packLabel)}）`) : p.pack > 1 && !/\d(個|枚)入/.test(p.name) ? `（${p.pack}個入り）` : ''}・${esc(lifeLabel(p))}</span></td>
${hasPrice ? `<td class="price">${p.price ? yen(p.price) : '—'}</td>` : ''}
<td class="act">${amzLink(ds, p, 'Amazon')}${p.source ? ` / <a href="${esc(p.source)}" rel="noopener" target="_blank">直販</a>` : ''}</td></tr>`).join('\n');

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

  // シャープ：交換頻度でまとめる
  let freqHtml = '';
  if (ds.showFrequency) {
    const buckets = [
      { name: '毎月', test: p => p.life && p.life.unit === 'month', note: 'いちばん買う頻度が高いもの。まとめ買いしておくと切らしません。' },
      { name: '毎年', test: p => p.life && p.life.unit === 'year' && p.life.value === 1, note: '冬の加湿シーズン前に替えるのが目安です。' },
      { name: '数年に1回', test: p => p.life && p.life.unit === 'year' && p.life.value > 1 && p.life.value < 10, note: '' },
      { name: '約10年に1回', test: p => p.life && p.life.unit === 'year' && p.life.value >= 10, note: '本来は長持ちします。洗っても汚れやニオイが取れないときだけ交換します。' },
      { name: 'ランプが点滅したら', test: p => p.life && p.life.unit === 'lamp', note: '本体の交換ランプで知らせてくれます。' },
    ];
    if (ps.some(p => p.life)) freqHtml = `<h2 class="h2">交換の頻度で分けると</h2>
<p>${m.id} の消耗品を、取扱説明書の交換めやすで並べ替えました。「フィルター交換」と言っても、毎月替えるものと10年もつものが混ざっています。</p>
<table class="tbl freq"><thead><tr><th>頻度</th><th>部品</th><th>メモ</th></tr></thead><tbody>
${buckets.map(b => { const xs = ps.filter(b.test); return xs.length ? `<tr><th>${b.name}</th><td>${xs.map(p => `<a class="pn" href="${partUrl(p.id)}">${p.id}</a> <span class="sub">${esc(KINDS[p.kind].label)}</span>`).join('<br>')}</td><td class="sub">${esc(b.note)}</td></tr>` : ''; }).join('')}
</tbody></table>`;
  }

  const siblings = primary ? primary.models.filter(x => x !== m.id && ds.hasPage.has(x)) : [];
  const title = `${m.id} の交換フィルター・部品番号｜${maker.name} ${maker.category}`;
  const keyIds = ps.filter(p => (ds.primaryKinds || []).includes(p.kind) || p.kind === 'air').map(p => p.id);
  const desc = `${maker.name}の${maker.category} ${m.id} に合う交換フィルターの部品番号は${keyIds.join('・')}。${hasPrice ? 'メーカー直販価格、' : ''}交換のめやすをメーカー資料からまとめています。`;
  const srcUrl = m.source || ds.sourceUrl || maker.officialShop;
  const srcName = ds.modelSourceName ? ds.modelSourceName.replace('{id}', m.id) : m.source ? `${maker.name} ${m.id} 取扱説明書（PDF）` : ds.sourceName || `${maker.name} 公式 別売部品ページ`;
  const srcKind = ds.modelSourceName ? ds.sourceKind : m.source ? '取扱説明書' : ds.sourceKind || 'メーカー直販サイト';

  const body = `
<h1 class="h1">${m.id} の交換フィルター・部品</h1>
<p class="lead">${esc(maker.nameFull)}の${esc(maker.category)}「${m.id}」に適合する純正の交換部品です。${srcKind}の記載（${fmtDate(ds.checkedAt)}確認）にもとづいています。</p>

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

${costHtml}${freqHtml}${ds.maker.id === 'dainichi' ? `<p>フィルターの交換時期の条件（「最大5シーズン」は月1回のクエン酸洗浄が前提）は → <a href="/guide/dainichi-filter-life/">ダイニチ加湿器のフィルター交換時期</a></p>` : ''}${ds.maker.id === 'sharp' && ps.some(p => p.kind === 'humid') ? `<p>加湿フィルターは、交換する前に洗うと長持ちします。→ <a href="/guide/sharp-humidifier-filter-care/">クエン酸・重曹での洗い方</a></p>` : ''}

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
  const title = `${p.id} ${p.name}の適用機種一覧｜${maker.name} ${maker.category}`;
  const desc = `${maker.name}の${p.name}（${p.id}）が使える${maker.category}の型番${p.models.length}機種の一覧。${p.price ? `${ds.priceLabel ? '希望小売価格' : '直販価格'}${yen(p.price)}、` : ''}交換のめやす、購入時の注意をまとめています。`;
  const srcs = p.source ? [[p.source, `${maker.name} 公式 ${p.id}`]] : ds.sourceUrl ? [[ds.sourceUrl, ds.sourceName]] : withPage.map(x => ds.modelList.find(m => m.id === x)).filter(m => m && m.source).map(m => [m.source, `${m.id} 取扱説明書`]);

  const body = `
<h1 class="h1">${p.id} ${esc(p.name)} ${typeBadge(p)}</h1>
<table class="tbl spec"><tbody>
<tr><th>部品番号</th><td><strong class="pn-big">${p.id}</strong>${p.replaces ? `<span class="sub">（旧番号 ${p.replaces.join('・')} はこの番号に統合）</span>` : ''}</td></tr>
<tr><th>部品名</th><td>${esc(p.name)}${p.typeLabel ? `（${esc(p.typeLabel)}）` : ''}</td></tr>
<tr><th>入数</th><td>${esc(p.packLabel || `${p.pack}個`)}</td></tr>
${p.price ? `<tr><th>${ds.priceLabel ? 'メーカー希望小売価格' : 'メーカー直販価格'}</th><td class="price">${yen(p.price)}<span class="sub">（税込・${fmtDate(ds.checkedAt)}確認）</span></td></tr>` : ''}
<tr><th>交換のめやす</th><td>${esc(lifeLabel(p))}<br><span class="sub">${esc(p.lifeNote)}</span></td></tr>
${p.variants ? `<tr><th>入数違い</th><td>${esc(p.variants)}</td></tr>` : ''}
<tr><th>適用機種数</th><td>${p.models.length}機種</td></tr>
</tbody></table>
<div class="buy">
  <a class="btn-amz" href="${esc(partAmazonUrl(maker.name, p))}" rel="sponsored nofollow noopener" target="_blank">Amazonで ${p.id} を見る</a>
  ${p.source ? `<a class="btn-off" href="${esc(p.source)}" rel="noopener" target="_blank">メーカー直販で見る</a>` : ''}
</div>

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
  const groups = groupBySeries(ds, ds.modelList);
  const primaryOf = g => mainParts(ds, g.models);
  const body = `
<h1 class="h1">${esc(maker.name)} ${esc(maker.category)}の交換フィルター 機種別一覧</h1>
<p class="lead">${ds.modelList.length}機種を収録。形名を選ぶと、その機種に合う交換部品の部品番号と交換のめやすが表示されます。</p>
<div class="jump">${groups.map(g => `<a href="#s-${g.key}">${esc(g.name)}</a>`).join('')}</div>
${groups.map(g => `<h2 class="h2" id="s-${g.key}">${esc(g.name)}<span class="h2-n">${g.models.length}機種</span></h2>
<p class="sub">主なフィルター：${primaryOf(g).slice(0, 6).map(id => `<a href="${partUrl(id)}">${id}</a>（${esc(shortType(ds.partById[id]))}）`).join('、')}${more(primaryOf(g), 6)}</p>
<ul class="model-grid">${g.models.map(m => `<li><a href="${modelUrl(ds, m.id)}">${m.id}</a></li>`).join('')}</ul>`).join('')}
<p class="src">出典：<a href="${esc(ds.sourceUrl || maker.officialShop)}" rel="noopener" target="_blank">${esc(ds.sourceName || `${maker.name} 公式サポート`)}</a>${ds.modelSources ? '・各機種の取扱説明書' : ''}（${fmtDate(ds.checkedAt)}確認）。ここにない形名は、まだ収録していないか、メーカーの部品供給が終わっている可能性があります。</p>`;
  return layout({
    title: `${maker.name} ${maker.category}の交換フィルター 機種別一覧（${ds.modelList.length}機種）`,
    desc: `${maker.name}の${maker.category}${ds.modelList.length}機種について、形名ごとに合う交換フィルターの部品番号をシリーズ別に一覧化。`,
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
  <p class="top-hint">型番は本体の側面か背面のシールに書いてあります。「HD-」「KI-」「FU-」「F-」を省いて入れても探せます。</p>
</section>

<h2 class="h2">収録しているメーカー</h2>
<table class="tbl">
<thead><tr><th>メーカー</th><th>製品</th><th>収録機種</th><th>部品</th><th>確認日</th></tr></thead>
<tbody>${datasets.map(d => `<tr><td><a href="${makerUrl(d)}">${esc(d.maker.nameFull)}</a></td><td>${esc(d.maker.category)}</td><td>${d.modelList.length}機種</td><td>${d.parts.length}点</td><td>${fmtDate(d.checkedAt)}</td></tr>`).join('')}</tbody>
</table>
<p class="sub">ダイキンの加湿空気清浄機、浄水器・掃除機の消耗品も順次追加します。</p>

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

<p class="src">出典：<a href="${esc(ds.maker.officialShop)}" rel="noopener" target="_blank">ダイニチWebShop 加湿器 別売部品</a>（各部品ページの適用機種・交換の期間の記載）、<a href="https://www.dainichi-net.co.jp/support/faq/hd/hd1504_2.html" rel="noopener" target="_blank">ダイニチ よくあるご質問（加湿器）</a>（${fmtDate(ds.checkedAt)}確認）</p>`;
  return layout({
    title: 'ダイニチ加湿器のフィルター交換時期｜お手入れタイプ最大5シーズン・使い捨て3カ月の条件',
    desc: 'ダイニチ加湿器の抗菌気化フィルター（お手入れタイプ）は最大5シーズン、カンタン取替えフィルター（使い捨て）は3カ月。メーカーの前提条件、交換のサイン、機種別の部品番号と直販価格をまとめました。',
    canonical: U, ds, crumbs: [{ name: 'ダイニチの交換時期' }], body,
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
    ...allParts.map(p => ({ k: p.id, u: partUrl(p.id), t: 'p', s: `${p.maker.name} ${p.name}（${shortType(p)}）` })),
  ];
  fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));
}

function seo(urls) {
  const lastmod = datasets.map(d => d.checkedAt).sort().pop();
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nDisallow: /search/\nSitemap: ${SITE}/sitemap.xml\n`);
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
  if (ds.maker.id === 'sharp') { write('guide/sharp-filter-schedule/index.html', sharpScheduleGuide(ds)); urls.push('/guide/sharp-filter-schedule/'); }
  if (ds.maker.id === 'sharp') { write('guide/sharp-humidifier-filter-care/index.html', sharpCareGuide(ds)); urls.push('/guide/sharp-humidifier-filter-care/'); }
}
staticPages();
assets();
seo(urls);
console.log(`built: ${datasets.length} datasets, ${nModels} model pages, ${allParts.length} part pages, ${urls.length} urls${cfg.amazonTag ? '' : '  (amazonTag 未設定)'}`);
