import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '../../../../lib/db';
import { excelDateToStr, looksLikeDateSerial } from '../../../../lib/excelDate';

export const runtime = 'nodejs';

// "26.07월근무표" 같은 근무 계획표 엑셀 전용 업로드.
// 이 파일은 부서(파트)별로 근무자 명단이 구간으로 나뉘어 있고, 각 구간 끝에
// "일일 투입인원 <근무표 코드>" 라는 요약 행 7개(AA/AS/A/AN/N/P/D)가 있어서
// 그 안에 날짜별 배치 인원수가 이미 계산되어 있습니다. 이 요약 행만 읽어서
// 워크센터별(P1/P3/P4) + 관리 인력 시프트 인원수로 자동 반영합니다.
// 연장근무 시간은 이 업로드에서 다루지 않습니다 (관리 화면에서 직접 입력).

const SHIFT_CODE_ORDER = ['AA', 'AS', 'A', 'AN', 'N', 'P', 'D'];

function normalizeLabel(s) {
  return String(s || '').replace(/\s+/g, '').toUpperCase();
}

// 부서(파트) 라벨을 워크센터/관리인력으로 분류합니다.
// 필요에 따라 이 목록에 키워드를 추가하면 새로운 부서명도 인식됩니다.
function classifyDept(label) {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  if (norm.includes('OAL')) return { skip: true };
  if (norm.includes('베버리지')) return { pcode: 'P1' };
  if (norm.includes('헤드셋')) return { pcode: 'P3' };
  if (
    norm.includes('컨테이너') ||
    norm.includes('드로워') ||
    norm.includes('메뉴카드') ||
    norm.includes('벌크') ||
    norm.includes('러너') ||
    norm.includes('DRYITEM') ||
    norm.includes('SLIPPER') ||
    norm.includes('CAPT')
  ) {
    return { pcode: 'P4' };
  }
  return { overhead: true };
}

