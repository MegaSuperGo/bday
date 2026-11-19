import type { Env } from './env';
import * as admin from './routes/admin';
import * as pub from './routes/public';
import { errorResponse, HttpError } from './utils/http';

type Handler = (req: Request, env: Env, params: Record<string, string>) => Promise<Response>;

interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  admin: boolean;
}

const routes: Route[] = [];
function add(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ method, pattern, keys, handler, admin: path.startsWith('/api/admin') });
}

// Public / guest
add('GET', '/api/health', pub.health);
add('POST', '/api/identify', pub.identify);
add('GET', '/api/briefing', pub.briefing);
add('POST', '/api/briefing/progress', pub.progress);
add('POST', '/api/briefing/complete', pub.complete);
add('POST', '/api/chat', pub.chat);

// Admin
add('POST', '/api/admin/login', admin.login);
add('POST', '/api/admin/logout', admin.logout);
add('GET', '/api/admin/session', admin.session);
add('GET', '/api/admin/stats', admin.stats);
add('GET', '/api/admin/guests', admin.listGuests);
add('POST', '/api/admin/guests', admin.createGuest);
add('PATCH', '/api/admin/guests/:id', admin.updateGuest);
add('DELETE', '/api/admin/guests/:id', admin.deleteGuest);
add('POST', '/api/admin/guests/:id/reset', admin.resetGuest);
add('GET', '/api/admin/event', admin.getEvent);
add('PUT', '/api/admin/event', admin.putEvent);
add('GET', '/api/admin/ai', admin.getAi);
add('PUT', '/api/admin/ai', admin.putAi);
add('PUT', '/api/admin/ai/key', admin.putAiKey);
add('DELETE', '/api/admin/ai/key', admin.deleteAiKey);
add('POST', '/api/admin/ai/test', admin.testAi);

function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, '').toLowerCase())
    .filter(Boolean);
}

function isAllowed(origin: string | null, env: Env): boolean {
  return !!origin && allowedOrigins(env).includes(origin.toLowerCase());
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  if (!origin || !isAllowed(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Nexus-Client',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
};

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const origin = req.headers.get('Origin');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const match = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
  if (!match) {
    const exists = routes.some((r) => r.pattern.test(url.pathname));
    throw exists ? new HttpError(405, 'METHOD_NOT_ALLOWED', 'Methode nicht erlaubt.') : new HttpError(404, 'NOT_FOUND', 'Endpunkt nicht gefunden.');
  }

  // CSRF defence: state-changing requests must come from an allowed origin and carry
  // a custom header (which forces a CORS preflight for cross-site callers).
  if (req.method !== 'GET') {
    if (origin && !isAllowed(origin, env)) throw new HttpError(403, 'FORBIDDEN_ORIGIN', 'Ursprung nicht erlaubt.');
    if (match.admin && req.headers.get('X-Nexus-Client') !== '1') throw new HttpError(403, 'CSRF', 'Ungültige Anfrage.');
  }

  const m = url.pathname.match(match.pattern)!;
  const params: Record<string, string> = {};
  match.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
  return match.handler(req, env, params);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    let res: Response;
    try {
      res = await route(req, env);
    } catch (err) {
      if (err instanceof HttpError) {
        res = errorResponse(err);
      } else {
        console.error('Unhandled error', err);
        res = errorResponse(new HttpError(500, 'INTERNAL', 'Interner Systemfehler.'));
      }
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries({ ...securityHeaders, ...corsHeaders(origin, env) })) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
} satisfies ExportedHandler<Env>;
