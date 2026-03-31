import { useCallback, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  /** Time as "HH:mm" 24-hour string, e.g. "14:30" */
  value: string;
  /** Called with new "HH:mm" string when selection changes */
  onChange: (time: string) => void;
  /** Optional className for the container */
  className?: string;
  /** Whether to show the clock icon */
  showIcon?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i);
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/**
 * A reliable time picker using Select dropdowns instead of `<input type="time">`
 * which is unreliable in some browser environments.
 */
export function TimePicker({ value, onChange, className, showIcon = true }: TimePickerProps) {
  // Parse "HH:mm" into parts
  const parsed = useMemo(() => {
    const [h, m] = value.split(':').map(Number);
    const hour24 = isNaN(h) ? 12 : h;
    const minute = isNaN(m) ? 0 : m;
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    // Round minute to nearest 5
    const roundedMinute = Math.round(minute / 5) * 5;
    const minuteStr = String(roundedMinute >= 60 ? 0 : roundedMinute).padStart(2, '0');
    return { hour12, minuteStr, period };
  }, [value]);

  const buildTime = useCallback((hour12: number, minute: string, period: string) => {
    let hour24 = hour12;
    if (period === 'AM') {
      hour24 = hour12 === 12 ? 0 : hour12;
    } else {
      hour24 = hour12 === 12 ? 12 : hour12 + 12;
    }
    return `${String(hour24).padStart(2, '0')}:${minute}`;
  }, []);

  const handleHourChange = useCallback((h: string) => {
    onChange(buildTime(parseInt(h), parsed.minuteStr, parsed.period));
  }, [onChange, buildTime, parsed]);

  const handleMinuteChange = useCallback((m: string) => {
    onChange(buildTime(parsed.hour12, m, parsed.period));
  }, [onChange, buildTime, parsed]);

  const handlePeriodChange = useCallback((p: string) => {
    onChange(buildTime(parsed.hour12, parsed.minuteStr, p));
  }, [onChange, buildTime, parsed]);

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {showIcon && (
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
      )}
      {/* Hour select */}
      <Select value={String(parsed.hour12)} onValueChange={handleHourChange}>
        <SelectTrigger className="w-[68px] h-9 text-sm px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS_12.map(h => (
            <SelectItem key={h} value={String(h)} className="text-sm">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground font-bold text-lg leading-none">:</span>

      {/* Minute select */}
      <Select value={parsed.minuteStr} onValueChange={handleMinuteChange}>
        <SelectTrigger className="w-[68px] h-9 text-sm px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map(m => (
            <SelectItem key={m} value={m} className="text-sm">
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* AM/PM toggle */}
      <Select value={parsed.period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-[68px] h-9 text-sm px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM" className="text-sm">AM</SelectItem>
          <SelectItem value="PM" className="text-sm">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
