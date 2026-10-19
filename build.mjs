// カエドキ 静的サイト生成スクリプト（依存パッケージなし）
// 使い方: node build.mjs  → dist/ に全ページを書き出す
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');

// ---------- データ読み込み ----------
const datasets = fs.readdirSync(path.join(ROOT, 'data'))
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')));

const ds = datasets[0]; // 現状はダイニチ加湿器のみ
const maker = ds.maker;
const parts = ds.parts;
const partById = Object.fromEntries(parts.map(p => [p.id, p]));

// シリーズ判定（公式WebShopの部品カテゴリ区分に合わせる）
const SERIES = [
  { re: /^HD-ELXC/, key: 'elxc', name: 'ELXCタイプ' },
  { re: /^HD-LXC/, key: 'lxc', name: 'LXCタイプ' },
  { re: /^HD-LX/, key: 'lx', name: 'LXタイプ' },
  { re: /^HD-ERXT/, key: 'erxt', name: 'ERXTタイプ' },
  { re: /^HD-RXT/, key: 'rxt', name: 'RXTタイプ' },
  { re: /^HD-RXC/, key: 'rxc', name: 'RXCタイプ' },
  { re: /^HD-KSRX/, key: 'ksrx', name: 'KSRXタイプ' },
  { re: /^HD-KS/, key: 'ks', name: 'KSタイプ' },
  { re: /^HD-RX3/, key: 'rx3', name: 'RXタイプ（HD-RX3xx）' },
  { re: /^HD-RX/, key: 'rx', name: 'RXタイプ（HD-RX5xx/7xx/9xx）' },
  { re: /^HD-N3/, key: 'n3', name: 'Nタイプ（HD-N3xx）' },
  { re: /^HD-N/, key: 'n', name: 'Nタイプ（HD-N5xx/7xx/9xx）' },
  { re: /^HD-C3/, key: 'c3', name: 'Cタイプ（HD-C300）' },
  { re: /^HD-C/, key: 'c', name: 'Cタイプ（HD-C500/700/900）' },
  { re: /^HD-50EN/, key: 'en', name: 'ENタイプ' },
  { re: /^HD-300/, key: 'h300', name: 'HD-300系（旧型）' },
  { re: /^HD-[579]00[A-F]$/, key: 'h500', name: 'HD-500/700/900系（旧型）' },
  { re: /^HD-3\d{3}/, key: 'h30', name: 'HD-30xx系' },
  { re: /^HD-[579]\d{3}/, key: 'h50', name: 'HD-50xx/70xx/90xx系' },
];
const seriesOf = m => SERIES.find(s => s.re.test(m)) || { key: 'other', name: 'その他' };
const slug = s => s.toLowerCase();

// 機種 → 部品の逆引き。気化フィルターがある機種だけページを作る
const models = {};
for (const p of parts) {
  for (const m of p.models) {
    (models[m] ||= { id: m, parts: [] }).parts.push(p.id);
  }
}
const modelList = Object.values(models)
  .filter(m => m.parts.some(pid => partById[pid].kind === 'vapor'))
  .map(m => ({ ...m, series: seriesOf(m.id) }))
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
const hasPage = new Set(modelList.map(m => m.id));

// ---------- ユーティリティ ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = n => '¥' + n.toLocaleString('ja-JP');
const amazonUrl = q => {
  const u = new URL('https://www.amazon.co.jp/s');
  u.searchParams.set('k', q);
  if (cfg.amazonTag) u.searchParams.set('tag', cfg.amazonTag);
  return u.toString();
};
const modelUrl = m => `/${maker.id}/${slug(m)}/`;
const partUrl = p => `/parts/${slug(p)}/`;
const fmtDate = d => d.replace(/-/g, '/');

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

// 使い捨てタイプ・お手入れタイプの累計コスト（N年、年M カ月使用）
function costs(care, disp, years = 5, months = 6) {
  const seasons = years * months / 6;
  const careCount = Math.ceil(seasons / care.life.value);
  const filters = Math.ceil(months / disp.life.value) * years;
  const packs = Math.ceil(filters / disp.pack);
  return { care: careCount * care.price, careCount, disp: packs * disp.price, packs, washes: months * years };
}

