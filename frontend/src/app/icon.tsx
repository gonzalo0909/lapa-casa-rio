import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#1a1a2e',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#e8c97a',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: -0.5,
            fontFamily: 'serif',
          }}
        >
          LCR
        </span>
      </div>
    ),
    { ...size }
  );
}
