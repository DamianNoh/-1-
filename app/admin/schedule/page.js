'use client';
import { useEffect, useState } from 'react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function SchedulePage() {
  const [workers, setWorkers] = useState([]);
  const [workerId, setWorkerId] = useState('');
  const [hours, setHours] = useState(Array(7).fill(''));
  const [msg, setMsg] = useState('');

  async function load() {
    const ws = await fetch('/api/workers').then((r) => r.json());
    setWorkers(ws);
    if (!workerId && ws[0]) setWorkerId(ws[0].id);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    const w = workers.find((x) => x.id === workerId);
    if (!w) return;
    const arr = Array(7).fill('');
    (w.weeklySchedules || []).forEach((s) => { arr[s.weekday] = s.hours; });
    setHours(arr);
  }, [workerId, workers]);

  async function saveAll(e) {
    e.preventDefault();
    setMsg('');
    for (let weekday = 0; weekday < 7; weekday++) {
      const h = hours[weekday];
      if (h === '' || h === null || h === undefined) continue;
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId, weekday, hours: Number(h) })
      });
    }
    setMsg('저장했습니다.');
    load();
  }

  const currentWorker = workers.find((w) => w.id === workerId);

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>기본 근무 스케줄</h1>
          <p>근무자별 요일당 기본 근무시간을 설정합니다. 정규직은 매일 동일 시간, 파트타임은 요일마다 다르게 설정할 수 있습니다. 특정 날짜의 연장근무/결근은 "일일 근무시간" 화면에서 처리합니다.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">근무자 선택</div>
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <select value={workerId} onChange={(e) => setWorkerId(e.target.value)}>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.name} · {w.workcenter?.label} · {w.employmentType === 'PARTTIME' ? '파트타임' : '정규직'}</option>
            ))}
          </select>
        </div>

        {currentWorker && (
          <form onSubmit={saveAll}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 16 }}>
              {WEEKDAYS.map((label, i) => (
                <label key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#767b8a', fontWeight: 600 }}>
                  {label}요일 (시간)
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={hours[i]}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = e.target.value;
                      setHours(next);
                    }}
                    placeholder="0"
                    style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ecedf1' }}
                  />
                </label>
              ))}
            </div>
            <button className="btn" type="submit">스케줄 저장</button>
            {msg && <span style={{ marginLeft: 12, fontSize: 12.5, color: '#16a34a' }}>{msg}</span>}
          </form>
        )}
        {!currentWorker && <div style={{ color: '#767b8a', fontSize: 13 }}>먼저 "근무자 관리"에서 근무자를 등록해주세요.</div>}
      </div>
    </div>
  );
}
