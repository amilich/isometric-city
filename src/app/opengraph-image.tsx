import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'ISOCITY - Isometric Metropolis Builder';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          position: 'relative',
        }}
      >
        {/* Decorative grid pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Main title */}
          <div
            style={{
              fontSize: 120,
              fontWeight: 300,
              letterSpacing: '0.15em',
              color: 'rgba(255, 255, 255, 0.95)',
              marginBottom: 20,
            }}
          >
            ISOCITY
          </div>

          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              letterSpacing: '0.3em',
              color: 'rgba(255, 255, 255, 0.6)',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Metropolis Builder
          </div>

          {/* Decorative line */}
          <div
            style={{
              marginTop: 40,
              width: 200,
              height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              display: 'flex',
            }}
          />

          {/* Tagline */}
          <div
            style={{
              marginTop: 30,
              fontSize: 20,
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.4)',
              display: 'flex',
              gap: 20,
            }}
          >
            <span style={{ display: 'flex' }}>🏗️ Build</span>
            <span style={{ display: 'flex' }}>•</span>
            <span style={{ display: 'flex' }}>🚗 Simulate</span>
            <span style={{ display: 'flex' }}>•</span>
            <span style={{ display: 'flex' }}>🌆 Thrive</span>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)',
            display: 'flex',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
