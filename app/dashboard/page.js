'use client';
import { useEffect, useMemo, useState } from 'react';
import { LineChart, DonutChart, fmt, fmt1 } from './Charts';

function monthRange(monthStr) {
  // monthStr: 'YYYY-MM'
  const [y, m] = monthStr.split('-').map(Number);
  const start = `${monthStr}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${monthStr}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

function defaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(defaultMonth());
  const [mode, setMode] = useState('headcount');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const { start, end } = monthRange(month);
    setLoading(true);
    setError('');
    fetch(`/api/dashboard?start=${start}&end=${end}&mode=${mode}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e) => setError(e.message || '데이터를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [month, mode]);

  const daily = data?.daily || [];
  const seriesMeta = data?.series_meta || [];
  const labels = daily.map((d) => d.day + '일');
  const totalRaw = daily.map((d) => d.total_raw || 0);

  const seriesForChart = seriesMeta.map((meta, i) => ({
    name: meta.name,
    color: meta.color,
    data: daily.map((d) => d['p' + (i + 1)] || 0)
  }));

  const kpis = useMemo(() => {
    if (!daily.length) return [];
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const avg = (arr) => sum(arr) / arr.length;
    const totalSum = sum(totalRaw);
    const totalAvg = avg(totalRaw);
    const base = [
      { label: '일일 합계 CPC (월 누계)', color: 'var(--total)', value: fmt(totalSum), sub: `${data.range_label} 합산` },
      { label: '일평균 합계 CPC', color: 'var(--total)', value: fmt1(totalAvg), sub: '1일 평균' }
    ];
    seriesForChart.forEach((s) => {
      base.push({ label: s.name + ' 평균', color: s.color, value: fmt1(avg(s.data)), sub: mode === 'hours' ? '실근무시간당' : '근무자 1인당' });
    });
    return base;
  }, [daily, seriesForChart, mode]);

  const wcTotals = data?.wc_totals || {};
  const wcKeys = Object.keys(wcTotals);
  const wcLabels = seriesMeta.map((m) => m.name.split(' · ')[1] || m.code);
  const wcValues = seriesMeta.map((m) => wcTotals[m.code] || 0);
  const wcColors = seriesMeta.map((m) => m.color);

  const topDesc = (data?.top_desc || []).slice(0, 10);
  const maxTop = Math.max(1, ...topDesc.map((d) => d.total));
  const colorByWc = {};
  seriesMeta.forEach((m) => { colorByWc[m.code] = m.color; });

  return (
    <div className="wrap">
      <div className="header">
        <div>
          <h1>CPC 대시보드</h1>
          <p>월별 P1 / P2 / P3 CPC 추이 · 계산 방식을 실시간으로 전환할 수 있습니다.</p>
        </div>
        <div className="badge">{data ? `${data.range_label} · ${daily.length}일` : '불러오는 중...'}</div>
      </div>

      <div className="toolbar">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <div className="seg">
          <button className={mode === 'headcount' ? 'active' : ''} onClick={() => setMode('headcount')}>근무자 수 기준</button>
          <button className={mode === 'hours' ? 'active' : ''} onClick={() => setMode('hours')}>실근무시간 기준</button>
        </div>
        {loading && <span style={{ fontSize: 12.5, color: '#767b8a' }}>불러오는 중...</span>}
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 16, color: '#dc2626' }}>
          {error} — 워크센터/근무자/CPC 데이터가 아직 등록되지 않았을 수 있습니다. 관리 메뉴에서 먼저 데이터를 입력해주세요.
        </div>
      )}

      {!error && (
        <>
          <div className="kpi-grid">
            {kpis.map((k, i) => (
              <div className="kpi" key={i}>
                <div className="label"><span className="dot" style={{ background: k.color }} />{k.label}</div>
                <div className="value">{k.value}</div>
                <div className="sub">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid-main">
            <div className="card">
              <div className="card-title">일자별 P1 / P2 / P3 CPC 추이</div>
              <div className="card-desc">{mode === 'hours' ? '실근무시간(기본 스케줄 + 연장근무) 당 CPC' : '근무자 1인당 CPC'}</div>
              <div className="legend-row">
                {seriesMeta.map((m, i) => (
                  <div className="legend-item" key={i}>
                    <span className="legend-swatch" style={{ background: m.color }} />{m.name}
                  </div>
                ))}
              </div>
              <div className="chart-box">
                {daily.length > 0 && <LineChart labels={labels} series={seriesForChart} height={300} />}
              </div>
            </div>

            <div className="card">
              <div className="card-title">워크센터별 월간 합계 비중</div>
              <div className="card-desc">선택한 월 Total CPC 구성비</div>
              {wcValues.some((v) => v > 0) && <DonutChart data={wcValues} labels={wcLabels} colors={wcColors} />}
            </div>
          </div>

          <div className="grid-sub">
            <div className="card">
              <div className="card-title">일일 합계 CPC 추이</div>
              <div className="card-desc">전체 워크센터 합산 CPC (일 단위)</div>
              <div className="chart-box">
                {daily.length > 0 && (
                  <LineChart labels={labels} series={[{ name: '일일 합계', color: '#334155', data: totalRaw }]} height={220} />
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-title">디스크립션 TOP 10 (월간 누계)</div>
              <div className="card-desc">Total CPC 기준 상위 항목</div>
              <div>
                {topDesc.map((d, i) => {
                  const color = colorByWc[d.workcenter] || '#334155';
                  return (
                    <div style={{ marginBottom: 11 }} key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }} title={d.description}>{d.description}</span>
                        <span style={{ fontWeight: 700, color }}>{fmt(d.total)}</span>
                      </div>
                      <div className="bar-bg"><div className="bar-fill" style={{ width: (d.total / maxTop * 100).toFixed(1) + '%', background: color }} /></div>
                    </div>
                  );
                })}
                {topDesc.length === 0 && <div style={{ fontSize: 12.5, color: '#767b8a' }}>데이터가 없습니다.</div>}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">일자별 상세 데이터</div>
            <div className="card-desc">{mode === 'hours' ? '실근무시간 기준' : '근무자 수 기준'} P1 / P2 / P3 CPC 및 일일 합계</div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th>
                    {seriesMeta.map((m, i) => <th className="num" key={i}>{m.name}</th>)}
                    <th className="num">일일 합계</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((d, i) => (
                    <tr key={i}>
                      <td>{d.date}</td>
                      {seriesMeta.map((m, si) => <td className="num" key={si}>{fmt1(d['p' + (si + 1)] || 0)}</td>)}
                      <td className="num">{fmt(d.total_raw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="footer">계산법: 일일 CPC ÷ {mode === 'hours' ? '일 실근무시간(기본 스케줄+연장근무)' : '일 근무자 수'}</div>
    </div>
  );
}
