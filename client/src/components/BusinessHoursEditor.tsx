import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAY_NAMES, DEFAULT_WEEK_SCHEDULE, type WeekSchedule, type DaySchedule } from "../../../shared/businessHours";

interface BusinessHoursEditorProps {
  value: WeekSchedule;
  onChange: (schedule: WeekSchedule) => void;
}

export function BusinessHoursEditor({ value, onChange }: BusinessHoursEditorProps) {
  const schedule = { ...DEFAULT_WEEK_SCHEDULE, ...value };

  function toggleDay(dayKey: string, enabled: boolean) {
    const updated: WeekSchedule = { ...schedule };
    if (enabled) {
      // Usa horário padrão ou copia do dia anterior
      const prev = DEFAULT_WEEK_SCHEDULE[dayKey];
      updated[dayKey] = prev ?? { open: "09:00", close: "18:00" };
    } else {
      updated[dayKey] = null;
    }
    onChange(updated);
  }

  function updateTime(dayKey: string, field: "open" | "close", time: string) {
    const current = schedule[dayKey];
    if (!current) return;
    const updated: WeekSchedule = {
      ...schedule,
      [dayKey]: { ...current, [field]: time },
    };
    onChange(updated);
  }

  return (
    <div className="space-y-1">
      {Array.from({ length: 7 }, (_, i) => String(i)).map((dayKey) => {
        const day: DaySchedule = schedule[dayKey] ?? null;
        const isEnabled = day !== null;

        return (
          <div
            key={dayKey}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
              isEnabled ? "bg-muted/40" : "opacity-60"
            }`}
          >
            {/* Toggle + nome do dia */}
            <Switch
              id={`day-${dayKey}`}
              checked={isEnabled}
              onCheckedChange={(checked) => toggleDay(dayKey, checked)}
              className="shrink-0"
            />
            <Label
              htmlFor={`day-${dayKey}`}
              className="w-16 text-sm font-medium cursor-pointer select-none shrink-0"
            >
              {DAY_NAMES[dayKey]}
            </Label>

            {/* Campos de horário */}
            {isEnabled && day ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  type="time"
                  value={day.open}
                  onChange={(e) => updateTime(dayKey, "open", e.target.value)}
                  className="h-8 w-28 text-sm"
                  aria-label={`Abertura ${DAY_NAMES[dayKey]}`}
                />
                <span className="text-muted-foreground text-xs shrink-0">até</span>
                <Input
                  type="time"
                  value={day.close}
                  onChange={(e) => updateTime(dayKey, "close", e.target.value)}
                  className="h-8 w-28 text-sm"
                  aria-label={`Fechamento ${DAY_NAMES[dayKey]}`}
                />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground flex-1">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
