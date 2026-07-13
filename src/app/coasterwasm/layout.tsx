import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'IsoCoaster WASM - WebAssembly Theme Park',
  description: 'Build your dream theme park in WebAssembly! A high-performance isometric theme park simulation.',
};

export default function CoasterWasmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
