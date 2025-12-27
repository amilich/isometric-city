import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Use the static og-image.png for static generation
    const fallbackPath = path.join(process.cwd(), 'public', 'og-image.png');
    const fallbackBuffer = await readFile(fallbackPath);
    
    return new NextResponse(fallbackBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': fallbackBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error serving OG image:', error);
    return new NextResponse('Image not found', { status: 404 });
  }
}
