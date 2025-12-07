// src/components/DatePicker.jsx

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-day-picker/dist/style.css';

export default function DatePicker({ value, onChange, isDarkMode }) {
  const [open, setOpen] = useState(false);
  const selectedDate = value
    ? parse(value, 'yyyy-MM-dd', new Date())
    : new Date();

  const handleSelect = (date) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    onChange(format(d, 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    onChange(format(d, 'yyyy-MM-dd'));
  };

  const textPrimary = isDarkMode ? 'text-white' : 'text-slate-800';
  const textSecondary = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const bgPopover = isDarkMode
    ? 'bg-slate-800 border-slate-700'
    : 'bg-white border-slate-200';

  /* ✅ 월 헤더 */
  const CustomCaption = ({ displayMonth, goToMonth }) => {
    const moveMonth = (offset) => {
      const d = new Date(displayMonth);
      d.setMonth(d.getMonth() + offset);
      goToMonth(d);
    };

    return (
      <div className="flex items-center justify-between px-6 md:px-8">
        <span className={`text-sm font-semibold ${textPrimary}`}>
          {format(displayMonth, 'yyyy년 M월', { locale: ko })}
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => moveMonth(-1)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => moveMonth(1)}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  /* ✅ DayPicker 스타일 */
  const dayPickerClassNames = {
    months: 'flex flex-col',
    month: 'space-y-2',
    table: 'w-full',
    head_row: 'flex',
    head_cell: `flex-1 text-center text-[11px] font-medium ${textSecondary}`,
    row: 'flex w-full',
    cell: 'flex-1 flex justify-center py-1',
    day: `
      w-7 h-7
      text-[13px]
      rounded-full
      transition
      hover:bg-slate-100
      ${isDarkMode ? 'hover:bg-slate-700 text-slate-300' : 'text-slate-700'}
    `,
    day_today: 'text-blue-500 font-semibold',
    day_selected: `
      !w-6 !h-6
      !bg-slate-200
      !text-slate-800
      !font-medium
      ${isDarkMode ? '!bg-slate-700 !text-slate-200' : ''}
    `,
    day_outside: 'text-slate-300',
    day_disabled: 'opacity-30'
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePrevDay}
        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <ChevronLeft size={18} />
      </button>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <Calendar size={15} className="text-blue-500" />
            <span className={`text-sm font-medium ${textPrimary}`}>
              {value}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={0}
          alignOffset={0}
          className={`z-50 p-4 rounded-xl border shadow-lg ${bgPopover}`}
        >
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={ko}
            showOutsideDays
            classNames={dayPickerClassNames}
            components={{ Caption: CustomCaption }}
          />

          {/* ✅ 오늘 버튼 여백 조정 */}
          <button
            onClick={() => {
              onChange(format(new Date(), 'yyyy-MM-dd'));
              setOpen(false);
            }}
            className="w-full mt-4 mb-1 py-2 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            오늘
          </button>

          <Popover.Arrow className={isDarkMode ? 'fill-slate-800' : 'fill-white'} />
        </Popover.Content>
      </Popover.Root>

      <button
        onClick={handleNextDay}
        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
