// src/pages/WaterDetail.jsx
import React, { useState, useMemo } from 'react';
import { ChevronLeft, Droplets, Activity, Edit2, Save, X, ChevronDown, ChevronUp, Loader } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 1. 로그 그룹화 (세션 분리) 함수
const groupLogsIntoSessions = (logs, gapMinutes = 5) => {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  // 시간순 정렬
  const sorted = [...logs].sort((a, b) => {
    const timeA = a.time || '';
    const timeB = b.time || '';
    return timeA.localeCompare(timeB);
  });

  const sessions = [];
  let currentSession = {
    logs: [sorted[0]],
    startTime: sorted[0].time,
    endTime: sorted[0].time
  };

  for (let i = 1; i < sorted.length; i++) {
    const prevTime = parseTime(currentSession.endTime);
    const currTime = parseTime(sorted[i].time);
    const diffMin = (currTime - prevTime) / (1000 * 60);

    if (diffMin > gapMinutes) {
      sessions.push(finalizeSession(currentSession));
      currentSession = {
        logs: [sorted[i]],
        startTime: sorted[i].time,
        endTime: sorted[i].time
      };
    } else {
      currentSession.logs.push(sorted[i]);
      currentSession.endTime = sorted[i].time;
    }
  }
  sessions.push(finalizeSession(currentSession));
  return sessions;
};

// 시간 파싱 헬퍼
const parseTime = (timeStr) => {
  if (!timeStr) return new Date('2000-01-01 00:00');
  const [h, m] = (timeStr.slice(0, 5) || '00:00').split(':');
  return new Date(`2000-01-01 ${h}:${m}`);
};

// 세션 요약 계산 (우선순위 로직 적용)
const finalizeSession = (session) => {
  let waterAmount = 0;
  let drinkAmount = 0;
  
  session.logs.forEach(log => {
    const amount = parseInt(log.amount) || 0;
    
    // [우선순위] My Label(사용자 수정) > AI Result
    const finalLabel = log.userLabel || log.aiResult || "";
    
    // "Water"가 포함되지 않으면 음료(Drink)로 간주
    let isDrink = false;
    if (finalLabel !== "") {
        isDrink = !finalLabel.toLowerCase().includes("water");
    } else {
        // 라벨이 없으면 기본값(물)
        isDrink = false; 
    }
    
    if (isDrink) drinkAmount += amount;
    else waterAmount += amount;
  });

  const startMin = session.startTime?.slice(0, 5) || '00:00';
  const endMin = session.endTime?.slice(0, 5) || '00:00';

  return {
    id: session.startTime,
    logs: session.logs,
    startTime: startMin,
    endTime: endMin,
    displayTime: startMin === endMin ? startMin : `${startMin}~${endMin}`,
    waterAmount,
    drinkAmount,
    totalAmount: waterAmount + drinkAmount,
    logCount: session.logs.length
  };
};

// 차트 커스텀 점
const CustomDot = ({ cx, cy, payload, onClick, isActive }) => {
  if (!cx || !cy) return null;
  const hasDrink = payload.drinkAmount > 0;
  
  return (
    <g onClick={() => onClick && onClick(payload)} style={{ cursor: 'pointer' }}>
      <circle 
        cx={cx} 
        cy={cy} 
        r={isActive ? 8 : 6} 
        fill={hasDrink ? '#ef4444' : '#3b82f6'} 
        stroke="#fff"
        strokeWidth={2}
      />
      {isActive && (
        <circle cx={cx} cy={cy} r={12} fill="none" stroke="#3b82f6" strokeWidth={2} opacity={0.5} />
      )}
    </g>
  );
};

