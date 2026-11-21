export const runtime = 'nodejs';

import { multiplayerReady } from '@/lib/store';

export async function GET() {
  return Response.json({
    multiplayerReady: multiplayerReady(),
    storage: multiplayerReady() ? 'upstash-redis' : 'local-file-or-memory',
  });
}
