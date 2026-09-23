// backend/src/utils/brazil-holidays.ts
// Módulo canónico de feriados nacionais do Brasil.
// Fuente de verdad: el frontend duplica esta lógica (no puede importar del backend).

function easterDate(year: number): Date {
  // Algoritmo de Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function getBrazilHolidays(year: number): string[] {
  const easter = easterDate(year);
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return [
    `${year}-01-01`, // Año Nuevo
    fmt(addDays(easter, -50)), // Carnaval sábado
    fmt(addDays(easter, -49)), // Carnaval domingo
    fmt(addDays(easter, -48)), // Carnaval lunes
    fmt(addDays(easter, -47)), // Carnaval martes
    fmt(addDays(easter, -2)),  // Viernes Santo
    fmt(easter),               // Pascua
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Día del Trabajo
    fmt(addDays(easter, 60)),  // Corpus Christi
    `${year}-09-07`, // Independencia
    `${year}-10-12`, // N.S. Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra
    `${year}-12-25`, // Navidad
    `${year}-12-31`, // Réveillon
  ];
}

export interface HolidayBlockPreset {
  key: string;
  name: string;
  startDate: string;
  endDate: string;
}

/** Presets de bloqueo masivo para el admin: un feriado nombrado con su
 *  ventana ±7 días ya calculada (mismo buffer que apartment_holiday_periods,
 *  0039/0041), para que el admin bloquee todas las habitaciones de un click
 *  y solo tenga que editar el rango si quiere algo distinto. */
export function getHolidayBlockPresets(year: number): HolidayBlockPreset[] {
  const easter = easterDate(year);
  const addDays = (d: Date, n: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  };
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const around = (d: Date) => ({ startDate: fmt(addDays(d, -7)), endDate: fmt(addDays(d, 7)) });

  const carnivalStart = addDays(easter, -50); // sábado
  const carnivalEnd = addDays(easter, -47);   // terça-feira
  const goodFriday = addDays(easter, -2);
  const newYearsEve = new Date(year, 11, 31);

  return [
    { key: 'ano_novo', name: `Ano Novo ${year}`, ...around(new Date(year, 0, 1)) },
    { key: 'carnaval', name: `Carnaval ${year}`, startDate: fmt(addDays(carnivalStart, -7)), endDate: fmt(addDays(carnivalEnd, 7)) },
    { key: 'semana_santa', name: `Semana Santa ${year}`, startDate: fmt(addDays(goodFriday, -7)), endDate: fmt(addDays(easter, 7)) },
    { key: 'tiradentes', name: `Tiradentes ${year}`, ...around(new Date(year, 3, 21)) },
    { key: 'trabalho', name: `Día del Trabajo ${year}`, ...around(new Date(year, 4, 1)) },
    { key: 'corpus_christi', name: `Corpus Christi ${year}`, ...around(addDays(easter, 60)) },
    { key: 'independencia', name: `Independência ${year}`, ...around(new Date(year, 8, 7)) },
    { key: 'aparecida', name: `N.S. Aparecida ${year}`, ...around(new Date(year, 9, 12)) },
    { key: 'finados', name: `Finados ${year}`, ...around(new Date(year, 10, 2)) },
    { key: 'republica', name: `Proclamação da República ${year}`, ...around(new Date(year, 10, 15)) },
    { key: 'consciencia_negra', name: `Consciência Negra ${year}`, ...around(new Date(year, 10, 20)) },
    { key: 'natal', name: `Natal ${year}`, ...around(new Date(year, 11, 25)) },
    { key: 'reveillon', name: `Réveillon ${year}`, startDate: fmt(addDays(newYearsEve, -7)), endDate: fmt(addDays(newYearsEve, 7)) },
  ];
}

export function isBrazilHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.substring(0, 4), 10);
  const checkDate = new Date(dateStr + 'T00:00:00');
  const holidays = [
    ...getBrazilHolidays(year - 1),
    ...getBrazilHolidays(year),
    ...getBrazilHolidays(year + 1),
  ];
  return holidays.some(h => {
    const hDate = new Date(h + 'T00:00:00');
    const diffDays = Math.round(Math.abs(checkDate.getTime() - hDate.getTime()) / 86400000);
    return diffDays <= 7;
  });
}
