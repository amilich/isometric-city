'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (typeof window === 'undefined') {
    // During SSR/prerendering, return a simple structure
    return (
      <html>
        <body>
          <div>Error</div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Something went wrong!</h1>
          <p style={{ marginBottom: '16px', color: '#666' }}>{error?.message || 'An unexpected error occurred'}</p>
          <button
            onClick={reset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
