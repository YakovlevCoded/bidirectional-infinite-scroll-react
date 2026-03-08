import { useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { ChartData } from 'chart.js';
import type { DayData } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const ACTIVE_BG = 'rgba(59, 130, 246, 0.9)';
const INACTIVE_BG = 'rgba(59, 130, 246, 0.25)';
const ACTIVE_BORDER = 'rgba(59, 130, 246, 1)';
const INACTIVE_BORDER = 'rgba(59, 130, 246, 0.4)';

interface EventChartProps {
  days: DayData[];
  activeDate: string | null;
  onDayClick: (date: string) => void;
}

export function EventChart({ days, activeDate, onDayClick }: EventChartProps) {
  const chartRef = useRef<ChartJS<'bar'>>(null);

  // Only recompute data when days change (not on activeDate change)
  const chartData = useMemo<ChartData<'bar'>>(() => {
    const labels = days.map(d => {
      const date = new Date(d.date + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = days.map(d => d.events.length);

    return {
      labels,
      datasets: [{
        label: 'Events',
        data,
        backgroundColor: days.map(() => INACTIVE_BG),
        borderColor: days.map(() => INACTIVE_BORDER),
        borderWidth: 1,
        borderRadius: 3,
      }],
    };
  }, [days]);

  // Update only colors imperatively when activeDate changes — no React re-render
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ds = chart.data.datasets[0];
    if (!ds) return;

    const bgColors = days.map(d => d.date === activeDate ? ACTIVE_BG : INACTIVE_BG);
    const borderColors = days.map(d => d.date === activeDate ? ACTIVE_BORDER : INACTIVE_BORDER);

    ds.backgroundColor = bgColors;
    ds.borderColor = borderColors;
    chart.update('none'); // 'none' = skip animations for instant update
  }, [activeDate, days]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        title: { display: false },
        tooltip: {
          callbacks: {
            title: (items: { dataIndex: number }[]) => {
              const idx = items[0]?.dataIndex;
              if (idx == null) return '';
              return days[idx]?.date ?? '';
            },
            label: (item: { parsed: { y: number } }) => `${item.parsed.y} events`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 20,
            font: { size: 10 },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 10 } },
        },
      },
      onClick: (_: unknown, elements: { index: number }[]) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const day = days[idx];
          if (day) onDayClick(day.date);
        }
      },
    }),
    [days, onDayClick],
  );

  return (
    <div className="w-full h-full">
      <Bar ref={chartRef} data={chartData} options={options as any} />
    </div>
  );
}
