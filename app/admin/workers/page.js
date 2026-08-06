'use client';
import { useEffect, useState } from 'react';

export default function WorkersPage() {
  const [workcenters, setWorkcenters] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState('');
  const [workcenterId, setWorkcenterId] = useState('');
  const [employmentType, setEmploymentType] = useState('FULLTIME');
  const [msg, setMsg] = useState('');

  async function load() {
    const [wcs, ws] = await Promise.all([
      fetch('/api/workcenters').then((r) => r.json()),
      fetch('/api/workers').then((r) => r.json())
    ]);
    setWorkcenters(wcs);
    setWorkers(ws);
    if (!workcenterId && wcs[0]) setWorkcenterId(wcs[0].id);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function addWorker(e) {
    e.preventDefault();
    if (!name || !workcenterId) return;
    setMsg('');
    const res = await fetch('/api/workers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, workcenterId, employmentType })
    });
    if (!res.ok) {
      const j = await res.json();
      setMsg(j.error || '추가 실패');
      return;
    }
    setName('');
    load();
  }

  async function removeWorker(id) {
    if (!confirm('이 근무자를 비활성화할까요? (과거 이력은 유지됩니다)')) return;
    await fetch(`/api/workers/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>근무자 관리</h1>
          <p>워크센터별 근무자 명단을 등록합니다. 정규직/파트타임 구분은 기본 스케줄 화면에서 활용됩니다.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">근무자 추가</div>
        <form onSubmit={addWorker} className="form-grid" style={{ alignItems: 'end' }}>
          <label>이름
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
          </label>
          <label>워크센터
            <select value={workcenterId} onChange={(e) => setWorkcenterId(e.target.value)}>
              {workcenters.map((wc) => <option key={wc.id} value={wc.id}>{wc.label} ({wc.code})</option>)}
            </select>
          </label>
          <label>고용형태
            <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              <option value="FULLTIME">정규직</option>
              <option value="PARTTIME">파트타임</option>
            </select>
          </label>
          <button className="btn" type="submit">추가</button>
        </form>
        {msg && <div style={{ color: '#dc2626', fontSize: 12.5 }}>{msg}</div>}
      </div>

      <div className="card">
        <div className="card-title">근무자 목록 ({workers.length}명)</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>워크센터</th>
                <th>고용형태</th>
                <th>기본 스케줄 요일 수</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td>{w.name}</td>
                  <td>{w.workcenter?.label}</td>
                  <td>{w.employmentType === 'PARTTIME' ? '파트타임' : '정규직'}</td>
                  <td>{w.weeklySchedules?.length || 0}일</td>
                  <td><button className="btn danger" onClick={() => removeWorker(w.id)}>비활성화</button></td>
                </tr>
              ))}
              {workers.length === 0 && <tr><td colSpan={5} style={{ color: '#767b8a' }}>등록된 근무자가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
