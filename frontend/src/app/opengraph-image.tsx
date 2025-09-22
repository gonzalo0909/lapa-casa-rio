// src/app/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Lapa Casa Hostel - Especialista en Grupos | Santa Teresa Rio';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '80px 60px',
          fontFamily: 'Inter, system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* Patrón de fondo decorativo */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.1,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        
        {/* Contenido principal */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '60%',
            zIndex: 2,
          }}
        >
          {/* Logo/Título principal */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#ffffff',
              marginBottom: 20,
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              lineHeight: 1.1,
            }}
          >
            LAPA CASA
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: '#fbbf24',
                marginTop: -10,
              }}
            >
              HOSTEL
            </div>
          </div>

          {/* Subtítulo especialización */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 600,
              color: '#fbbf24',
              marginBottom: 15,
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            Especialista en Grupos
          </div>

          {/* Ubicación */}
          <div
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: '#ffffff',
              marginBottom: 30,
              display: 'flex',
              alignItems: 'center',
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            📍 Santa Teresa, Rio de Janeiro
          </div>

          {/* Highlights clave */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              🛏️ 45 camas • 4 habitaciones
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              👥 Descuentos hasta 20% grupos
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              💳 Reserva desde R$ 60/noche
            </div>
          </div>
        </div>

        {/* Sección derecha con CTA */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '35%',
            zIndex: 2,
          }}
        >
          {/* Badge de descuento */}
          <div
            style={{
              background: '#ef4444',
              color: '#ffffff',
              fontSize: 18,
              fontWeight: 700,
              padding: '12px 24px',
              borderRadius: 25,
              marginBottom: 30,
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              transform: 'rotate(-5deg)',
            }}
          >
            ¡HASTA 20% OFF!
          </div>

          {/* Imagen decorativa/iconos */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                fontSize: 80,
                filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
              }}
            >
              🏠
            </div>
            <div
              style={{
                display: 'flex',
                gap: 15,
                fontSize: 30,
                filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))',
              }}
            >
              🎉 🌴 ⭐
            </div>
          </div>

          {/* CTA Button */}
          <div
            style={{
              background: '#fbbf24',
              color: '#000000',
              fontSize: 22,
              fontWeight: 800,
              padding: '18px 36px',
              borderRadius: 15,
              textAlign: 'center',
              boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
              border: '3px solid #ffffff',
            }}
          >
            RESERVAR AHORA
          </div>

          {/* Website URL */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: '#ffffff',
              marginTop: 20,
              textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            lapacasahostel.com
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: await fetch(
            new URL('../../../public/fonts/inter-latin-400-normal.woff2', import.meta.url)
          ).then((res) => res.arrayBuffer()),
          style: 'normal',
          weight: 400,
        },
        {
          name: 'Inter',
          data: await fetch(
            new URL('../../../public/fonts/inter-latin-700-normal.woff2', import.meta.url)
          ).then((res) => res.arrayBuffer()),
          style: 'normal',
          weight: 700,
        },
        {
          name: 'Inter',
          data: await fetch(
            new URL('../../../public/fonts/inter-latin-900-normal.woff2', import.meta.url)
          ).then((res) => res.arrayBuffer()),
          style: 'normal',
          weight: 900,
        },
      ],
    }
  );
}
