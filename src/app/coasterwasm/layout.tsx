import { getGT } from 'gt-next/server';
import type { Metadata } from 'next';

export async function generateMetadata(): Promise<Metadata> {
  const gt = await getGT();

  return {
    title: gt('IsoCoaster WASM - WebAssembly Theme Park'),
    description: gt('Build your dream theme park in WebAssembly! A high-performance isometric theme park simulation.'),
  };
}

export default function CoasterWasmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
