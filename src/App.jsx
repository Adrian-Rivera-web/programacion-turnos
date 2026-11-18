import React, { useState, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  Upload,
  FileSpreadsheet,
  Calendar,
  MapPin,
  Search,
  Download,
  AlertCircle,
  Trash2,
  Sparkles,
  Loader2,
  Users,
  CheckCircle2,
} from 'lucide-react';
import ScheduleCard from './components/ScheduleCard';
import { parseScheduleExcel, downloadSampleExcel } from './utils/excelParser';

export default function App() {
  const [drivers, setDrivers] = useState([]);
  const [fileName, setFileName] = useState('');
  const [dateRange, setDateRange] = useState('16-11 al 22-11');
  const [globalLocation, setGlobalLocation] = useState('Santa Marta');
  const [useExcelLocation, setUseExcelLocation] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Estado para descarga masiva en ZIP
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0 });

  // Mapa de referencias DOM de cada tarjeta para captura masiva
  const cardRefsMap = useRef(new Map());
  const fileInputRef = useRef(null);

  const registerCardRef = (driverId, element) => {
    if (element) {
      cardRefsMap.current.set(driverId, element);
    } else {
      cardRefsMap.current.delete(driverId);
    }
  };

  const handleFileProcess = async (file) => {
    if (!file) return;

    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    if (!validExtensions.some((ext) => lowerName.endsWith(ext))) {
      setError(
        'Formato de archivo no válido. Por favor sube un archivo Excel (.xlsx o .xls).'
      );
      return;
    }

    setError('');
    setIsProcessingFile(true);

    try {
      const { drivers: parsedDrivers, detectedDateRange } =
        await parseScheduleExcel(file);

      setDrivers(parsedDrivers);
      setFileName(file.name);

      if (detectedDateRange) {
        setDateRange(detectedDateRange);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message ||
          'No se pudo procesar el archivo Excel. Verifica que tenga la estructura correcta.'
      );
      setDrivers([]);
      setFileName('');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleClear = () => {
    setDrivers([]);
    setFileName('');
    setSearchTerm('');
    setError('');
    cardRefsMap.current.clear();
  };

  // Filtrado por nombre, código/legajo o RUT
  const filteredDrivers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return drivers;
    return drivers.filter(
      (d) =>
        d.nombre.toLowerCase().includes(query) ||
        d.codigo.toLowerCase().includes(query) ||
        d.rut.toLowerCase().includes(query) ||
        d.extremo.toLowerCase().includes(query)
    );
  }, [drivers, searchTerm]);

  // Descargar todas las tarjetas visibles en un archivo .ZIP
  const handleDownloadAllZip = async () => {
    if (filteredDrivers.length === 0 || isZipping) return;

    setIsZipping(true);
    setZipProgress({ current: 0, total: filteredDrivers.length });

    try {
      const zip = new JSZip();
      const folderName = `Programacion_${(dateRange || 'Turnos').replace(
        /[^a-zA-Z0-9_-]/g,
        '_'
      )}`;
      const imgFolder = zip.folder(folderName);

      for (let i = 0; i < filteredDrivers.length; i++) {
        const driver = filteredDrivers[i];
        setZipProgress({ current: i + 1, total: filteredDrivers.length });

        const element = cardRefsMap.current.get(driver.id);
        if (!element) continue;

        const canvas = await html2canvas(element, {
          scale: 2,
          backgroundColor: '#ffffff',
          useCORS: true,
          logging: false,
          windowWidth: 1200,
        });

        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );

        if (blob) {
          const safeName = driver.nombre
            .replace(/[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ\s_-]/g, '')
            .trim()
            .replace(/\s+/g, '_');
          const fileNamePng = `Programacion_${driver.codigo}_${safeName}.png`;
          imgFolder.file(fileNamePng, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${folderName}.zip`);
    } catch (err) {
      console.error('Error al generar archivo ZIP:', err);
      alert('Ocurrió un error durante la generación del archivo ZIP.');
    } finally {
      setIsZipping(false);
      setZipProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Header Principal */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Generador de Tarjetas de Programación
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Convierte planillas Excel de turnos en tarjetas PNG listas para
                enviar a cada conductor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={downloadSampleExcel}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
              title="Descarga un archivo Excel de prueba con la estructura exacta requerida"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Descargar Excel de Ejemplo
            </button>

            {drivers.length > 0 && (
              <button
                onClick={handleDownloadAllZip}
                disabled={isZipping || filteredDrivers.length === 0}
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generando ZIP ({zipProgress.current}/{zipProgress.total})...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Descargar Todas ({filteredDrivers.length}) en ZIP
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Panel Superior: Zona de Carga y Controles */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Zona Drag & Drop (Columna Izquierda) */}
          <div className="lg:col-span-5 flex flex-col">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex-1 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all text-center min-h-[210px] ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70'
                  : fileName
                  ? 'border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/50'
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50/80'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {isProcessingFile ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  <p className="text-sm font-semibold text-slate-700">
                    Procesando archivo Excel...
                  </p>
                </div>
              ) : fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 break-all px-2">
                    {fileName}
                  </p>
                  <p className="text-xs text-emerald-700 font-medium">
                    {drivers.length} conductores cargados correctamente
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm">
                      Cambiar archivo
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClear();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Limpiar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-1">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Haz clic para subir o arrastra tu archivo Excel aquí
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Soporta archivos <span className="font-mono">.xlsx</span> o{' '}
                    <span className="font-mono">.xls</span> con la programación
                    semanal de conductores
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Controles de Configuración (Columna Derecha) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Configuración de las Tarjetas
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Personaliza el encabezado de fechas y el terminal/lugar que se
                mostrará en las tarjetas generadas.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Input de Rango de Fechas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Rango de Fechas (Subtítulo)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      placeholder="Ej: 16-11 al 22-11"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Se muestra entre paréntesis debajo del título:{' '}
                    <span className="font-medium">({dateRange || '...'})</span>
                  </p>
                </div>

                {/* Input de Lugar Global */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Lugar / Terminal Global
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={globalLocation}
                      onChange={(e) => setGlobalLocation(e.target.value)}
                      placeholder="Ej: Santa Marta"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useExcelLocation}
                      onChange={(e) => setUseExcelLocation(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-slate-600">
                      Usar columna 4 (Extremo/Lugar) de cada fila si existe
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Buscador de conductores */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar por nombre, código/legajo o RUT..."
                  disabled={drivers.length === 0}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
                <span>
                  Mostrando <strong>{filteredDrivers.length}</strong> de{' '}
                  <strong>{drivers.length}</strong> conductores
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Mensaje de Error si el archivo falla */}
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3 text-rose-800">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold">Error al procesar el archivo</p>
              <p className="mt-0.5 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* Barra de progreso durante la creación del ZIP */}
        {isZipping && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
              <span>
                Renderizando tarjetas en alta resolución y comprimiendo archivo
                ZIP...
              </span>
              <span>
                {zipProgress.current} / {zipProgress.total} (
                {Math.round((zipProgress.current / zipProgress.total) * 100)}%)
              </span>
            </div>
            <div className="w-full h-2 bg-blue-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-200"
                style={{
                  width: `${(zipProgress.current / zipProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Cuadrícula de Tarjetas Generadas */}
        {drivers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              Aún no se ha cargado ninguna programación
            </h3>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Sube tu archivo <span className="font-mono">.xlsx</span> en el
              recuadro superior o haz clic en{' '}
              <strong>&ldquo;Descargar Excel de Ejemplo&rdquo;</strong> para
              probar inmediatamente la generación y descarga de tarjetas.
            </p>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
            <p className="text-sm font-medium text-slate-600">
              No se encontraron conductores que coincidan con &ldquo;
              <strong>{searchTerm}</strong>&rdquo;.
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 gap-8">
            {filteredDrivers.map((driver) => (
              <ScheduleCard
                key={driver.id}
                driver={driver}
                dateRange={dateRange}
                globalLocation={globalLocation}
                useExcelLocation={useExcelLocation}
                registerCardRef={registerCardRef}
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
