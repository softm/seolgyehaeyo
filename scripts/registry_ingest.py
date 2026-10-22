#!/usr/bin/env python3
"""Normalize official registry spreadsheets; never infer legal registration from absence.
Usage: python scripts/registry_ingest.py --file source.xlsx --source-id city-2026 --out data/registry
XLSX requires openpyxl; CSV uses Python standard library. No network access.
"""
import argparse, csv, hashlib, json, re
from datetime import datetime, timezone
from pathlib import Path

ALIASES = {
    "name": ["업체명", "상호", "사무소명", "측량업체명", "건축사사무소명"],
    "registration_no": ["등록번호", "신고번호", "측량업등록번호"],
    "category": ["업종", "등록업종", "업종명", "업무구분"],
    "address": ["소재지", "주소", "사무소주소", "사업장소재지"],
    "representative": ["대표자", "대표자명", "개설자"],
    "status": ["등록상태", "상태", "영업상태"],
}
def normalize(s):
    return re.sub(r"\s+", "", str(s or "")).casefold()
def rows(path):
    if path.suffix.lower() == ".csv":
        for enc in ("utf-8-sig", "cp949"):
            try:
                with path.open(encoding=enc, newline="") as f:
                    yield from csv.DictReader(f)
                return
            except UnicodeDecodeError:
                continue
        raise ValueError("CSV encoding unsupported")
    if path.suffix.lower() != ".xlsx":
        raise ValueError("Only .csv and .xlsx are supported; convert legacy .xls first")
    from openpyxl import load_workbook
    wb = load_workbook(path, read_only=True, data_only=True)
    for sheet in wb:
        iterator = sheet.values
        headers = next(iterator, None)
        if not headers:
            continue
        headers = [str(h or "") for h in headers]
        for values in iterator:
            yield dict(zip(headers, values))
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--file", required=True)
    p.add_argument("--source-id", required=True)
    p.add_argument("--source-url", default="")
    p.add_argument("--dataset-date", default="")
    p.add_argument("--out", default="data/registry")
    a = p.parse_args()
    source = Path(a.file)
    if not source.is_file():
        p.error("source file missing")
    raw = source.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    mapped = []
    for row in rows(source):
        norm_keys = {normalize(k): v for k, v in row.items()}
        record = {field: next((norm_keys[normalize(k)] for k in aliases if normalize(k) in norm_keys), None)
                  for field, aliases in ALIASES.items()}
        if not record["name"]:
            continue
        record = {k: str(v).strip() if v is not None else "" for k, v in record.items()}
        record["source_id"] = a.source_id
        record["record_key"] = hashlib.sha256(
            (a.source_id + "|" + (normalize(record["registration_no"]) or normalize(record["name"])+"|"+normalize(record["address"]))).encode()
        ).hexdigest()[:24]
        mapped.append(record)
    if not mapped:
        raise SystemExit("No usable rows: source headers must be mapped; old data preserved")
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    dest = out / (a.source_id + ".json")
    old = json.loads(dest.read_text(encoding="utf-8")) if dest.exists() else {}
    prev = {r["record_key"]: r for r in old.get("records", [])}
    now = {r["record_key"]: r for r in mapped}
    diff = {"added": len(now.keys()-prev.keys()), "missing_from_latest": len(prev.keys()-now.keys()),
            "changed": sum(prev[k] != now[k] for k in prev.keys() & now.keys())}
    result = {"source_id": a.source_id, "source_url": a.source_url, "dataset_date": a.dataset_date,
              "collected_at": datetime.now(timezone.utc).isoformat(), "file_name": source.name,
              "file_sha256": digest, "count": len(mapped), "diff": diff, "records": mapped,
              "caution": "Missing from latest file does not prove deregistration; confirm with competent authority."}
    temp = dest.with_suffix(".tmp")
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    temp.replace(dest)
    print(json.dumps({"output": str(dest), "count": len(mapped), "diff": diff}, ensure_ascii=False))
if __name__ == "__main__":
    main()
