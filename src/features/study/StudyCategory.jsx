// src/pages/StudyCategory.jsx
// ============================================================
// Study 카테고리 선택 화면 + 24시간 타임라인
// - 카테고리 카드 위, 타임라인 아래
// ============================================================

import React, { useMemo } from 'react';
import { BookOpen, Laptop, PenTool, ArrowLeft, Lock, Clock, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import StudyCard from './components/StudyCard';
import { formatMinutesToTime } from './utils/studyCalculator';

export default function StudyCategory({ 
  onSelectCategory, 
  onBack,
  isDarkMode,
  studySummary = { totalStudyMin: 0, totalBookMin: 0, totalLaptopMin: 0 },
  bookLogs = [],
  laptopLogs = []
}) {
  const cardBase = isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200';
  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // 24시간 기준 타임라인 데이터 생성 (세션 기반)
  const timelineData = useMemo(() => {
    // 24시간 초기화
    const hours = {};
    for (let i = 0; i < 24; i++) {
      const key = `${i.toString().padStart(2, '0')}:00`;
      hours[key] = { time: key, hour: i, book: 0, laptop: 0, total: 0 };
    }

    // 로그를 sourceFile(CSV)별로 그룹핑하여 세션 시간 계산
    const groupBySource = (logs, type) => {
      const groups = {};
      logs.forEach(log => {
        const key = log.sourceFile || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(log);
      });
      
      // 각 그룹(세션)의 시작 시간과 duration 계산
      return Object.values(groups).map(group => {
        const sorted = group.sort((a, b) => {
          const timeA = a.timestamp || a.time || '';
          const timeB = b.timestamp || b.time || '';
          return timeA.localeCompare(timeB);
        });
        
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        
        // 시간 추출
        const extractTime = (ts) => {
          if (!ts) return '00:00';
          if (ts.includes('T')) return ts.split('T')[1]?.slice(0, 5) || '00:00';
          if (ts.includes(' ')) return ts.split(' ')[1]?.slice(0, 5) || '00:00';
          return ts.slice(0, 5);
        };
        
        const startTime = extractTime(first.timestamp || first.time);
        const endTime = extractTime(last.timestamp || last.time);
        
        const parseMin = (t) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        
        const duration = Math.max(parseMin(endTime) - parseMin(startTime), 1);
        
        return { startHour: parseInt(startTime.split(':')[0]) || 0, duration, type };
      });
    };
    
    const bookSessions = groupBySource(bookLogs, 'book');
    const laptopSessions = groupBySource(laptopLogs, 'laptop');
    
    // 세션을 시간대별로 배분
    [...bookSessions, ...laptopSessions].forEach(session => {
      const hour = session.startHour;
      const key = `${hour.toString().padStart(2, '0')}:00`;
      if (hours[key]) {
        hours[key][session.type] += session.duration;
        hours[key].total += session.duration;
      }
    });

    return Object.values(hours);
  }, [bookLogs, laptopLogs]);

  const hasData = timelineData.some(h => h.total > 0);

  // 활동(세션) 수 계산 (sourceFile별 그룹 = 1개 활동)
  const countSessions = (logs) => {
    if (!logs || logs.length === 0) return 0;
    const sources = new Set(logs.map(log => log.sourceFile || 'unknown'));
    return sources.size;
  };

  const bookSessionCount = countSessions(bookLogs);
  const laptopSessionCount = countSessions(laptopLogs);

  const categories = [
    {
      id: 'book',
      icon: BookOpen,
      title: 'Book Reading',
      subtitle: '독서 기록',
      description: '읽은 책과 페이지를 기록하세요',
      color: 'blue',
      time: studySummary.totalBookMin,
      count: bookSessionCount,  // 로그 수 → 활동(세션) 수
      locked: false
    },
    {
      id: 'laptop',
      icon: Laptop,
      title: 'Laptop Study',
      subtitle: '노트북 공부',
      description: '강의, 과제, 검색 활동을 기록하세요',
      color: 'slate',
      time: studySummary.totalLaptopMin,
      count: laptopSessionCount,  // 로그 수 → 활동(세션) 수
      locked: false
    },
    {
      id: 'pen',
      icon: PenTool,
      title: 'Pen Note',
      subtitle: '필기 노트',
      description: '손으로 쓴 노트를 기록하세요',
      color: 'emerald',
      time: 0,
      count: 0,
      locked: true
    }
  ];

  const getColorClasses = (color, locked) => {
    if (locked) {
      return {
        bg: isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100',
        iconBg: isDarkMode ? 'bg-slate-600' : 'bg-slate-200',
        iconColor: isDarkMode ? 'text-slate-500' : 'text-slate-400',
        border: isDarkMode ? 'border-slate-600' : 'border-slate-200'
      };
    }
    
    const colors = {
      blue: {
        bg: isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50',
        iconBg: isDarkMode ? 'bg-blue-500/20' : 'bg-blue-100',
        iconColor: 'text-blue-500',
        border: isDarkMode ? 'border-blue-500/30' : 'border-blue-200',
        hover: 'hover:border-blue-400 hover:shadow-blue-500/10'
      },
      slate: {
        bg: isDarkMode ? 'bg-slate-500/10' : 'bg-slate-100',
        iconBg: isDarkMode ? 'bg-slate-500/20' : 'bg-slate-200',
        iconColor: 'text-slate-500',
        border: isDarkMode ? 'border-slate-500/30' : 'border-slate-300',
        hover: 'hover:border-slate-400 hover:shadow-slate-500/10'
      },
      emerald: {
        bg: isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-50',
        iconBg: isDarkMode ? 'bg-emerald-500/20' : 'bg-emerald-100',
        iconColor: 'text-emerald-500',
        border: isDarkMode ? 'border-emerald-500/30' : 'border-emerald-200',
        hover: 'hover:border-emerald-400 hover:shadow-emerald-500/10'
      }
    };
    return colors[color];
  };

  const formatTime = (minutes) => {
    if (!minutes || minutes === 0) return '0분';
    if (minutes < 60) return `${Math.round(minutes)}분`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className={`p-2 rounded-xl transition ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'}`}>
              <ArrowLeft size={22} className={textSecondary} />
            </button>
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>Study Analytics</h1>
              <p className={`text-sm ${textSecondary}`}>공부 카테고리를 선택하세요</p>
            </div>
          </div>
          
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`}>
            <Clock size={18} className={textSecondary} />
            <span className={`text-sm font-medium ${textPrimary}`}>
              총 {formatTime(studySummary.totalStudyMin)}
            </span>
          </div>
        </div>
      </div>

      {/* 카테고리 카드들 (위로 이동) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const colors = getColorClasses(cat.color, cat.locked);

          return (
            <button
              key={cat.id}
              onClick={() => !cat.locked && onSelectCategory(cat.id)}
              disabled={cat.locked}
              className={`
                relative p-6 rounded-3xl border-2 text-left transition-all duration-300
                ${colors.bg} ${colors.border}
                ${cat.locked ? 'cursor-not-allowed opacity-70' : `cursor-pointer hover:-translate-y-1 hover:shadow-xl ${colors.hover}`}
              `}
            >
              {cat.locked && (
                <div className={`absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-slate-600 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                  <Lock size={12} />
                  Coming Soon
                </div>
              )}

              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${colors.iconBg}`}>
                <Icon size={28} className={colors.iconColor} />
              </div>

              <h3 className={`text-xl font-bold mb-1 ${cat.locked ? textSecondary : textPrimary}`}>
                {cat.title}
              </h3>
              <p className={`text-sm font-medium mb-2 ${colors.iconColor}`}>
                {cat.subtitle}
              </p>
              <p className={`text-sm mb-4 ${textSecondary}`}>
                {cat.description}
              </p>

              {!cat.locked && (
                <div className={`flex items-center justify-between pt-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={textSecondary} />
                    <span className={`text-sm ${textSecondary}`}>
                      {cat.time > 0 ? formatTime(cat.time) : '기록 없음'}
                    </span>
                  </div>
                  {cat.count > 0 && (
                    <span className={`text-xs px-2 py-1 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'}`}>
                      {cat.count}건
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 24시간 타임라인 그래프 (아래로 이동) */}
      <div className={`p-6 rounded-3xl border shadow-sm ${cardBase}`}>
        <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
          <TrendingUp size={20} className="text-violet-500" />
          Study Timeline
          <span className={`text-sm font-normal ${textSecondary}`}>
            (24시간)
          </span>
        </h2>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#334155" : "#e2e8f0"} strokeOpacity={0.5} />
              <XAxis 
                dataKey="hour"
                tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(h) => h % 3 === 0 ? `${h}시` : ''}
                interval={0}
              />
              <YAxis 
                tick={{ fontSize: 9, fill: isDarkMode ? '#94a3b8' : '#64748b' }} 
                axisLine={false} 
                tickLine={false}
                width={30}
                tickFormatter={(v) => v > 0 ? `${v}` : ''}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isDarkMode ? '#1e293b' : '#fff', 
                  borderRadius: '12px', 
                  border: isDarkMode ? '1px solid #475569' : '1px solid #e2e8f0',
                  color: isDarkMode ? '#fff' : '#000'
                }}
                formatter={(value, name) => [`${value}분`, name === 'book' ? '📘 독서' : '💻 노트북']}
                labelFormatter={(h) => `${h}:00 - ${h}:59`}
              />
              <Bar dataKey="book" name="book" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="laptop" name="laptop" stackId="a" fill="#64748b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* 범례 */}
        <div className={`flex justify-center gap-6 mt-3 text-xs font-medium ${textSecondary}`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div> 독서
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-slate-500 rounded"></div> 노트북
          </div>
        </div>
        
        {!hasData && (
          <p className={`text-center text-sm mt-4 ${textSecondary}`}>
            오늘의 공부 기록이 없습니다.
          </p>
        )}
      </div>

      <div className={`p-4 rounded-2xl text-center ${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <p className={`text-sm ${textSecondary}`}>
          💡 각 카테고리를 선택하면 상세 기록을 확인하고 수정할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
