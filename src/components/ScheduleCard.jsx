import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2, Check } from 'lucide-react';

/**
 * Componente visual de la Tarjeta de Programación de un conductor.
 * El div capturable tiene un ancho fijo de 800px (w-[800px]) para garantizar
 * que html2canvas genere siempre un PNG idéntico sin deformarse.
 */
const ScheduleCard = ({
  driver,
  dateRange,
  globalLocation,
  useExcelLocation,
  registerCardRef,
}) => {
  const cardRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  // Determinar el lugar a mostrar en el título y en la columna LUGAR
  const resolvedLocation =
    useExcelLocation && driver.extremo
      ? driver.extremo
      : globalLocation || driver.extremo || 'Santa Marta';

  const tableLocationUpper = resolvedLocation.toUpperCase();
  const formattedDateSubtitle = dateRange
    ? dateRange.startsWith('(')
      ? dateRange
      : `(${dateRange})`
    : '(Sin fechas definidas)';

  // Registrar referencia en el componente padre para permitir la descarga masiva en ZIP
  const setRefs = (element) => {
    cardRef.current = element;
    if (registerCardRef) {
      registerCardRef(driver.id, element);
    }
  };

  const handleDownloadSingle = async () => {
    if (!cardRef.current || isDownloading) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // Alta resolución (1600px de ancho efectivo)
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });

      const dataUrl = canvas.toDataURL('image/png');
      const safeName = driver.nombre
        .replace(/[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_');

      const link = document.createElement('a');
      link.download = `Programacion_${driver.codigo}_${safeName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (error) {
      console.error('Error al generar la imagen PNG:', error);
      alert('Ocurrió un error al generar la imagen de la tarjeta.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col bg-slate-100 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Barra superior de acciones de la tarjeta (No sale en el PNG) */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-lime-300 text-slate-900 border border-lime-400">
            #{driver.codigo}
          </span>
          <span className="font-semibold text-sm text-slate-800 truncate">
            {driver.nombre}
          </span>
          {driver.rut && (
            <span className="text-xs text-slate-400 hidden sm:inline">
              ({driver.rut})
            </span>
          )}
        </div>

        <button
          onClick={handleDownloadSingle}
          disabled={isDownloading}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm shrink-0 ${
            downloaded
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-95'
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generando...
            </>
          ) : downloaded ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Descargado
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Descargar Imagen
            </>
          )}
        </button>
      </div>

      {/* Contenedor con scroll horizontal suave en pantallas pequeñas */}
      <div className="overflow-x-auto p-4 flex justify-center bg-slate-100">
        {/* ===================================================================
            ÁREA CAPTURADA POR HTML2CANVAS (Ancho fijo estricto w-[800px])
           =================================================================== */}
        <div
          ref={setRefs}
          className="w-[800px] min-w-[800px] bg-white text-slate-900 p-10 border border-slate-300 shadow-sm"
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            backgroundColor: '#ffffff',
            color: '#0f172a',
          }}
        >
          {/* Encabezado */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Asignaciones de Programación — {resolvedLocation}
            </h2>
            <p className="text-lg font-semibold text-slate-700 mt-1">
              {formattedDateSubtitle}
            </p>
          </div>

          {/* Saludo y Mensaje */}
          <div className="text-left space-y-2 mb-5 text-[15px] leading-relaxed">
            <p className="font-bold text-slate-900">
              Estimad@ {driver.nombre}:
            </p>
            <p className="text-slate-800">
              Le informamos los servicios programados para los días que se
              indican. Considerar esta programación.
            </p>
          </div>

          {/* Código / Legajo resaltado */}
          <div className="mb-4 text-left">
            <span className="font-bold text-[15px] text-slate-900 mr-2">
              CODIGO
            </span>
            <span
              className="inline-block font-bold text-[15px] px-2.5 py-0.5 bg-lime-300 text-slate-900 border border-slate-400"
              style={{ backgroundColor: '#bef264' }}
            >
              {driver.codigo}
            </span>
          </div>

          {/* Tabla de Turnos */}
          <table className="w-full border-collapse border border-slate-300 text-sm">
            <thead>
              <tr
                className="bg-slate-200 text-slate-900"
                style={{ backgroundColor: '#e2e8f0' }}
              >
                <th className="border border-slate-300 py-2 px-3 text-center font-bold w-[16%]">
                  DÍA
                </th>
                <th className="border border-slate-300 py-2 px-3 text-center font-bold w-[14%]">
                  INI
                </th>
                <th className="border border-slate-300 py-2 px-3 text-center font-bold w-[14%]">
                  FIN
                </th>
                <th className="border border-slate-300 py-2 px-3 text-center font-bold w-[14%]">
                  DUR
                </th>
                <th className="border border-slate-300 py-2 px-3 text-center font-bold w-[24%]">
                  LUGAR
                </th>
                <th className="border border-slate-300 py-2 px-3 text-center font-bold w-[18%]">
                  SERVICIO
                </th>
              </tr>
            </thead>
            <tbody>
              {driver.schedule.map((row) => (
                <tr key={row.day} className="bg-white">
                  <td className="border border-slate-300 py-2 px-3 font-semibold text-left text-slate-900">
                    {row.day}
                  </td>
                  <td className="border border-slate-300 py-2 px-3 text-center text-slate-900">
                    {row.ini}
                  </td>
                  <td className="border border-slate-300 py-2 px-3 text-center text-slate-900">
                    {row.fin}
                  </td>
                  <td
                    className={`border border-slate-300 py-2 px-3 text-center ${
                      row.isFree
                        ? 'font-bold text-slate-900'
                        : 'text-slate-900'
                    }`}
                  >
                    {row.dur}
                  </td>
                  <td className="border border-slate-300 py-2 px-3 text-center font-medium text-slate-900">
                    {tableLocationUpper}
                  </td>
                  <td className="border border-slate-300 py-2 px-3 text-center text-slate-900">
                    {row.servicio}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ScheduleCard;
