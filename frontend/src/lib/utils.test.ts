// lapa-casa-hostel/frontend/src/lib/utils.test.ts
//
// Sección 13 auditoría de 17 secciones: primer test real del frontend --
// el script "test" ya existía en package.json pero no había ningún
// archivo .test.ts en todo el proyecto. Se prueban validateCPF/formatCPF
// (lib/utils.ts) por ser funciones puras con lógica de negocio real
// (dígito verificador de CPF, módulo 11) que ambos motores de reserva
// consumen para validar el documento del huésped.

import { validateCPF, formatCPF } from './utils';

describe('validateCPF', () => {
  it('acepta un CPF válido (dígito verificador correcto)', () => {
    expect(validateCPF('111.444.777-35')).toBe(true);
  });

  it('acepta el mismo CPF sin formato (solo dígitos)', () => {
    expect(validateCPF('11144477735')).toBe(true);
  });

  it('rechaza un CPF con el último dígito verificador alterado', () => {
    expect(validateCPF('111.444.777-36')).toBe(false);
  });

  it('rechaza un CPF con el primer dígito verificador alterado', () => {
    expect(validateCPF('111.444.777-45')).toBe(false);
  });

  it('rechaza CPFs con los 11 dígitos repetidos (ej. 111.111.111-11)', () => {
    expect(validateCPF('111.111.111-11')).toBe(false);
    expect(validateCPF('000.000.000-00')).toBe(false);
  });

  it('rechaza un string con menos de 11 dígitos', () => {
    expect(validateCPF('123.456.789')).toBe(false);
  });

  it('rechaza un string vacío', () => {
    expect(validateCPF('')).toBe(false);
  });
});

describe('formatCPF', () => {
  it('no agrega puntuación con 3 dígitos o menos', () => {
    expect(formatCPF('111')).toBe('111');
  });

  it('agrega el primer punto después de 3 dígitos', () => {
    expect(formatCPF('1114')).toBe('111.4');
  });

  it('agrega el segundo punto después de 6 dígitos', () => {
    expect(formatCPF('1114447')).toBe('111.444.7');
  });

  it('agrega el guion después de 9 dígitos', () => {
    expect(formatCPF('11144477735')).toBe('111.444.777-35');
  });

  it('ignora caracteres no numéricos y trunca a 11 dígitos', () => {
    expect(formatCPF('111.444.777-35999')).toBe('111.444.777-35');
  });
});