// ---------- レイアウト ----------
function layout({ title, desc, canonical, crumbs = [], body, aside = true, jsonld = [] , scripts = [] }) {
  const crumbLd = crumbs.length ? [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [{ name: 'トップ', url: '/' }, ...crumbs].map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name, ...(c.url ? { item: SITE + c.url } : {}),
    })),
  }] : [];
  const ld = [...crumbLd, ...jsonld].map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
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
<div class="pr-bar">当サイトはアフィリエイト広告（Amazonアソシエイト）を利用しています</div>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="logo" href="/"><span class="logo-main">${esc(cfg.siteName)}</span><span class="logo-sub">${esc(cfg.tagline)}</span></a>
    <form class="head-search" action="/search/" method="get" role="search">
      <label class="vh" for="q">型番で検索</label>
      <input id="q" name="q" type="search" autocomplete="off" placeholder="型番・部品番号で検索（例：HD-RX520）">
      <button type="submit">検索</button>
    </form>
  </div>
  <nav class="gnav"><div class="wrap">
    <a href="/${maker.id}/">ダイニチ 加湿器</a><a href="/parts/">部品番号一覧</a><a href="/guide/dainichi-filter-cost/">フィルター費用の比較</a><a href="/guide/find-model-number/">型番の確認方法</a>
  </div></nav>
</header>
${crumbs.length ? `<div class="wrap crumbs"><a href="/">トップ</a>${crumbs.map(c => c.url ? ` &gt; <a href="${c.url}">${esc(c.name)}</a>` : ` &gt; <span>${esc(c.name)}</span>`).join('')}</div>` : ''}
<div class="wrap cols${aside ? '' : ' cols-full'}">
<main>
${body}
</main>
${aside ? sidebar() : ''}
</div>
<footer class="site-foot">
  <div class="wrap">
    <p class="foot-links"><a href="/about/">運営者情報</a><a href="/privacy/">プライバシーポリシー・免責事項</a><a href="/contact/">お問い合わせ</a><a href="/parts/">部品番号一覧</a></p>
    <p class="foot-note">Amazonのアソシエイトとして、${esc(cfg.siteName)}は適格販売により収入を得ています。価格は各メーカー直販サイトの掲載価格（税込）で、確認日時点のものです。購入前に販売ページで適用機種を必ずご確認ください。</p>
    <p class="copy">&copy; ${new Date().getFullYear()} ${esc(cfg.siteName)}</p>
  </div>
