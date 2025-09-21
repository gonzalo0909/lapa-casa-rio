// src/components/rooms/room-list.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { RoomCard } from './room-card';
import { RoomComparison } from './room-comparison';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { LoadingSpinner } from '../ui/loading-spinner';

export interface Habitacion {
  id: string;
  nombre: string;
  capacidad: number;
  tipo: 'mixto' | 'femenino' | 'masculino';
  precio_base: number;
  es_flexible: boolean;
  disponible: boolean;
  camas_disponibles: number;
  descripcion: string;
  amenidades: string[];
  imagenes: string[];
  estado_conversion?: {
    convertira_a: 'mixto';
    horas_restantes: number;
  };
}

interface PropiedadesListaHabitaciones {
  fechas: {
    entrada: Date;
    salida: Date;
  };
  huespedes: number;
  camas_solicitadas: number;
  habitaciones_seleccionadas: string[];
  al_seleccionar_habitacion: (habitacion_id: string, seleccionada: boolean) => void;
  mostrar_comparacion?: boolean;
  al_cambiar_comparacion?: (mostrar: boolean) => void;
  filtros?: {
    tipo_habitacion?: 'todas' | 'mixto' | 'femenino' | 'masculino';
    precio_maximo?: number;
    solo_disponibles?: boolean;
  };
}

const habitaciones_lapa_casa: Habitacion[] = [
  {
    id: 'room_mixto_12a',
    nombre: 'Mixto 12A',
    capacidad: 12,
    tipo: 'mixto',
    precio_base: 60.00,
    es_flexible: false,
    disponible: true,
    camas_disponibles: 12,
    descripcion: 'Habitación mixta con 12 camas literas, ideal para grupos grandes. Baño compartido, lockers individuales y área común.',
    amenidades: ['Aire acondicionado', 'Lockers', 'Enchufes individuales', 'Baño compartido', 'WiFi gratuito'],
    imagenes: ['/habitaciones/mixto-12a-1.jpg', '/habitaciones/mixto-12a-2.jpg']
  },
  {
    id: 'room_mixto_12b',
    nombre: 'Mixto 12B',
    capacidad: 12,
    tipo: 'mixto',
    precio_base: 60.00,
    es_flexible: false,
    disponible: true,
    camas_disponibles: 8,
    descripcion: 'Segunda habitación mixta con 12 camas, diseño similar a 12A con vista al patio interno.',
    amenidades: ['Aire acondicionado', 'Lockers', 'Enchufes individuales', 'Baño compartido', 'WiFi gratuito'],
    imagenes: ['/habitaciones/mixto-12b-1.jpg', '/habitaciones/mixto-12b-2.jpg']
  },
  {
    id: 'room_mixto_7',
    nombre: 'Mixto 7',
    capacidad: 7,
    tipo: 'mixto',
    precio_base: 60.00,
    es_flexible: false,
    disponible: true,
    camas_disponibles: 5,
    descripcion: 'Habitación mixta más íntima con 7 camas, perfecta para grupos medianos que buscan más privacidad.',
    amenidades: ['Ventilador', 'Lockers', 'Enchufes individuales', 'Baño compartido', 'WiFi gratuito'],
    imagenes: ['/habitaciones/mixto-7-1.jpg', '/habitaciones/mixto-7-2.jpg']
  },
  {
    id: 'room_flexible_7',
    nombre: 'Flexible 7',
    capacidad: 7,
    tipo: 'femenino',
    precio_base: 60.00,
    es_flexible: true,
    disponible: true,
    camas_disponibles: 7,
    descripcion: 'Habitación flexible que funciona como femenina por defecto, pero se convierte a mixta automáticamente si no hay reservas femeninas 48h antes.',
    amenidades: ['Ventilador', 'Lockers', 'Enchufes individuales', 'Baño compartido', 'WiFi gratuito', 'Conversión automática'],
    imagenes: ['/habitaciones/flexible-7-1.jpg', '/habitaciones/flexible-7-2.jpg'],
    estado_conversion: {
      convertira_a: 'mixto',
      horas_restantes: 36
    }
  }
];

