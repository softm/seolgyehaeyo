#!/usr/bin/env python3
"""Collect allowlisted official files. Failure preserves previous evidence, not certification."""
from __future__ import annotations
import argparse, csv, hashlib, html, io, json, os, re, sys, tempfile, unicodedata
import urllib.request, urllib.parse, zipfile, xml.etree.ElementTree as ET
from datetime import datetime, timezone, date
from pathlib import Path
MAX_BYTES = 12 * 1024 * 1024
ALIASES = {
 'name': ['업체명','상호','사무소명','측량업체명','건축사사무소명','사업장명','사무소명칭'],
 'registration_no': ['등록번호','신고번호','측량업등록번호','사무소등록번호'],
 'category': ['업종','등록업종','업종명','업무구분','업종구분'],
 'address': ['소재지','주소','사무소주소','사업장소재지','소재지도로명주소','도로명주소','사무소소재지'],
 'representative': ['대표자','대표자명','개설자'],
 'phone': ['전화번호','사무소전화번호','업체전화번호','연락처'],
 'authority': ['관리기관명','등록관청','등록기관','관리기관'],
 'authority_phone': ['관리기관전화번호'],
 'dataset_date': ['데이터기준일자','자료기준일','기준일자','데이터기준일'],
 'status_raw': ['등록상태','영업상태','영업구분','영업상태명','폐업여부','상태'],
}
class ValidationError(ValueError): pass

def norm(value):
    return re.sub(r'[^\w가-힣]', '', unicodedata.normalize('NFKC', str(value or ''))).casefold()
def text(value): return re.sub(r'\s+', ' ', str(value or '')).strip()
def iso_date(value):
    m = re.fullmatch(r'(\d{4})[-./]?(\d{2})[-./]?(\d{2})', text(value))
    if not m: return None
    try: return date(*map(int, m.groups())).isoformat()
    except ValueError: return None

def atomic_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':')); f.write('\n')
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def safe_url(url):
    p = urllib.parse.urlparse(url)
    if p.scheme != 'https' or p.hostname not in {'www.data.go.kr', 'data.go.kr'} or p.username or p.password or p.port not in (None,443):
        raise ValidationError('허용되지 않은 출처 주소')
    return url
class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)
def get(url):
    req = urllib.request.Request(safe_url(url), headers={'User-Agent': 'SeolgyehaeyoRegistry/1.0 (+https://github.com/softm/seolgyehaeyo)'})
    with urllib.request.build_opener(SafeRedirect).open(req, timeout=35) as res:
        raw = res.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES: raise ValidationError('파일 크기 한도 초과')
        return raw

def metadata(page):
    # Some publishers put unescaped quotes inside JSON-LD descriptions; never eval.
    blocks = re.findall(r'<script[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>', page, re.S|re.I)
    candidates = []
    for block in blocks:
        for u in re.findall(r'"contentUrl"\s*:\s*"([^"<>]+)"', block):
            u = html.unescape(u.replace('\\/', '/'))
            safe_url(u)
            if urllib.parse.urlparse(u).path == '/cmm/cmm/fileDownload.do': candidates.append(u)
    if len(set(candidates)) != 1: raise ValidationError('원문 파일 주소가 없거나 여러 개입니다. 출처 검토 필요')
    visible = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', ' ', page, flags=re.S|re.I)
    plain = text(html.unescape(re.sub(r'<[^>]+>', ' ', visible)))
    if '이용허락범위 제한 없음' not in plain:
        raise ValidationError('자동 재배포가 허용된 이용조건을 확인하지 못했습니다')
    title = re.search(r'<title[^>]*>(.*?)</title>', page, re.S|re.I)
    title = text(html.unescape(title.group(1))) if title else ''
    dates = re.findall(r'_(\d{8})(?:\b|\s|\|)', title)
    base_date = iso_date(dates[-1]) if dates else None
    cycle = re.search(r'업데이트 주기\s+(연간|월간|분기|반기|수시|일간|1회성)', plain)
    count = re.search(r'전체 행\s+([\d,]+)', plain)
    modified = re.search(r'수정일\s+(\d{4}-\d{2}-\d{2})', plain)
    return {'download_url': candidates[0], 'dataset_date':base_date, 'title':title,
            'publisher_cycle':cycle.group(1) if cycle else '원문 확인',
            'expected_rows':int(count.group(1).replace(',','')) if count else None,
            'published_modified_at':modified.group(1) if modified else None,
            'license':'이용허락범위 제한 없음'}

