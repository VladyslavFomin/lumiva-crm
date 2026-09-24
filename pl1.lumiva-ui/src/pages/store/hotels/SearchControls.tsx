import React, { useEffect, useRef, useState } from "react";

const DOW = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIso(s: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function fmtShort(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function useOutsideClose(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [ref, onClose]);
}

function MonthGrid({
  month,
  checkIn,
  checkOut,
  today,
  onPick,
}: {
  month: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  today: Date;
  onPick: (d: Date) => void;
}) {
  const first = startOfMonth(month);
  const firstDow = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(month.getFullYear(), month.getMonth(), d));

  const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && iso(a) === iso(b);
  const inRange = (d: Date) => !!checkIn && !!checkOut && d > checkIn && d < checkOut;

  return (
    <div className="w-full">
      <div className="text-center text-sm font-semibold text-stone-800 mb-2 capitalize">
        {MONTHS[month.getMonth()]} {month.getFullYear()}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DOW.map((w) => (
          <div key={w} className="text-[10px] font-medium text-stone-400 pb-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const past = d < today;
          const isStart = sameDay(d, checkIn);
          const isEnd = sameDay(d, checkOut);
          const selected = isStart || isEnd;
          const ranged = inRange(d);
          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => onPick(d)}
              className={[
                "h-8 w-8 mx-auto text-xs rounded-full transition-colors",
                past ? "text-stone-300 cursor-not-allowed" : "text-stone-700 hover:bg-amber-100",
                selected ? "bg-amber-500 text-white hover:bg-amber-500 font-semibold" : "",
                ranged ? "bg-amber-100 rounded-none" : "",
              ].join(" ")}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const DateRangePicker: React.FC<{
  checkIn: string;
  checkOut: string;
  onChange: (checkIn: string, checkOut: string) => void;
}> = ({ checkIn, checkOut, onChange }) => {
  const [open, setOpen] = useState(false);
  const inDate = parseIso(checkIn);
  const outDate = parseIso(checkOut);
  const [view, setView] = useState(() => startOfMonth(inDate || new Date()));
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false));
  const today = new Date(new Date().toDateString());

  const pick = (d: Date) => {
    if (!inDate || (inDate && outDate)) {
      onChange(iso(d), "");
      return;
    }
    if (d <= inDate) {
      onChange(iso(d), "");
      return;
    }
    onChange(iso(inDate), iso(d));
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-1 min-w-[180px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left"
      >
        <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Даты</div>
        <div className="text-sm font-medium text-stone-800">
          {inDate ? fmtShort(inDate) : "Выберите"} {"–"} {outDate ? fmtShort(outDate) : "…"}
        </div>
      </button>
      {open && (
        <div className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-3 bg-white rounded-2xl shadow-lumiva border border-amber-100 p-4 flex gap-6 w-[560px] max-w-[92vw]">
          <MonthGrid month={view} checkIn={inDate} checkOut={outDate} today={today} onPick={pick} />
          <MonthGrid month={addMonths(view, 1)} checkIn={inDate} checkOut={outDate} today={today} onPick={pick} />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1">
            <button type="button" onClick={() => setView((v) => addMonths(v, -1))} className="h-7 w-7 rounded-full border border-amber-200 bg-white text-stone-500 hover:bg-amber-50 flex items-center justify-center text-xs">
              ‹
            </button>
            <button type="button" onClick={() => setView((v) => addMonths(v, 1))} className="h-7 w-7 rounded-full border border-amber-200 bg-white text-stone-500 hover:bg-amber-50 flex items-center justify-center text-xs">
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const GuestStepper: React.FC<{
  value: number;
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClose(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative min-w-[110px]">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left">
        <div className="text-[10px] font-medium uppercase tracking-wide text-stone-400">Гостей</div>
        <div className="text-sm font-medium text-stone-800">{value} {value === 1 ? "гость" : "гостя"}</div>
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-3 bg-white rounded-2xl shadow-lumiva border border-amber-100 p-4 w-56">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-700">Гости</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={value <= 1}
                onClick={() => onChange(Math.max(1, value - 1))}
                className="h-7 w-7 rounded-full border border-amber-300 text-amber-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
              >
                −
              </button>
              <span className="w-4 text-center text-sm font-medium">{value}</span>
              <button
                type="button"
                onClick={() => onChange(value + 1)}
                className="h-7 w-7 rounded-full border border-amber-300 text-amber-700 flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
