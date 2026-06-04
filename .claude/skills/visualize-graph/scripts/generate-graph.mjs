/**
 * generate-graph.mjs  (visualize-graph skill bundled script)
 *
 * codegraph.db → docs/codegraph-viz.html
 *
 * 전략: method 레벨 calls/instantiates 엣지를 부모 class/interface/struct/enum 로 집계
 *       → 클래스 의존성 그래프 (class-to-class dependency graph)
 *
 * 사용법 (프로젝트 루트에서):
 *   node <skill-scripts-path>/generate-graph.mjs [options]
 *
 * 옵션:
 *   --methods        method 노드 포함 (기본: class/interface/struct/enum 만)
 *   --out <path>     출력 HTML 경로 (기본: docs/codegraph-viz.html)
 *   --db  <path>     DB 경로 (기본: .codegraph/codegraph.db)
 */

import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname }         from 'node:path';

const args        = process.argv.slice(2);
const SHOW_METHODS = args.includes('--methods');

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

// ── 2. contains 엣지로 부모 맵 구성 ───────────────────────────────────────────
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

// ── 3. 표시할 노드 결정 ────────────────────────────────────────────────────────
const TYPE_KINDS = SHOW_METHODS
  ? ['class','interface','struct','enum','method']
  : ['class','interface','struct','enum'];

const displayNodes = allNodes.filter(n => TYPE_KINDS.includes(n.kind));
const displayIds   = new Set(displayNodes.map(n => n.id));

// ── 4. 집계 엣지 생성 ─────────────────────────────────────────────────────────
const EDGE_KINDS  = ['calls','instantiates','implements','imports'];
const rawEdges    = db.prepare(
  'SELECT source, target, kind FROM edges WHERE kind IN (' + EDGE_KINDS.map(()=>'?').join(',') + ')'
).all(...EDGE_KINDS);

const edgeSet  = new Set();
const aggEdges = [];
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

// ── 5. Cytoscape.js 데이터 변환 ───────────────────────────────────────────────
const KIND_COLOR = {
  class:     '#4A90D9',
  interface: '#00BCD4',
  struct:    '#4CAF50',
  enum:      '#FF9800',
  method:    '#9C27B0',
};
const EDGE_COLOR = {
  calls:        '#E53935',
  instantiates: '#FF9800',
  implements:   '#00BCD4',
  imports:      '#78909C',
};
const shortFile = p => p ? p.split('/').pop() : '';

const cyNodes = displayNodes.map(n => ({
  data: {
    id:            n.id,
    label:         n.name,
    kind:          n.kind,
    qualifiedName: n.qualified_name || n.name,
    file:          n.file_path || '',
    shortFile:     shortFile(n.file_path),
    line:          n.start_line || 0,
    endLine:       n.end_line   || 0,
    signature:     n.signature  || '',
    visibility:    n.visibility || '',
    color:         KIND_COLOR[n.kind] || '#78909C',
  }
}));
const cyEdges = aggEdges.map((e,i) => ({
  data: { id:'e'+i, source:e.source, target:e.target, kind:e.kind, color:EDGE_COLOR[e.kind]||'#BDBDBD' }
}));

const graphData  = JSON.stringify({ nodes: cyNodes, edges: cyEdges });
const statsLine  = cyNodes.length + ' nodes · ' + cyEdges.length + ' edges (집계)';
const methodFlag = SHOW_METHODS ? '<div class="legend-item" data-kind="method"><div class="legend-dot-node" style="background:#9C27B0"></div>Method</div>' : '';

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
</style>
</head>
<body>
<header>
  <h1>⬡ Codegraph Visualizer</h1>
  <span class="stats">${statsLine}</span>
  <input id="search" type="text" placeholder="심볼 이름 검색...">
  <div class="controls">
    <select id="layout-select">
      <option value="cose" selected>CoSE (포스)</option>
      <option value="dagre">Dagre (계층)</option>
      <option value="grid">Grid</option>
      <option value="circle">Circle</option>
      <option value="breadthfirst">BFS</option>
    </select>
    <button id="fit-btn">맞춤</button>
    <button id="reset-btn">초기화</button>
  </div>
  <div class="legend">
    <span style="font-size:10px;color:#888">노드:</span>
    <div class="legend-item" data-kind="class"><div class="legend-dot-node" style="background:#4A90D9"></div>Class</div>
    <div class="legend-item" data-kind="interface"><div class="legend-dot-node" style="background:#00BCD4"></div>Interface</div>
    <div class="legend-item" data-kind="struct"><div class="legend-dot-node" style="background:#4CAF50"></div>Struct</div>
    <div class="legend-item" data-kind="enum"><div class="legend-dot-node" style="background:#FF9800"></div>Enum</div>
    ${methodFlag}
    <span style="font-size:10px;color:#888;margin-left:6px">엣지:</span>
    <div class="legend-item" data-edge="calls"><div class="legend-dot-edge" style="background:#E53935"></div>calls</div>
    <div class="legend-item" data-edge="instantiates"><div class="legend-dot-edge" style="background:#FF9800"></div>instantiates</div>
    <div class="legend-item" data-edge="implements"><div class="legend-dot-edge" style="background:#00BCD4"></div>implements</div>
    <div class="legend-item" data-edge="imports"><div class="legend-dot-edge" style="background:#78909C"></div>imports</div>
  </div>
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
  </div>
</div>
<script>
const GRAPH_DATA=${graphData};
const hiddenKinds=new Set(), hiddenEdges=new Set();
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
  layout:{name:'cose',animate:false,randomize:true,nodeRepulsion:8192,idealEdgeLength:120,gravity:0.8},
  wheelSensitivity:0.5, minZoom:0.05, maxZoom:8,
  userZoomingEnabled:true, userPanningEnabled:true,
});
document.getElementById('cy').addEventListener('wheel',e=>e.preventDefault(),{passive:false});
function applyLayout(n){
  const m={cose:{name:'cose',animate:true,animationDuration:400,nodeRepulsion:8192,idealEdgeLength:120},dagre:{name:'dagre',rankDir:'TB',animate:true,animationDuration:400},grid:{name:'grid',animate:true,animationDuration:300},circle:{name:'circle',animate:true,animationDuration:300},breadthfirst:{name:'breadthfirst',animate:true,animationDuration:300}};
  cy.layout(m[n]||m.cose).run();
}
document.getElementById('layout-select').addEventListener('change',e=>applyLayout(e.target.value));
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
  document.getElementById('d-line').textContent=d.line?('L'+d.line+'-L'+d.endLine):'-';
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
console.log('[visualize-graph] ✅ ' + OUT_PATH);
console.log('[visualize-graph]    nodes: ' + cyNodes.length + '  edges: ' + cyEdges.length);
