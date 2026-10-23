import {sourceState} from './core.mjs';
const e=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined)n.textContent=txt;if(cls)n.className=cls;return n;};
const dt=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'없음';
function link(label,url){const a=e('a',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
try{
 const r=await fetch(new URL('../data/registry.json',import.meta.url),{cache:'no-store'});if(!r.ok)throw Error('자료 응답 실패');const d=await r.json();
 const latest=d.sources.map(s=>s.last_success_at).filter(Boolean).sort().at(-1),metrics=document.getElementById('metrics');
 for(const [label,value,highlight] of [['수집 예약 주기',d.schedule.label,true],['마지막 수집 성공',dt(latest),true],['검색 가능한 등록 항목',d.count.toLocaleString('ko-KR')+'건',false]]){const box=e('div',undefined,'metric'+(highlight?' highlight':''));box.append(e('span',label),e('strong',value));metrics.append(box);}
 const status=document.getElementById('status');status.replaceChildren();
 for(const s of d.sources){const box=e('article',undefined,'status-source');const state=sourceState(s);box.append(e('h2',s.label),e('span',state.label,'badge '+state.tone));
  const dl=e('dl',undefined,'facts');for(const [k,v] of [['수집 범위',s.scope],['자료 기준일',s.dataset_date||'미확인'],['원문 수정일',s.published_modified_at||'미확인'],['공표 주기',s.publisher_cycle||'미확인'],['마지막 시도',dt(s.last_attempt_at)],['마지막 성공',dt(s.last_success_at)],['반영 건수',String(s.count||0)],['원문 행',String(s.raw_count||s.count||0)],['동일행 합침',String(s.duplicate_rows_collapsed||0)],['등록번호 제공',String(s.registration_number_count||0)+'건'],['수집 결과',s.status==='success'?'정상':'실패 · 이전 자료 유지'],['최근 오류',s.last_error||'없음'],['이용 조건',s.license||'미확인']]){const row=e('div');row.append(e('dt',k),e('dd',v));dl.append(row);}box.append(dl);if(s.scope_warning)box.append(e('p',s.scope_warning,'notice'));if(s.diff)box.append(e('p',`직전 수집 대비 추가 ${s.diff.added} · 내용 변경 ${s.diff.changed} · 최신 명부 미확인 ${s.diff.missing_from_latest} (말소 판정 아님)`));box.append(e('p','원본 SHA-256'),e('code',s.file_sha256||'원본 수집 전'),e('br'),link('공식 자료와 다운로드 페이지 ↗',s.url));status.append(box);
 }
 for(const s of d.manual_sources){const a=link(s.label+' ↗',s.url);a.append(e('span',s.reason));document.getElementById('manual').append(a);}
}catch(error){document.getElementById('status').textContent='수집 기록을 불러오지 못했어요. 성공·실패 여부를 판단할 수 없습니다. 페이지를 새로고침해 주세요.';}