</footer>
<script src="/assets/search.js" defer></script>
${scripts.map(s => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

function sidebar() {
  const seriesGroups = groupBySeries(modelList);
  return `<aside class="side">
  <section class="side-box">
    <h2>型番はどこに書いてある？</h2>
    <p>${esc(maker.modelLabelHint)}「HD-」から始まる英数字です。</p>
    <p><a href="/guide/find-model-number/">確認方法をくわしく</a></p>
  </section>
  <section class="side-box">
    <h2>シリーズから探す</h2>
    <ul class="side-list">${seriesGroups.map(g => `<li><a href="/${maker.id}/#s-${g.key}">${esc(g.name)}</a><span class="n">${g.models.length}</span></li>`).join('')}</ul>
  </section>
  <section class="side-box">
    <h2>部品番号から探す</h2>
    <ul class="side-list">${parts.map(p => `<li><a href="${partUrl(p.id)}">${p.id}</a><span class="n">${esc(shortType(p))}</span></li>`).join('')}</ul>
  </section>
</aside>`;
}
const shortType = p => p.kind === 'air' ? 'エアフィルター' : (p.type === 'care' ? '気化・お手入れ' : '気化・使い捨て');

function groupBySeries(list) {
  const map = new Map();
  for (const m of list) {
    if (!map.has(m.series.key)) map.set(m.series.key, { key: m.series.key, name: m.series.name, models: [] });
    map.get(m.series.key).models.push(m);
  }
  const order = SERIES.map(s => s.key);
  return [...map.values()].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function typeBadge(p) {
  if (p.kind === 'air') return '<span class="badge b-air">エアフィルター</span>';
  return p.type === 'care' ? '<span class="badge b-care">お手入れ</span>' : '<span class="badge b-disp">使い捨て</span>';
}

function buyButtons(p) {
  return `<div class="buy">
    <a class="btn-amz" href="${esc(amazonUrl(`${maker.name} ${p.id}`))}" rel="sponsored nofollow noopener" target="_blank">Amazonで ${p.id} を見る</a>
    <a class="btn-off" href="${esc(p.source)}" rel="noopener" target="_blank">メーカー直販で見る</a>
  </div>`;
}

// ---------- ページ: 機種 ----------
function modelPage(m) {
  const ps = m.parts.map(id => partById[id]);
  const care = ps.find(p => p.kind === 'vapor' && p.type === 'care');
  const disp = ps.find(p => p.kind === 'vapor' && p.type === 'disposable');
  const air = ps.find(p => p.kind === 'air');
  const vapor = care || disp;

  const rows = [
    ['メーカー', maker.nameFull],
    ['製品', maker.category],
    ['シリーズ', `<a href="/${maker.id}/#s-${m.series.key}">${esc(m.series.name)}</a>`],
  ];

  const partRow = (label, p) => p
    ? `<tr><th>${label}</th><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a> ${typeBadge(p)}<br><span class="sub">${esc(p.name)}・${esc(p.life ? p.life.label : '交換周期の記載なし')}</span></td><td class="price">${yen(p.price)}</td><td class="act"><a href="${esc(amazonUrl(`${maker.name} ${p.id}`))}" rel="sponsored nofollow noopener" target="_blank">Amazon</a> / <a href="${esc(p.source)}" rel="noopener" target="_blank">直販</a></td></tr>`
    : `<tr><th>${label}</th><td colspan="3" class="sub">このサイトではまだ収録していません。取扱説明書の「別売部品」欄でご確認ください。</td></tr>`;

  let costHtml = '';
  if (care && disp) {
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

  const siblings = vapor ? vapor.models.filter(x => x !== m.id && hasPage.has(x) && seriesOf(x).key === m.series.key) : [];
  const allCount = vapor ? vapor.models.length : 0;
  const title = `${m.id} の交換フィルター・部品番号｜${maker.name} ${maker.category}`;
  const desc = `${maker.name}の${maker.category} ${m.id} に合う交換フィルターの部品番号は${[care, disp, air].filter(Boolean).map(p => p.id).join('・')}。メーカー直販価格、交換のめやす、5シーズンの費用比較をまとめています。`;

  const body = `
<h1 class="h1">${m.id} の交換フィルター・部品</h1>
<p class="lead">${maker.nameFull}の${maker.category}「${m.id}」に適合する純正の交換部品です。適用機種はメーカー直販サイトの掲載内容（${fmtDate(ds.checkedAt)}確認）にもとづいています。</p>

<table class="tbl spec">
<tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody>
</table>

<h2 class="h2">適合する交換部品</h2>
<table class="tbl parts">
<thead><tr><th>部品</th><th>部品番号</th><th>直販価格</th><th>購入先</th></tr></thead>
<tbody>
${partRow('気化フィルター<br>（お手入れ）', care)}
${partRow('気化フィルター<br>（使い捨て）', disp)}
${partRow('エアフィルター', air)}
</tbody>
</table>
<p class="sub">直販価格はメーカー直販サイトの税込価格です。Amazonの価格は出品者によって変わります。</p>

${costHtml}

<h2 class="h2">買う前に確認すること</h2>
<ul class="notes">
<li>${esc(maker.genuineNote)}Amazonで買う場合は、出品者が「ダイニチ」または信頼できる販売店であること、商品名に部品番号「${vapor.id}」が入っていることを確かめてください。</li>
<li>型番の末尾まで一致しているか確認してください（例：「${m.id}」と「${m.id}E」は別の機種として扱われることがあります）。</li>
<li>${esc(maker.partsPolicy)}</li>
</ul>

${vapor ? `<h2 class="h2">同じ気化フィルター（${vapor.id}）が使える機種</h2>
<p class="sub">${vapor.id} は全${allCount}機種で共通です。${siblings.length ? `同じ${esc(m.series.name)}の機種は次のとおり。` : ''}家に複数台あれば、まとめ買いできます。<a href="${partUrl(vapor.id)}">全${allCount}機種の一覧</a></p>
${siblings.length ? `<ul class="model-grid">${siblings.map(x => `<li><a href="${modelUrl(x)}">${x}</a></li>`).join('')}</ul>` : ''}` : ''}

<p class="src">出典：<a href="${esc(maker.officialShop)}" rel="noopener" target="_blank">ダイニチWebShop 加湿器別売部品</a>（${fmtDate(ds.checkedAt)}確認）</p>`;

  return layout({
    title, desc, canonical: modelUrl(m.id),
    crumbs: [{ name: `${maker.name} ${maker.category}`, url: `/${maker.id}/` }, { name: m.series.name, url: `/${maker.id}/#s-${m.series.key}` }, { name: m.id }],
    body, scripts: care && disp ? ['/assets/calc.js'] : [],
  });
}

// ---------- ページ: 部品 ----------
function partPage(p) {
  const pair = p.pairId ? partById[p.pairId] : null;
  const grouped = groupBySeries(p.models.filter(x => hasPage.has(x)).map(x => ({ id: x, series: seriesOf(x) })));
  const noPage = p.models.filter(x => !hasPage.has(x));
  const title = `${p.id} ${p.name}の適用機種一覧｜${maker.name} ${maker.category}`;
  const desc = `${maker.name}の${p.name}（${p.id}）が使える${maker.category}の型番${p.models.length}機種の一覧。直販価格${yen(p.price)}、交換のめやす、${pair ? `${pair.id}との違い、` : ''}購入時の注意をまとめています。`;

  const body = `
<h1 class="h1">${p.id} ${esc(p.name)} ${typeBadge(p)}</h1>
<table class="tbl spec">
<tbody>
<tr><th>部品番号</th><td><strong class="pn-big">${p.id}</strong>${p.replaces ? `<span class="sub">（旧番号 ${p.replaces.join('・')} はこの番号に統合）</span>` : ''}</td></tr>
<tr><th>部品名</th><td>${esc(p.name)}（${esc(p.typeLabel)}）</td></tr>
<tr><th>入数</th><td>${p.pack}個</td></tr>
<tr><th>メーカー直販価格</th><td class="price">${yen(p.price)}<span class="sub">（税込・${fmtDate(ds.checkedAt)}確認）</span></td></tr>
<tr><th>交換のめやす</th><td>${p.life ? esc(p.life.label) : '記載なし'}<br><span class="sub">${esc(p.lifeNote)}</span></td></tr>
<tr><th>適用機種数</th><td>${p.models.length}機種</td></tr>
</tbody>
</table>
${buyButtons(p)}
<p class="sub">※Amazonへのリンクはアフィリエイトリンクです。Amazonの検索結果には純正品以外も表示されるため、商品名と出品者を確認してください。</p>

${pair ? `<h2 class="h2">${pair.id}（${esc(pair.typeLabel)}）との違い</h2>
<p>同じ機種で使える気化フィルターに、${p.type === 'care' ? '洗わずに捨てられる使い捨てタイプ' : '洗って長く使うお手入れタイプ'}の <a href="${partUrl(pair.id)}">${pair.id}</a>（${yen(pair.price)}・${esc(pair.life.label)}）があります。5シーズン使った場合の費用比較は<a href="/guide/dainichi-filter-cost/">こちら</a>。</p>` : ''}

<h2 class="h2">適用機種一覧（${p.models.length}機種）</h2>
<p class="sub">メーカー直販サイトの適用機種表を、シリーズ別に並べ替えたものです。</p>
${grouped.map(g => `<h3 class="h3">${esc(g.name)}</h3><ul class="model-grid">${g.models.map(x => `<li><a href="${modelUrl(x.id)}">${x.id}</a></li>`).join('')}</ul>`).join('')}
${noPage.length ? `<h3 class="h3">その他の適用機種</h3><ul class="model-grid">${noPage.map(x => `<li><span>${x}</span></li>`).join('')}</ul>` : ''}

<p class="src">出典：<a href="${esc(p.source)}" rel="noopener" target="_blank">ダイニチWebShop ${p.id}</a>（${fmtDate(ds.checkedAt)}確認）</p>`;

  return layout({
    title, desc, canonical: partUrl(p.id),
    crumbs: [{ name: '部品番号一覧', url: '/parts/' }, { name: p.id }], body,
  });
}

// ---------- ページ: メーカー（機種一覧） ----------
function makerPage() {
  const groups = groupBySeries(modelList);
  const body = `
<h1 class="h1">${maker.name} 加湿器の交換フィルター 機種別一覧</h1>
<p class="lead">${modelList.length}機種を収録。型番を選ぶと、その機種に合う気化フィルターとエアフィルターの部品番号・価格が表示されます。</p>
<div class="jump">${groups.map(g => `<a href="#s-${g.key}">${esc(g.name)}</a>`).join('')}</div>
${groups.map(g => {
  const vp = [...new Set(g.models.flatMap(m => m.parts).filter(id => partById[id].kind === 'vapor'))];
  return `<h2 class="h2" id="s-${g.key}">${esc(g.name)}<span class="h2-n">${g.models.length}機種</span></h2>
<p class="sub">気化フィルター：${vp.map(id => `<a href="${partUrl(id)}">${id}</a>（${partById[id].type === 'care' ? 'お手入れ' : '使い捨て'}）`).join('、')}</p>
<ul class="model-grid">${g.models.map(m => `<li><a href="${modelUrl(m.id)}">${m.id}</a></li>`).join('')}</ul>`;
}).join('')}
<p class="src">出典：<a href="${esc(maker.officialShop)}" rel="noopener" target="_blank">ダイニチWebShop 加湿器別売部品</a>（${fmtDate(ds.checkedAt)}確認）。ここにない型番は、メーカーの部品供給が終了している可能性があります。</p>`;
  return layout({
    title: `${maker.name} 加湿器の交換フィルター 機種別一覧（${modelList.length}機種）`,
    desc: `${maker.name}の加湿器${modelList.length}機種について、型番ごとに合う交換フィルターの部品番号をシリーズ別に一覧化。`,
    canonical: `/${maker.id}/`, crumbs: [{ name: `${maker.name} ${maker.category}` }], body,
  });
}

// ---------- ページ: 部品一覧 ----------
function partsIndex() {
  const body = `
<h1 class="h1">部品番号一覧</h1>
<p class="lead">収録している交換部品の一覧です。部品番号から適用機種を確認できます。</p>
<table class="tbl parts">
<thead><tr><th>部品番号</th><th>部品名</th><th>種類</th><th>直販価格</th><th>適用機種</th></tr></thead>
<tbody>${parts.map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a></td><td>${esc(p.name)}</td><td>${typeBadge(p)}</td><td class="price">${yen(p.price)}</td><td>${p.models.length}機種</td></tr>`).join('')}</tbody>
</table>`;
  return layout({ title: `部品番号一覧｜${cfg.siteName}`, desc: '収録している家電の交換部品の部品番号・価格・適用機種数の一覧。', canonical: '/parts/', crumbs: [{ name: '部品番号一覧' }], body });
}

// ---------- ページ: トップ ----------
function topPage() {
  const groups = groupBySeries(modelList);
  const vparts = parts.filter(p => p.kind === 'vapor');
  const body = `
<section class="top-search">
  <h1 class="top-h">本体の型番から、合う交換部品がわかる</h1>
  <form action="/search/" method="get" role="search" class="big-search">
    <label class="vh" for="q2">型番</label>
    <input id="q2" name="q" type="search" autocomplete="off" placeholder="例：HD-RXT524" data-suggest>
    <button type="submit">部品を調べる</button>
  </form>
  <ul class="suggest" data-suggest-list hidden></ul>
  <p class="top-hint">型番は本体の側面か後面のシールに書いてあります。「HD-」を省いて「RXT524」と入れても探せます。</p>
</section>

<h2 class="h2">収録しているメーカー</h2>
<table class="tbl">
<thead><tr><th>メーカー</th><th>製品</th><th>収録機種</th><th>部品</th><th>確認日</th></tr></thead>
<tbody><tr><td><a href="/${maker.id}/">${maker.nameFull}</a></td><td>${maker.category}</td><td>${modelList.length}機種</td><td>${parts.length}点</td><td>${fmtDate(ds.checkedAt)}</td></tr></tbody>
</table>
<p class="sub">空気清浄機・浄水器・掃除機の消耗品も順次追加します。</p>

<h2 class="h2">シリーズから探す（ダイニチ 加湿器）</h2>
<table class="tbl series">
<thead><tr><th>シリーズ</th><th>主な型番</th><th>気化フィルター</th></tr></thead>
<tbody>${groups.map(g => {
  const vp = [...new Set(g.models.flatMap(m => m.parts).filter(id => partById[id].kind === 'vapor'))];
  const sample = g.models.slice(-3).map(m => m.id).join('、');
  return `<tr><td><a href="/${maker.id}/#s-${g.key}">${esc(g.name)}</a></td><td class="sub">${sample} ほか ${g.models.length}機種</td><td>${vp.map(id => `<a href="${partUrl(id)}">${id}</a>`).join(' / ')}</td></tr>`;
}).join('')}</tbody>
</table>

<h2 class="h2">気化フィルターの価格と交換めやす</h2>
<table class="tbl parts">
<thead><tr><th>部品番号</th><th>種類</th><th>直販価格</th><th>交換めやす</th></tr></thead>
<tbody>${vparts.map(p => `<tr><td><a class="pn" href="${partUrl(p.id)}">${p.id}</a></td><td>${typeBadge(p)}</td><td class="price">${yen(p.price)}</td><td>${esc(p.life.label)}</td></tr>`).join('')}</tbody>
</table>
<p>使い捨てとお手入れ、5シーズンでいくら差が出るかは「<a href="/guide/dainichi-filter-cost/">ダイニチ加湿器フィルターの費用比較</a>」で計算しています。</p>`;

  return layout({
    title: `${cfg.siteName}｜家電の交換フィルター・部品を型番で検索`,
    desc: '加湿器などの家電の本体型番を入れると、合う純正交換フィルターの部品番号・メーカー直販価格・交換のめやすがわかる検索サイト。',
    canonical: '/', body, scripts: ['/assets/suggest.js'],
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.siteName, url: SITE + '/', potentialAction: { '@type': 'SearchAction', target: `${SITE}/search/?q={q}`, 'query-input': 'required name=q' } }],
  });
}

// ---------- ページ: 検索結果（クライアント側で描画） ----------
function searchPage() {
  const body = `
<h1 class="h1">検索結果</h1>
<div data-search-results><p class="sub">検索しています…</p></div>
<noscript><p>検索にはJavaScriptが必要です。<a href="/${maker.id}/">機種一覧</a>から探してください。</p></noscript>`;
  return layout({ title: `検索結果｜${cfg.siteName}`, desc: '型番検索の結果', canonical: '/search/', crumbs: [{ name: '検索結果' }], body, scripts: ['/assets/results.js'] })
    .replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"');
}

// ---------- ページ: 費用比較ガイド ----------
function costGuide() {
  const pairs = parts.filter(p => p.kind === 'vapor' && p.type === 'care').map(c => [c, partById[c.pairId]]);
  const scenarios = [[6, 5], [4, 5], [9, 5], [6, 1]];
  const label = c => c.models.some(m => /^HD-LX|^HD-ELXC/.test(m)) ? 'LX・LXC・ELXCタイプ' : c.models.some(m => /^HD-N3|^HD-RX3/.test(m)) ? 'N3xx・RX3xx・30xx系など' : 'RX・RXT・N5xx〜9xx系など';
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
<p>RX・RXT・N5xx〜9xx系（${pairs[1][0].id} / ${pairs[1][1].id}）で計算しました。</p>
<table class="tbl cmp">
<thead><tr><th>使い方</th><th>お手入れ</th><th>使い捨て</th><th>洗浄回数</th><th>洗浄1回あたりの差額</th></tr></thead>
<tbody>${scenarios.map(([mo, y]) => { const r = costs(pairs[1][0], pairs[1][1], y, mo); return `<tr><td>年${mo}カ月・${y}年</td><td class="price">${yen(r.care)}</td><td class="price">${yen(r.disp)}</td><td>${r.washes}回</td><td>${yen(Math.round((r.disp - r.care) / r.washes))}</td></tr>`; }).join('')}</tbody>
</table>

<h2 class="h2">どちらを選ぶか</h2>
<p>金額だけならお手入れタイプが大きく安くなります。ただしこの差は、月1回のクエン酸洗浄をきちんと続けた場合の話です。洗浄を忘れがちで、1〜2シーズンごとに買い替えているなら差は縮みます。</p>
<p>使い捨てタイプは、洗浄1回をおよそ数百円で外注しているのと同じです。つけ置きの手間とにおいの心配を減らしたい人、加湿器を使う月が短い人には十分に見合います。</p>
<p>どちらも同じ機種で使えるので、片方を使い切ったあとに切り替えることもできます。自分の機種で計算したい場合は、<a href="/${maker.id}/">機種一覧</a>から型番のページを開くと、使用月数を変えて試算できます。</p>

<p class="src">出典：<a href="${esc(maker.officialShop)}" rel="noopener" target="_blank">ダイニチWebShop 加湿器別売部品</a>（各部品ページの適用機種・交換めやすの記載）</p>`;
  return layout({
    title: 'ダイニチ加湿器フィルター お手入れタイプと使い捨てタイプの費用比較（5シーズン総額）',
    desc: 'ダイニチ加湿器の気化フィルター、お手入れタイプ（H060518等）と使い捨てタイプ（H060524等）を5シーズン使った総額で比較。メーカー直販価格と交換めやすから計算。',
    canonical: '/guide/dainichi-filter-cost/', crumbs: [{ name: 'フィルター費用の比較' }], body,
  });
}

function findModelGuide() {
  const body = `
<h1 class="h1">加湿器の型番（型式）の確認方法</h1>
<p class="lead">交換部品は本体の型番で決まります。シリーズ名やサイズだけでは特定できないので、本体に書かれた型番を確認してください。</p>
<h2 class="h2">ダイニチの加湿器</h2>
<ul class="notes">
<li>${esc(maker.modelLabelHint)}</li>
<li>「HD-」から始まる英数字です（例：HD-RXT524、HD-LX1225）。</li>
<li>末尾に「E3」「E6」などが付く型番があります。部品が異なる場合があるため、末尾まで入力してください。</li>
<li>カラーを表す記号（例：(W)、(T)）は型番に含めなくて大丈夫です。</li>
</ul>
<h2 class="h2">型番が見つからないとき</h2>
<p>取扱説明書の表紙や裏表紙、保証書にも型番が書かれています。このサイトで検索しても出てこない場合は、メーカーの部品供給が終わっているか、まだ収録していない機種です。<a href="${esc(maker.officialShop)}" rel="noopener" target="_blank">メーカーの別売部品ページ</a>でも検索できます。</p>`;
  return layout({ title: '加湿器の型番（型式）の確認方法｜ダイニチ', desc: '交換フィルターを探すための、加湿器本体の型番の確認場所と入力のコツ。', canonical: '/guide/find-model-number/', crumbs: [{ name: '型番の確認方法' }], body });
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
<p>家電の消耗品は、本体の型番がわかっても、どの部品番号を買えばいいのかが探しにくいものです。${esc(cfg.siteName)}は、型番を入れるだけで合う交換部品がわかるように、メーカーが公開している適用機種表を機種ごとに並べ直しています。</p>
<h2 class="h2">データの集め方</h2>
<ul class="notes">
<li>適用機種・部品番号・価格・交換のめやすは、メーカー直販サイトの掲載内容から転記しています。各ページに出典と確認日を記載しています。</li>
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
<p>当サイトの文章・計算結果の無断転載はご遠慮ください。部品番号・型番などの事実情報はメーカーに帰属するものではありませんが、出典としてメーカーのページを記載しています。</p>`,
  }));
  write('contact/index.html', layout({
    title: `お問い合わせ｜${cfg.siteName}`, desc: 'お問い合わせ', canonical: '/contact/', crumbs: [{ name: 'お問い合わせ' }],
    body: `<h1 class="h1">お問い合わせ</h1>
<p>掲載内容の誤り、収録してほしい機種、その他のご連絡は下記からお願いします。</p>
${cfg.contactUrl ? `<p><a class="btn-off" href="${esc(cfg.contactUrl)}" rel="noopener" target="_blank">お問い合わせフォームを開く</a></p>` : '<p class="sub">お問い合わせフォームは準備中です。</p>'}
<p class="sub">部品の在庫や注文については、各販売店またはメーカーへお問い合わせください。</p>`,
  }));
  write('404.html', layout({ title: `ページが見つかりません｜${cfg.siteName}`, desc: 'ページが見つかりません', canonical: '/404.html', aside: false,
    body: `<h1 class="h1">ページが見つかりません</h1><p>型番で検索するか、<a href="/${maker.id}/">機種一覧</a>から探してください。</p>` }));
}

// ---------- アセット ----------
function assets() {
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) {
    fs.copyFileSync(path.join(ROOT, 'src', f), path.join(OUT, 'assets', f));
  }
  fs.copyFileSync(path.join(ROOT, 'src-root', 'favicon.svg'), path.join(OUT, 'favicon.svg'));
  const index = [
    ...modelList.map(m => ({ k: m.id, u: modelUrl(m.id), t: 'm', s: m.series.name })),
    ...parts.map(p => ({ k: p.id, u: partUrl(p.id), t: 'p', s: `${p.name}（${shortType(p)}）` })),
  ];
  fs.writeFileSync(path.join(OUT, 'search-index.json'), JSON.stringify(index));
}

function seo(urls) {
  const today = ds.checkedAt;
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nDisallow: /search/\nSitemap: ${SITE}/sitemap.xml\n`);
}

// ---------- 実行 ----------
fs.rmSync(OUT, { recursive: true, force: true });
const urls = ['/', `/${maker.id}/`, '/parts/', '/guide/dainichi-filter-cost/', '/guide/find-model-number/', '/about/', '/privacy/', '/contact/'];
write('index.html', topPage());
write(`${maker.id}/index.html`, makerPage());
write('parts/index.html', partsIndex());
write('search/index.html', searchPage());
write('guide/dainichi-filter-cost/index.html', costGuide());
write('guide/find-model-number/index.html', findModelGuide());
for (const m of modelList) { write(`${maker.id}/${slug(m.id)}/index.html`, modelPage(m)); urls.push(modelUrl(m.id)); }
for (const p of parts) { write(`parts/${slug(p.id)}/index.html`, partPage(p)); urls.push(partUrl(p.id)); }
staticPages();
assets();
seo(urls);
console.log(`built: ${modelList.length} model pages, ${parts.length} part pages, ${urls.length} urls in sitemap${cfg.amazonTag ? '' : '  (amazonTag 未設定)'}`);
