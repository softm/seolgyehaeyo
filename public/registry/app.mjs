import {searchRecords,sourceState,compareRecord,evidenceText} from './core.mjs';
const $=id=>document.getElementById(id); const pageSize=12;
let data=null, found=[], page=0, selected=null, comparison=null, opener=null;
const e=(tag,content,cls)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=content;if(cls)n.className=cls;return n;};
const date=v=>v?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)):'성공 기록 없음';
const link=(label,url)=>{const a=e('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;};
function facts(items){const dl=e('dl',undefined,'facts');for(const [label,value] of items){const row=e('div');row.append(e('dt',label),e('dd',value||'원자료 미제공'));dl.append(row);}return dl;}
function badge(state){return e('span',state.label,'badge '+state.tone);}
function render(){
  const results=$('results');results.replaceChildren();results.setAttribute('aria-busy','false');
  $('result-count').textContent=`${found.length.toLocaleString('ko-KR')}건`;
  if(!found.length){const empty=e('div',undefined,'empty');empty.append(e('h3','이 자료 범위에서는 찾지 못했어요.'),e('p','이름을 짧게 입력하거나 지역·업종·등록번호 조건을 풀어보세요. 다른 지역 자료, 표기 차이, 갱신 시차일 수 있어요.'),e('p','등록번호가 없는 원자료는 번호 검색에 나오지 않습니다. 아래 협회 검색과 관할기관 확인을 함께 이용하세요.'));results.append(empty);}
  for(const r of found.slice(page*pageSize,(page+1)*pageSize)){
    const source=data.sources.find(s=>s.id===r.source_id),card=e('article',undefined,'card'),top=e('div',undefined,'card-top');
    top.append(e('span',r.category,'badge'),badge(sourceState(source)));
    card.append(top,e('h3',r.name),e('p',r.address,'address'),facts([['등록번호',r.registration_no],['대표자',r.representative],['등록기관',r.authority],['자료 기준일',r.dataset_date],['자료 제공',source.publisher]]));
    if(source.scope_warning)card.append(e('p',source.scope_warning,'scope-warning'));
    const actions=e('div',undefined,'card-actions'),b=e('button','이 업체와 대조');b.type='button';b.addEventListener('click',()=>openComparison(r,b));
    actions.append(b,link('공식 원문 ↗',source.url));card.append(actions);results.append(card);
  }
  const pages=Math.max(1,Math.ceil(found.length/pageSize));$('page-number').textContent=`${page+1} / ${pages}`;$('prev').disabled=page===0;$('next').disabled=page+1>=pages;
  const failed=data.sources.filter(s=>s.status==='failed').length;
  $('search-note').textContent=`수집한 자료 안에서 찾은 등록 항목입니다. 동일 업체가 업종별·출처별로 여러 번 나올 수 있어요.${failed?` ${failed}개 출처는 최근 수집에 실패했으니 수집 현황을 확인해 주세요.`:''}`;
}
function search(){if(!data)return;page=0;found=searchRecords(data.records,{q:$('q').value,number:$('number').value,region:$('region').value,category:$('category').value});render();}
function sourceList(){
  const list=$('source-list');list.replaceChildren();
  for(const s of data.sources){const row=e('div',undefined,'source-row'),left=e('div'),right=e('div');left.append(e('h3',s.label),e('p',s.scope),link('자료 출처 ↗',s.url));right.append(badge(sourceState(s)),e('p',`기준일 ${s.dataset_date||'미확인'} · ${s.count||0}건 · 공표 주기 ${s.publisher_cycle||'미확인'}`),e('p',`수집 성공 ${date(s.last_success_at)}`));if(s.last_error)right.append(e('p',s.last_error));row.append(left,right);list.append(row);}
}
async function load(){
  $('load-error').classList.add('hidden');$('results').setAttribute('aria-busy','true');
  try{
    const res=await fetch(new URL('../data/registry.json',import.meta.url),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);
    const next=await res.json();if(next.schema_version!==1||!Array.isArray(next.records)||!Array.isArray(next.sources))throw Error('Invalid schema');
    data=next;for(const id of ['region','category']){const control=$(id);while(control.options.length>1)control.remove(1);const values=[...new Set(data.records.map(r=>r[id]))].sort((a,b)=>a.localeCompare(b,'ko'));values.forEach(v=>{const o=e('option',v);o.value=v;control.append(o);});}
    const scope=[...new Set(data.records.map(r=>r.region))].join(' · ');
    $('coverage').textContent=`검색 범위: ${scope||'아직 수집 성공 없음'} · ${data.count.toLocaleString('ko-KR')}개 등록 항목. 전국 전체 업체 명부가 아닙니다.`;
    sourceList();search();
  }catch(err){data=null;$('load-error').classList.remove('hidden');$('coverage').textContent='자료를 읽지 못해 검색을 제공할 수 없어요.';$('results').replaceChildren();$('result-count').textContent='';$('search-note').textContent='';$('prev').disabled=true;$('next').disabled=true;}
  finally{$('results').setAttribute('aria-busy','false');}
}
function openComparison(r,button){selected=r;comparison=null;opener=button;$('compare-form').reset();$('dialog-title').textContent=r.name;$('comparison').replaceChildren();$('copy-status').textContent='';$('copy-fallback').classList.add('hidden');$('original-link').href=data.sources.find(s=>s.id===r.source_id).url;$('compare-dialog').showModal();$('compare-form').elements.name.focus();}
$('search-form').addEventListener('submit',ev=>{ev.preventDefault();search();});
for(const id of ['region','category'])$(id).addEventListener('change',search);
let debounce;$('q').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(search,180);});$('number').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(search,180);});
$('reset').addEventListener('click',()=>{$('search-form').reset();search();$('q').focus();});
$('prev').addEventListener('click',()=>{page--;render();$('results-title').scrollIntoView({block:'start'});});$('next').addEventListener('click',()=>{page++;render();$('results-title').scrollIntoView({block:'start'});});
$('retry').addEventListener('click',load);$('close-dialog').addEventListener('click',()=>$('compare-dialog').close());$('compare-dialog').addEventListener('close',()=>{opener?.focus();selected=null;comparison=null;$('compare-form').reset();$('copy-fallback').value='';});
$('compare-form').addEventListener('submit',ev=>{
  ev.preventDefault();if(!selected)return;
  const source=data.sources.find(s=>s.id===selected.source_id);comparison=compareRecord(selected,Object.fromEntries(new FormData(ev.target)),source);
  const box=$('comparison');box.replaceChildren(e('h3',comparison.title),badge(comparison.source));
  const table=e('table',undefined,'compare-table'),thead=e('thead'),hr=e('tr');['항목','입력한 정보','공개명부','대조 결과'].forEach(t=>hr.append(e('th',t)));thead.append(hr);table.append(thead);const body=e('tbody');
  const labels={'same':'일치','similar':'법인 표기 유사 · 추가 확인','different':'불일치 · 추가 확인','unavailable':'원자료 미제공','not-entered':'미입력'};
  for(const f of comparison.fields){const tr=e('tr');[f.label,f.provided||'미입력',f.official||'미제공',labels[f.result]].forEach(t=>tr.append(e('td',t)));body.append(tr);}table.append(body);const wrap=e('div',undefined,'compare-table-wrap');wrap.append(table);box.append(wrap,e('p',comparison.caveat,'notice'));
});
$('copy-evidence').addEventListener('click',async()=>{if(!selected)return;const txt=evidenceText(selected,data.sources.find(s=>s.id===selected.source_id),comparison);try{await navigator.clipboard.writeText(txt);$('copy-status').textContent='확인 내용과 질문을 복사했어요. 기록할 곳에 직접 붙여 넣어 주세요.';}catch{$('copy-fallback').value=txt;$('copy-fallback').classList.remove('hidden');$('copy-fallback').select();$('copy-status').textContent='자동 복사 권한이 없어 내용을 펼쳤어요. 선택한 글을 직접 복사해 주세요.';}});
load();
