// src/components/rooms/room-amenities.tsx
'use client';

import React from 'react';
import { Modal } from '../ui/modal';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { 
  Wifi, 
  AirVent, 
  Lock, 
  Users, 
  Bath, 
  Coffee, 
  Car, 
  MapPin,
  Shield,
  Clock,
  Tv,
  Music,
  Utensils,
  Shirt,
  Phone,
  CheckCircle,
  X,
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

interface PropiedadesAmenidadesHabitacion {
  habitacion: Habitacion;
  abierto: boolean;
  al_cerrar: () => void;
}

interface CategoriaAmenidad {
  nombre: string;
  icono: React.ReactNode;
  items: string[];
  color: string;
}

export function RoomAmenities({
  habitacion,
  abierto,
  al_cerrar
}: PropiedadesAmenidadesHabitacion) {
  
  const obtener_icono_amenidad = (amenidad: string): React.ReactNode => {
    const amenidad_lower = amenidad.toLowerCase();
    
    if (amenidad_lower.includes('wifi') || amenidad_lower.includes('internet')) {
      return <Wifi className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('aire') || amenidad_lower.includes('acondicionado')) {
      return <AirVent className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('locker') || amenidad_lower.includes('casillero')) {
      return <Lock className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('baño') || amenidad_lower.includes('bathroom')) {
      return <Bath className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('tv') || amenidad_lower.includes('televisión')) {
      return <Tv className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('música') || amenidad_lower.includes('audio')) {
      return <Music className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('cocina') || amenidad_lower.includes('kitchen')) {
      return <Utensils className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('lavandería') || amenidad_lower.includes('laundry')) {
      return <Shirt className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('seguridad') || amenidad_lower.includes('security')) {
      return <Shield className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('recepción') || amenidad_lower.includes('24h')) {
      return <Clock className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('estacionamiento') || amenidad_lower.includes('parking')) {
      return <Car className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('ubicación') || amenidad_lower.includes('location')) {
      return <MapPin className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('café') || amenidad_lower.includes('coffee')) {
      return <Coffee className="w-5 h-5" />;
    }
    if (amenidad_lower.includes('teléfono') || amenidad_lower.includes('phone')) {
      return <Phone className="w-5 h-5" />;
    }
    
    return <CheckCircle className="w-5 h-5" />;
  };

  const categorizar_amenidades = (): CategoriaAmenidad[] => {
    const categorias: CategoriaAmenidad[] = [
      {
        nombre: 'Habitación',
        icono: <Users className="w-5 h-5" />,
        items: [],
        color: 'bg-blue-50 border-blue-200 text-blue-800'
      },
      {
        nombre: 'Comodidades',
        icono: <AirVent className="w-5 h-5" />,
        items: [],
        color: 'bg-green-50 border-green-200 text-green-800'
      },
      {
        nombre: 'Conectividad',
        icono: <Wifi className="w-5 h-5" />,
        items: [],
        color: 'bg-purple-50 border-purple-200 text-purple-800'
      },
      {
        nombre: 'Seguridad',
        icono: <Shield className="w-5 h-5" />,
        items: [],
        color: 'bg-red-50 border-red-200 text-red-800'
      },
      {
        nombre: 'Servicios',
        icono: <Clock className="w-5 h-5" />,
        items: [],
        color: 'bg-yellow-50 border-yellow-200 text-yellow-800'
      },
      {
        nombre: 'Otras',
        icono: <CheckCircle className="w-5 h-5" />,
        items: [],
        color: 'bg-gray-50 border-gray-200 text-gray-800'
      }
    ];

    habitacion.amenidades.forEach(amenidad => {
      const amenidad_lower = amenidad.toLowerCase();
      
      if (amenidad_lower.includes('cama') || amenidad_lower.includes('litera') || 
          amenidad_lower.includes('colchón') || amenidad_lower.includes('almohada')) {
        categorias[0].items.push(amenidad);
      } else if (amenidad_lower.includes('aire') || amenidad_lower.includes('ventilador') || 
                 amenidad_lower.includes('calefacción') || amenidad_lower.includes('clima')) {
        categorias[1].items.push(amenidad);
      } else if (amenidad_lower.includes('wifi') || amenidad_lower.includes('internet') || 
                 amenidad_lower.includes('enchuf') || amenidad_lower.includes('usb')) {
        categorias[2].items.push(amenidad);
      } else if (amenidad_lower.includes('locker') || amenidad_lower.includes('segur') || 
                 amenidad_lower.includes('llave') || amenidad_lower.includes('cerradura')) {
        categorias[3].items.push(amenidad);
      } else if (amenidad_lower.includes('24h') || amenidad_lower.includes('recepción') || 
                 amenidad_lower.includes('limpieza') || amenidad_lower.includes('servicio')) {
        categorias[4].items.push(amenidad);
      } else {
        categorias[5].items.push(amenidad);
      }
    });

    // Filtrar categorías vacías
    return categorias.filter(categoria => categoria.items.length > 0);
  };

  const categorias_amenidades = categorizar_amenidades();

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

  const amenidades_destacadas = [
    'WiFi gratuito',
    'Aire acondicionado',
    'Lockers individuales',
    'Enchufes por cama'
  ].filter(amenidad => 
    habitacion.amenidades.some(a => 
      a.toLowerCase().includes(amenidad.toLowerCase().split(' ')[0])
    )
  );

  if (!abierto) {
    return null;
  }

  return (
    <Modal
      abierto={abierto}
      al_cerrar={al_cerrar}
      tamano="lg"
      titulo={`Amenidades - ${habitacion.nombre}`}
    >
      <div className="space-y-6">
        {/* Header de la habitación */}
        <div className="flex items-center justify-between pb-4 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {habitacion.nombre}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className={obtener_color_tipo()}>
                {habitacion.tipo}
              </Badge>
              <span className="text-sm text-gray-600">
                {habitacion.capacidad} camas • R$ {habitacion.precio_base}/noche
              </span>
            </div>
          </div>
        </div>

        {/* Amenidades destacadas */}
        {amenidades_destacadas.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Amenidades destacadas
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {amenidades_destacadas.map((amenidad, indice) => (
                <div
                  key={indice}
                  className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  {obtener_icono_amenidad(amenidad)}
                  <span className="text-sm font-medium text-green-800">
                    {amenidad}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amenidades por categorías */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Todas las amenidades
          </h3>
          
          <div className="space-y-4">
            {categorias_amenidades.map((categoria, indice) => (
              <Card key={indice} className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-lg ${categoria.color}`}>
                    {categoria.icono}
                  </div>
                  <h4 className="font-semibold text-gray-900">
                    {categoria.nombre}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {categoria.items.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {categoria.items.map((amenidad, item_indice) => (
                    <div
                      key={item_indice}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      {obtener_icono_amenidad(amenidad)}
                      <span className="text-sm text-gray-700">
                        {amenidad}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Información especial de la habitación flexible */}
        {habitacion.es_flexible && (
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-900 mb-2">
                  Habitación Flexible
                </h4>
                <p className="text-sm text-orange-800 mb-2">
                  Esta habitación funciona como dormitorio femenino por defecto, 
                  pero se convierte automáticamente a mixto si no hay reservas 
                  femeninas 48 horas antes del check-in.
                </p>
                {habitacion.estado_conversion && (
                  <p className="text-sm font-medium text-orange-900">
                    Se convertirá a {habitacion.estado_conversion.convertira_a} en{' '}
                    {habitacion.estado_conversion.horas_restantes} horas
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Notas adicionales */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">
                Incluido en tu estadía
              </h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Ropa de cama limpia y toallas</li>
                <li>• Acceso a todas las áreas comunes del hostel</li>
                <li>• Mapa gratuito de Rio de Janeiro</li>
                <li>• Información turística y recomendaciones locales</li>
                <li>• Soporte 24/7 del equipo de Lapa Casa</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Estadísticas de amenidades */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {habitacion.amenidades.length}
            </div>
            <div className="text-sm text-gray-600">
              Total amenidades
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {categorias_amenidades.length}
            </div>
            <div className="text-sm text-gray-600">
              Categorías
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {amenidades_destacadas.length}
            </div>
            <div className="text-sm text-gray-600">
              Destacadas
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={al_cerrar}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Entendido
          </button>
          
          <button
            onClick={() => {
              // Compartir amenidades
              if (navigator.share) {
                navigator.share({
                  title: `Amenidades - ${habitacion.nombre}`,
                  text: `${habitacion.nombre} en Lapa Casa Hostel incluye: ${habitacion.amenidades.slice(0, 5).join(', ')}...`,
                  url: window.location.href
                });
              }
            }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Compartir
          </button>
        </div>
      </div>
    </Modal>
  );
}
