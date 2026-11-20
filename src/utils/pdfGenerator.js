import { jsPDF } from 'jspdf';

/**
 * Genera y descarga un archivo PDF con las tarjetas de programación de todos los conductores.
 * Usa dibujo vectorial nativo en jsPDF para que sea instantáneo (incluso con 200+ conductores),
 * liviano y con textos 100% nítidos para imprimir o buscar con Ctrl+F.
 */
export function generateAllSchedulesPdf({
  drivers,
  dateRange,
  globalLocation,
  useExcelLocation,
}) {
  if (!drivers || drivers.length === 0) return;

  // Crear documento en formato A4 Horizontal (297mm x 210mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const cardX = 20;
  const cardY = 18;
  const cardWidth = 257;
  const cardHeight = 170;

  const contentX = 34;
  const contentWidth = 229; // 257 - 28 (14mm padding a cada lado)

  // Porcentajes de columnas idénticos a ScheduleCard.jsx (16%, 14%, 14%, 14%, 24%, 18%)
  const colWidths = [
    contentWidth * 0.16, // DÍA
    contentWidth * 0.14, // INI
    contentWidth * 0.14, // FIN
    contentWidth * 0.14, // DUR
    contentWidth * 0.24, // LUGAR
    contentWidth * 0.18, // SERVICIO
  ];
  const headers = ['DÍA', 'INI', 'FIN', 'DUR', 'LUGAR', 'SERVICIO'];
  const rowHeight = 9.5;

  const formattedDateSubtitle = dateRange
    ? dateRange.startsWith('(')
      ? dateRange
      : `(${dateRange})`
    : '(Sin fechas definidas)';

  drivers.forEach((driver, index) => {
    if (index > 0) {
      doc.addPage('a4', 'landscape');
    }

    const resolvedLocation =
      useExcelLocation && driver.extremo
        ? driver.extremo
        : globalLocation || driver.extremo || 'Santa Marta';
    const tableLocationUpper = resolvedLocation.toUpperCase();

    // 1. Borde exterior de la tarjeta (fondo blanco, borde #cbd5e1)
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.rect(cardX, cardY, cardWidth, cardHeight, 'FD');

    // 2. Encabezado centrado
    doc.setTextColor(15, 23, 42); // #0f172a
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(
      `Asignaciones de Programación — ${resolvedLocation}`,
      pageWidth / 2,
      cardY + 18,
      { align: 'center' }
    );

    // Subtítulo de fechas
    doc.setTextColor(51, 65, 85); // #334155
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(formattedDateSubtitle, pageWidth / 2, cardY + 26, {
      align: 'center',
    });

    // 3. Saludo y Mensaje
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text(`Estimad@ ${driver.nombre}:`, contentX, cardY + 40);

    doc.setTextColor(30, 41, 59); // #1e293b
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(
      'Le informamos los servicios programados para los días que se indican. Considerar esta programación.',
      contentX,
      cardY + 47
    );

    // 4. Código / Legajo resaltado en verde lima (#bef264)
    const codeY = cardY + 54;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('CODIGO', contentX, codeY + 5);

    const codeLabelWidth = doc.getTextWidth('CODIGO');
    const codeStr = String(driver.codigo || '');
    const badgePaddingX = 3.5;
    const badgeWidth = Math.max(doc.getTextWidth(codeStr) + badgePaddingX * 2, 12);
    const badgeHeight = 6.8;
    const badgeX = contentX + codeLabelWidth + 3;
    const badgeY = codeY;

    doc.setFillColor(190, 242, 100); // bg-lime-300 (#bef264)
    doc.setDrawColor(148, 163, 184); // border-slate-400
    doc.setLineWidth(0.3);
    doc.rect(badgeX, badgeY, badgeWidth, badgeHeight, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.text(codeStr, badgeX + badgeWidth / 2, badgeY + 4.8, {
      align: 'center',
    });

    // 5. Tabla de Turnos
    let currentY = cardY + 66;

    // 5.1 Cabecera de la tabla (bg-slate-200: #e2e8f0)
    let currentX = contentX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);

    headers.forEach((headerText, colIdx) => {
      const colW = colWidths[colIdx];
      doc.setFillColor(226, 232, 240); // #e2e8f0
      doc.setDrawColor(203, 213, 225); // #cbd5e1
      doc.setLineWidth(0.3);
      doc.rect(currentX, currentY, colW, rowHeight, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.text(headerText, currentX + colW / 2, currentY + 6.3, {
        align: 'center',
      });
      currentX += colW;
    });

    currentY += rowHeight;

    // 5.2 Filas de Lunes a Domingo
    (driver.schedule || []).forEach((row) => {
      let rowX = contentX;
      const cells = [
        { text: row.day || '', align: 'left', bold: true },
        { text: row.ini || '', align: 'center', bold: false },
        { text: row.fin || '', align: 'center', bold: false },
        { text: row.dur || '', align: 'center', bold: Boolean(row.isFree) },
        { text: tableLocationUpper, align: 'center', bold: false },
        { text: row.servicio || '', align: 'center', bold: false },
      ];

      cells.forEach((cell, colIdx) => {
        const colW = colWidths[colIdx];
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.rect(rowX, currentY, colW, rowHeight, 'FD');

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', cell.bold ? 'bold' : 'normal');
        doc.setFontSize(10);

        if (cell.align === 'left') {
          doc.text(String(cell.text), rowX + 3.5, currentY + 6.3);
        } else {
          doc.text(String(cell.text), rowX + colW / 2, currentY + 6.3, {
            align: 'center',
          });
        }

        rowX += colW;
      });

      currentY += rowHeight;
    });

    // Pie de página discreto con numeración
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Conductor ${index + 1} de ${drivers.length} — Código #${driver.codigo}`,
      cardX + cardWidth,
      cardY + cardHeight + 6,
      { align: 'right' }
    );
  });

  const safeDateName = (dateRange || 'Turnos').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Programacion_Conductores_${safeDateName}.pdf`);
}
