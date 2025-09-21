// src/components/rooms/room-comparison.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Users, 
  Bed, 
  Wifi, 
  AirVent, 
  Lock,
  CheckCircle,
  XCircle,
  Minus,
  ArrowUpDown,
  Star,
  AlertTriangle,
  Info
} from 'lucide-react';

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

interface PropiedadesComparacionHabitaciones {
  habitaciones: Habitacion[];
  fechas: {
    entrada: Date;
    salida: Date;
  };
  mostrar_precios?: boolean;
  resaltar_diferencias?: boolean;
  al_remover_habitacion?: (habitacion_id: string) => void;
}

interface CategoriaComparacion {
  titulo: string;
  propiedades: {
    etiqueta: string;
    obtener_valor: (habitacion: Habitacion) => string | number | boolean | React.ReactNode;
    tipo: 'texto' | 'numero' | 'booleano' | 'badge' | 'lista' | 'componente';
    mostrar_diferencia?: boolean;
  }[];
}

export function RoomComparison({
  habitaciones,
  fechas,
  mostrar_precios = true,
  resaltar_diferencias = true,
  al_remover_habitacion
}: PropiedadesComparacionHabitaciones) {
  const [ordenar_por, setOrdenarPor] = useState<'nombre' | 'capacidad' | 'precio' | 'disponibilidad'>('capacidad');
  const [orden_ascendente, setOrdenAscendente] = useState(false);

  const calcular_noches = () => {
    const diff = fechas.salida.getTime() - fechas.entrada.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const obtener_icono_amenidad = (amenidad: string): React.ReactNode => {
    const amenidad_lower = amenidad.toLowerCase();
    
    if (amenidad_lower.includes('wifi')) {
      return <Wifi className="w-4 h-4 text-blue-600" />;
    }
    if (amenidad_lower.includes('aire')) {
      return <AirVent className="w-4 h-4 text-green-600" />;
    }
    if (amenidad_lower.includes('locker')) {
      return <Lock className="w-4 h-4 text-purple-600" />;
    }
    return <CheckCircle className="w-4 h-4 text-gray-600" />;
  };

  const obtener_color_tipo = (tipo: string) => {
    switch (tipo) {
      case 'mixto':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'femenino':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'masculino':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const categorias_comparacion: CategoriaComparacion[] = [
    {
      titulo: 'Información Básica',
      propiedades: [
        {
          etiqueta: 'Nombre',
          obtener_valor: (hab) => hab.nombre,
          tipo: 'texto',
          mostrar_diferencia: true
        },
        {
          etiqueta: 'Tipo',
          obtener_valor: (hab) => (
            <Badge variant="outline" className={obtener_color_tipo(hab.tipo)}>
              {hab.tipo}
            </Badge>
          ),
          tipo: 'componente',
          mostrar_diferencia: true
        },
        {
          etiqueta: 'Capacidad',
          obtener_valor: (hab) => `${hab.capacidad} camas`,
          tipo: 'texto',
          mostrar_diferencia: true
        },
        {
          etiqueta: 'Disponibilidad',
          obtener_valor: (hab) => (
            <div className="flex items-center gap-1">
              {hab.disponible ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              <span className={hab.disponible ? 'text-green-800' : 'text-red-800'}>
                {hab.disponible ? 
                  `${hab.camas_disponibles} libres` : 
                  'No disponible'
                }
              </span>
            </div>
          ),
          tipo: 'componente',
          mostrar_diferencia: true
        },
        {
          etiqueta: 'Flexible',
          obtener_valor: (hab) => hab.es_flexible,
          tipo: 'booleano',
          mostrar_diferencia: true
        }
      ]
    },
    {
      titulo: 'Precios',
      propiedades: [
        {
          etiqueta: 'Precio base/noche',
          obtener_valor: (hab) => `R$ ${hab.precio_base.toFixed(2)}`,
          tipo: 'texto',
          mostrar_diferencia: true
        },
        {
          etiqueta: `Total ${calcular_noches()} ${calcular_noches() === 1 ? 'noche' : 'noches'}`,
          obtener_valor: (hab) => `R$ ${(hab.precio_base * calcular_noches()).toFixed(2)}`,
          tipo: 'texto',
          mostrar_diferencia: true
        }
      ]
    },
    {
      titulo: 'Amenidades Principales',
      propiedades: [
        {
          etiqueta: 'WiFi',
          obtener_valor: (hab) => hab.amenidades.some(a => a.toLowerCase().includes('wifi')),
          tipo: 'booleano'
        },
        {
          etiqueta: 'Aire Acondicionado',
          obtener_valor: (hab) => hab.amenidades.some(a => a.toLowerCase().includes('aire')),
          tipo: 'booleano'
        },
        {
          etiqueta: 'Lockers',
          obtener_valor: (hab) => hab.amenidades.some(a => a.toLowerCase().includes('locker')),
          tipo: 'booleano'
        },
        {
          etiqueta: 'Enchufes individuales',
          obtener_valor: (hab) => hab.amenidades.some(a => a.toLowerCase().includes('enchuf')),
          tipo: 'booleano'
        }
      ]
    },
    {
      titulo: 'Todas las Amenidades',
      propiedades: [
        {
          etiqueta: 'Lista completa',
          obtener_valor: (hab) => hab.amenidades,
          tipo: 'lista'
        }
      ]
    }
  ];

  const habitaciones_ordenadas = [...habitaciones].sort((a, b) => {
    let valor_a: any;
    let valor_b: any;

    switch (ordenar_por) {
      case 'nombre':
        valor_a = a.nombre;
        valor_b = b.nombre;
        break;
      case 'capacidad':
        valor_a = a.capacidad;
        valor_b = b.capacidad;
        break;
      case 'precio':
        valor_a = a.precio_base;
        valor_b = b.precio_base;
        break;
      case 'disponibilidad':
        valor_a = a.camas_disponibles;
        valor_b = b.camas_disponibles;
        break;
      default:
        return 0;
    }

    if (typeof valor_a === 'string' && typeof valor_b === 'string') {
      return orden_ascendente ? 
        valor_a.localeCompare(valor_b) : 
        valor_b.localeCompare(valor_a);
    }

    return orden_ascendente ? 
      valor_a - valor_b : 
      valor_b - valor_a;
  });

  const obtener_habitacion_destacada = () => {
    // Encontrar la habitación con mejor relación calidad-precio-disponibilidad
    return habitaciones_ordenadas.reduce((mejor, actual) => {
      if (!actual.disponible) return mejor;
      
      const puntuacion_actual = (
        actual.camas_disponibles * 2 + 
        actual.amenidades.length * 0.5 +
        (actual.es_flexible ? 1 : 0) +
        (100 - actual.precio_base) * 0.1
      );

      const puntuacion_mejor = mejor ? (
        mejor.camas_disponibles * 2 + 
        mejor.amenidades.length * 0.5 +
        (mejor.es_flexible ? 1 : 0) +
        (100 - mejor.precio_base) * 0.1
      ) : 0;

      return puntuacion_actual > puntuacion_mejor ? actual : mejor;
    }, null as Habitacion | null);
  };

  const habitacion_destacada = obtener_habitacion_destacada();

  const alternar_orden = (nuevo_criterio: typeof ordenar_por) => {
    if (ordenar_por === nuevo_criterio) {
      setOrdenAscendente(!orden_ascendente);
    } else {
      setOrdenarPor(nuevo_criterio);
      setOrdenAscendente(false);
    }
  };

  const verificar_diferencias = (propiedad: string) => {
    if (!resaltar_diferencias) return false;
    
    const valores = habitaciones.map(hab => {
      const categoria = categorias_comparacion.find(cat =>
        cat.propiedades.some(prop => prop.etiqueta === propiedad)
      );
      const prop = categoria?.propiedades.find(p => p.etiqueta === propiedad);
      return prop ? prop.obtener_valor(hab) : '';
    });

    return new Set(valores.map(v => JSON.stringify(v))).size > 1;
  };

  if (habitaciones.length === 0) {
    return (
      <Card className="p-8 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          No hay habitaciones para comparar
        </h3>
        <p className="text-gray-600">
          Selecciona al menos 2 habitaciones para ver la comparación.
        </p>
      </Card>
    );
  }

  if (habitaciones.length === 1) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Info className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Habitación seleccionada
          </h3>
        </div>
        
        <div className="grid md:grid-cols-3 gap-4">
          <div className="relative aspect-video">
            <Image
              src={habitaciones[0].imagenes[0] || '/placeholder-room.jpg'}
              alt={habitaciones[0].nombre}
              fill
              className="object-cover rounded-lg"
            />
          </div>
          
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xl font-bold">{habitaciones[0].nombre}</h4>
              <Badge variant="outline" className={obtener_color_tipo(habitaciones[0].tipo)}>
                {habitaciones[0].tipo}
              </Badge>
              {habitacion_destacada?.id === habitaciones[0].id && (
                <Badge className="bg-yellow-500 text-white">
                  <Star className="w-3 h-3 mr-1" />
                  Recomendada
                </Badge>
              )}
            </div>
            
            <p className="text-gray-600 mb-3">{habitaciones[0].descripcion}</p>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Capacidad:</span> {habitaciones[0].capacidad} camas
              </div>
              <div>
                <span className="font-medium">Disponibles:</span> {habitaciones[0].camas_disponibles} camas
              </div>
              <div>
                <span className="font-medium">Precio:</span> R$ {habitaciones[0].precio_base.toFixed(2)}/noche
              </div>
              <div>
                <span className="font-medium">Total:</span> R$ {(habitaciones[0].precio_base * calcular_noches()).toFixed(2)}
              </div>
            </div>

            {habitaciones[0].es_flexible && habitaciones[0].estado_conversion && (
              <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg text-sm">
                <AlertTriangle className="w-4 h-4 text-orange-600 inline mr-2" />
                <span className="text-orange-800">
                  Se convertirá a {habitaciones[0].estado_conversion.convertira_a} en{' '}
                  {habitaciones[0].estado_conversion.horas_restantes}h
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-500 mt-4 text-sm">
          Selecciona más habitaciones para ver la comparación detallada.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header de comparación */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Comparación de Habitaciones
            </h3>
            <p className="text-sm text-gray-600">
              Comparando {habitaciones.length} habitaciones seleccionadas
            </p>
          </div>

          {/* Controles de ordenamiento */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Ordenar por:</span>
            
            {['nombre', 'capacidad', 'precio', 'disponibilidad'].map(criterio => (
              <Button
                key={criterio}
                variant={ordenar_por === criterio ? 'default' : 'outline'}
                size="sm"
                onClick={() => alternar_orden(criterio as typeof ordenar_por)}
                className="capitalize"
              >
                {criterio}
                {ordenar_por === criterio && (
                  <ArrowUpDown className={`w-3 h-3 ml-1 ${orden_ascendente ? 'rotate-180' : ''}`} />
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Habitación recomendada */}
        {habitacion_destacada && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-900">
                Recomendación: {habitacion_destacada.nombre}
              </span>
            </div>
            <p className="text-sm text-yellow-800 mt-1">
              Mejor combinación de disponibilidad, amenidades y precio.
            </p>
          </div>
        )}
      </Card>

      {/* Tabla de comparación */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header con imágenes de habitaciones */}
            <thead>
              <tr className="border-b">
                <th className="p-4 text-left font-medium text-gray-900 w-48">
                  Características
                </th>
                {habitaciones_ordenadas.map(habitacion => (
                  <th key={habitacion.id} className="p-4 text-center min-w-[200px]">
                    <div className="space-y-3">
                      {/* Imagen */}
                      <div className="relative w-full h-24 rounded-lg overflow-hidden">
                        <Image
                          src={habitacion.imagenes[0] || '/placeholder-room.jpg'}
                          alt={habitacion.nombre}
                          fill
                          className="object-cover"
                        />
                      </div>
                      
                      {/* Nombre y badges */}
                      <div>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <h4 className="font-bold text-gray-900">
                            {habitacion.nombre}
                          </h4>
                          {habitacion_destacada?.id === habitacion.id && (
                            <Star className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        
                        <div className="flex flex-wrap justify-center gap-1">
                          <Badge variant="outline" className={`text-xs ${obtener_color_tipo(habitacion.tipo)}`}>
                            {habitacion.tipo}
                          </Badge>
                          
                          {habitacion.es_flexible && (
                            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                              Flexible
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Botón remover */}
                      {al_remover_habitacion && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => al_remover_habitacion(habitacion.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Minus className="w-3 h-3 mr-1" />
                          Remover
                        </Button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Cuerpo de la tabla */}
            <tbody>
              {categorias_comparacion.map((categoria, cat_index) => (
                <React.Fragment key={cat_index}>
                  {/* Header de categoría */}
                  <tr className="bg-gray-50">
                    <td colSpan={habitaciones.length + 1} className="p-3 font-semibold text-gray-900">
                      {categoria.titulo}
                    </td>
                  </tr>

                  {/* Propiedades de la categoría */}
                  {categoria.propiedades.map((propiedad, prop_index) => {
                    const hay_diferencias = verificar_diferencias(propiedad.etiqueta);
                    
                    return (
                      <tr 
                        key={prop_index} 
                        className={`border-b hover:bg-gray-50 ${
                          hay_diferencias ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="p-4 font-medium text-gray-700">
                          <div className="flex items-center gap-2">
                            {propiedad.etiqueta}
                            {hay_diferencias && (
                              <AlertTriangle className="w-3 h-3 text-blue-600" />
                            )}
                          </div>
                        </td>
                        
                        {habitaciones_ordenadas.map(habitacion => {
                          const valor = propiedad.obtener_valor(habitacion);
                          
                          return (
                            <td key={habitacion.id} className="p-4 text-center">
                              <div className="flex items-center justify-center min-h-[24px]">
                                {propiedad.tipo === 'booleano' ? (
                                  valor ? (
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-red-600" />
                                  )
                                ) : propiedad.tipo === 'lista' ? (
                                  <div className="space-y-1">
                                    {(valor as string[]).slice(0, 3).map((item, index) => (
                                      <div key={index} className="flex items-center gap-1 text-xs">
                                        {obtener_icono_amenidad(item)}
                                        <span>{item}</span>
                                      </div>
                                    ))}
                                    {(valor as string[]).length > 3 && (
                                      <div className="text-xs text-gray-500">
                                        +{(valor as string[]).length - 3} más
                                      </div>
                                    )}
                                  </div>
                                ) : propiedad.tipo === 'componente' ? (
                                  valor as React.ReactNode
                                ) : (
                                  <span className="text-sm">{valor as string}</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Resumen de comparación */}
      <Card className="p-4">
        <h4 className="font-semibold text-gray-900 mb-3">Resumen de la comparación</h4>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium text-gray-800 mb-2">Capacidad total</h5>
            <p className="text-2xl font-bold text-gray-900">
              {habitaciones.reduce((total, hab) => total + hab.capacidad, 0)} camas
            </p>
            <p className="text-sm text-gray-600">
              {habitaciones.reduce((total, hab) => total + hab.camas_disponibles, 0)} disponibles
            </p>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-800 mb-2">
              Precio total ({calcular_noches()} {calcular_noches() === 1 ? 'noche' : 'noches'})
            </h5>
            <p className="text-2xl font-bold text-gray-900">
              R$ {habitaciones.reduce((total, hab) => total + (hab.precio_base * calcular_noches()), 0).toFixed(2)}
            </p>
            <p className="text-sm text-gray-600">
              Promedio: R$ {(habitaciones.reduce((total, hab) => total + hab.precio_base, 0) / habitaciones.length).toFixed(2)}/noche por habitación
            </p>
          </div>
        </div>

        {/* Diferencias destacadas */}
        {resaltar_diferencias && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-900">Diferencias importantes</span>
            </div>
            <div className="text-sm text-blue-800 space-y-1">
              {verificar_diferencias('Tipo') && (
                <p>• Las habitaciones tienen diferentes tipos (mixto/femenino)</p>
              )}
              {verificar_diferencias('Capacidad') && (
                <p>• Diferentes capacidades de camas</p>
              )}
              {verificar_diferencias('Precio base/noche') && (
                <p>• Precios diferentes por noche</p>
              )}
              {habitaciones.some(h => h.es_flexible) && (
                <p>• Algunas habitaciones son flexibles y pueden cambiar de tipo</p>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
