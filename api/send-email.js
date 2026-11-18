import nodemailer from 'nodemailer';

/**
 * Construye el HTML del correo replicando exactamente el diseño de la tarjeta de programación
 */
function buildEmailHtml({ driver, dateRange, location }) {
  const resolvedLocation = location || driver.extremo || 'Santa Marta';
  const tableLocationUpper = resolvedLocation.toUpperCase();
  const formattedDateSubtitle = dateRange
    ? dateRange.startsWith('(')
      ? dateRange
      : `(${dateRange})`
    : '(Sin fechas definidas)';

  const rowsHtml = (driver.schedule || [])
    .map(
      (row) => `
      <tr>
        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: 600; text-align: left; color: #0f172a;">
          ${row.day}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; color: #0f172a;">
          ${row.ini || ''}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; color: #0f172a;">
          ${row.fin || ''}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; color: #0f172a; ${
          row.isFree ? 'font-weight: 700;' : ''
        }">
          ${row.dur || ''}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 500; color: #0f172a;">
          ${tableLocationUpper}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; color: #0f172a;">
          ${row.servicio || ''}
        </td>
      </tr>`
    )
    .join('');

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8" />
  </head>
  <body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: Arial, Helvetica, sans-serif; color: #0f172a;">
    <div style="max-width: 760px; margin: 0 auto; background-color: #ffffff; border: 1px solid #cbd5e1; padding: 36px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #0f172a;">
          Asignaciones de Programación — ${resolvedLocation}
        </h2>
        <p style="margin: 6px 0 0 0; font-size: 17px; font-weight: 600; color: #334155;">
          ${formattedDateSubtitle}
        </p>
      </div>

      <div style="text-align: left; margin-bottom: 20px; font-size: 15px; line-height: 1.6;">
        <p style="margin: 0 0 8px 0; font-weight: 700; color: #0f172a;">
          Estimad@ ${driver.nombre}:
        </p>
        <p style="margin: 0; color: #1e293b;">
          Le informamos los servicios programados para los días que se indican. Considerar esta programación.
        </p>
      </div>

      <div style="margin-bottom: 16px; text-align: left;">
        <span style="font-weight: 700; font-size: 15px; color: #0f172a; margin-right: 8px;">
          CODIGO
        </span>
        <span style="display: inline-block; font-weight: 700; font-size: 15px; padding: 2px 10px; background-color: #bef264; color: #0f172a; border: 1px solid #94a3b8;">
          ${driver.codigo}
        </span>
      </div>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; font-size: 14px;">
        <thead>
          <tr style="background-color: #e2e8f0; color: #0f172a;">
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700; width: 16%;">DÍA</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700; width: 14%;">INI</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700; width: 14%;">FIN</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700; width: 14%;">DUR</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700; width: 24%;">LUGAR</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: center; font-weight: 700; width: 18%;">SERVICIO</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  </body>
  </html>
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const {
      to,
      driver,
      dateRange,
      location,
      imageBase64,
      smtpUser,
      smtpPass,
      senderName,
    } = req.body || {};

    if (!to || !to.includes('@')) {
      return res.status(400).json({
        error: 'Debes ingresar un correo electrónico de destino válido.',
      });
    }

    if (!driver || !driver.nombre) {
      return res.status(400).json({
        error: 'Faltan los datos del conductor para generar el correo.',
      });
    }

    const DEFAULT_GMAIL_USER = 'condell2026.metro@gmail.com';
    const DEFAULT_GMAIL_PASS = 'zlzovhdibyralqpj';

    const user = (
      smtpUser ||
      process.env.GMAIL_USER ||
      DEFAULT_GMAIL_USER
    ).trim();
    const pass = (
      smtpPass ||
      process.env.GMAIL_APP_PASSWORD ||
      DEFAULT_GMAIL_PASS
    )
      .replace(/\s+/g, '')
      .trim();

    if (!user || !pass) {
      return res.status(400).json({
        error:
          'Falta configurar el correo remitente (Gmail y Contraseña de Aplicación). Haz clic en el botón "Configurar Correo" arriba a la derecha.',
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const resolvedLocation = location || driver.extremo || 'Santa Marta';
    const subject = `Asignaciones de Programación — ${resolvedLocation} (${
      dateRange || 'Turnos'
    }) - ${driver.nombre}`;

    const html = buildEmailHtml({ driver, dateRange, location: resolvedLocation });

    const attachments = [];
    if (imageBase64 && imageBase64.includes('base64,')) {
      const safeName = driver.nombre
        .replace(/[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_');

      attachments.push({
        filename: `Programacion_${driver.codigo}_${safeName}.png`,
        content: imageBase64.split('base64,')[1],
        encoding: 'base64',
      });
    }

    const fromDisplay = senderName
      ? `"${senderName}" <${user}>`
      : `"Programación de Turnos" <${user}>`;

    await transporter.sendMail({
      from: fromDisplay,
      to: to.trim(),
      subject,
      html,
      attachments,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error enviando correo:', err);
    return res.status(500).json({
      error:
        err.message ||
        'Error al enviar el correo. Verifica tu correo Gmail y tu Contraseña de Aplicación de 16 letras.',
    });
  }
}
