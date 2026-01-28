import { Metadata } from 'next';

interface Props {
  params: Promise<{ roomCode: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomCode } = await params;
  const code = roomCode?.toUpperCase() || 'ROOM';
  const title = `Join co-op ${code}`;
  
  return {
    title,
    description: 'Join this IsoCoaster co-op park and build together with friends.',
    openGraph: {
      title,
      description: 'Join this IsoCoaster co-op park and build together with friends.',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: 'Join this IsoCoaster co-op park and build together with friends.',
    },
  };
}

export default function CoasterCoopRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
