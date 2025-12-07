import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot } from 'lucide-react';
import { sendChatMessage, generateHydrationReport } from '../Services/aiService';

export default function ChatBot({ user, stats, drinkCount, currentDate, buildSummary }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `안녕하세요 ${user.name}님! 무엇을 도와드릴까요?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const buildContextSummary = (period) => {
    // App 쪽에서 주간/월간 집계를 넘겨주는 경우 우선 사용
    if (typeof buildSummary === 'function') {
      const s = buildSummary(period);
      if (s) return s;
    }
    // fallback: 오늘 데이터 기준 간단 요약
    return {
      period: 'daily',
      date: currentDate,
      goalWater: user.goals.water,
      waterMl: stats.waterMl,
      drinkCount,
    };
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput("");
    setLoading(true);

    try {
      // AI에게 보낼 컨텍스트 데이터
      const contextData = {
        name: user.name,
        water: stats.waterMl,
        goal: user.goals.water,
        drinkCount: drinkCount,
        date: currentDate
      };

      // 대화 기록 중 role, content만 추출해서 전송
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
      
      const replyText = await sendChatMessage(historyForApi, input, contextData);
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "죄송합니다. AI 연결 상태를 확인해주세요." }]);
    }
    setLoading(false);
  };

  const handleQuickReport = async (period) => {
    setIsOpen(true);
    setLoading(true);
    try {
      const summary = buildContextSummary(period);
      const context = { name: user.name, summary };
      const replyText = await generateHydrationReport(period, context);
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "리포트를 생성하는 중 오류가 발생했습니다." }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* 채팅창 본문 */}
      {isOpen && (
        <div className="mb-4 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in-up">
          {/* 헤더 */}
          <div className="bg-slate-900 text-white p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot size={18} />
                <span className="font-bold text-sm">AI Health Assistant</span>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:text-slate-300"><X size={18}/></button>
            </div>
            <div className="flex gap-2 text-[10px]">
              <button
                type="button"
                onClick={() => handleQuickReport('daily')}
                className="px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/20"
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => handleQuickReport('weekly')}
                className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/15"
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => handleQuickReport('monthly')}
                className="px-2 py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/15"
              >
                Monthly
              </button>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none text-xs text-slate-400">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text" 
              className="flex-1 bg-slate-100 rounded-full px-4 text-xs outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Ask about your health..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition hover:scale-110 flex items-center justify-center"
        >
          <MessageSquare size={24} />
        </button>
      )}
    </div>
  );
}