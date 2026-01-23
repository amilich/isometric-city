'use client';

/* eslint-disable @next/next/no-img-element -- OG preview cards require native img for external URLs */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface OGData {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
}

function TwitterCard({ og }: { og: OGData }) {
  return (
    <div className="max-w-[504px] rounded-2xl overflow-hidden border border-gray-700 bg-black">
      {og.image && (
        <div className="relative aspect-[1.91/1] bg-gray-900">
          <img 
            src={og.image} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3">
        <div className="text-gray-500 text-sm truncate">{new URL(og.url).hostname}</div>
        <div className="text-white font-normal truncate">{og.title}</div>
        <div className="text-gray-500 text-sm line-clamp-2">{og.description}</div>
      </div>
    </div>
  );
}

function IMessageCard({ og }: { og: OGData }) {
  return (
    <div className="max-w-[300px] rounded-2xl overflow-hidden bg-[#1c1c1e] border border-[#38383a]">
      {og.image && (
        <div className="relative aspect-[1.91/1] bg-gray-900">
          <img 
            src={og.image} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-3 space-y-1">
        <div className="text-white text-sm font-medium line-clamp-2">{og.title}</div>
        <div className="text-gray-400 text-xs truncate">{new URL(og.url).hostname}</div>
      </div>
    </div>
  );
}

function SlackCard({ og }: { og: OGData }) {
  return (
    <div className="max-w-[400px] border-l-4 border-[#36C5F0] bg-white rounded-r pl-3 py-2 pr-3">
      <div className="text-[#1264A3] font-bold text-sm hover:underline cursor-pointer">{og.siteName || new URL(og.url).hostname}</div>
      <div className="text-[#1D1C1D] font-bold text-base mt-1">{og.title}</div>
      <div className="text-[#616061] text-sm mt-1 line-clamp-2">{og.description}</div>
      {og.image && (
        <div className="mt-2 rounded overflow-hidden max-w-[360px]">
          <img 
            src={og.image} 
            alt="" 
            className="max-h-[200px] object-cover"
          />
        </div>
      )}
    </div>
  );
}

function DiscordCard({ og }: { og: OGData }) {
  return (
    <div className="max-w-[432px] rounded bg-[#2f3136] border-l-4 border-[#5865F2] overflow-hidden">
      <div className="p-4">
        <div className="text-[#00b0f4] text-xs font-medium mb-1">{og.siteName || new URL(og.url).hostname}</div>
        <div className="text-[#00b0f4] font-semibold text-base hover:underline cursor-pointer">{og.title}</div>
        <div className="text-[#dcddde] text-sm mt-2 line-clamp-3">{og.description}</div>
      </div>
      {og.image && (
        <div className="px-4 pb-4">
          <img 
            src={og.image} 
            alt="" 
            className="rounded max-w-full max-h-[300px] object-cover"
          />
        </div>
      )}
    </div>
  );
}

export default function ThumbnailPreview() {
  const searchParams = useSearchParams();
  const [inputUrl, setInputUrl] = useState('');
  const [og, setOG] = useState<OGData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathParam = searchParams.get('path') || '/';

  useEffect(() => {
    const abortController = new AbortController();
    const baseUrl = window.location.origin;
    const fullUrl = `${baseUrl}${pathParam}`;
    setInputUrl(fullUrl);

    async function fetchOGData() {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(fullUrl, { signal: abortController.signal });
        const html = await response.text();
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const getMeta = (property: string): string => {
          const el = doc.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
          return el?.getAttribute('content') || '';
        };
        
        const title = getMeta('og:title') || doc.querySelector('title')?.textContent || '';
        const description = getMeta('og:description') || getMeta('description') || '';
        const image = getMeta('og:image') || getMeta('twitter:image') || '';
        const siteName = getMeta('og:site_name') || '';
        
        setOG({ title, description, image, siteName, url: fullUrl });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Request was cancelled, ignore
        }
        setError('Failed to fetch OG data');
        console.error(err);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchOGData();

    return () => {
      abortController.abort();
    };
  }, [pathParam]);

  const quickLinks = [
    { label: 'Homepage', path: '/' },
    { label: 'Co-op ABC12', path: '/coop/ABC12' },
    { label: 'Co-op XYZ99', path: '/coop/XYZ99' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">OG Image Preview</h1>
        <p className="text-gray-400 mb-6">See how your links will appear when shared on social platforms</p>
        
        {/* Quick Links */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {quickLinks.map((link) => (
            <a
              key={link.path}
              href={`/thumbnail?path=${encodeURIComponent(link.path)}`}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                pathParam === link.path 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>
        
        {/* Current URL */}
        <div className="mb-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
          <div className="text-sm text-gray-400 mb-1">Previewing:</div>
          <div className="font-mono text-blue-400">{inputUrl}</div>
        </div>
        
        {loading && (
          <div className="text-gray-400">Loading OG data...</div>
        )}
        
        {error && (
          <div className="text-red-400">{error}</div>
        )}
        
        {og && !loading && (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Twitter/X */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">𝕏</span> Twitter / X
              </h2>
              <div className="bg-black p-4 rounded-xl">
                <TwitterCard og={og} />
              </div>
            </div>
            
            {/* iMessage */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">💬</span> iMessage
              </h2>
              <div className="bg-[#000000] p-4 rounded-xl">
                <IMessageCard og={og} />
              </div>
            </div>
            
            {/* Slack */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">💼</span> Slack
              </h2>
              <div className="bg-white p-4 rounded-xl">
                <SlackCard og={og} />
              </div>
            </div>
            
            {/* Discord */}
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="text-xl">🎮</span> Discord
              </h2>
              <div className="bg-[#36393f] p-4 rounded-xl">
                <DiscordCard og={og} />
              </div>
            </div>
          </div>
        )}
        
        {/* Raw Meta Tags */}
        {og && !loading && (
          <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800">
            <h2 className="text-lg font-semibold mb-3">Raw Meta Tags</h2>
            <div className="font-mono text-sm space-y-1 text-gray-300">
              <div><span className="text-gray-500">og:title:</span> {og.title}</div>
              <div><span className="text-gray-500">og:description:</span> {og.description}</div>
              <div><span className="text-gray-500">og:image:</span> {og.image}</div>
              <div><span className="text-gray-500">og:site_name:</span> {og.siteName}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
