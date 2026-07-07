/**
 * generate-graph.mjs  (visualize-graph skill bundled script)
 *
 * codegraph.db → docs/codegraph-viz.html
 *
 * 두 가지 모드:
 *  1) 코드 그래프 (기본): method 레벨 calls/instantiates 엣지를
 *     부모 class/interface/struct/enum 로 집계 → 클래스 의존성 그래프.
 *  2) 문서 링크 그래프 (--docs, 또는 코드 심볼이 0이고 doc 노드가 있으면 자동):
 *     doc 노드 + doc_link 엣지 → 위키 지식 그래프. 노드는 최상위 디렉토리별 색상.
 *
 * 사용법 (프로젝트 루트에서):
 *   node <skill-scripts-path>/generate-graph.mjs [options]
 *
 * 옵션:
 *   --methods        method 노드 포함 (코드 모드 한정. 기본: class/interface/struct/enum)
 *   --docs           문서 링크 그래프 모드 강제 (doc/doc_link)
 *   --out <path>     출력 HTML 경로 (기본: docs/codegraph-viz.html)
 *   --db  <path>     DB 경로 (기본: .codegraph/codegraph.db)
 */

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname }         from 'node:path';

const args        = process.argv.slice(2);
const SHOW_METHODS = args.includes('--methods');
const FORCE_DOCS   = args.includes('--docs');

const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i+1] : null; };

const CWD     = process.cwd();
const DB_PATH = resolve(CWD, getArg('--db')  || '.codegraph/codegraph.db');
const OUT_PATH = resolve(CWD, getArg('--out') || 'docs/codegraph-viz.html');

// ── DB 접속 ────────────────────────────────────────────────────────────────────
let db;
try {
  db = new DatabaseSync(DB_PATH);
} catch (e) {
  console.error('[visualize-graph] ERROR: DB를 열 수 없습니다: ' + DB_PATH);
  console.error('  → codegraph init -i 를 먼저 실행하세요.');
  process.exit(1);
}

// ── 1. 전체 노드 로드 ──────────────────────────────────────────────────────────
const allNodes = db.prepare(
  'SELECT id, kind, name, qualified_name, file_path, start_line, end_line, signature, visibility FROM nodes'
).all();
const nodeMap  = new Map(allNodes.map(n => [n.id, n]));

// ── 2. contains 엣지로 부모 맵 구성 (코드 모드 집계용) ────────────────────────
const parentOf = new Map();
db.prepare("SELECT source, target FROM edges WHERE kind='contains'").all()
  .forEach(e => parentOf.set(e.target, e.source));

function rootType(id) {
  let cur = id;
  const visited = new Set();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const n = nodeMap.get(cur);
    if (!n) return null;
    if (['class','interface','struct','enum'].includes(n.kind)) return cur;
    const p = parentOf.get(cur);
    if (!p) return null;
    cur = p;
  }
  return null;
}

// ── 3. 모드 결정 ───────────────────────────────────────────────────────────────
const CODE_KINDS  = ['class','interface','struct','enum'];
const codeNodeCnt = allNodes.filter(n => CODE_KINDS.includes(n.kind)).length;
const docNodeCnt  = allNodes.filter(n => n.kind === 'doc').length;
const DOCS_MODE   = FORCE_DOCS || (codeNodeCnt === 0 && docNodeCnt > 0);

// 디렉토리 그룹(문서 모드) ─ 최상위 폴더로 색상 분류
const topDir = (p) => {
  if (!p) return '(root)';
  const seg = String(p).replace(/\\/g, '/').split('/');
  return seg.length > 1 ? seg[0] : '(root)';
};
const PALETTE = ['#4A90D9','#4CAF50','#FF9800','#E91E63','#00BCD4','#9C27B0',
                 '#FFC107','#8BC34A','#FF5722','#607D8B','#3F51B5','#009688'];

