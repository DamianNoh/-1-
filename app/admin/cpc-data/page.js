'use client';
import { useEffect, useState } from 'react';

function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function CpcDataPage() {
  const [workcenters, setWorkcenters] = useState([]);
  const [entries, setEntries] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const [wcCode, setWcCode] = useState('');
  const [wcLabel, setWcLabel] = useState('');

  const [form, setForm] = useState({ date: todayStr(), workcenterId: '', description: '', totalCpc: '', flight: '', salesNo: '', customerName: '' });
  const [formMsg, setFormMsg] = useState('');

  async function loadWorkcenters() {
    const wcs = await fetch('/api/workcenters').then((r) => r.json());
    setWorkcenters(wcs);
    if (!form.workcenterId && wcs[0]) setForm((f) => ({ ...f, workcenterId: wcs[0].id }));
  }
  async function loadEntries() {
    const list = await fetch('/api/cpc-entries?limit=100').then((r) => r.json());
    setEntries(list);
  }

  useEffect(() => { loadWorkcenters(); loadEntries(); }, []); // eslint-disable-line

  async function addWorkcenter(e) {
    e.preventDefault();
    if (!wcCode || !wcLabel) return;
    await fetch('/api/workcenters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: wcCode, label: wcLabel })
    });
    setWcCode(''); setWcLabel('');
    loadWorkcenters();
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadMsg('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/cpc-entries/upload', { method: 'POST', body: fd });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) {
      setUploadMsg('오류: ' + (json.error || '업로드 실패'));
      return;
    }
    setUploadMsg(`완료: ${json.rangeStart} ~ ${json.rangeEnd} 기간 기존 ${json.deletedCount}건 교체, ${json.createdCount}건 등록`);
    loadWorkcenters();
    loadEntries();
  }

  async function submitManual(e) {
    e.preventDefault();
    setFormMsg('');
    const res = await fetch('/api/cpc-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const j = await res.json();
      setFormMsg(j.error || '저장 실패');
      return;
    }
    setForm((f) => ({ ...f, description: '', totalCpc: '', flight: '', salesNo: '', customerName: '' }));
    loadEntries();
  }

  async function removeEntry(id) {
    if (!confirm('이 데이터를 삭제할까요?')) return;
    await fetch(`/api/cpc-entries/${id}`, { method: 'DELETE' });
    loadEntries();
  }

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>CPC 원본 데이터</h1>
          <p>매달 원본 핸들링 엑셀을 업로드하거나, 개별 항목을 직접 입력할 수 있습니다. 업로드 시 같은 기간의 기존 데이터는 새 데이터로 교체됩니다.</p>
        </div>
      </div>

      <div className="grid-sub">
        <div className="card">
          <div className="card-title">엑셀 업로드</div>
          <div className="card-desc">Date, Workcenter, Description, Total Cpc(또는 Final CPC) 열이 포함된 엑셀 (기존 "원본데이터" 시트와 동일 형식)</div>
          <form onSubmit={handleUpload}>
            <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: 12 }} />
            <div>
              <button className="btn" type="submit" disabled={uploading || !file}>{uploading ? '업로드 중...' : '업로드'}</button>
            </div>
          </form>
          {uploadMsg && <div style={{ fontSize: 12.5, marginTop: 10, color: uploadMsg.startsWith('오류') ? '#dc2626' : '#16a34a' }}>{uploadMsg}</div>}
        </div>

        <div className="card">
          <div className="card-title">워크센터 관리</div>
          <div className="card-desc">P1/P2/P3에 해당하는 워크센터 목록 (새 워크센터도 여기서 추가 가능)</div>
          <form onSubmit={addWorkcenter} className="form-grid" style={{ marginBottom: 14 }}>
            <label>코드 (엑셀의 Workcenter 열 값과 동일해야 함)
              <input value={wcCode} onChange={(e) => setWcCode(e.target.value)} placeholder="예: P1-BAR Packing" />
            </label>
            <label>표시 이름
              <input value={wcLabel} onChange={(e) => setWcLabel(e.target.value)} placeholder="예: 베버리지" />
            </label>
            <button className="btn ghost" type="submit">추가</button>
          </form>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {workcenters.map((wc) => (
              <div key={wc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: wc.color, display: 'inline-block' }} />
                <b>{wc.label}</b><span style={{ color: '#767b8a' }}>({wc.code})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">수동 입력</div>
        <form onSubmit={submitManual} className="form-grid" style={{ alignItems: 'end' }}>
          <label>날짜
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>워크센터
            <select value={form.workcenterId} onChange={(e) => setForm({ ...form, workcenterId: e.target.value })}>
              {workcenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.label}</option>)}
            </select>
          </label>
          <label>디스크립션
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="예: OZ 102 HANDLING..." />
          </label>
          <label>Total CPC
            <input type="number" step="0.01" value={form.totalCpc} onChange={(e) => setForm({ ...form, totalCpc: e.target.value })} />
          </label>
          <label>편명 (선택)
            <input value={form.flight} onChange={(e) => setForm({ ...form, flight: e.target.value })} />
          </label>
          <label>고객사 (선택)
            <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          </label>
          <button className="btn" type="submit">추가</button>
        </form>
        {formMsg && <div style={{ color: '#dc2626', fontSize: 12.5 }}>{formMsg}</div>}
      </div>

      <div className="card">
        <div className="card-title">최근 데이터 (최대 100건)</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>워크센터</th>
                <th>디스크립션</th>
                <th className="num">Total CPC</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toISOString().slice(0, 10)}</td>
                  <td>{e.workcenter?.label}</td>
                  <td>{e.description}</td>
                  <td className="num">{e.totalCpc}</td>
                  <td><button className="btn danger" onClick={() => removeEntry(e.id)}>삭제</button></td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5} style={{ color: '#767b8a' }}>데이터가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