def xlsx_rows(raw):
    ns = {'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        if sum(i.file_size for i in z.infolist()) > 40*1024*1024: raise ValidationError('압축 해제 크기 초과')
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            strings=[''.join(n.itertext()) for n in root.findall('m:si',ns)]
        sheets=sorted(n for n in z.namelist() if re.fullmatch(r'xl/worksheets/sheet\d+\.xml',n))
        if not sheets: raise ValidationError('워크시트 없음')
        for sheet in sheets:
            table=[]
            for row in ET.fromstring(z.read(sheet)).findall('.//m:sheetData/m:row',ns):
                cells={}
                for c in row.findall('m:c',ns):
                    if c.find('m:f',ns) is not None: raise ValidationError('수식 셀은 담당자 검토 필요')
                    letters=re.sub(r'\d','',c.attrib.get('r','A'))
                    col=0
                    for letter in letters: col=col*26+ord(letter)-64
                    v=c.find('m:v',ns)
                    value=v.text if v is not None else ''
                    if c.get('t')=='s': value=strings[int(value)]
                    if c.get('t')=='inlineStr': value=''.join(c.find('m:is',ns).itertext())
                    cells[col-1]=value or ''
                table.append((int(row.get('r',len(table)+1)),[cells.get(i,'') for i in range(max(cells,default=0)+1)]))
            yield sheet,table

def tables(raw):
    if raw[:2]==b'PK':
        yield from xlsx_rows(raw); return
    if raw[:8]==bytes.fromhex('D0CF11E0A1B11AE1'): raise ValidationError('구형 XLS는 XLSX/CSV 변환 후 검토 필요')
    decoded=None
    for encoding in ('utf-8-sig','cp949'):
        try: decoded=raw.decode(encoding); break
        except UnicodeDecodeError: continue
    if decoded is None or '<html' in decoded[:500].lower() or '<!doctype' in decoded[:500].lower():
        raise ValidationError('다운로드 응답이 CSV/XLSX가 아닙니다')
    parsed=list(csv.reader(io.StringIO(decoded)))
    yield 'CSV',list(enumerate(parsed,1))

def parse(raw, source, meta):
    mapped=[]
    name_alias={norm(x) for x in ALIASES['name']}
    for sheet,table in tables(raw):
        header_index=next((i for i,(_,r) in enumerate(table[:25]) if any(norm(c) in name_alias for c in r)),None)
        if header_index is None: raise ValidationError('업체명 열을 찾지 못했습니다: '+sheet)
        headers=table[header_index][1]
        keys=[norm(h) for h in headers]
        if len(set(k for k in keys if k)) != len([k for k in keys if k]): raise ValidationError('중복 열 이름')
        for row_number,values in table[header_index+1:]:
            if not any(text(v) for v in values):continue
            cells=dict(zip(keys,values))
            r={field:next((text(cells.get(norm(k))) for k in aliases if text(cells.get(norm(k)))), '') for field,aliases in ALIASES.items()}
            if not r['name'] or not r['address']: raise ValidationError('업체명/주소 누락 행: '+str(row_number))
            r['category']=r['category'] or source.get('category','')
            if r['category'] in ('일반측량','공공측량','지적측량'):r['category']+='업'
            if not r['category']:raise ValidationError('업종 누락: '+str(row_number))
            r['dataset_date']=iso_date(r['dataset_date']) or meta.get('dataset_date')
            if not r['dataset_date']:raise ValidationError('자료 기준일 확인 불가')
            if r['dataset_date']>date.today().isoformat():raise ValidationError('미래 자료 기준일')
            r['authority']=r['authority'] or ''
            r.update(source_id=source['id'],region=source['region'],kind=source['kind'],source_row=row_number,source_sheet=sheet,source_refs=[{'sheet':sheet,'row':row_number}])
            identity='|'.join([source['id'],norm(r['category']),norm(r['authority']),norm(r['registration_no']) or norm(r['name'])+'|'+norm(r['address'])])
            r['record_key']=hashlib.sha256(identity.encode()).hexdigest()[:24]
            mapped.append(r)
    if not mapped: raise ValidationError('사용 가능한 행이 없습니다')
    if len(mapped)<source.get('min_rows',1): raise ValidationError('기대 최소 건수 미달')
    if meta.get('expected_rows') is not None and len(mapped)!=meta['expected_rows']:
        raise ValidationError(f"원문 공표 행수({meta['expected_rows']})와 파일 행수({len(mapped)}) 불일치")
    # 동일한 공식 행이 여러 번 실린 경우 하나의 검색 항목으로 합칩니다.
    # 같은 식별자에 서로 다른 공식 값이 있으면 자동으로 고르지 않고 수집을 중단합니다.
    seen={}
    for r in mapped:
        key=r['record_key']
        if key not in seen:
            seen[key]=r
            continue
        prev=seen[key]
        conflicts=[field for field in ALIASES if text(prev.get(field)) != text(r.get(field))]
        if conflicts:
            raise ValidationError('동일 식별자의 상충 행: '+key+' ('+','.join(conflicts)+')')
        prev.setdefault('source_refs',[{'sheet':prev.get('source_sheet'),'row':prev.get('source_row')}]).extend(r.get('source_refs',[]))
    return list(seen.values())

def validate_previous(records, previous):
    old=previous.get('records',[])
    if old and len(records)<len(old)*0.7: raise ValidationError('이전 정상본 대비 30% 이상 행 감소; 검토 전 유지')
    if old and min(r['dataset_date'] for r in records)<min(r['dataset_date'] for r in old):
        raise ValidationError('자료 기준일이 이전 정상본보다 과거입니다')

def collect(config_path, output, raw_dir):
    config=json.loads(config_path.read_text())
    old=json.loads(output.read_text()) if output.exists() else {}
    prior={s['id']:s for s in old.get('sources',[])}
    old_records=old.get('records',[])
    now=datetime.now(timezone.utc).isoformat(timespec='seconds')
    records=[];sources=[];failed=0
    for src in config['sources']:
        if not re.fullmatch('[a-z0-9][a-z0-9-]{1,64}',src['id']):raise ValidationError('잘못된 source_id')
        prev=prior.get(src['id'],{})
        previous_records=[r for r in old_records if r['source_id']==src['id']]
        state={**prev,**src,'last_attempt_at':now}
        try:
            page_raw=get(src['url']);page=page_raw.decode('utf-8');meta=metadata(page)
            raw=get(meta['download_url']);digest=hashlib.sha256(raw).hexdigest()
            current=parse(raw,src,meta)
            validate_previous(current,{'records':previous_records})
            before={r['record_key']:r for r in previous_records};after={r['record_key']:r for r in current}
            fields=list(ALIASES)
            diff={'added':len(after.keys()-before.keys()),'missing_from_latest':len(before.keys()-after.keys()),
                  'changed':sum(any(before[k].get(f)!=after[k].get(f) for f in fields) for k in before.keys()&after.keys())}
            state.update(meta,status='success',last_success_at=now,file_sha256=digest,
                         dataset_date=min(r['dataset_date'] for r in current),count=len(current),raw_count=meta.get('expected_rows') or len(current),
                         duplicate_rows_collapsed=sum(max(0,len(r.get('source_refs',[]))-1) for r in current),
                         last_error=None,diff=diff,registration_number_count=sum(bool(r['registration_no']) for r in current),
                         scope_warning=src.get('scope_note') if any('청주시' in r['address'] for r in current) else None)
            d=raw_dir/src['id'];d.mkdir(parents=True,exist_ok=True)
            ext='xlsx' if raw[:2]==b'PK' else 'csv'
            (d/(digest+'.'+ext)).write_bytes(raw)
            atomic_json(d/(digest+'.meta.json'),state)
            records.extend(current)
            print(src['id'],len(current),state['dataset_date'],flush=True)
        except Exception as exc:
            failed+=1
            state.update(status='failed',last_error=f'{type(exc).__name__}: {str(exc)[:240]}',count=len(previous_records))
            state.setdefault('last_success_at',None)
            records.extend(previous_records)
            print(src['id'],'FAILED',state['last_error'],file=sys.stderr,flush=True)
        sources.append(state)
    result={'schema_version':1,'generated_at':now,'schedule':config['schedule'],
            'coverage':'수집에 성공한 공식 공개 파일만 포함. 전국 전체 업체 명부가 아닙니다.',
            'sources':sources,'manual_sources':config['manual_sources'],'count':len(records),'records':records}
    atomic_json(output,result)
    return failed
if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--config',type=Path,default=Path('config/registry-sources.json'))
    p.add_argument('--out',type=Path,default=Path('public/data/registry.json'))
    p.add_argument('--raw-dir',type=Path,default=Path('registry-raw'))
    a=p.parse_args();failures=collect(a.config,a.out,a.raw_dir)
    sys.exit(2 if failures else 0)
