import unittest, importlib.util, io, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('collector',Path(__file__).parents[1]/'scripts/collect_registry.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
S={'id':'test-source','region':'가상도','kind':'survey','min_rows':1}
M={'dataset_date':'2026-03-31'}
CSV='업체명,등록번호,업종,주소\n시험업체,02-001,일반측량,가상도 가상시\n'
class Tests(unittest.TestCase):
 def test_csv(self):
  r=c.parse(CSV.encode('utf-8-sig'),S,M)[0];self.assertEqual(r['registration_no'],'02-001');self.assertEqual(r['category'],'일반측량업');self.assertEqual(r['source_row'],2)
 def test_cp949(self):self.assertEqual(len(c.parse(CSV.encode('cp949'),S,M)),1)
 def test_title_header(self):self.assertEqual(c.parse(('자료설명\n\n'+CSV).encode(),S,M)[0]['source_row'],4)
 def test_html(self):
  with self.assertRaises(c.ValidationError):c.parse(b'<html>blocked</html>',S,M)
 def test_no_name(self):
  with self.assertRaises(c.ValidationError):c.parse('성명,금액\n누구,30'.encode(),S,M)
 def test_dup(self):
  rows=c.parse((CSV+'시험업체,02-001,일반측량,가상도 가상시\n').encode(),S,M)
  self.assertEqual(len(rows),1);self.assertEqual(len(rows[0]['source_refs']),2)
 def test_conflicting_dup(self):
  raw='업체명,등록번호,업종,주소,대표자\n시험업체,02-001,일반측량,가상도 가상시,갑\n시험업체,02-001,일반측량,가상도 가상시,을\n'
  with self.assertRaises(c.ValidationError):c.parse(raw.encode(),S,M)
 def test_multiple_categories(self):self.assertEqual(len(c.parse((CSV+'시험업체,02-001,공공측량,가상도 가상시\n').encode(),S,M)),2)
 def test_business_status_alias(self):
  raw='업체명,주소,업종,영업구분\n시험업체,가상도 가상시,건축사사무소,영업중\n'
  self.assertEqual(c.parse(raw.encode(),S,M)[0]['status_raw'],'영업중')
 def test_count(self):
  with self.assertRaises(c.ValidationError):c.parse(CSV.encode(),S,{**M,'expected_rows':2})
 def test_drop(self):
  with self.assertRaises(c.ValidationError):c.validate_previous([{'dataset_date':'2026-03-31'}],{'records':[{'dataset_date':'2026-03-31'}]*10})
 def test_date_regression(self):
  with self.assertRaises(c.ValidationError):c.validate_previous([{'dataset_date':'2025-01-01'}],{'records':[{'dataset_date':'2026-01-01'}]})
 def test_allowlist(self):
  for url in ['http://www.data.go.kr/','https://data.go.kr.evil.test/','https://evil.test/','https://user@data.go.kr/','https://data.go.kr:8443/']:
   with self.assertRaises(c.ValidationError):c.safe_url(url)
 def test_jsonld_malformed_description(self):
  page='<title>자료_20260331 | 공공데이터</title><script type="application/ld+json">{"description":""잘못된인용"","distribution":[{"contentUrl":"https://www.data.go.kr/cmm/cmm/fileDownload.do?id=1"}]}</script>이용허락범위 제한 없음 업데이트 주기 연간 전체 행 1'
  self.assertEqual(c.metadata(page)['dataset_date'],'2026-03-31')
 def test_missing_license(self):
  with self.assertRaises(c.ValidationError):c.metadata('<script type="application/ld+json">{"contentUrl":"https://www.data.go.kr/cmm/cmm/fileDownload.do?id=1"}</script>')
 def test_xlsx(self):
  b=io.BytesIO()
  xml='''<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>업체명</t></is></c><c r="B1" t="inlineStr"><is><t>주소</t></is></c><c r="C1" t="inlineStr"><is><t>업종</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>시험업체</t></is></c><c r="B2" t="inlineStr"><is><t>가상시</t></is></c><c r="C2" t="inlineStr"><is><t>일반측량</t></is></c></row></sheetData></worksheet>'''
  with zipfile.ZipFile(b,'w') as z:z.writestr('xl/worksheets/sheet1.xml',xml)
  self.assertEqual(c.parse(b.getvalue(),S,M)[0]['name'],'시험업체')
if __name__=='__main__':unittest.main()