// 메인 컴포넌트
export default function WaterDetail({ logs, stats, user, onBack, onImageAnalysis, onManualEdit, isDarkMode }) {
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ time: "", amount: "", aiResult: "", userLabel: "" });
  const [expandedSession, setExpandedSession] = useState(null);

  const sessions = useMemo(() => groupLogsIntoSessions(logs), [logs]);

  const timelineData = useMemo(() => {
    return sessions.map(session => ({
      id: session.id,
      time: session.startTime,
      displayTime: session.displayTime,
      waterAmount: session.waterAmount, // 그래프 키
      drinkAmount: session.drinkAmount, // 그래프 키
      total: session.totalAmount,
      logCount: session.logCount
    }));
  }, [sessions]);

  // 수정 시작
  const startEdit = (log) => {
    setEditingId(log.id);
    setEditValues({ 
        time: log.time, 
        amount: log.amount, 
        aiResult: log.aiResult || "",
        // 기존 라벨이 없으면 기본값은 'Water'로 설정하지 않고 빈 상태로 둠 (선택 유도)
        userLabel: log.userLabel || "" 
    });
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditingId(null);
  };

  // 수정 저장
  const saveEdit = (logId) => {
    onManualEdit(logId, editValues.time, editValues.amount, editValues.aiResult, editValues.userLabel);
    setEditingId(null);
  };

  const toggleSession = (sessionId) => {
    setExpandedSession(expandedSession === sessionId ? null : sessionId);
  };

  const handleDotClick = (data) => {
    if (data && data.id) toggleSession(data.id);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
      <div className={`px-4 py-3 rounded-xl shadow-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
        <p className="font-semibold mb-2">{data.displayTime}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>물: {data.waterAmount}ml</span>
          </div>
          {data.drinkAmount > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>음료: {data.drinkAmount}ml</span>
            </div>
          )}
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {data.logCount}건의 로그
          </p>
        </div>
      </div>
    );
  };

  const cardStyle = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 뒤로가기 */}
      <button onClick={onBack} className={`flex items-center gap-2 font-bold transition mb-4 ${textSecondary} hover:text-blue-500`}>
        <ChevronLeft size={20} /> Back to Dashboard
      </button>

      {/* 헤더 */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 text-white p-8 rounded-3xl shadow-lg border border-blue-600/50 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Droplets className="fill-current text-blue-200" /> Water Intake Detail
          </h2>
          <p className="opacity-80 mt-1 text-blue-100">Real-time analysis & Verification</p>
        </div>
        <div className="text-right">
          <p className="text-5xl font-bold drop-shadow-md">{stats.waterMl}</p>
          <p className="text-lg opacity-80 text-blue-100">/ {user.goals.water} ml Goal</p>
        </div>
      </div>

      {/* 차트 */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardStyle}`}>
        <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>Intake Timeline</h3>
        <p className={`text-sm mb-4 ${textSecondary}`}>점을 클릭하면 상세 로그를 볼 수 있습니다</p>
        
        {timelineData.length > 0 ? (
          <div className="h-80 w-full flex flex-col justify-between">
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} />
                  <XAxis dataKey="displayTime" tick={{ fontSize: 11, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fontSize: 10, fill: isDarkMode ? '#94a3b8' : '#64748b' }} axisLine={false} tickLine={false} width={45} tickFormatter={(v) => `${v}ml`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="waterAmount" stroke="#3b82f6" strokeWidth={3} dot={(props) => <CustomDot {...props} onClick={handleDotClick} isActive={expandedSession === props.payload.id} />} activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="drinkAmount" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={(props) => props.payload.drinkAmount > 0 ? <circle cx={props.cx} cy={props.cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1} /> : null} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* 범례 */}
            <div className={`flex flex-wrap justify-center gap-x-8 gap-y-2 pt-2 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <span className={textSecondary}>Water</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                <span className={textSecondary}>Drink (Excluded)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={`h-40 flex items-center justify-center rounded-2xl border border-dashed ${textSecondary} ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            No data available.
          </div>
        )}
      </div>

      {/* 로그 테이블 */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardStyle}`}>
        <h3 className={`text-lg font-bold mb-4 ${textPrimary}`}>
          Logs & Verification
          <span className={`ml-2 text-sm font-normal ${textSecondary}`}>
            ({sessions.length}회 음수 활동)
          </span>
        </h3>

        {sessions.length === 0 ? (
          <div className={`h-32 flex items-center justify-center rounded-2xl border border-dashed ${textSecondary} ${isDarkMode ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
            No logs available.
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className={`rounded-2xl border overflow-hidden transition ${expandedSession === session.id ? (isDarkMode ? 'border-blue-500/50' : 'border-blue-300') : (isDarkMode ? 'border-slate-700' : 'border-slate-200')}`}>
                <button onClick={() => toggleSession(session.id)} className={`w-full p-4 flex items-center justify-between transition ${expandedSession === session.id ? (isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50') : (isDarkMode ? 'bg-slate-900/50 hover:bg-slate-800' : 'bg-slate-50 hover:bg-slate-100')}`}>
                  <div className="flex items-center gap-4">
                    <div className={`text-xl font-mono font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {session.displayTime}
                    </div>
                    <div className={`flex items-center gap-2 ${textSecondary}`}>
                      <Droplets size={16} className="text-blue-500" />
                      <span className="font-bold text-blue-500">{session.waterAmount}ml</span>
                      {session.drinkAmount > 0 && (
                        <><span>+</span><span className="font-bold text-red-400">{session.drinkAmount}ml (음료)</span></>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                      {session.logCount}건
                    </span>
                    {expandedSession === session.id ? <ChevronUp size={20} className={textSecondary} /> : <ChevronDown size={20} className={textSecondary} />}
                  </div>
                </button>

                {expandedSession === session.id && (
                  <div className={`border-t overflow-x-auto ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-white'}`}>
                    <table className={`w-full text-left text-sm whitespace-nowrap ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      <thead className={`${isDarkMode ? 'bg-slate-900/50 text-slate-500' : 'bg-slate-100 text-slate-500'} text-xs uppercase`}>
                        <tr>
                          <th className="p-3 pl-6">Time</th>
                          <th className="p-3">Image</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3 min-w-[120px]">AI Result</th>
                          <th className="p-3 min-w-[140px] font-bold text-blue-600">My Label</th>
                          <th className="p-3 pr-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDarkMode ? 'divide-slate-700/30' : 'divide-slate-100'}`}>
                        {session.logs.map((log) => (
                          <tr key={log.id} className={`transition ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}>
                            {editingId === log.id ? (
                              // [수정 모드]
                              <>
                                <td className={`p-3 pl-6 font-mono text-xs ${textSecondary}`}>{log.time}</td>
                                <td className="p-3">
                                  {log.imageUrl ? <img src={log.imageUrl} alt="log" className="w-12 h-12 rounded object-contain border border-slate-300 bg-slate-50" /> : <span className="text-xs text-slate-400">-</span>}
                                </td>
                                <td className="p-3">
                                  <input type="number" value={editValues.amount} onChange={(e) => setEditValues({...editValues, amount: e.target.value})} className={`w-16 p-1 rounded border outline-none text-center text-xs ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200'}`} />
                                </td>
                                <td className="p-3">
                                  <span className="text-xs text-slate-400">{log.aiResult || "Not Analyzed"}</span>
                                </td>
                                <td className="p-3">
                                  {/* [변경점] 텍스트 입력 대신 버튼 선택 UI 적용 */}
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => setEditValues({...editValues, userLabel: 'Water'})}
                                      className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                        editValues.userLabel === 'Water' 
                                          ? 'bg-blue-500 text-white border-blue-500 font-bold shadow-md' 
                                          : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'
                                      }`}
                                    >
                                      Water
                                    </button>
                                    <button 
                                      onClick={() => setEditValues({...editValues, userLabel: 'Drink'})}
                                      className={`px-3 py-1 text-xs rounded-full border transition-all ${
                                        editValues.userLabel === 'Drink' 
                                          ? 'bg-red-500 text-white border-red-500 font-bold shadow-md' 
                                          : 'bg-white text-red-500 border-red-200 hover:bg-red-50'
                                      }`}
                                    >
                                      Drink
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 pr-6 text-center">
                                  <div className="flex justify-center gap-2">
                                    <button onClick={() => saveEdit(log.id)} className="p-1 bg-green-100 text-green-600 rounded hover:bg-green-200"><Save size={14}/></button>
                                    <button onClick={cancelEdit} className="p-1 bg-red-100 text-red-600 rounded hover:bg-red-200"><X size={14}/></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              // [일반 보기 모드]
                              <>
                                <td className={`p-3 pl-6 font-mono text-xs ${textSecondary}`}>{log.time}</td>
                                <td className="p-3">
                                  {log.imageUrl ? (
                                    <div 
                                      className="relative group cursor-pointer w-12 h-12" 
                                      onClick={() => !log.isAnalyzing && onImageAnalysis(log.id, log.imageFile)}
                                    >
                                      <img 
                                        src={log.imageUrl} 
                                        alt="capture" 
                                        className={`w-full h-full rounded-md object-contain border border-slate-200 bg-slate-50 transition-all ${log.isAnalyzing ? 'opacity-50' : 'hover:scale-110'}`}
                                      />
                                      {log.isAnalyzing && <div className="absolute inset-0 flex items-center justify-center"><Loader className="w-5 h-5 animate-spin text-blue-600" /></div>}
                                      {!log.isAnalyzing && !log.analyzed && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-md transition-opacity">
                                          <Activity size={16} className="text-white" />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">No Img</span>
                                  )}
                                </td>
                                <td className="p-3 font-bold">{log.amount}ml</td>
                                <td className="p-3">
                                  <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                    {log.aiResult || "Not Analyzed"}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {log.userLabel ? (
                                    <span className={`font-bold text-xs px-2 py-1 rounded-full ${
                                      log.userLabel === 'Water' 
                                      ? 'bg-blue-100 text-blue-700' 
                                      : 'bg-red-100 text-red-700'
                                    }`}>
                                      {log.userLabel}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-300">-</span>
                                  )}
                                </td>
                                <td className="p-3 pr-6 text-center">
                                  <button onClick={() => startEdit(log)} className="text-slate-400 hover:text-blue-500 transition p-1">
                                    <Edit2 size={14} />
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}