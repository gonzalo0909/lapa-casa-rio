// src/components/rooms/room-gallery.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Share2, 
  Maximize2,
  Grid3x3,
  Play,
  Pause
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

interface PropiedadesGaleriaHabitacion {
  habitacion: Habitacion;
  abierto: boolean;
  al_cerrar: () => void;
  imagen_inicial?: number;
}

export function RoomGallery({
  habitacion,
  abierto,
  al_cerrar,
  imagen_inicial = 0
}: PropiedadesGaleriaHabitacion) {
  const [imagen_actual, setImagenActual] = useState(imagen_inicial);
  const [modo_presentacion, setModoPresentacion] = useState(false);
  const [vista_cuadricula, setVistaCuadricula] = useState(false);
  const [zoom_activo, setZoomActivo] = useState(false);
  const [posicion_zoom, setPosicionZoom] = useState({ x: 50, y: 50 });

  // Resetear imagen actual cuando se abre la galería
  useEffect(() => {
    if (abierto) {
      setImagenActual(imagen_inicial);
      setModoPresentacion(false);
      setVistaCuadricula(false);
      setZoomActivo(false);
    }
  }, [abierto, imagen_inicial]);

  // Controles de teclado
  useEffect(() => {
    const manejar_tecla = (evento: KeyboardEvent) => {
      if (!abierto) return;

      switch (evento.key) {
        case 'Escape':
          al_cerrar();
          break;
        case 'ArrowLeft':
          navegar('anterior');
          break;
        case 'ArrowRight':
          navegar('siguiente');
          break;
        case ' ':
          evento.preventDefault();
          alternar_presentacion();
          break;
        case 'g':
        case 'G':
          setVistaCuadricula(!vista_cuadricula);
          break;
      }
    };

    window.addEventListener('keydown', manejar_tecla);
    return () => window.removeEventListener('keydown', manejar_tecla);
  }, [abierto, vista_cuadricula]);

  // Presentación automática
  useEffect(() => {
    let intervalo: NodeJS.Timeout;

    if (modo_presentacion && habitacion.imagenes.length > 1) {
      intervalo = setInterval(() => {
        navegar('siguiente');
      }, 3000);
    }

    return () => {
      if (intervalo) clearInterval(intervalo);
    };
  }, [modo_presentacion, imagen_actual]);

  const navegar = (direccion: 'anterior' | 'siguiente') => {
    if (habitacion.imagenes.length <= 1) return;

    setImagenActual(prev => {
      if (direccion === 'anterior') {
        return prev === 0 ? habitacion.imagenes.length - 1 : prev - 1;
      } else {
        return prev === habitacion.imagenes.length - 1 ? 0 : prev + 1;
      }
    });
  };

  const ir_a_imagen = (indice: number) => {
    setImagenActual(indice);
    setVistaCuadricula(false);
  };

  const alternar_presentacion = () => {
    setModoPresentacion(!modo_presentacion);
  };

  const manejar_zoom = (evento: React.MouseEvent<HTMLDivElement>) => {
    if (!zoom_activo) return;

    const rect = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - rect.left) / rect.width) * 100;
    const y = ((evento.clientY - rect.top) / rect.height) * 100;
    
    setPosicionZoom({ x, y });
  };

  const descargar_imagen = async () => {
    try {
      const respuesta = await fetch(habitacion.imagenes[imagen_actual]);
      const blob = await respuesta.blob();
      const url = window.URL.createObjectURL(blob);
      
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${habitacion.nombre}-imagen-${imagen_actual + 1}.jpg`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al descargar imagen:', error);
    }
  };

  const compartir_imagen = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${habitacion.nombre} - Lapa Casa Hostel`,
          text: habitacion.descripcion,
          url: habitacion.imagenes[imagen_actual]
        });
      } catch (error) {
        console.error('Error al compartir:', error);
      }
    } else {
      // Fallback: copiar URL al portapapeles
      try {
        await navigator.clipboard.writeText(habitacion.imagenes[imagen_actual]);
      } catch (error) {
        console.error('Error al copiar URL:', error);
      }
    }
  };

  const obtener_color_tipo = () => {
    switch (habitacion.tipo) {
      case 'mixto': return 'bg-blue-500';
      case 'femenino': return 'bg-pink-500';
      case 'masculino': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (!abierto || habitacion.imagenes.length === 0) {
    return null;
  }

  return (
    <Modal
      abierto={abierto}
      al_cerrar={al_cerrar}
      tamano="full"
      className="bg-black/95 backdrop-blur-sm"
    >
      <div className="relative w-full h-full flex flex-col">
        {/* Barra superior */}
        <div className="absolute top-0 left-0 right-0 z-20 bg-black/50 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between p-4">
            {/* Información de la habitación */}
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {habitacion.nombre}
                </h2>
                <p className="text-sm text-gray-300">
                  {imagen_actual + 1} de {habitacion.imagenes.length} imágenes
                </p>
              </div>
              
              <Badge className={`${obtener_color_tipo()} text-white`}>
                {habitacion.tipo}
              </Badge>
            </div>

            {/* Controles principales */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVistaCuadricula(!vista_cuadricula)}
                className="text-white hover:bg-white/10"
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={alternar_presentacion}
                className="text-white hover:bg-white/10"
              >
                {modo_presentacion ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoomActivo(!zoom_activo)}
                className="text-white hover:bg-white/10"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={descargar_imagen}
                className="text-white hover:bg-white/10"
              >
                <Download className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={compartir_imagen}
                className="text-white hover:bg-white/10"
              >
                <Share2 className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={al_cerrar}
                className="text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Vista de cuadrícula */}
        {vista_cuadricula ? (
          <div className="flex-1 overflow-y-auto pt-20 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
              {habitacion.imagenes.map((imagen, indice) => (
                <div
                  key={indice}
                  className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden transition-all ${
                    indice === imagen_actual 
                      ? 'ring-2 ring-blue-500 scale-105' 
                      : 'hover:scale-105'
                  }`}
                  onClick={() => ir_a_imagen(indice)}
                >
                  <Image
                    src={imagen}
                    alt={`${habitacion.nombre} - Vista ${indice + 1}`}
                    fill
                    className="object-cover"
                  />
                  
                  <div className="absolute inset-0 bg-black/20 hover:bg-black/10 transition-colors" />
                  
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                    {indice + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Vista de imagen principal */
          <div className="flex-1 flex items-center justify-center pt-20 pb-20">
            <div className="relative max-w-full max-h-full">
              <div
                className={`relative cursor-${zoom_activo ? 'zoom-in' : 'default'}`}
                onMouseMove={manejar_zoom}
                onClick={() => zoom_activo && setZoomActivo(false)}
              >
                <Image
                  src={habitacion.imagenes[imagen_actual]}
                  alt={`${habitacion.nombre} - Vista ${imagen_actual + 1}`}
                  width={1200}
                  height={800}
                  className={`object-contain max-h-[70vh] w-auto transition-transform duration-300 ${
                    zoom_activo ? 'scale-150' : 'scale-100'
                  }`}
                  style={zoom_activo ? {
                    transformOrigin: `${posicion_zoom.x}% ${posicion_zoom.y}%`
                  } : {}}
                  priority
                />
              </div>

              {/* Controles de navegación */}
              {habitacion.imagenes.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30"
                    onClick={() => navegar('anterior')}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="lg"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 bg-black/30"
                    onClick={() => navegar('siguiente')}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Barra inferior - Miniaturas */}
        {!vista_cuadricula && habitacion.imagenes.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm border-t border-white/10">
            <div className="flex items-center gap-2 p-4 overflow-x-auto">
              {habitacion.imagenes.map((imagen, indice) => (
                <div
                  key={indice}
                  className={`relative flex-shrink-0 w-16 h-16 cursor-pointer rounded-lg overflow-hidden transition-all ${
                    indice === imagen_actual 
                      ? 'ring-2 ring-blue-500 scale-110' 
                      : 'opacity-70 hover:opacity-100 hover:scale-105'
                  }`}
                  onClick={() => setImagenActual(indice)}
                >
                  <Image
                    src={imagen}
                    alt={`Miniatura ${indice + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Indicador de modo presentación */}
        {modo_presentacion && (
          <div className="absolute top-24 right-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Presentación activa
          </div>
        )}

        {/* Indicador de zoom */}
        {zoom_activo && (
          <div className="absolute top-24 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            Zoom activo - Click para desactivar
          </div>
        )}

        {/* Atajos de teclado */}
        <div className="absolute bottom-4 left-4 bg-black/70 text-white text-xs p-2 rounded opacity-50 hover:opacity-100 transition-opacity">
          <div>Atajos: ←→ Navegar | Espacio: Presentación | G: Cuadrícula | Esc: Cerrar</div>
        </div>
      </div>
    </Modal>
  );
}
