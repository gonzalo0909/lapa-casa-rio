// src/components/rooms/room-availability.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LoadingSpinner } from '../ui/loading-spinner';
import { 
  Calendar, 
  Users, 
  Bed, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

export interface DisponibilidadHabitacion {
  habitacion_id: string;
  nombre_habitacion: string;
  capacidad_total: number;
  tipo: 'mixto' | 'femenino' | 'masculino';
  es_flexible: boolean;
  disponibilidad_por_fecha: {
    fecha: string;
    camas_disponibles: number;
    camas_ocupadas: number;
    estado: 'disponible' | 'parcial' | 'completo' | 'bloqueado';
    reservas_activas: number;
    precio_noche: number;
    puede_convertir?: boolean; // Para habitaciones flexibles
  }[];
  tendencia_ocupacion: 'alta' | 'media' | 'baja';
  proximas_liberaciones: {
    fecha: string;
    camas_liberadas: number;
  }[];
}

interface PropiedadesDisponibilidadHabitacion {
  fechas: {
    entrada: Date;
    salida: Date;
  };
  camas_solicitadas: number;
  habitacion_id?: string; // Si solo queremos una habitación específica
  mostrar_calendario?: boolean;
  mostrar_tendencias?: boolean;
  al_cambiar_fechas?: (fechas: { entrada: Date; salida: Date }) => void;
  al_seleccionar_habitacion?: (habitacion_id: string) => void;
}

export function RoomAvailability({
  fechas,
  camas_solicitadas,
  habitacion_id,
  mostrar_calendario = true,
  mostrar_tendencias = true,
  al_cambiar_fechas,
  al_seleccionar_habitacion
}: PropiedadesDisponibilidadHabitacion) {
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadHabitacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fecha_seleccionada, setFechaSeleccionada] = useState<string>('');

  useEffect(() => {
    cargar_disponibilidad();
  }, [fechas.entrada, fechas.salida, habitacion_id]);

  const cargar_disponibilidad = async () => {
    try {
      setCargando(true);
      setError(null);

      // Simular llamada API
      await new Promise(resolve => setTimeout(resolve, 1000));

      const disponibilidad_mock = generar_disponibilidad_mock();
      setDisponibilidad(disponibilidad_mock);
    } catch (error) {
      console.error('Error cargando disponibilidad:', error);
      setError('Error al cargar la disponibilidad. Inténtalo de nuevo.');
    } finally {
      setCargando(false);
    }
  };

  const generar_disponibilidad_mock = (): DisponibilidadHabitacion[] => {
    const habitaciones_base = [
      {
        habitacion_id: 'room_mixto_12a',
        nombre_habitacion: 'Mixto 12A',
        capacidad_total: 12,
        tipo: 'mixto' as const,
        es_flexible: false,
        tendencia_ocupacion: 'alta' as const
      },
      {
        habitacion_id: 'room_mixto_12b',
        nombre_habitacion: 'Mixto 12B',
        capacidad_total: 12,
        tipo: 'mixto' as const,
        es_flexible: false,
        tendencia_ocupacion: 'media' as const
      },
      {
        habitacion_id: 'room_mixto_7',
        nombre_habitacion: 'Mixto 7',
        capacidad_total: 7,
        tipo: 'mixto' as const,
        es_flexible: false,
        tendencia_ocupacion: 'baja' as const
      },
      {
        habitacion_id: 'room_flexible_7',
        nombre_habitacion: 'Flexible 7',
        capacidad_total: 7,
        tipo: 'femenino' as const,
        es_flexible: true,
        tendencia_ocupacion: 'baja' as const
      }
    ];

    return habitaciones_base
      .filter(hab => !habitacion_id || hab.habitacion_id === habitacion_id)
      .map(habitacion => {
        const disponibilidad_por_fecha = [];
        const fecha_actual = new Date(fechas.entrada);
        const fecha_fin = new Date(fechas.salida);

        while (fecha_actual < fecha_fin) {
          const camas_ocupadas = Math.floor(Math.random() * habitacion.capacidad_total);
          const camas_disponibles = habitacion.capacidad_total - camas_ocupadas;
          
          let estado: 'disponible' | 'parcial' | 'completo' | 'bloqueado';
          if (camas_disponibles === 0) {
            estado = 'completo';
          } else if (camas_disponibles < habitacion.capacidad_total / 2) {
            estado = 'parcial';
          } else {
            estado = 'disponible';
          }

          disponibilidad_por_fecha.push({
            fecha: fecha_actual.toISOString().split('T')[0],
            camas_disponibles,
            camas_ocupadas,
            estado,
            reservas_activas: Math.floor(camas_ocupadas / 2),
            precio_noche: 60.00,
            puede_convertir: habitacion.es_flexible && camas_ocupadas === 0
          });

          fecha_actual.setDate(fecha_actual.getDate() + 1);
        }

        return {
          ...habitacion,
          disponibilidad_por_fecha,
          proximas_liberaciones: [
            {
              fecha: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              camas_liberadas: 3
            }
          ]
        };
      });
  };

  const obtener_color_estado = (estado: string) => {
    switch (estado) {
      case 'disponible':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'parcial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completo':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'bloqueado':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const obtener_icono_tendencia = (tendencia: string) => {
    switch (tendencia) {
      case 'alta':
        return <TrendingUp className="w-4 h-4 text-red-600" />;
      case 'media':
        return <TrendingUp className="w-4 h-4 text-yellow-600" />;
      case 'baja':
        return <TrendingDown className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  const calcular_disponibilidad_total = () => {
    return disponibilidad.reduce((total, habitacion) => {
      const disponible_en_periodo = habitacion.disponibilidad_por_fecha.reduce(
        (sum, dia) => sum + dia.camas_disponibles, 0
      );
      return total + disponible_en_periodo;
    }, 0);
  };

  const formatear_fecha = (fecha_string: string) => {
    const fecha = new Date(fecha_string);
    return fecha.toLocaleDateString('es-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  if (cargando) {
    return (
      <Card className="p-6 text-center">
        <LoadingSpinner className="mx-auto mb-4" />
        <p className="text-gray-600">Verificando disponibilidad...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center bg-red-50 border-red-200">
        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={cargar_disponibilidad} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reintentar
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen general */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Disponibilidad de Habitaciones
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={cargar_disponibilidad}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {calcular_disponibilidad_total()}
            </div>
            <div className="text-sm text-gray-600">
              Camas disponibles
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {disponibilidad.length}
            </div>
            <div className="text-sm text-gray-600">
              Habitaciones
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.ceil((fechas.salida.getTime() - fechas.entrada.getTime()) / (1000 * 60 * 60 * 24))}
            </div>
            <div className="text-sm text-gray-600">
              Noches
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {camas_solicitadas}
            </div>
            <div className="text-sm text-gray-600">
              Camas necesarias
            </div>
          </div>
        </div>
      </Card>

      {/* Lista de habitaciones */}
      {disponibilidad.map(habitacion => (
        <Card key={habitacion.habitacion_id} className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h4 className="text-lg font-semibold text-gray-900">
                {habitacion.nombre_habitacion}
              </h4>
              
              <Badge variant="outline" className="capitalize">
                {habitacion.tipo}
              </Badge>
              
              {habitacion.es_flexible && (
                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                  Flexible
                </Badge>
              )}

              {mostrar_tendencias && (
                <div className="flex items-center gap-1">
                  {obtener_icono_tendencia(habitacion.tendencia_ocupacion)}
                  <span className="text-sm text-gray-600 capitalize">
                    {habitacion.tendencia_ocupacion}
                  </span>
                </div>
              )}
            </div>

            {al_seleccionar_habitacion && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => al_seleccionar_habitacion(habitacion.habitacion_id)}
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver detalles
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Bed className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                {habitacion.capacidad_total} camas total
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                Ocupación promedio: {Math.round(
                  (habitacion.disponibilidad_por_fecha.reduce(
                    (sum, dia) => sum + dia.camas_ocupadas, 0
                  ) / habitacion.disponibilidad_por_fecha.length / habitacion.capacidad_total) * 100
                )}%
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">
                R$ {habitacion.disponibilidad_por_fecha[0]?.precio_noche.toFixed(2)}/noche
              </span>
            </div>
          </div>

          {/* Calendario de disponibilidad */}
          {mostrar_calendario && (
            <div>
              <h5 className="font-medium text-gray-900 mb-3">
                Disponibilidad por día
              </h5>
              
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(dia => (
                  <div key={dia} className="text-xs font-medium text-gray-500 text-center p-2">
                    {dia}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {habitacion.disponibilidad_por_fecha.map((dia, indice) => (
                  <div
                    key={indice}
                    className={`relative p-2 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                      obtener_color_estado(dia.estado)
                    } ${
                      fecha_seleccionada === dia.fecha ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => setFechaSeleccionada(
                      fecha_seleccionada === dia.fecha ? '' : dia.fecha
                    )}
                  >
                    <div className="text-xs font-medium text-center">
                      {new Date(dia.fecha).getDate()}
                    </div>
                    
                    <div className="text-xs text-center mt-1">
                      {dia.camas_disponibles}/{habitacion.capacidad_total}
                    </div>

                    {dia.puede_convertir && (
                      <div className="absolute -top-1 -right-1">
                        <div className="w-3 h-3 bg-orange-500 rounded-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Leyenda */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-200 rounded" />
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-200 rounded" />
                  <span>Parcial</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-red-200 rounded" />
                  <span>Completo</span>
                </div>
                {habitacion.es_flexible && (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded-full" />
                    <span>Puede convertir</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detalles del día seleccionado */}
          {fecha_seleccionada && (
            <Card className="mt-4 p-3 bg-blue-50 border-blue-200">
              {(() => {
                const dia_seleccionado = habitacion.disponibilidad_por_fecha.find(
                  dia => dia.fecha === fecha_seleccionada
                );
                
                if (!dia_seleccionado) return null;

                return (
                  <div>
                    <h6 className="font-medium text-blue-900 mb-2">
                      {formatear_fecha(fecha_seleccionada)}
                    </h6>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-blue-700">Disponibles:</span>
                        <span className="font-medium text-blue-900 ml-1">
                          {dia_seleccionado.camas_disponibles} camas
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-blue-700">Ocupadas:</span>
                        <span className="font-medium text-blue-900 ml-1">
                          {dia_seleccionado.camas_ocupadas} camas
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-blue-700">Reservas activas:</span>
                        <span className="font-medium text-blue-900 ml-1">
                          {dia_seleccionado.reservas_activas}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-blue-700">Precio:</span>
                        <span className="font-medium text-blue-900 ml-1">
                          R$ {dia_seleccionado.precio_noche.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {dia_seleccionado.puede_convertir && (
                      <div className="mt-2 p-2 bg-orange-100 border border-orange-200 rounded text-xs text-orange-800">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Esta habitación flexible puede convertirse a mixta automáticamente
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          )}

          {/* Próximas liberaciones */}
          {habitacion.proximas_liberaciones.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  Próximas liberaciones
                </span>
              </div>
              
              {habitacion.proximas_liberaciones.map((liberacion, indice) => (
                <div key={indice} className="text-sm text-green-800">
                  {formatear_fecha(liberacion.fecha)}: +{liberacion.camas_liberadas} camas
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {/* Mensaje si no hay suficientes camas disponibles */}
      {calcular_disponibilidad_total() < camas_solicitadas && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">
                Disponibilidad limitada
              </h4>
              <p className="text-sm text-yellow-800 mb-3">
                Actualmente hay {calcular_disponibilidad_total()} camas disponibles, 
                pero necesitas {camas_solicitadas} camas. Te sugerimos:
              </p>
              
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Ajustar las fechas de tu estadía</li>
                <li>• Dividir el grupo en múltiples reservas</li>
                <li>• Contactarnos para opciones personalizadas</li>
              </ul>

              {al_cambiar_fechas && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    // Sugerir fechas alternativas (ejemplo: una semana después)
                    const nueva_entrada = new Date(fechas.entrada);
                    nueva_entrada.setDate(nueva_entrada.getDate() + 7);
                    const nueva_salida = new Date(fechas.salida);
                    nueva_salida.setDate(nueva_salida.getDate() + 7);
                    
                    al_cambiar_fechas({
                      entrada: nueva_entrada,
                      salida: nueva_salida
                    });
                  }}
                >
                  Probar fechas alternativas
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
