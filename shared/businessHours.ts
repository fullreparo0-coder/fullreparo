/**
 * Horário de funcionamento estruturado por dia da semana.
 * Armazenado como JSON no campo `businessHours` da tabela tenants.
 *
 * Formato:
 * {
 *   "0": null,                          // Domingo — fechado
 *   "1": { open: "09:00", close: "18:00" },  // Segunda
 *   "2": { open: "09:00", close: "18:00" },  // Terça
 *   ...
 *   "6": { open: "09:00", close: "13:00" },  // Sábado
 * }
 */

export type DaySchedule = { open: string; close: string } | null;

/** Mapa de 0 (Dom) a 6 (Sáb) */
export type WeekSchedule = Record<string, DaySchedule>;

export const DAY_NAMES: Record<string, string> = {
  "0": "Domingo",
  "1": "Segunda",
  "2": "Terça",
  "3": "Quarta",
  "4": "Quinta",
  "5": "Sexta",
  "6": "Sábado",
};

export const DAY_NAMES_SHORT: Record<string, string> = {
  "0": "Dom",
  "1": "Seg",
  "2": "Ter",
  "3": "Qua",
  "4": "Qui",
  "5": "Sex",
  "6": "Sáb",
};

/** Valor padrão: Seg–Sex 9h–18h, Sáb 9h–13h, Dom fechado */
export const DEFAULT_WEEK_SCHEDULE: WeekSchedule = {
  "0": null,
  "1": { open: "09:00", close: "18:00" },
  "2": { open: "09:00", close: "18:00" },
  "3": { open: "09:00", close: "18:00" },
  "4": { open: "09:00", close: "18:00" },
  "5": { open: "09:00", close: "18:00" },
  "6": { open: "09:00", close: "13:00" },
};

/**
 * Converte string JSON ou texto livre para WeekSchedule.
 * Retorna null se não for possível parsear.
 */
export function parseBusinessHours(raw: string | null | undefined): WeekSchedule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Verifica se tem pelo menos uma chave numérica (0-6)
    if (typeof parsed === "object" && !Array.isArray(parsed) && "1" in parsed) {
      return parsed as WeekSchedule;
    }
  } catch {
    // Não é JSON — é texto livre legado
  }
  return null;
}

/**
 * Converte WeekSchedule para texto legível resumido.
 * Ex: "Seg–Sex 09:00–18:00 · Sáb 09:00–13:00"
 */
export function formatBusinessHoursText(schedule: WeekSchedule): string {
  const parts: string[] = [];
  let i = 0;
  while (i <= 6) {
    const day = schedule[String(i)];
    if (!day) { i++; continue; }
    // Agrupa dias consecutivos com mesmo horário
    let j = i + 1;
    while (j <= 6 && schedule[String(j)]?.open === day.open && schedule[String(j)]?.close === day.close) {
      j++;
    }
    const range = j - i > 1
      ? `${DAY_NAMES_SHORT[String(i)]}–${DAY_NAMES_SHORT[String(j - 1)]}`
      : DAY_NAMES_SHORT[String(i)];
    parts.push(`${range} ${day.open}–${day.close}`);
    i = j;
  }
  return parts.join(" · ") || "Horário não configurado";
}

/**
 * Verifica se a assistência está aberta agora com base no WeekSchedule.
 * Usa o horário local do navegador/servidor.
 */
export function isOpenNow(schedule: WeekSchedule, now?: Date): boolean {
  const date = now ?? new Date();
  const dayKey = String(date.getDay()); // 0=Dom, 6=Sáb
  const day = schedule[dayKey];
  if (!day) return false;

  const [openH, openM] = day.open.split(":").map(Number);
  const [closeH, closeM] = day.close.split(":").map(Number);
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

/**
 * Retorna o próximo horário de abertura a partir de agora.
 * Ex: "Abre amanhã às 09:00" ou "Abre na Segunda às 09:00"
 */
export function nextOpenTime(schedule: WeekSchedule, now?: Date): string | null {
  const date = now ?? new Date();
  const todayDay = date.getDay();
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  // Verifica os próximos 7 dias
  for (let offset = 0; offset <= 7; offset++) {
    const checkDay = (todayDay + offset) % 7;
    const day = schedule[String(checkDay)];
    if (!day) continue;

    const [openH, openM] = day.open.split(":").map(Number);
    const openMinutes = openH * 60 + openM;

    if (offset === 0 && currentMinutes >= openMinutes) continue; // já passou hoje

    const dayName = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : `na ${DAY_NAMES[String(checkDay)]}`;
    return `Abre ${dayName} às ${day.open}`;
  }
  return null;
}
