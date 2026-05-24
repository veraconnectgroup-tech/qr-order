"use client";

import { Switch } from "@/components/ui/switch";
import {
  SCHEDULE_PRESETS,
  normalizeScheduleDays,
  toTimeInputValue,
} from "@/lib/menu/schedule";

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export type CategoryScheduleFormState = {
  schedule_enabled: boolean;
  schedule_start: string;
  schedule_end: string;
  schedule_days: number[];
};

export function defaultCategoryScheduleState(): CategoryScheduleFormState {
  return {
    schedule_enabled: false,
    schedule_start: "07:00",
    schedule_end: "11:30",
    schedule_days: [1, 2, 3, 4, 5, 6, 0],
  };
}

export function categoryScheduleFromRow(row?: {
  schedule_enabled?: boolean;
  schedule_start?: string | null;
  schedule_end?: string | null;
  schedule_days?: number[] | null;
}): CategoryScheduleFormState {
  if (!row) return defaultCategoryScheduleState();
  return {
    schedule_enabled: row.schedule_enabled ?? false,
    schedule_start: toTimeInputValue(row.schedule_start) || "07:00",
    schedule_end: toTimeInputValue(row.schedule_end) || "11:30",
    schedule_days: normalizeScheduleDays(
      row.schedule_days ?? [1, 2, 3, 4, 5, 6, 0]
    ),
  };
}

export function CategoryScheduleFields({
  value,
  onChange,
}: {
  value: CategoryScheduleFormState;
  onChange: (next: CategoryScheduleFormState) => void;
}) {
  function toggleDay(day: number) {
    const next = new Set(value.schedule_days);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange({
      ...value,
      schedule_days: normalizeScheduleDays([...next]),
    });
  }

  function applyPreset(key: keyof typeof SCHEDULE_PRESETS) {
    const preset = SCHEDULE_PRESETS[key];
    onChange({
      schedule_enabled: true,
      schedule_start: preset.schedule_start,
      schedule_end: preset.schedule_end,
      schedule_days: [...preset.schedule_days],
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dash-border bg-dash-bg/50 p-4">
      <label className="flex items-center justify-between gap-3 text-sm text-dash-text-secondary">
        <span>Time-limited availability</span>
        <Switch
          checked={value.schedule_enabled}
          onCheckedChange={(checked) =>
            onChange({ ...value, schedule_enabled: checked })
          }
        />
      </label>

      {value.schedule_enabled && (
        <>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(SCHEDULE_PRESETS) as Array<keyof typeof SCHEDULE_PRESETS>).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className="rounded-full border border-dash-surface-overlay px-3 py-1 text-xs text-dash-text-secondary hover:border-dash-accent/50 hover:text-dash-accent"
                >
                  {SCHEDULE_PRESETS[key].label}
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs text-dash-text-disabled">From</span>
              <input
                type="time"
                value={value.schedule_start}
                onChange={(e) =>
                  onChange({ ...value, schedule_start: e.target.value })
                }
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs text-dash-text-disabled">To</span>
              <input
                type="time"
                value={value.schedule_end}
                onChange={(e) =>
                  onChange({ ...value, schedule_end: e.target.value })
                }
                className="w-full rounded-lg border border-dash-surface-overlay bg-dash-bg px-3 py-2 text-sm text-dash-text outline-none focus:border-dash-accent"
              />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-xs text-dash-text-disabled">Days</span>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => {
                const active = value.schedule_days.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      active
                        ? "bg-dash-accent/20 text-orange-300"
                        : "bg-dash-surface-raised text-dash-text-disabled"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
