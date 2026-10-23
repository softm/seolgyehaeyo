/** Matching describes data alignment, never legal eligibility. */
export function normal(value='') { return String(value??'').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[\s\p{P}\p{S}]/gu,''); }
export function companyName(value='') { return normal(String(value).normalize('NFKC').replace(/주식회사|유한책임회사|유한회사|\(\s*주\s*\)/g,'')); }
export function searchRecords(records, {q='',number='',region='',category=''}={}) {
 const words=String(q).trim().split(/\s+/).filter(Boolean).map(normal),no=normal(number);
 return records.filter(r=>(!region||r.region===region)&&(!category||r.category===category)&&(!no||(r.registration_no&&normal(r.registration_no)===no))&&words.every(w=>[r.name,r.address,r.representative,r.registration_no].some(v=>normal(v).includes(w)))).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.category.localeCompare(b.category,'ko')||a.record_key.localeCompare(b.record_key));
}
export function sourceState(source,today=new Date()) {
 if(!source?.last_success_at)return {tone:'danger',label:'수집되지 않은 자료'};
 if(source.status==='failed')return {tone:'amber',label:'최근 수집 실패 · 이전 자료'};
 const age=source.dataset_date?Math.floor((today.getTime()-Date.parse(source.dataset_date+'T00:00:00Z'))/86400000):null;
 if(age===null||!Number.isFinite(age))return {tone:'amber',label:'자료 기준일 미확인'};
 if(age>source.max_age_days)return {tone:'amber',label:`오래된 자료 · ${age}일 경과`};
 return {tone:'neutral',label:'기준일의 공개명부 수록'};
}
export function compareRecord(record,claimed,source,today=new Date()) {
 const labels={name:'업체명',registration_no:'등록번호',category:'업종',authority:'등록기관',address:'주소'};
 const fields=Object.entries(labels).map(([key,label])=>{
  const provided=String(claimed[key]??'').trim(),official=String(record[key]??'').trim();
  let result=!provided?'not-entered':!official?'unavailable':normal(provided)===normal(official)?'same':'different';
  if(key==='name'&&result==='different'&&companyName(provided)===companyName(official))result='similar';
  return {key,label,provided,official,result};
 });
 const by=Object.fromEntries(fields.map(f=>[f.key,f.result])),conflicts=fields.filter(f=>f.result==='different');
 const strong=by.registration_no==='same'&&by.category==='same'&&by.authority==='same';
 const code=conflicts.length?'mismatch':strong?'identifiers-match':fields.some(f=>f.result==='same'||f.result==='similar')?'partial':'insufficient';
 const titles={'mismatch':'서로 다른 항목이 있어요','identifiers-match':'등록 식별정보가 일치해요','partial':'일부 정보만 대조했어요','insufficient':'대조할 정보가 더 필요해요'};
 return {code,title:titles[code],fields,source:sourceState(source,today),caveat:'동일 업체·현재 영업·행정처분·실제 담당자 자격은 별도 확인이 필요합니다. 명부 일치가 업무 품질이나 안전을 보장하지 않습니다.'};
}
export function evidenceText(record,source,comparison) {
 const lines=['설계해요 · 공개명부 대조 기록',`업체: ${record.name}`,`업종: ${record.category}`,`등록번호: ${record.registration_no||'원자료 미제공'}`,`주소: ${record.address}`,`원자료 영업/등록 상태: ${record.status_raw||'원자료 미제공'}`,`제공기관: ${source.publisher}`,`자료 기준일: ${record.dataset_date}`,`마지막 수집 성공: ${source.last_success_at||'없음'}`,`원문: ${source.url}`,`원본 SHA-256: ${source.file_sha256||'없음'}`,`원본 행: ${record.source_sheet} ${record.source_row}${record.source_refs?.length>1?` (동일 공식행 ${record.source_refs.length}개를 하나로 표시)`:''}`];
 if(comparison)lines.push(`대조: ${comparison.title}`,...comparison.fields.map(f=>`${f.label}: ${f.result} (입력: ${f.provided||'미입력'} / 원문: ${f.official||'미제공'})`));
 lines.push('확인 질문: 현재 등록·영업 상태와 업무를 실제로 수행하고 책임지는 담당자를 알려주세요. 등록증의 업종·번호·등록기관·상호·주소가 최신 자료와 일치하는지 확인 부탁드립니다.','이 기록은 공식 증명서나 무등록·사기 판정이 아닙니다.');return lines.join('\n');
}
