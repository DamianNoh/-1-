'use client';
import { useEffect, useState } from 'react';

export default function ShiftTypesPage() {
  const [types, setTypes] = useState([]);
  const [code, setCode] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hours, setHours] = useState('');
  const [msg, setMsg] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ code: '', startTime: '', endTime: '', hours: '' });
  const [editMsg, setEditMsg] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  async function load() {
    const list = await fetch('/api/shift-types').then((r) => r.json());
    setTypes(list);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function addType(e) {
    e.preventDefault();
    if (!code || !startTime || !endTime || hours === '') return;
    setMsg('');
    const res = await fetch('/api/shift-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, startTime, endTime, hours: Number(hours) })
    });
    if (!res.ok) {
      const j = await res.json();
      setMsg(j.error || '추가 실패');
      return;
    }
    setCode(''); setStartTime(''); setEndTime(''); setHours('');
    load();
  }

  async function removeType(id) {
    if (!confirm('이 시프트 코드를 삭제할까요? 이미 입력된 인원수 데이터도 함께 삭제됩니다.')) return;
    await fetch(`/api/shift-types/${id}`, { method: 'DELETE' });
    load();
  }

  function startEdit(t) {
    setEditingId(t.id);
    setEditDraft({ code: t.code, startTime: t.startTime, endTime: t.endTime, hours: String(t.hours) });
    setEditMsg('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditMsg('');
  }

  async function saveEdit(id) {
    if (!editDraft.code || !editDraft.startTime || !editDraft.endTime || editDraft.hours === '') return;
    setEditSaving(true);
    setEditMsg('');
    const res = await fetch(`/api/shift-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: editDraft.code,
        startTime: editDraft.startTime,
        endTime: editDraft.endTime,
        hours: Number(editDraft.hours)
      })
    });
    setEditSaving(false);
    if (!res.ok) {
      let j = null;
      try { j = await res.json(); } catch { j = null; }
      setEditMsg((j && j.error) || '수정 실패');
      return;
    }
    setEditingId(null);
    load();
  }

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>시프트 코드 관리</h1>
          <p>AA, AS, A, AN, N, P, D 등 근무 시프트 코드와 시작/종료 시각, 근무시간을 등록합니다. "근무 인원 입력" 화면에서 이 목록을 기준으로 인원수를 입력합니다.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">시프트 코드 추가</div>
        <form onSubmit={addType} className="form-grid" style={{ alignItems: 'end' }}>
          <label>코드
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: AA" />
          </label>
          <label>시작 시각
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>종료 시각
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label>근무시간(시간)
            <input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="예: 9" />
          </label>
          <button className="btn" type="submit">추가</button>
        </form>
        {msg && <div style={{ color: '#dc2626', fontSize: 12.5 }}>{msg}</div>}
      </div>

      <div className="card">
        <div className="card-title">시프트 코드 목록</div>
        <div className="card-desc">근무시간은 시작~종료 사이 전체 시간에서 휴게시간을 뺀 "실 근무시간"을 입력합니다. "수정"을 눌러 바로 고칠 수 있고, 코드를 삭제/재등록하지 않아도 되므로 이미 입력된 인원수 데이터가 유지됩니다.</div>
        {editMsg && <div style={{ color: '#dc2626', fontSize: 12.5, marginBottom: 10 }}>{editMsg}</div>}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>코드</th>
                <th>시작</th>
                <th>종료</th>
                <th className="num">근무시간</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                editingId === t.id ? (
                  <tr key={t.id}>
                    <td>
                      <input
                        value={editDraft.code}
                        onChange={(e) => setEditDraft({ ...editDraft, code: e.target.value })}
                        style={{ width: 70, padding: '5px 7px', borderRadius: 6, border: '1px solid #ecedf1' }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={editDraft.startTime}
                        onChange={(e) => setEditDraft({ ...editDraft, startTime: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: 6, border: '1px solid #ecedf1' }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={editDraft.endTime}
                        onChange={(e) => setEditDraft({ ...editDraft, endTime: e.target.value })}
                        style={{ padding: '5px 7px', borderRadius: 6, border: '1px solid #ecedf1' }}
                      />
                    </td>
                    <td className="num">
                      <input
                        type="number"
                        step="0.5"
                        value={editDraft.hours}
                        onChange={(e) => setEditDraft({ ...editDraft, hours: e.target.value })}
                        style={{ width: 70, padding: '5px 7px', borderRadius: 6, border: '1px solid #ecedf1', textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn" disabled={editSaving} onClick={() => saveEdit(t.id)} style={{ marginRight: 6 }}>
                        {editSaving ? '저장 중...' : '저장'}
                      </button>
                      <button className="btn ghost" onClick={cancelEdit}>취소</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={t.id}>
                    <td><b>{t.code}</b></td>
                    <td>{t.startTime}</td>
                    <td>{t.endTime}</td>
                    <td className="num">{t.hours}시간</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn ghost" onClick={() => startEdit(t)} style={{ marginRight: 6 }}>수정</button>
                      <button className="btn danger" onClick={() => removeType(t.id)}>삭제</button>
                    </td>
                  </tr>
                )
              ))}
              {types.length === 0 && <tr><td colSpan={5} style={{ color: '#767b8a' }}>등록된 시프트 코드가 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
