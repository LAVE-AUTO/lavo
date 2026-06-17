import { handlers } from '@/auth';
// export const { GET, POST } = handlers;

import { NextResponse, type NextRequest } from 'next/server';

// Flag to put Facebook OAuth "en veille" (on standby)
const FACEBOOK_LOGIN_ENABLED = false;

async function interceptFacebookAuth(req: NextRequest, handler: (req: NextRequest) => Promise<Response> | Response) {
  const url = new URL(req.url);
  // If Facebook login is disabled, return an adapted response for any Facebook-related auth route
  if (!FACEBOOK_LOGIN_ENABLED && url.pathname.includes('/facebook')) {
    return NextResponse.json(
      { 
        error: 'service_unavailable',
        message: 'Facebook authentication is temporarily disabled.' 
      },
      { status: 503 }
    );
  }
  return handler(req);
}


export async function GET(req: NextRequest) {
  return interceptFacebookAuth(req, handlers.GET as unknown as (req: NextRequest) => Promise<Response>);
}

export async function POST(req: NextRequest) {
  return interceptFacebookAuth(req, handlers.POST as unknown as (req: NextRequest) => Promise<Response>);
}
