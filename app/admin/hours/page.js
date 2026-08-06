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

export default function HoursPage() {
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [scheduledHours, setScheduledHours] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [present, setPresent] = useState(true);
  const [note, setNote] = useState('');
  const [entries, setEntries] = useState([]);
  const [msg, setMsg] = useState('');

  async function loadWorkers() {
    const ws = await fetch('/api/workers').then((r) => r.json());
    setWorkers(ws);
    if (!workerId && ws[0]) setWorkerId(ws[0].id);
  }

  async function loadEntries() {
    const { start, end } = monthRangeOf(date);
    const list = await fetch(`/api/hours?start=${start}&end=${end}`).then((r) => r.json());
    setEntries(list);
  }

  useEffect(() => { loadWorkers(); }, []); // eslint-disable-line
  useEffect(() => { loadEntries(); }, [date]); // eslint-disable-line

  async function submit(e) {
    e.preventDefault();
    if (!workerId || !date) return;
    setMsg('');
    const res = await fetch('/api/hours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workerId,
        date,
        scheduledHours: scheduledHours === '' ? null : Number(scheduledHours),
        overtimeHours: Number(overtimeHours || 0),
        present,
        note
      })
    });
    if (!res.ok) {
      const j = await res.json();
      setMsg(j.error || '저장 실패');
      return;
    }
    setMsg('저장했습니다.');
    setNote('');
    loadEntries();
  }

  async function removeEntry(id) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    await fetch(`/api/hours/${id}`, { method: 'DELETE' });
    loadEntries();
  }

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>일일 근무시간</h1>
          <p>특정 날짜의 결근, 스케줄 예외, 연장근무를 입력합니다. 입력하지 않은 날짜는 기본 스케줄 시간이 자동 적용됩니다.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">근무시간 입력</div>
        <form onSubmit={submit} className="form-grid" style={{ alignItems: 'end' }}>
          <label>근무자
            <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.workcenter?.label}</option>)}
            </select>
          </label>
          <label>날짜
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>기본근무시간 override (선택)
            <input type="number" step="0.5" value={scheduledHours} onChange={(e) => setScheduledHours(e.target.value)} placeholder="비우면 기본 스케줄 사용" />
          </label>
          <label>연장근무 시간
            <input type="number" step="0.5" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} />
          </label>
          <label>출근 여부
            <select value={present ? '1' : '0'} onChange={(e) => setPresent(e.target.value === '1')}>
              <option value="1">출근</option>
              <option value="0">결근</option>
            </select>
          </label>
          <label>메모
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택 사항" />
          </label>
          <button className="btn" type="submit">저장</button>
        </form>
        {msg && <div style={{ fontSize: 12.5, color: '#16a34a' }}>{msg}</div>}
      </div>

      <div className="card">
        <div className="card-title">{date.slice(0, 7)}월 입력 내역</div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>날짜</th>
                <th>근무자</th>
                <th className="num">기본시간</th>
                <th className="num">연장근무</th>
                <th>출근</th>
                <th>메모</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toISOString().slice(0, 10)}</td>
                  <td>{e.worker?.name}</td>
                  <td className="num">{e.scheduledHours ?? '-'}</td>
                  <td className="num">{e.overtimeHours}</td>
                  <td>{e.present ? '출근' : '결근'}</td>
                  <td>{e.note}</td>
                  <td><button className="btn danger" onClick={() => removeEntry(e.id)}>삭제</button></td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={7} style={{ color: '#767b8a' }}>이번 달 입력 내역이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