const KIND_COLOR = { class:'#4A90D9', interface:'#00BCD4', struct:'#4CAF50', enum:'#FF9800', method:'#9C27B0' };
const EDGE_COLOR = { calls:'#E53935', instantiates:'#FF9800', implements:'#00BCD4', imports:'#78909C', doc_link:'#8899bb' };

let displayNodes, displayIds, aggEdges;
const groupColor = {};   // 문서 모드 전용: 디렉토리 → 색
let groupsOrdered = [];  // 범례 순서(노드 수 desc)

if (DOCS_MODE) {
  // ── 문서 링크 그래프 ──────────────────────────────────────────────────────
  displayNodes = allNodes.filter(n => n.kind === 'doc');
  displayIds   = new Set(displayNodes.map(n => n.id));

  // 디렉토리 그룹 집계 → 색 배정
  const groupCount = new Map();
  displayNodes.forEach(n => { const g = topDir(n.file_path); groupCount.set(g, (groupCount.get(g)||0)+1); });
  groupsOrdered = [...groupCount.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
  groupsOrdered.forEach((g,i) => { groupColor[g] = PALETTE[i % PALETTE.length]; });

  // 각 노드에 그룹/색 주입
  displayNodes.forEach(n => { n.__group = topDir(n.file_path); n.__color = groupColor[n.__group]; });

  // doc_link 엣지 (양끝이 표시 노드, 자기참조 제외, 중복 제거)
  const edgeSet = new Set();
  aggEdges = [];
  db.prepare("SELECT source, target FROM edges WHERE kind='doc_link'").all().forEach(e => {
    if (!displayIds.has(e.source) || !displayIds.has(e.target) || e.source === e.target) return;
    const key = e.source + '|' + e.target;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    aggEdges.push({ source: e.source, target: e.target, kind: 'doc_link' });
  });
} else {
  // ── 코드 의존성 그래프 (기존 동작) ────────────────────────────────────────
  const TYPE_KINDS = SHOW_METHODS ? [...CODE_KINDS, 'method'] : CODE_KINDS;
  displayNodes = allNodes.filter(n => TYPE_KINDS.includes(n.kind));
  displayIds   = new Set(displayNodes.map(n => n.id));
  displayNodes.forEach(n => { n.__group = n.kind; n.__color = KIND_COLOR[n.kind] || '#78909C'; });

  const EDGE_KINDS = ['calls','instantiates','implements','imports'];
  const rawEdges = db.prepare(
    'SELECT source, target, kind FROM edges WHERE kind IN (' + EDGE_KINDS.map(()=>'?').join(',') + ')'
  ).all(...EDGE_KINDS);

  const edgeSet = new Set();
  aggEdges = [];
  rawEdges.forEach(e => {
    let src = displayIds.has(e.source) ? e.source : rootType(e.source);
    let tgt = displayIds.has(e.target) ? e.target : rootType(e.target);
    if (!src || !tgt || src === tgt) return;
    if (!displayIds.has(src) || !displayIds.has(tgt)) return;
    const key = src + '|' + tgt + '|' + e.kind;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    aggEdges.push({ source: src, target: tgt, kind: e.kind });
  });
}

// ── 5. Cytoscape.js 데이터 변환 ───────────────────────────────────────────────
const shortFile = p => p ? String(p).replace(/\\/g,'/').split('/').pop() : '';

const cyNodes = displayNodes.map(n => ({
  data: {
    id:            n.id,
    label:         n.name,
    kind:          n.__group,                       // 코드: 심볼종류 / 문서: 디렉토리그룹 (범례 토글 키)
    qualifiedName: n.qualified_name || n.name,
    file:          n.file_path || '',
    shortFile:     shortFile(n.file_path),
    line:          n.start_line || 0,
    endLine:       n.end_line   || 0,
    signature:     n.signature  || '',
    visibility:    n.visibility || '',
    color:         n.__color || '#78909C',
  }
}));
const cyEdges = aggEdges.map((e,i) => ({
  data: { id:'e'+i, source:e.source, target:e.target, kind:e.kind, color:EDGE_COLOR[e.kind]||'#BDBDBD' }
}));

const graphData  = JSON.stringify({ nodes: cyNodes, edges: cyEdges });
const modeLabel  = DOCS_MODE ? '문서 링크 그래프' : '집계';
const statsLine  = cyNodes.length + ' nodes · ' + cyEdges.length + ' edges (' + modeLabel + ')';
const titleText  = DOCS_MODE ? '⬡ Wiki Link Graph' : '⬡ Codegraph Visualizer';

// ── 범례 HTML (모드별) ─────────────────────────────────────────────────────────
let legendHtml;
if (DOCS_MODE) {
  const nodeItems = groupsOrdered.map(g =>
    '<div class="legend-item" data-kind="'+g+'"><div class="legend-dot-node" style="background:'+groupColor[g]+'"></div>'+g+'</div>'
  ).join('');
  legendHtml =
    '<span style="font-size:10px;color:#888">디렉토리:</span>' + nodeItems +
    '<span style="font-size:10px;color:#888;margin-left:6px">엣지:</span>' +
    '<div class="legend-item" data-edge="doc_link"><div class="legend-dot-edge" style="background:#8899bb"></div>doc_link (참조)</div>';
} else {
  const methodFlag = SHOW_METHODS ? '<div class="legend-item" data-kind="method"><div class="legend-dot-node" style="background:#9C27B0"></div>Method</div>' : '';
  legendHtml =
    '<span style="font-size:10px;color:#888">노드:</span>' +
    '<div class="legend-item" data-kind="class"><div class="legend-dot-node" style="background:#4A90D9"></div>Class</div>' +
    '<div class="legend-item" data-kind="interface"><div class="legend-dot-node" style="background:#00BCD4"></div>Interface</div>' +
    '<div class="legend-item" data-kind="struct"><div class="legend-dot-node" style="background:#4CAF50"></div>Struct</div>' +
    '<div class="legend-item" data-kind="enum"><div class="legend-dot-node" style="background:#FF9800"></div>Enum</div>' +
    methodFlag +
    '<span style="font-size:10px;color:#888;margin-left:6px">엣지:</span>' +
    '<div class="legend-item" data-edge="calls"><div class="legend-dot-edge" style="background:#E53935"></div>calls</div>' +
    '<div class="legend-item" data-edge="instantiates"><div class="legend-dot-edge" style="background:#FF9800"></div>instantiates</div>' +
    '<div class="legend-item" data-edge="implements"><div class="legend-dot-edge" style="background:#00BCD4"></div>implements</div>' +
    '<div class="legend-item" data-edge="imports"><div class="legend-dot-edge" style="background:#78909C"></div>imports</div>';
}

// ── 6. HTML ────────────────────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Codegraph Visualizer</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.29.2/cytoscape.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/dagre/0.8.5/dagre.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape-dagre@2.5.0/cytoscape-dagre.min.js"></script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{display:flex;flex-direction:column;height:100vh;font-family:'Segoe UI',sans-serif;background:#1a1a2e;color:#e0e0e0}
header{padding:10px 16px;background:#16213e;border-bottom:1px solid #0f3460;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
header h1{font-size:15px;font-weight:600;color:#e94560;white-space:nowrap}
.stats{font-size:11px;color:#888}
#search{padding:5px 10px;border-radius:4px;border:1px solid #0f3460;background:#0d1b2a;color:#e0e0e0;font-size:12px;width:200px}
#search::placeholder{color:#555}
.controls{display:flex;gap:8px;align-items:center}
select,button{padding:5px 10px;border-radius:4px;border:1px solid #0f3460;background:#0d1b2a;color:#e0e0e0;font-size:11px;cursor:pointer}
button:hover{background:#1a3a5c}
.legend{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.legend-item{display:flex;align-items:center;gap:4px;font-size:10px;cursor:pointer;user-select:none}
.legend-dot-node{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.legend-dot-edge{width:16px;height:2px;flex-shrink:0}
.legend-item.dimmed{opacity:.3}
.main{display:flex;flex:1;overflow:hidden}
#cy{flex:1}
#panel{width:270px;background:#16213e;border-left:1px solid #0f3460;padding:14px;overflow-y:auto;font-size:12px;flex-shrink:0}
#panel h2{font-size:13px;color:#4A90D9;margin-bottom:10px}
.row{margin-bottom:7px}
.lbl{color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
.val{color:#e0e0e0;word-break:break-all;margin-top:2px}
.badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:10px;font-weight:bold;color:#fff}
#nb-list .nb-item{padding:4px 6px;border-radius:3px;margin-bottom:3px;cursor:pointer;font-size:11px;background:#0d1b2a}
#nb-list .nb-item:hover{background:#1a3a5c}
.nb-edge{color:#888;font-size:10px}
#empty-panel{color:#555;font-size:12px;margin-top:20px}
/* Obsidian 슬라이더 스타일 */
input[type=range] { width: 100%; margin-top: 4px; cursor: pointer; accent-color: #4A90D9; }
.range-val { float: right; color: #4A90D9; font-weight: bold; font-size: 11px; }
</style>
</head>
<body>
<header>
  <h1>${titleText}</h1>
  <span class="stats">${statsLine}</span>
  <input id="search" type="text" placeholder="이름 검색...">
  <div class="controls">
    <select id="layout-select">
      <option value="cose" selected>CoSE (포스)</option>
      <option value="obsidian">Obsidian (장력 조절)</option>
      <option value="dagre">Dagre (계층)</option>
      <option value="grid">Grid</option>
      <option value="circle">Circle</option>
      <option value="breadthfirst">BFS</option>
    </select>
    <button id="fit-btn">맞춤</button>
    <button id="reset-btn">초기화</button>
  </div>
  <div class="legend">${legendHtml}</div>
</header>
<div class="main">
  <div id="cy"></div>
  <div id="panel">
    <h2>심볼 상세</h2>
    <div id="empty-panel">노드를 클릭하면<br>상세 정보가 표시됩니다.</div>
    <div id="detail" style="display:none">
      <div class="row"><div class="lbl">이름</div><div class="val" id="d-name"></div></div>
      <div class="row"><div class="lbl">종류</div><span id="d-kind" class="badge"></span></div>
      <div class="row"><div class="lbl">파일</div><div class="val" id="d-file"></div></div>
      <div class="row"><div class="lbl">라인</div><div class="val" id="d-line"></div></div>
      <div class="row" id="d-sig-row"><div class="lbl">시그니처</div><div class="val" id="d-sig"></div></div>
      <div id="neighbors" style="margin-top:10px">
        <div class="lbl" style="margin-bottom:6px">연결 노드</div>
        <div id="nb-list"></div>
      </div>
    </div>
    
    <div id="obsidian-forces" style="display:none; margin-top:25px; border-top:1px solid #0f3460; padding-top:15px;">
      <h2 style="color:#e94560; margin-bottom:12px;">장력 설정</h2>
      <div class="row">
        <div class="lbl">중심 장력 <span id="val-gravity" class="range-val">0.8</span></div>
        <input type="range" id="f-gravity" min="0" max="3" step="0.1" value="0.8">
      </div>
      <div class="row">
        <div class="lbl">반발력 <span id="val-repulsion" class="range-val">8192</span></div>
        <input type="range" id="f-repulsion" min="1000" max="40000" step="500" value="8192">
      </div>
      <div class="row">
        <div class="lbl">링크 장력 <span id="val-elasticity" class="range-val">100</span></div>
        <input type="range" id="f-elasticity" min="10" max="500" step="10" value="100">
      </div>
      <div class="row">
        <div class="lbl">링크 거리 <span id="val-distance" class="range-val">120</span></div>
        <input type="range" id="f-distance" min="10" max="500" step="10" value="120">
      </div>
    </div>
  </div>
</div>
<script>
const GRAPH_DATA=${graphData};
const hiddenKinds=new Set(), hiddenEdges=new Set();
let activeLayout = null;

const cy=cytoscape({
  container:document.getElementById('cy'),
  elements:GRAPH_DATA,
  style:[
    {selector:'node',style:{label:'data(label)','background-color':'data(color)',color:'#fff','font-size':'10px','text-valign':'center','text-halign':'center',width:'label',height:'label',padding:'7px',shape:'roundrectangle','text-wrap':'wrap','text-max-width':'120px','border-width':0}},
    {selector:'node:selected',style:{'border-width':2,'border-color':'#fff'}},
    {selector:'node.highlighted',style:{'border-width':2,'border-color':'#FFD600',opacity:1}},
    {selector:'node.dimmed',style:{opacity:0.12}},
    {selector:'edge',style:{'line-color':'data(color)','target-arrow-color':'data(color)','target-arrow-shape':'triangle','curve-style':'bezier',width:1.5,opacity:0.65,'arrow-scale':0.8}},
    {selector:'edge.dimmed',style:{opacity:0.04}},
    {selector:'edge.highlighted',style:{opacity:1,width:2.5}},
  ],
  wheelSensitivity:0.5, minZoom:0.05, maxZoom:8,
  userZoomingEnabled:true, userPanningEnabled:true,
});

document.getElementById('cy').addEventListener('wheel',e=>e.preventDefault(),{passive:false});

// Obsidian 슬라이더 조작 시 실시간 포스 업데이트
function updateObsidianForces() {
  if (document.getElementById('layout-select').value !== 'obsidian') return;
  
  const g = parseFloat(document.getElementById('f-gravity').value);
  const r = parseInt(document.getElementById('f-repulsion').value);
  const e = parseInt(document.getElementById('f-elasticity').value);
  const d = parseInt(document.getElementById('f-distance').value);

  document.getElementById('val-gravity').innerText = g;
  document.getElementById('val-repulsion').innerText = r;
  document.getElementById('val-elasticity').innerText = e;
  document.getElementById('val-distance').innerText = d;

  if (activeLayout) activeLayout.stop();
  activeLayout = cy.layout({
    name: 'cose',
    animate: true,
    randomize: false, // 기존 위치에서 자연스럽게 시뮬레이션 이동
    fit: false,
    nodeRepulsion: r,
    idealEdgeLength: d,
    edgeElasticity: e,
    gravity: g,
    numIter: 1000,
    refresh: 5
  });
  activeLayout.run();
}

['f-gravity', 'f-repulsion', 'f-elasticity', 'f-distance'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateObsidianForces);
});

function applyLayout(n){
  document.getElementById('obsidian-forces').style.display = (n === 'obsidian') ? 'block' : 'none';
  if (activeLayout) activeLayout.stop();

  if (n === 'obsidian') {
    activeLayout = cy.layout({
      name: 'cose', animate: true, randomize: true, fit: true,
      nodeRepulsion: parseInt(document.getElementById('f-repulsion').value),
      idealEdgeLength: parseInt(document.getElementById('f-distance').value),
      edgeElasticity: parseInt(document.getElementById('f-elasticity').value),
      gravity: parseFloat(document.getElementById('f-gravity').value)
    });
    activeLayout.run();
    return;
  }

  const m={
    cose:{name:'cose',animate:true,animationDuration:400,nodeRepulsion:8192,idealEdgeLength:120},
    dagre:{name:'dagre',rankDir:'TB',animate:true,animationDuration:400},
    grid:{name:'grid',animate:true,animationDuration:300},
    circle:{name:'circle',animate:true,animationDuration:300},
    breadthfirst:{name:'breadthfirst',animate:true,animationDuration:300}
  };
  activeLayout = cy.layout(m[n]||m.cose);
  activeLayout.run();
}

document.getElementById('layout-select').addEventListener('change',e=>applyLayout(e.target.value));

// 초기 레이아웃 실행
applyLayout('cose');

document.getElementById('fit-btn').addEventListener('click',()=>cy.fit(40));
document.getElementById('reset-btn').addEventListener('click',()=>{cy.elements().removeClass('highlighted dimmed');document.getElementById('detail').style.display='none';document.getElementById('empty-panel').style.display='';});
document.getElementById('search').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase().trim();
  cy.elements().removeClass('highlighted dimmed');
  if(!q)return;
  const m=cy.nodes().filter(n=>n.data('label').toLowerCase().includes(q));
  if(!m.length)return;
  cy.elements().addClass('dimmed');
  m.addClass('highlighted').removeClass('dimmed');
  m.connectedEdges().addClass('highlighted').removeClass('dimmed');
  cy.animate({fit:{eles:m,padding:60},duration:400});
});
cy.on('tap','node',e=>{
  const n=e.target,d=n.data();
  document.getElementById('empty-panel').style.display='none';
  document.getElementById('detail').style.display='';
  document.getElementById('d-name').textContent=d.qualifiedName||d.label;
  const b=document.getElementById('d-kind');b.textContent=d.kind;b.style.background=d.color;
  document.getElementById('d-file').textContent=d.file||'-';
  document.getElementById('d-line').textContent=d.line?('L'+d.line+(d.endLine?('-L'+d.endLine):'')):'-';
  const sr=document.getElementById('d-sig-row');
  if(d.signature){document.getElementById('d-sig').textContent=d.signature;sr.style.display='';}else sr.style.display='none';
  const nb=document.getElementById('nb-list');nb.innerHTML='';
  n.connectedEdges().forEach(edge=>{
    const o=edge.source().id()===n.id()?edge.target():edge.source();
    const dir=edge.source().id()===n.id()?'→':'←';
    const div=document.createElement('div');div.className='nb-item';
    div.innerHTML=dir+' <b>'+o.data('label')+'</b> <span class="nb-edge">'+edge.data('kind')+'</span>';
    div.onclick=()=>{cy.animate({center:{eles:o},zoom:cy.zoom()},{duration:300});o.select();};
    nb.appendChild(div);
  });
  cy.elements().addClass('dimmed');
  n.addClass('highlighted').removeClass('dimmed');
  n.connectedEdges().addClass('highlighted').removeClass('dimmed');
  n.neighborhood().nodes().removeClass('dimmed');
});
cy.on('tap',e=>{
  if(e.target!==cy)return;
  cy.elements().removeClass('highlighted dimmed');
  document.getElementById('detail').style.display='none';
  document.getElementById('empty-panel').style.display='';
});
document.querySelectorAll('.legend-item[data-kind]').forEach(el=>{
  el.addEventListener('click',()=>{const k=el.dataset.kind;el.classList.toggle('dimmed');hiddenKinds.has(k)?(hiddenKinds.delete(k),cy.nodes('[kind="'+k+'"]').show()):(hiddenKinds.add(k),cy.nodes('[kind="'+k+'"]').hide());});
});
document.querySelectorAll('.legend-item[data-edge]').forEach(el=>{
  el.addEventListener('click',()=>{const k=el.dataset.edge;el.classList.toggle('dimmed');hiddenEdges.has(k)?(hiddenEdges.delete(k),cy.edges('[kind="'+k+'"]').show()):(hiddenEdges.add(k),cy.edges('[kind="'+k+'"]').hide());});
});
</script>
</body>
</html>`;

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, html, 'utf8');
console.log('[visualize-graph] ✅ ' + OUT_PATH + (DOCS_MODE ? '  [문서 링크 모드]' : ''));
console.log('[visualize-graph]    nodes: ' + cyNodes.length + '  edges: ' + cyEdges.length);