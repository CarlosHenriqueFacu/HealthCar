export type ChartPeriod = 'day' | 'month';

export interface ChartBucket {
  key: string;
  label: string;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildChartBuckets(
  period: ChartPeriod,
  locale = 'pt-BR',
  now = new Date(),
): ChartBucket[] {
  const count = period === 'day' ? 7 : 12;
  const buckets: ChartBucket[] = [];

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    if (period === 'day') {
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - offset);
      buckets.push({
        key: localDateKey(date),
        label: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
      });
    } else {
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      date.setMonth(date.getMonth() - offset);
      const month = new Intl.DateTimeFormat(locale, { month: 'short' })
        .format(date)
        .replace('.', '');
      buckets.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: month,
      });
    }
  }

  return buckets;
}

