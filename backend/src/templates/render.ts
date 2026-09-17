// lapa-casa-hostel/backend/src/templates/render.ts
//
// Motor de plantillas minimo: sustitucion {{variable}} sobre archivos
// HTML estaticos en src/templates/emails/. No hace falta nada mas
// potente (handlebars, ejs) porque no hay loops/condicionales en las
// plantillas -- las listas (ej. habitaciones de una reserva) se arman
// como HTML ya formado en el servicio y se pasan como variable *Html.
//
// Seguridad: toda variable se escapa por defecto (nombres de huesped,
// emails, etc. vienen de un formulario publico). Las variables que
// terminan en "Html" son la unica excepcion deliberada -- HTML ya
// armado por el propio backend (ej. lista de habitaciones), nunca texto
// crudo de un usuario.

import { readFileSync } from 'fs';
import { join } from 'path';

const TEMPLATES_DIR = join(__dirname, 'emails');
const fileCache = new Map<string, string>();

function readTemplateFile(name: string): string {
  let content = fileCache.get(name);
  if (content === undefined) {
    content = readFileSync(join(TEMPLATES_DIR, `${name}.html`), 'utf-8');
    fileCache.set(name, content);
  }
  return content;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type TemplateVars = Record<string, string | number | null | undefined>;

function interpolate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) {
      return '';
    }
    const str = String(value);
    return key.endsWith('Html') ? str : escapeHtml(str);
  });
}

/** Renderiza `emails/<templateName>.html` envuelto en el layout compartido. */
export function renderEmailTemplate(templateName: string, vars: TemplateVars): string {
  const content = interpolate(readTemplateFile(templateName), vars);
  // BUG (encontrado armando el email de referidos, afecta a TODOS los
  // templates por igual): layout.html usaba {{content}}, que la regla de
  // interpolate() de arriba escapa por default (solo las claves que
  // terminan en "Html" se dejan crudas) -- el HTML entero del cuerpo del
  // email, ya renderizado y seguro, se re-escapaba una segunda vez acá,
  // y todos los emails salían mostrando las etiquetas HTML como texto
  // literal en vez del contenido formateado.
  return interpolate(readTemplateFile('layout'), { ...vars, contentHtml: content });
}
