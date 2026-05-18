import { useDashboardFilters } from '../../contexts/DashboardFilterContext';
import { Card, CardBody } from '../ui/Card';
import { Calendar } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

function getAvailableYears() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const maxMonth = currentMonth + 3;
  const maxYear = maxMonth > 12 ? currentYear + 1 : currentYear;
  const startYear = 2020;
  const years = [];
  for (let y = maxYear; y >= startYear; y--) {
    years.push(y);
  }
  return years;
}

function isMonthDisabled(monthValue, selectedYear) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const maxTotalMonths = currentYear * 12 + currentMonth + 3;
  const selectedTotalMonths = selectedYear * 12 + monthValue;
  return selectedTotalMonths > maxTotalMonths;
}

function isYearDisabled(yearValue) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const maxTotalMonths = currentYear * 12 + currentMonth + 3;
  const maxAllowedYear = Math.floor((maxTotalMonths - 1) / 12);
  return yearValue > maxAllowedYear;
}

export function GlobalFilters() {
  const { granularity, month, year, setGranularity, setMonth, setYear } = useDashboardFilters();
  const { isDark } = useTheme();

  const selectClass = isDark
    ? 'rounded-lg border border-[#3d4543] bg-[#1e2322] px-3 py-2 text-sm text-[#d4e4d1] outline-none transition-colors focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]'
    : 'rounded-lg border border-[#b0b087] bg-white px-3 py-2 text-sm text-[#4b5757] outline-none transition-colors focus:border-[#58706d] focus:ring-1 focus:ring-[#58706d]';

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar size={18} className={isDark ? 'text-[#7c8a6e]' : 'text-[#58706d]'} />
          <span className={`text-sm font-medium ${isDark ? 'text-[#d4e4d1]' : 'text-[#4b5757]'}`}>Filtros</span>
        </div>

        {/* Granularity selector */}
        <div className={`flex items-center gap-1 rounded-lg border p-1 ${isDark ? 'border-[#3d4543]' : 'border-[#e3e3d1]'}`}>
          <button
            type="button"
            onClick={() => setGranularity('monthly')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              granularity === 'monthly'
                ? 'bg-[#58706d] text-white'
                : isDark ? 'text-[#d4e4d1] hover:bg-[#3d4543]' : 'text-[#4b5757] hover:bg-[#f5f5ee]'
            }`}
          >
            Mensal
          </button>
          <button
            type="button"
            onClick={() => setGranularity('annual')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              granularity === 'annual'
                ? 'bg-[#58706d] text-white'
                : isDark ? 'text-[#d4e4d1] hover:bg-[#3d4543]' : 'text-[#4b5757] hover:bg-[#f5f5ee]'
            }`}
          >
            Anual
          </button>
        </div>

        {/* Month selector */}
        {granularity === 'monthly' && (
          <div className="flex flex-col gap-1">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className={selectClass}
            >
              {MONTHS.map(({ value: mv, label }) => (
                <option key={mv} value={mv} disabled={isMonthDisabled(mv, year)}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Year selector */}
        <div className="flex flex-col gap-1">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={selectClass}
          >
            {getAvailableYears().map((y) => (
              <option key={y} value={y} disabled={isYearDisabled(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </CardBody>
    </Card>
  );
}