function extractShiftCode(cellText) {
  const m = /^([A-Z]{1,3})\s*\(/.exec(String(cellText || '').trim());
  return m ? m[1] : null;
}

export async function POST(req) {
  try {
    return await handleUpload(req);
  } catch (err) {
    console.error('근무표 업로드 처리 중 오류:', err);
    return NextResponse.json(
      { error: '업로드 처리 중 서버 오류가 발생했습니다: ' + (err && err.message ? err.message : String(err)) },
      { status: 500 }
    );
  }
}

async function handleUpload(req) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!file) {
    return NextResponse.json({ error: '업로드할 엑셀 파일(file)이 없습니다.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'buffer', cellDates: false });

  const sheetName = workbook.SheetNames.find((n) => n.includes('근무표')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

  if (!rows.length) {
    return NextResponse.json({ error: '엑셀에 데이터가 없습니다.' }, { status: 400 });
  }

  // 1) 날짜 헤더 행 찾기: 7번째 열(인덱스 6) 이후 날짜처럼 보이는 셀이 가장 많은 행
  let headerRowIdx = -1;
  let bestCount = 0;
  rows.forEach((row, i) => {
    if (!row) return;
    let count = 0;
    for (let c = 6; c < row.length; c++) {
      if (looksLikeDateSerial(row[c])) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      headerRowIdx = i;
    }
  });

  if (headerRowIdx === -1 || bestCount === 0) {
    return NextResponse.json(
      { error: '날짜 헤더 행을 찾지 못했습니다. "근무표" 형식의 엑셀 파일이 맞는지 확인해주세요.' },
      { status: 400 }
    );
  }

  const headerRow = rows[headerRowIdx];
  const dateCols = []; // [{ col, dateStr }]
  for (let c = 6; c < headerRow.length; c++) {
    if (looksLikeDateSerial(headerRow[c])) {
      const dateStr = excelDateToStr(headerRow[c]);
      if (dateStr) dateCols.push({ col: c, dateStr });
    } else if (dateCols.length > 0) {
      break; // 날짜 열 구간이 끝나고 다른 요약 열(근무일/휴무 등)이 시작됨
    }
  }

  if (!dateCols.length) {
    return NextResponse.json({ error: '날짜 열을 인식하지 못했습니다.' }, { status: 400 });
  }

  // 2) 부서 구간 + "일일 투입인원" 요약 행 파싱
  // key: 'P1'|'P3'|'P4'|'OVERHEAD' + '|' + dateStr + '|' + shiftCode -> 인원수 합계
  const agg = new Map();
  const deptReportMap = new Map(); // 부서 라벨 -> 분류 결과 (요약 리포트용)
  let currentDept = null;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    if (row[1] === '총원' || row[1] === '구분') continue; // 반복되는 헤더 행은 건너뜀 (부서명으로 오인식 방지)
    const deptCell = row[3];
    const codeCell = row[4];

    if (currentDept === null && deptCell != null && String(deptCell).trim() !== '') {
      currentDept = String(deptCell).trim();
    }

    const shiftCode = extractShiftCode(codeCell);
    if (shiftCode && SHIFT_CODE_ORDER.includes(shiftCode)) {
      const target = classifyDept(currentDept);
      deptReportMap.set(currentDept || '(부서 미상)', target);

      if (target && !target.skip) {
        for (const { col, dateStr } of dateCols) {
          const v = row[col];
          const headcount = typeof v === 'number' ? v : Number(v);
          if (!isFinite(headcount)) continue;
          const bucket = target.overhead ? 'OVERHEAD' : target.pcode;
          const key = bucket + '|' + dateStr + '|' + shiftCode;
          agg.set(key, (agg.get(key) || 0) + headcount);
        }
      }

      if (shiftCode === 'D') {
        // 이 부서 구간의 마지막 코드까지 처리했으니 다음 부서를 위해 초기화
        currentDept = null;
      }
    }
  }

  if (agg.size === 0) {
    return NextResponse.json(
      { error: '인식된 근무 인원 데이터가 없습니다. 파일 형식을 확인해주세요.' },
      { status: 400 }
    );
  }

  // 3) 워크센터/시프트코드 매핑 준비
  const workcenters = await prisma.workcenter.findMany();
  const wcByPCode = new Map();
  for (const wc of workcenters) {
    const m = /P\s*-?\s*(\d+)/i.exec(wc.code);
    if (m) wcByPCode.set('P' + m[1], wc.id);
  }
  const shiftTypes = await prisma.shiftType.findMany();
  const shiftTypeIdByCode = new Map(shiftTypes.map((st) => [st.code, st.id]));

  const missingWc = [];
  const missingShiftType = new Set();
  const wcRows = [];
  const overheadRows = [];

  for (const [key, headcount] of agg.entries()) {
    const [bucket, dateStr, shiftCode] = key.split('|');
    const shiftTypeId = shiftTypeIdByCode.get(shiftCode);
    if (!shiftTypeId) {
      missingShiftType.add(shiftCode);
      continue;
    }
    const date = new Date(dateStr + 'T00:00:00Z');
    if (bucket === 'OVERHEAD') {
      overheadRows.push({ date, shiftTypeId, headcount });
    } else {
      const workcenterId = wcByPCode.get(bucket);
      if (!workcenterId) {
        if (!missingWc.includes(bucket)) missingWc.push(bucket);
        continue;
      }
      wcRows.push({ date, workcenterId, shiftTypeId, headcount });
    }
  }

  const allDates = dateCols.map((d) => d.dateStr).sort();
  const rangeStart = allDates[0];
  const rangeEnd = allDates[allDates.length - 1];
  const rangeStartDate = new Date(rangeStart + 'T00:00:00Z');
  const rangeEndDate = new Date(rangeEnd + 'T00:00:00Z');
  const workcenterIdsInFile = Array.from(new Set(wcRows.map((u) => u.workcenterId)));

  const result = await prisma.$transaction(
    async (tx) => {
      let deletedWc = 0, createdWc = 0, deletedOverhead = 0, createdOverhead = 0;

      if (wcRows.length) {
        const del = await tx.shiftCount.deleteMany({
          where: {
            date: { gte: rangeStartDate, lte: rangeEndDate },
            workcenterId: { in: workcenterIdsInFile }
          }
        });
        deletedWc = del.count;
        const created = await tx.shiftCount.createMany({ data: wcRows });
        createdWc = created.count;
      }

      if (overheadRows.length) {
        const del = await tx.overheadShiftCount.deleteMany({
          where: { date: { gte: rangeStartDate, lte: rangeEndDate } }
        });
        deletedOverhead = del.count;
        const created = await tx.overheadShiftCount.createMany({ data: overheadRows });
        createdOverhead = created.count;
      }

      return { deletedWc, createdWc, deletedOverhead, createdOverhead };
    },
    { timeout: 30000, maxWait: 10000 }
  );

  const deptReport = Array.from(deptReportMap.entries()).map(([label, target]) => {
    let routedTo = '건너뜀';
    if (target) {
      if (target.skip) routedTo = '건너뜀 (OAL)';
      else if (target.overhead) routedTo = '관리 인력';
      else routedTo = target.pcode;
    }
    return { label, routedTo };
  });

  return NextResponse.json({
    ok: true,
    rangeStart,
    rangeEnd,
    ...result,
    deptReport,
    missingWc,
    missingShiftType: Array.from(missingShiftType)
  });
}
