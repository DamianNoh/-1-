'use client';
import { useEffect, useState } from 'react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthRangeOf(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

const PAGE_SIZE = 50;

function Pager({ page, setPage, total }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
      <button className="btn ghost" type="button" disabled={page <= 0} onClick={() => setPage(page - 1)}>이전</button>
      <span style={{ fontSize: 12.5, color: '#767b8a' }}>{page + 1} / {totalPages} 페이지 (총 {total}건)</span>
      <button className="btn ghost" type="button" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>다음</button>
    </div>
  );
}

export default function ShiftEntryPage() {
  const [workcenters, setWorkcenters] = useState([]);
  const [shiftTypes, setShiftTypes] = useState([]);
  const [workcenterId, setWorkcenterId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [counts, setCounts] = useState({}); // shiftTypeId -> headcount string
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState([]);
  const [hasExisting, setHasExisting] = useState(false);

  const [overheadCounts, setOverheadCounts] = useState({}); // shiftTypeId -> headcount string
  const [overheadOvertimeHours, setOverheadOvertimeHours] = useState('0');
  const [overheadMsg, setOverheadMsg] = useState('');
  const [overheadSaving, setOverheadSaving] = useState(false);
  const [overheadSummary, setOverheadSummary] = useState([]);
  const [hasExistingOverhead, setHasExistingOverhead] = useState(false);

  const defaultRange = monthRangeOf(todayStr());
  const [summaryStart, setSummaryStart] = useState(defaultRange.start);
  const [summaryEnd, setSummaryEnd] = useState(defaultRange.end);
  const [summaryWcFilter, setSummaryWcFilter] = useState('');
  const [summaryPage, setSummaryPage] = useState(0);
  const [overheadPage, setOverheadPage] = useState(0);

  const [rosterFile, setRosterFile] = useState(null);
  const [rosterUploading, setRosterUploading] = useState(false);
  const [rosterMsg, setRosterMsg] = useState('');
  const [rosterResult, setRosterResult] = useState(null);

  async function loadMasters() {
    const [wcs, sts] = await Promise.all([
      fetch('/api/workcenters').then((r) => r.json()),
      fetch('/api/shift-types').then((r) => r.json())
    ]);
    setWorkcenters(wcs);
    setShiftTypes(sts);
    if (!workcenterId && wcs[0]) setWorkcenterId(wcs[0].id);
  }

  async function loadEntry() {
    if (!workcenterId || !date) return;
    const json = await fetch(`/api/shift-entries?date=${date}&workcenterId=${workcenterId}`).then((r) => r.json());
    const next = {};
    (json.shiftCounts || []).forEach((sc) => { next[sc.shiftTypeId] = String(sc.headcount || ''); });
    setCounts(next);
    setOvertimeHours(String(json.overtimeHours || 0));
    const hasData = (json.shiftCounts || []).some((sc) => sc.headcount > 0) || (json.overtimeHours || 0) > 0;
    setHasExisting(hasData);
  }

  async function loadSummary() {
    if (!summaryStart || !summaryEnd) return;
    const list = await fetch(`/api/shift-entries?start=${summaryStart}&end=${summaryEnd}`).then((r) => r.json());
    setSummary(list);
  }

  async function loadOverhead() {
    if (!date) return;
    const json = await fetch(`/api/overhead-entries?date=${date}`).then((r) => r.json());
    const next = {};
    (json.shiftCounts || []).forEach((sc) => { next[sc.shiftTypeId] = String(sc.headcount || ''); });
    setOverheadCounts(next);
    setOverheadOvertimeHours(String(json.overtimeHours || 0));
    const hasData = (json.shiftCounts || []).some((sc) => sc.headcount > 0) || (json.overtimeHours || 0) > 0;
    setHasExistingOverhead(hasData);
  }

  async function loadOverheadSummary() {
    if (!summaryStart || !summaryEnd) return;
    const list = await fetch(`/api/overhead-entries?start=${summaryStart}&end=${summaryEnd}`).then((r) => r.json());
    setOverheadSummary(list);
  }

  async function uploadRoster(e) {
    e.preventDefault();
    if (!rosterFile) return;
    setRosterUploading(true);
    setRosterMsg('');
    setRosterResult(null);
    try {
      const fd = new FormData();
      fd.append('file', rosterFile);
      const res = await fetch('/api/shift-entries/roster-upload', { method: 'POST', body: fd });
      let json = null;
      try { json = await res.json(); } catch { json = null; }
      if (!res.ok || !json || !json.ok) {
        setRosterMsg((json && json.error) || '업로드 처리 중 오류가 발생했습니다.');
        return;
      }
      setRosterMsg(
        `완료: ${json.rangeStart} ~ ${json.rangeEnd} 기간 워크센터 ${json.deletedWc}건 교체 → ${json.createdWc}건 등록, 관리 인력 ${json.deletedOverhead}건 교체 → ${json.createdOverhead}건 등록`
      );
      setRosterResult(json);
      loadEntry();
      loadOverhead();
      loadSummary();
      loadOverheadSummary();
    } catch (err) {
      setRosterMsg('업로드 처리 중 오류가 발생했습니다: ' + (err && err.message ? err.message : String(err)));
    } finally {
      setRosterUploading(false);
    }
  }

  useEffect(() => { loadMasters(); }, []); // eslint-disable-line
  useEffect(() => { loadEntry(); }, [workcenterId, date]); // eslint-disable-line
  useEffect(() => { loadOverhead(); }, [date]); // eslint-disable-line
  useEffect(() => { loadSummary(); loadOverheadSummary(); }, [summaryStart, summaryEnd]); // eslint-disable-line
  useEffect(() => { setSummaryPage(0); }, [summaryStart, summaryEnd, summaryWcFilter]);
  useEffect(() => { setOverheadPage(0); }, [summaryStart, summaryEnd]);

  const filteredSummary = summaryWcFilter ? summary.filter((s) => s.workcenterId === summaryWcFilter) : summary;
  const pagedSummary = filteredSummary.slice(summaryPage * PAGE_SIZE, summaryPage * PAGE_SIZE + PAGE_SIZE);
  const pagedOverheadSummary = overheadSummary.slice(overheadPage * PAGE_SIZE, overheadPage * PAGE_SIZE + PAGE_SIZE);

  async function saveOverhead(e) {
    e.preventDefault();
    if (hasExistingOverhead && !confirm('이미 입력된 관리 인력 내용이 있습니다. 수정하시겠습니까?')) return;
    setOverheadSaving(true);
    setOverheadMsg('');
    const countsPayload = {};
    shiftTypes.forEach((st) => { countsPayload[st.id] = Number(overheadCounts[st.id] || 0); });
    const res = await fetch('/api/overhead-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, counts: countsPayload, overtimeHours: Number(overheadOvertimeHours || 0) })
    });
    setOverheadSaving(false);
    if (!res.ok) {
      const j = await res.json();
      setOverheadMsg(j.error || '저장 실패');
      return;
    }
    setOverheadMsg('저장했습니다.');
    setHasExistingOverhead(true);
    loadOverheadSummary();
  }

  const overheadTotalHeadcount = shiftTypes.reduce((sum, st) => sum + (Number(overheadCounts[st.id]) || 0), 0);
  const overheadTotalShiftHours = shiftTypes.reduce((sum, st) => sum + (Number(overheadCounts[st.id]) || 0) * st.hours, 0);
  const overheadTotalHours = overheadTotalShiftHours + (Number(overheadOvertimeHours) || 0);

  async function save(e) {
    e.preventDefault();
    if (hasExisting && !confirm('이미 입력된 내용이 있습니다. 수정하시겠습니까?')) return;
    setSaving(true);
    setMsg('');
    const countsPayload = {};
    shiftTypes.forEach((st) => { countsPayload[st.id] = Number(counts[st.id] || 0); });
    const res = await fetch('/api/shift-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, workcenterId, counts: countsPayload, overtimeHours: Number(overtimeHours || 0) })
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json();
      setMsg(j.error || '저장 실패');
      return;
    }
    setMsg('저장했습니다.');
    setHasExisting(true);
    loadSummary();
  }

  const totalHeadcount = shiftTypes.reduce((sum, st) => sum + (Number(counts[st.id]) || 0), 0);
  const totalShiftHours = shiftTypes.reduce((sum, st) => sum + (Number(counts[st.id]) || 0) * st.hours, 0);
  const totalHours = totalShiftHours + (Number(overtimeHours) || 0);

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>근무 인원 입력</h1>
          <p>날짜 · 워크센터별로 시프트 코드마다 배치된 인원 수와 그날의 연장근무 합계 시간을 입력합니다. 개인별 등록 없이 인원수만 관리합니다.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">근무표 엑셀 업로드</div>
        <div className="card-desc">회사에서 쓰는 "근무_마감" 형식의 원본 근무표 엑셀을 그대로 업로드하면, 부서별 "일일 투입인원" 요약 행을 읽어서 워크센터(P1/P3/P4)와 관리 인력의 시프트별 인원수를 자동으로 채워줍니다. 벌크&러너는 P4(컨테이너)로 합쳐지고, OAL은 자동으로 제외됩니다. 연장근무 시간은 이 업로드에 포함되지 않으니 아래에서 별도로 입력해주세요. 같은 기간의 기존 입력 내역은 새로 덮어쓰기 됩니다.</div>
        <form onSubmit={uploadRoster} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: rosterMsg ? 12 : 0 }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setRosterFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
          />
          <button className="btn" type="submit" disabled={!rosterFile || rosterUploading}>
            {rosterUploading ? '업로드 중...' : '업로드'}
          </button>
        </form>
        {rosterMsg && <div style={{ fontSize: 12.5, color: rosterResult ? '#16a34a' : '#dc2626', marginBottom: rosterResult ? 12 : 0 }}>{rosterMsg}</div>}
        {rosterResult && rosterResult.deptReport && rosterResult.deptReport.length > 0 && (
          <div className="table-scroll" style={{ maxHeight: 220 }}>
            <table>
              <thead>
                <tr><th>부서(파트)</th><th>반영 위치</th></tr>
              </thead>
              <tbody>
                {rosterResult.deptReport.map((d, i) => (
                  <tr key={i}><td>{d.label}</td><td>{d.routedTo}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rosterResult && rosterResult.missingWc && rosterResult.missingWc.length > 0 && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>워크센터 매핑을 찾지 못한 코드: {rosterResult.missingWc.join(', ')} (워크센터 관리에서 코드에 P번호가 포함되어 있는지 확인해주세요)</div>
        )}
        {rosterResult && rosterResult.missingShiftType && rosterResult.missingShiftType.length > 0 && (
          <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>시프트 코드 매핑을 찾지 못한 코드: {rosterResult.missingShiftType.join(', ')} (시프트 코드 관리에서 먼저 등록해주세요)</div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <select value={workcenterId} onChange={(e) => setWorkcenterId(e.target.value)}>
            {workcenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.label} ({wc.code})</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {shiftTypes.length === 0 && (
          <div style={{ color: '#767b8a', fontSize: 13 }}>먼저 "시프트 코드 관리"에서 시프트 코드를 등록해주세요.</div>
        )}

        {shiftTypes.length > 0 && (
          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))`, gap: 10, marginBottom: 16 }}>
              {shiftTypes.map((st) => (
                <label key={st.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#767b8a', fontWeight: 600, minWidth: 0 }}>
                  {st.code} ({st.startTime}~{st.endTime})
                  <input
                    type="number"
                    min="0"
                    value={counts[st.id] ?? ''}
                    onChange={(e) => setCounts({ ...counts, [st.id]: e.target.value })}
                    placeholder="0"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #ecedf1' }}
                  />
                </label>
              ))}
            </div>
            <div className="form-grid" style={{ maxWidth: 260, marginBottom: 16 }}>
              <label>연장근무 합계 시간
                <input type="number" step="0.5" min="0" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} />
              </label>
            </div>
            <div style={{ fontSize: 12.5, color: '#767b8a', marginBottom: 14 }}>
              합계 인원 <b style={{ color: '#1a1d29' }}>{totalHeadcount}명</b> · 합계 근무시간 <b style={{ color: '#1a1d29' }}>{totalHours}시간</b> (시프트 {totalShiftHours}시간 + 연장 {Number(overtimeHours) || 0}시간)
            </div>
            <button className="btn" type="submit" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
            {msg && <span style={{ marginLeft: 12, fontSize: 12.5, color: '#16a34a' }}>{msg}</span>}
          </form>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">관리 인력 입력</div>
        <div className="card-desc">특정 워크센터에 속하지 않는 관리업무 인력(실장/매니저/반장 등)도 근무자와 동일하게 시프트 코드별 인원수로 입력합니다. 워크센터 구분은 없고, 대시보드의 "전체 1인당 CPC"에 반영됩니다.</div>
        <div className="badge" style={{ display: 'inline-block', marginBottom: 16 }}>선택한 날짜: {date} (위 날짜 선택과 동일하게 적용됩니다)</div>

        {shiftTypes.length > 0 && (
          <form onSubmit={saveOverhead}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(110px, 1fr))`, gap: 10, marginBottom: 16 }}>
              {shiftTypes.map((st) => (
                <label key={st.id} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#767b8a', fontWeight: 600, minWidth: 0 }}>
                  {st.code} ({st.startTime}~{st.endTime})
                  <input
                    type="number"
                    min="0"
                    value={overheadCounts[st.id] ?? ''}
                    onChange={(e) => setOverheadCounts({ ...overheadCounts, [st.id]: e.target.value })}
                    placeholder="0"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid #ecedf1' }}
                  />
                </label>
              ))}
            </div>
            <div className="form-grid" style={{ maxWidth: 260, marginBottom: 16 }}>
              <label>연장근무 합계 시간
                <input type="number" step="0.5" min="0" value={overheadOvertimeHours} onChange={(e) => setOverheadOvertimeHours(e.target.value)} />
              </label>
            </div>
            <div style={{ fontSize: 12.5, color: '#767b8a', marginBottom: 14 }}>
              합계 인원 <b style={{ color: '#1a1d29' }}>{overheadTotalHeadcount}명</b> · 합계 근무시간 <b style={{ color: '#1a1d29' }}>{overheadTotalHours}시간</b> (시프트 {overheadTotalShiftHours}시간 + 연장 {Number(overheadOvertimeHours) || 0}시간)
            </div>
            <button className="btn" type="submit" disabled={overheadSaving}>{overheadSaving ? '저장 중...' : '저장'}</button>
            {overheadMsg && <span style={{ marginLeft: 12, fontSize: 12.5, color: '#16a34a' }}>{overheadMsg}</span>}
          </form>
        )}
      </div>

      <div className="card">
        <div className="card-title">입력 내역 조회</div>
        <div className="card-desc">조회 기간과 워크센터를 골라서 이미 입력된 내역을 확인합니다.</div>
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 12.5, color: '#767b8a', fontWeight: 600 }}>시작일</span>
          <input type="date" value={summaryStart} onChange={(e) => setSummaryStart(e.target.value)} />
          <span style={{ fontSize: 12.5, color: '#767b8a', fontWeight: 600 }}>종료일</span>
          <input type="date" value={summaryEnd} onChange={(e) => setSummaryEnd(e.target.value)} />
          <select value={summaryWcFilter} onChange={(e) => setSummaryWcFilter(e.target.value)}>
            <option value="">전체 워크센터</option>
            {workcenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.label} ({wc.code})</option>)}
          </select>
        </div>

        <div className="card-title" style={{ fontSize: 13, marginBottom: 8 }}>워크센터별 입력 내역</div>
        <div className="table-scroll" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>워크센터</th>
                <th className="num">합계 인원</th>
                <th className="num">합계 근무시간</th>
                <th className="num">연장근무</th>
              </tr>
            </thead>
            <tbody>
              {pagedSummary.map((s, i) => (
                <tr key={i}>
                  <td>{s.date}</td>
                  <td>{s.workcenterLabel}</td>
                  <td className="num">{s.totalHeadcount}명</td>
                  <td className="num">{s.totalHours}시간</td>
                  <td className="num">{s.overtimeHours}시간</td>
                </tr>
              ))}
              {filteredSummary.length === 0 && <tr><td colSpan={5} style={{ color: '#767b8a' }}>선택한 기간에 입력 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={summaryPage} setPage={setSummaryPage} total={filteredSummary.length} />

        <div className="card-title" style={{ fontSize: 13, marginBottom: 8, marginTop: 24 }}>관리 인력 입력 내역</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th className="num">합계 인원</th>
                <th className="num">합계 근무시간</th>
                <th className="num">연장근무</th>
              </tr>
            </thead>
            <tbody>
              {pagedOverheadSummary.map((o, i) => (
                <tr key={i}>
                  <td>{o.date}</td>
                  <td className="num">{o.totalHeadcount}명</td>
                  <td className="num">{o.totalHours}시간</td>
                  <td className="num">{o.overtimeHours}시간</td>
                </tr>
              ))}
              {overheadSummary.length === 0 && <tr><td colSpan={4} style={{ color: '#767b8a' }}>선택한 기간에 입력 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager page={overheadPage} setPage={setOverheadPage} total={overheadSummary.length} />
      </div>
    </div>
  );
}
