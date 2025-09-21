// src/components/rooms/room-card.tsx
'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { RoomGallery } from './room-gallery';
import { RoomAmenities } from './room-amenities';
import { 
  Users, 
  Bed, 
  Clock, 
  Star, 
  Wifi, 
  AirVent, 
  Lock,
  AlertTriangle,
  Info,
  Eye
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

interface PropiedadesTarjetaHabitacion {
  habitacion: Habitacion;
  fechas: {
    entrada: Date;
    salida: Date;
  };
  seleccionada: boolean;
  al_seleccionar: (seleccionada: boolean) => void;
  puede_deseleccionar?: boolean;
  destacar_recomendada?: boolean;
  mostrar_precios_detallados?: boolean;
}

export function RoomCard({
  habitacion,
  fechas,
  seleccionada,
  al_seleccionar,
  puede_deseleccionar = true,
  destacar_recomendada = false,
  mostrar_precios_detallados = true
}: PropiedadesTarjetaHabitacion) {
  const [mostrar_galeria, setMostrarGaleria] = useState(false);
  const [mostrar_amenidades, setMostrarAmenidades] = useState(false);
  const [imagen_actual, setImagenActual] = useState(0);

  const obtener_icono_tipo = () => {
    switch (habitacion.tipo) {
      case 'mixto':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'femenino':
        return <Users className="w-4 h-4 text-pink-600" />;
      case 'masculino':
        return <Users className="w-4 h-4 text-green-600" />;
      default:
        return <Users className="w-4 h-4 text-gray-600" />;
    }
  };

  const obtener_color_tipo = () => {
    switch (habitacion.tipo) {
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

  const calcular_noches = () => {
    const diff = fechas.salida.getTime() - fechas.entrada.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const precio_por_noche = habitacion.precio_base;
  const precio_total = precio_por_noche * calcular_noches();
  const noches = calcular_noches();

  const manejar_click_tarjeta = (evento: React.MouseEvent) => {
    // Evitar seleccionar si se hace click en botones o checkboxes
    const objetivo = evento.target as HTMLElement;
    if (
      objetivo.closest('button') || 
      objetivo.closest('input') || 
      objetivo.closest('[role="checkbox"]')
    ) {
      return;
    }

    if (habitacion.disponible && (puede_deseleccionar || !seleccionada)) {
      al_seleccionar(!seleccionada);
    }
  };

  const cambiar_imagen = (direccion: 'anterior' | 'siguiente') => {
    if (direccion === 'anterior') {
      setImagenActual(prev => 
        prev === 0 ? habitacion.imagenes.length - 1 : prev - 1
      );
    } else {
      setImagenActual(prev => 
        prev === habitacion.imagenes.length - 1 ? 0 : prev + 1
      );
    }
  };

  return (
    <>
      <Card 
        className={`overflow-hidden transition-all duration-200 cursor-pointer ${
          !habitacion.disponible 
            ? 'opacity-60 bg-gray-50' 
            : seleccionada 
              ? 'ring-2 ring-blue-500 shadow-lg' 
              : 'hover:shadow-md hover:scale-[1.01]'
        } ${
          destacar_recomendada ? 'ring-2 ring-green-500 bg-green-50' : ''
        }`}
        onClick={manejar_click_tarjeta}
      >
        <div className="flex flex-col md:flex-row">
          {/* Imagen de la habitación */}
          <div className="relative md:w-80 h-48 md:h-auto">
            {habitacion.imagenes.length > 0 ? (
              <>
                <Image
                  src={habitacion.imagenes[imagen_actual]}
                  alt={`${habitacion.nombre} - Vista ${imagen_actual + 1}`}
                  fill
                  className="object-cover"
                />
                
                {/* Controles de imagen */}
                {habitacion.imagenes.length > 1 && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="p-1 w-8 h-8 bg-white/80 backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiar_imagen('anterior');
                      }}
                    >
                      ‹
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="p-1 w-8 h-8 bg-white/80 backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        cambiar_imagen('siguiente');
                      }}
                    >
                      ›
                    </Button>
                  </div>
                )}

                {/* Contador de imágenes */}
                {habitacion.imagenes.length > 1 && (
                  <div className="absolute bottom-2 left-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    {imagen_actual + 1} / {habitacion.imagenes.length}
                  </div>
                )}

                {/* Botón ver galería */}
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMostrarGaleria(true);
                  }}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Ver más
                </Button>
              </>
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                <Bed className="w-12 h-12 text-gray-400" />
              </div>
            )}

            {/* Badge de disponibilidad */}
            <div className="absolute top-2 left-2">
              {!habitacion.disponible ? (
                <Badge variant="destructive">No disponible</Badge>
              ) : habitacion.camas_disponibles < habitacion.capacidad ? (
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                  {habitacion.camas_disponibles} camas libres
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  Totalmente disponible
                </Badge>
              )}
            </div>

            {/* Badge recomendada */}
            {destacar_recomendada && (
              <div className="absolute top-10 left-2">
                <Badge className="bg-green-500 text-white">
                  <Star className="w-3 h-3 mr-1" />
                  Recomendada
                </Badge>
              </div>
            )}
          </div>

          {/* Contenido de la tarjeta */}
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">
                    {habitacion.nombre}
                  </h3>
                  <div className="flex items-center gap-1">
                    {obtener_icono_tipo()}
                    <Badge variant="outline" className={obtener_color_tipo()}>
                      {habitacion.tipo}
                    </Badge>
                  </div>
                </div>

                {/* Información de capacidad */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <div className="flex items-center gap-1">
                    <Bed className="w-4 h-4" />
                    <span>{habitacion.capacidad} camas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>Hasta {habitacion.capacidad} personas</span>
                  </div>
                </div>

                {/* Habitación flexible - estado de conversión */}
                {habitacion.es_flexible && habitacion.estado_conversion && (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-orange-800">
                        Habitación flexible
                      </p>
                      <p className="text-orange-700">
                        Se convertirá a {habitacion.estado_conversion.convertira_a} en{' '}
                        <span className="font-semibold">
                          {habitacion.estado_conversion.horas_restantes}h
                        </span>{' '}
                        si no hay reservas femeninas
                      </p>
                    </div>
                  </div>
                )}

                {/* Descripción */}
                <p className="text-gray-700 text-sm mb-4 line-clamp-2">
                  {habitacion.descripcion}
                </p>

                {/* Amenidades principales */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {habitacion.amenidades.slice(0, 4).map((amenidad, indice) => (
                    <div key={indice} className="flex items-center gap-1 text-xs text-gray-600">
                      {amenidad.includes('WiFi') && <Wifi className="w-3 h-3" />}
                      {amenidad.includes('Aire') && <AirVent className="w-3 h-3" />}
                      {amenidad.includes('Locker') && <Lock className="w-3 h-3" />}
                      <span>{amenidad}</span>
                    </div>
                  ))}
                  {habitacion.amenidades.length > 4 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs p-0 h-auto font-normal text-blue-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMostrarAmenidades(true);
                      }}
                    >
                      +{habitacion.amenidades.length - 4} más
                    </Button>
                  )}
                </div>
              </div>

              {/* Checkbox de selección */}
              <div className="flex flex-col items-end">
                {habitacion.disponible && (
                  <Checkbox
                    checked={seleccionada}
                    onChange={al_seleccionar}
                    disabled={seleccionada && !puede_deseleccionar}
                    className="mb-4"
                  />
                )}

                {/* Precios */}
                {mostrar_precios_detallados && (
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      R$ {precio_por_noche.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">por cama/noche</div>
                    
                    {noches > 1 && (
                      <div className="text-sm text-gray-600 mt-1">
                        Total {noches} noches:
                        <div className="font-semibold text-gray-900">
                          R$ {precio_total.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-2">
              {habitacion.disponible ? (
                <Button
                  className="flex-1"
                  variant={seleccionada ? "default" : "outline"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (puede_deseleccionar || !seleccionada) {
                      al_seleccionar(!seleccionada);
                    }
                  }}
                  disabled={seleccionada && !puede_deseleccionar}
                >
                  {seleccionada ? 'Seleccionada' : 'Seleccionar'}
                </Button>
              ) : (
                <Button disabled className="flex-1">
                  No disponible
                </Button>
              )}

              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  setMostrarGaleria(true);
                }}
              >
                Ver detalles
              </Button>
            </div>

            {/* Información adicional */}
            {seleccionada && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Info className="w-4 h-4" />
                  <span>
                    Esta habitación está incluida en tu reserva.{' '}
                    {noches > 1 && `Total por ${noches} noches: R$ ${precio_total.toFixed(2)}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Galería modal */}
      {mostrar_galeria && (
        <RoomGallery
          habitacion={habitacion}
          abierto={mostrar_galeria}
          al_cerrar={() => setMostrarGaleria(false)}
        />
      )}

      {/* Amenidades modal */}
      {mostrar_amenidades && (
        <RoomAmenities
          habitacion={habitacion}
          abierto={mostrar_amenidades}
          al_cerrar={() => setMostrarAmenidades(false)}
        />
      )}
    </>
  );
}
