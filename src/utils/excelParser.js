import * as XLSX from 'xlsx';

export const DAYS_OF_WEEK = [
  'LUNES',
  'MARTES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SÁBADO',
  'DOMINGO',
];

/**
 * Convierte un valor de celda (fracción decimal de Excel o texto) a formato HH:MM:SS
 */
export function normalizeTimeValue(val) {
  if (val === null || val === undefined) return '';

  // Si viene como número decimal de tiempo de Excel (ej. 0.190972222 -> 4:35:00)
  if (typeof val === 'number') {
    if (val <= 0) return '00:00:00';
    const totalSeconds = Math.round(val * 86400);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  const str = String(val).trim();
  if (!str) return '';

  // Si es formato HH:MM sin segundos, añadir :00
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    return `${str}:00`;
  }

  // Si es formato 04:35:00 -> quitar el cero inicial de la hora para dejar 4:35:00 como en el ejemplo
  if (/^0\d:\d{2}:\d{2}$/.test(str)) {
    return str.substring(1);
  }

  return str;
}

/**
 * Determina si el horario de inicio corresponde a un día LIBRE
 */
export function isDayFree(rawStart) {
  const normalized = normalizeTimeValue(rawStart).toUpperCase();
  if (!normalized) return true;

  const zeroPatterns = ['00:00:00', '0:00:00', '00:00', '0:00', '0', '-'];
  if (zeroPatterns.includes(normalized)) return true;

  const freeKeywords = [
    'LIBRE',
    'L. MEDICA',
    'L. MÉDICA',
    'L.MEDICA',
    'L.MÉDICA',
    'LICENCIA',
    'VACACIONES',
    'DESCANSO',
    'PERMISO',
    'SIN TURNO',
  ];

  if (freeKeywords.some((kw) => normalized.includes(kw))) {
    return true;
  }

  // Si no contiene ningún formato de hora (dígitos con ':'), también se considera libre/ausencia
  if (!/\d{1,2}:\d{2}/.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Intenta extraer el rango de fechas desde la fila 0 del Excel (ej. "16-11 al 22-11")
 */
export function extractDateRangeFromRow0(row0) {
  if (!Array.isArray(row0) || row0.length === 0) return '';

  const formatCellDate = (cell) => {
    if (cell === null || cell === undefined || cell === '') return null;

    if (typeof cell === 'number' && cell > 30000 && cell < 60000) {
      const parsed = XLSX.SSF.parse_date_code(cell);
      if (parsed && parsed.d && parsed.m) {
        return `${String(parsed.d).padStart(2, '0')}-${String(parsed.m).padStart(2, '0')}`;
      }
    }

    const str = String(cell).trim();
    // Si ya tiene un rango tipo "16-11 al 22-11"
    const rangeMatch = str.match(/(\d{1,2}[-/]\d{1,2})\s*(?:al|a|-)\s*(\d{1,2}[-/]\d{1,2})/i);
    if (rangeMatch) {
      return `${rangeMatch[1].replace('/', '-')} al ${rangeMatch[2].replace('/', '-')}`;
    }

    // Buscar fecha tipo DD-MM-YYYY, DD/MM/YYYY o DD-MM
    const dateMatch = str.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
    if (dateMatch) {
      return `${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
    }

    // Buscar fecha tipo YYYY-MM-DD
    const isoMatch = str.match(/^\d{4}[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[2].padStart(2, '0')}-${isoMatch[1].padStart(2, '0')}`;
    }

    return null;
  };

  // Revisar si alguna celda ya contiene el rango completo
  for (const cell of row0) {
    if (cell && String(cell).toLowerCase().includes(' al ')) {
      const formatted = formatCellDate(cell);
      if (formatted) return formatted;
    }
  }

  // Revisar columnas 6 a 12 (Lunes a Domingo)
  const firstDay = formatCellDate(row0[6]);
  const lastDay = formatCellDate(row0[12]);
  if (firstDay && lastDay) {
    return `${firstDay} al ${lastDay}`;
  }

  // Buscar todas las fechas válidas en la fila 0
  const validDates = row0.map(formatCellDate).filter(Boolean);
  if (validDates.length >= 2) {
    return `${validDates[0]} al ${validDates[validDates.length - 1]}`;
  }

  return '';
}

/**
 * Procesa el archivo Excel (.xlsx / .xls) y retorna la lista de conductores y rango de fechas detectado
 */
export async function parseScheduleExcel(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas válidas.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Obtener matriz de filas usando el texto formateado (raw: false) para conservar formatos de hora
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (!rows || rows.length < 2) {
    throw new Error(
      'El archivo Excel no tiene suficientes filas. Recuerda que la fila 0 contiene las fechas y desde la fila 1 comienzan los datos.'
    );
  }

  const detectedDateRange = extractDateRangeFromRow0(rows[0]);
  const drivers = [];

  // Procesar desde la fila 1 en adelante
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const codigo = String(row[0] ?? '').trim();
    const rut = String(row[1] ?? '').trim();
    const nombre = String(row[2] ?? '').trim();
    const extremo = String(row[4] ?? '').trim();

    // Ignorar filas completamente vacías
    if (!codigo && !nombre) continue;

    // Ignorar fila si es un encabezado de columnas (ej. "CODIGO", "LEGAJO", "NOMBRES Y APELLIDOS")
    const upperCode = codigo.toUpperCase();
    const upperName = nombre.toUpperCase();
    if (
      upperCode === 'CODIGO' ||
      upperCode === 'CÓDIGO' ||
      upperCode === 'LEGAJO' ||
      upperName.includes('NOMBRES Y APELLIDOS') ||
      upperName === 'NOMBRE' ||
      upperName === 'CONDUCTOR'
    ) {
      continue;
    }

    const schedule = DAYS_OF_WEEK.map((dayName, dayIdx) => {
      const rawStart = row[6 + dayIdx];
      const rawEnd = row[13 + dayIdx];
      const rawDur = row[20 + dayIdx];

      const free = isDayFree(rawStart);

      return {
        day: dayName,
        isFree: free,
        ini: free ? '' : normalizeTimeValue(rawStart),
        fin: free ? '' : normalizeTimeValue(rawEnd),
        dur: free ? 'LIBRE' : normalizeTimeValue(rawDur),
        servicio: '',
      };
    });

    drivers.push({
      id: `${codigo || i}-${i}`,
      rowIndex: i + 1,
      codigo: codigo || 'S/C',
      rut,
      nombre: nombre || 'CONDUCTOR SIN NOMBRE',
      extremo: extremo || 'Santa Marta',
      schedule,
    });
  }

  if (drivers.length === 0) {
    throw new Error(
      'No se encontraron conductores válidos en el archivo. Verifica que las columnas 0 (Código), 2 (Nombre) y 6..26 (Horarios) tengan el formato esperado.'
    );
  }

  return {
    drivers,
    detectedDateRange,
    sheetName: firstSheetName,
  };
}

/**
 * Genera y descarga un archivo Excel (.xlsx) de ejemplo con la estructura exacta solicitada
 */
export function downloadSampleExcel() {
  const row0 = Array(27).fill('');
  row0[0] = 'FECHAS';
  row0[6] = '16-11-2026';
  row0[7] = '17-11-2026';
  row0[8] = '18-11-2026';
  row0[9] = '19-11-2026';
  row0[10] = '20-11-2026';
  row0[11] = '21-11-2026';
  row0[12] = '22-11-2026';

  const sampleDrivers = [
    [
      '10452',
      '15.432.198-K',
      'JUAN CARLOS PÉREZ GONZÁLEZ',
      '',
      'Santa Marta',
      '',
      // INICIO (Cols 6-12)
      '4:35:00',
      '4:35:00',
      '00:00:00',
      '14:15:00',
      '14:15:00',
      '5:00:00',
      '00:00:00',
      // TÉRMINO (Cols 13-19)
      '13:05:00',
      '13:05:00',
      '00:00:00',
      '22:45:00',
      '22:45:00',
      '13:30:00',
      '00:00:00',
      // DURACIÓN (Cols 20-26)
      '8:30:00',
      '8:30:00',
      '00:00:00',
      '8:30:00',
      '8:30:00',
      '8:30:00',
      '00:00:00',
    ],
    [
      '10891',
      '17.890.234-5',
      'MARÍA FERNANDA SOTO ROJAS',
      '',
      'Santa Marta',
      '',
      // INICIO (Cols 6-12)
      '6:10:00',
      '6:10:00',
      '6:10:00',
      'L. Medica',
      'L. Medica',
      '00:00:00',
      '7:00:00',
      // TÉRMINO (Cols 13-19)
      '14:40:00',
      '14:40:00',
      '14:40:00',
      '00:00:00',
      '00:00:00',
      '00:00:00',
      '15:30:00',
      // DURACIÓN (Cols 20-26)
      '8:30:00',
      '8:30:00',
      '8:30:00',
      '00:00:00',
      '00:00:00',
      '00:00:00',
      '8:30:00',
    ],
    [
      '11204',
      '14.221.908-2',
      'PEDRO ANTONIO MUÑOZ VERA',
      '',
      'T1',
      '',
      // INICIO (Cols 6-12)
      'Vacaciones',
      'Vacaciones',
      '13:20:00',
      '13:20:00',
      '13:20:00',
      '13:20:00',
      '00:00:00',
      // TÉRMINO (Cols 13-19)
      '',
      '',
      '21:50:00',
      '21:50:00',
      '21:50:00',
      '21:50:00',
      '',
      // DURACIÓN (Cols 20-26)
      '',
      '',
      '8:30:00',
      '8:30:00',
      '8:30:00',
      '8:30:00',
      '',
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet([row0, ...sampleDrivers]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Programacion');
  XLSX.writeFile(wb, 'ejemplo_programacion_turnos.xlsx');
}