export function RoomList({
  fechas,
  huespedes,
  camas_solicitadas,
  habitaciones_seleccionadas,
  al_seleccionar_habitacion,
  mostrar_comparacion = false,
  al_cambiar_comparacion,
  filtros = { solo_disponibles: true }
}: PropiedadesListaHabitaciones) {
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cargarHabitaciones();
  }, [fechas.entrada, fechas.salida]);

  const cargarHabitaciones = async () => {
    try {
      setCargando(true);
      setError(null);

      // Simulamos llamada API para obtener disponibilidad
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Aplicar filtros de disponibilidad y tipo
      let habitaciones_filtradas = habitaciones_lapa_casa.filter(habitacion => {
        // Filtro de disponibilidad
        if (filtros.solo_disponibles && !habitacion.disponible) {
          return false;
        }

        // Filtro de tipo de habitación
        if (filtros.tipo_habitacion && filtros.tipo_habitacion !== 'todas') {
          if (habitacion.tipo !== filtros.tipo_habitacion) {
            return false;
          }
        }

        // Filtro de precio máximo
        if (filtros.precio_maximo && habitacion.precio_base > filtros.precio_maximo) {
          return false;
        }

        return true;
      });

      // Ordenar por disponibilidad y capacidad
      habitaciones_filtradas.sort((a, b) => {
        // Primero las disponibles
        if (a.disponible && !b.disponible) return -1;
        if (!a.disponible && b.disponible) return 1;

        // Luego por camas disponibles (más camas primero)
        if (a.camas_disponibles !== b.camas_disponibles) {
          return b.camas_disponibles - a.camas_disponibles;
        }

        // Finalmente por capacidad total
        return b.capacidad - a.capacidad;
      });

      setHabitaciones(habitaciones_filtradas);
    } catch (error) {
      console.error('Error cargando habitaciones:', error);
      setError('Error al cargar las habitaciones. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const calcular_camas_seleccionadas = () => {
    return habitaciones
      .filter(hab => habitaciones_seleccionadas.includes(hab.id))
      .reduce((total, hab) => total + hab.capacidad, 0);
  };

  const camas_seleccionadas_total = calcular_camas_seleccionadas();
  const necesita_mas_camas = camas_seleccionadas_total < camas_solicitadas;

  if (cargando) {
    return (
      <Card className="p-8 text-center">
        <LoadingSpinner className="mx-auto mb-4" />
        <p className="text-gray-600">Verificando disponibilidad...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8 text-center bg-red-50 border-red-200">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={cargarHabitaciones} variant="outline">
          Reintentar
        </Button>
      </Card>
    );
  }

  if (habitaciones.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-xl font-semibold mb-2">No hay habitaciones disponibles</h3>
        <p className="text-gray-600 mb-4">
          No encontramos habitaciones que coincidan con tus criterios para las fechas seleccionadas.
        </p>
        <Button onClick={cargarHabitaciones} variant="outline">
          Verificar de nuevo
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen de selección */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-900">
              Camas seleccionadas: {camas_seleccionadas_total} de {camas_solicitadas}
            </p>
            {necesita_mas_camas && (
              <p className="text-sm text-blue-700">
                Necesitas seleccionar {camas_solicitadas - camas_seleccionadas_total} camas más
              </p>
            )}
          </div>

          {al_cambiar_comparacion && habitaciones_seleccionadas.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => al_cambiar_comparacion(!mostrar_comparacion)}
            >
              {mostrar_comparacion ? 'Ocultar' : 'Comparar'} habitaciones
            </Button>
          )}
        </div>

        {/* Barra de progreso */}
        <div className="mt-3">
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                camas_seleccionadas_total >= camas_solicitadas ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{
                width: `${Math.min((camas_seleccionadas_total / camas_solicitadas) * 100, 100)}%`
              }}
            />
          </div>
        </div>
      </Card>

      {/* Comparación de habitaciones */}
      {mostrar_comparacion && habitaciones_seleccionadas.length > 1 && (
        <RoomComparison
          habitaciones={habitaciones.filter(hab => habitaciones_seleccionadas.includes(hab.id))}
          fechas={fechas}
        />
      )}

      {/* Lista de habitaciones */}
      <div className="grid gap-4 md:gap-6">
        {habitaciones.map(habitacion => (
          <RoomCard
            key={habitacion.id}
            habitacion={habitacion}
            fechas={fechas}
            seleccionada={habitaciones_seleccionadas.includes(habitacion.id)}
            al_seleccionar={(seleccionada) => 
              al_seleccionar_habitacion(habitacion.id, seleccionada)
            }
            puede_deseleccionar={!necesita_mas_camas || camas_seleccionadas_total > camas_solicitadas}
            destacar_recomendada={
              habitacion.camas_disponibles >= (camas_solicitadas - camas_seleccionadas_total) &&
              necesita_mas_camas
            }
          />
        ))}
      </div>

      {/* Mensaje de ayuda */}
      <Card className="p-4 bg-gray-50">
        <h4 className="font-semibold text-gray-900 mb-2">Consejos para la selección:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Puedes combinar múltiples habitaciones para grupos grandes</li>
          <li>• La habitación "Flexible 7" se convierte automáticamente a mixta si no hay reservas femeninas</li>
          <li>• Los precios incluyen ropa de cama, WiFi y acceso a todas las áreas comunes</li>
          <li>• Descuentos automáticos para grupos de 7+ personas</li>
        </ul>
      </Card>
    </div>
  );
}
