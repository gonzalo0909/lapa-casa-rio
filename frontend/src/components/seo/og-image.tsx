// src/components/seo/og-image.tsx
'use client';

import { ImageResponse } from 'next/og';

interface OgImageProps {
  title: string;
  description?: string;
  type?: 'default' | 'room' | 'booking' | 'offer';
  price?: string;
  discount?: string;
  roomImage?: string;
  locale?: string;
}

export function generateOgImage({
  title,
  description,
  type = 'default',
  price,
  discount,
  roomImage,
  locale = 'pt',
}: OgImageProps) {
  const size = { width: 1200, height: 630 };
  
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          backgroundColor: 'white',
          position: 'relative',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            opacity: 0.9,
          }}
        />

        {/* Pattern overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='0.1'%3E%3Cpath d='m0 40l40-40h-40v40z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        {/* Header with logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '40px 60px',
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 12,
                background: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
              }}
            >
              🏠
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: 'white',
                  lineHeight: 1,
                }}
              >
                LAPA CASA
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#fbbf24',
                  lineHeight: 1,
                }}
              >
                HOSTEL
              </div>
            </div>
          </div>

          {/* Location badge */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              borderRadius: 25,
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            <span style={{ fontSize: 16, color: 'white' }}>📍</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>
              Santa Teresa, Rio
            </span>
          </div>
        </div>

        {/* Main content area */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            flex: 1,
            padding: '0 60px',
            zIndex: 2,
          }}
        >
          {/* Left side - Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              flex: type === 'room' && roomImage ? 0.6 : 1,
              paddingRight: type === 'room' && roomImage ? 40 : 0,
            }}
          >
            {/* Discount badge */}
            {discount && (
              <div
                style={{
                  background: '#ef4444',
                  color: 'white',
                  fontSize: 16,
                  fontWeight: 700,
                  padding: '8px 20px',
                  borderRadius: 20,
                  marginBottom: 20,
                  alignSelf: 'flex-start',
                  transform: 'rotate(-2deg)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                }}
              >
                {discount}
              </div>
            )}

            {/* Main title */}
            <div
              style={{
                fontSize: type === 'default' ? 56 : 48,
                fontWeight: 900,
                color: 'white',
                lineHeight: 1.1,
                marginBottom: 16,
                textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              {title}
            </div>

            {/* Description */}
            {description && (
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.9)',
                  lineHeight: 1.3,
                  marginBottom: 24,
                  textShadow: '1px 1px 2px rgba(0,0,0,0.3)',
                }}
              >
                {description}
              </div>
            )}

            {/* Price display */}
            {price && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#fbbf24',
                  }}
                >
                  {locale === 'pt' ? 'Desde' : locale === 'es' ? 'Desde' : 'From'}
                </span>
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 900,
                    color: '#fbbf24',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {price}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: 'rgba(251,191,36,0.8)',
                  }}
                >
                  /{locale === 'pt' ? 'noite' : locale === 'es' ? 'noche' : 'night'}
                </span>
              </div>
            )}

            {/* Key features */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>🛏️</span>
                {locale === 'pt' ? '45 camas • 4 habitações' : 
                 locale === 'es' ? '45 camas • 4 habitaciones' : 
                 '45 beds • 4 rooms'}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>👥</span>
                {locale === 'pt' ? 'Especialista em grupos' : 
                 locale === 'es' ? 'Especialista en grupos' : 
                 'Group specialist'}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>💳</span>
                {locale === 'pt' ? 'Reserva sem taxas extras' : 
                 locale === 'es' ? 'Reserva sin comisiones' : 
                 'No booking fees'}
              </div>
            </div>
          </div>

          {/* Right side - Room image */}
          {type === 'room' && roomImage && (
            <div
              style={{
                flex: 0.4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 280,
                  height: 200,
                  borderRadius: 16,
                  overflow: 'hidden',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  border: '4px solid white',
                }}
              >
                <img
                  src={roomImage}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '40px 60px',
            zIndex: 2,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              lapacasahostel.com
            </div>
            <div
              style={{
                height: 20,
                width: 1,
                background: 'rgba(255,255,255,0.3)',
              }}
            />
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.8)',
              }}
            >
              +55 21 9999-9999
            </div>
          </div>

          {/* CTA button */}
          <div
            style={{
              background: '#fbbf24',
              color: '#000',
              fontSize: 18,
              fontWeight: 800,
              padding: '16px 32px',
              borderRadius: 12,
              boxShadow: '0 4px 16px rgba(251,191,36,0.4)',
            }}
          >
            {locale === 'pt' ? 'RESERVAR AGORA' : 
             locale === 'es' ? 'RESERVAR AHORA' : 
             'BOOK NOW'}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

// Componente para usar en páginas
export default function OgImageComponent(props: OgImageProps) {
  return null; // Este componente no renderiza nada, solo exporta la función
}
