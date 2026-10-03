import { handleScim } from '@/lib/scim/handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

/**
 * SCIM 2.0 HTTP API.
 * Point a client at `/scim/v2` and send `Authorization: Bearer $SCIM_BEARER_TOKEN`.
 */
async function dispatch(request: Request, context: RouteContext): Promise<Response> {
  const params = await context.params;
  const path = params.path ?? [];
  return handleScim(request, path);
}

export function GET(request: Request, context: RouteContext): Promise<Response> {
  return dispatch(request, context);
}

export function POST(request: Request, context: RouteContext): Promise<Response> {
  return dispatch(request, context);
}

export function PUT(request: Request, context: RouteContext): Promise<Response> {
  return dispatch(request, context);
}

export function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return dispatch(request, context);
}

export function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return dispatch(request, context);
}
