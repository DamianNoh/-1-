import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '../../../../lib/db';

export const runtime = 'nodejs';

// 헤더 이름 후보 (엑셀마다 표기가 조금씩 다를 수 있어 유연하게 매칭)
const HEADER_ALIASES = {
  date: ['date', '일자', '날짜'],
  workcenter: ['workcenter', '워크센터'],
  description: ['description', '디스크립션'],
  totalCpc: ['total cpc', 'final cpc', 'totalcpc', 'finalcpc'],
  flight: ['flight', '편명'],
  salesNo: ['sales no', 'salesno'],
  customerName: ['customer name', 'customername', '고객사']
};

function normalize(s) {
  return String(s || '').trim().toLowerCase();
}

function buildHeaderIndex(headerRow) {
  const idx = {};
  headerRow.forEach((h, i) => {
    const norm = normalize(h);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm) && idx[key] === undefined) {
        idx[key] = i;
      }
    }
  });
  return idx;
}

function excelDateToJs(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // 엑셀 시리얼 날짜 (1900 날짜 시스템 기준)
    const utcDays = Math.floor(value - 25569);
    const ms = utcDays * 86400 * 1000;
    return new Date(ms);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!file) {
    return NextResponse.json({ error: '업로드할 엑셀 파일(file)이 없습니다.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: true });

  const sheetName = workbook.SheetNames.includes('원본데이터') ? '원본데이터' : workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  if (!rows.length) {
    return NextResponse.json({ error: '엑셀에 데이터가 없습니다.' }, { status: 400 });
  }

  const headerIdx = buildHeaderIndex(rows[0]);
  const missing = ['date', 'workcenter', 'description', 'totalCpc'].filter((k) => headerIdx[k] === undefined);
  if (missing.length) {
    return NextResponse.json(
      { error: `필수 열을 찾지 못했습니다: ${missing.join(', ')} (헤더 행을 확인해주세요)` },
      { status: 400 }
    );
  }

  const parsed = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const dateVal = excelDateToJs(row[headerIdx.date]);
    const wcCode = row[headerIdx.workcenter];
    const description = row[headerIdx.description];
    const totalCpc = Number(row[headerIdx.totalCpc]);
    if (!dateVal || !wcCode || !description || isNaN(totalCpc)) continue;

    parsed.push({
      date: dateVal,
      workcenterCode: String(wcCode).trim(),
      description: String(description).trim(),
      totalCpc,
      flight: headerIdx.flight !== undefined ? String(row[headerIdx.flight] ?? '') || null : null,
      salesNo: headerIdx.salesNo !== undefined ? String(row[headerIdx.salesNo] ?? '') || null : null,
      customerName: headerIdx.customerName !== undefined ? String(row[headerIdx.customerName] ?? '') || null : null
    });
  }

  if (!parsed.length) {
    return NextResponse.json({ error: '유효한 데이터 행을 찾지 못했습니다.' }, { status: 400 });
  }

  // 워크센터 코드 -> id 매핑 (없으면 자동 생성)
  const uniqueCodes = Array.from(new Set(parsed.map((p) => p.workcenterCode)));
  const existing = await prisma.workcenter.findMany({ where: { code: { in: uniqueCodes } } });
  const codeToId = new Map(existing.map((w) => [w.code, w.id]));
  const missingCodes = uniqueCodes.filter((c) => !codeToId.has(c));
  if (missingCodes.length) {
    const currentCount = await prisma.workcenter.count();
    for (let i = 0; i < missingCodes.length; i++) {
      const created = await prisma.workcenter.create({
        data: { code: missingCodes[i], label: missingCodes[i], sortOrder: currentCount + i + 1 }
      });
      codeToId.set(created.code, created.id);
    }
  }

  const dates = parsed.map((p) => p.date.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  const result = await prisma.$transaction(async (tx) => {
    // 같은 기간 재업로드 시 중복 방지: 해당 기간 기존 데이터는 삭제 후 새로 삽입
    const deleted = await tx.cpcEntry.deleteMany({
      where: { date: { gte: minDate, lte: maxDate } }
    });
    const created = await tx.cpcEntry.createMany({
      data: parsed.map((p) => ({
        date: p.date,
        workcenterId: codeToId.get(p.workcenterCode),
        description: p.description,
        totalCpc: p.totalCpc,
        flight: p.flight,
        salesNo: p.salesNo,
        customerName: p.customerName
      }))
    });
    return { deletedCount: deleted.count, createdCount: created.count };
  });

  return NextResponse.json({
    ok: true,
    rangeStart: minDate.toISOString().slice(0, 10),
    rangeEnd: maxDate.toISOString().slice(0, 10),
    ...result
  });
}
