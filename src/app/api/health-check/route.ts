import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    system: 'PMSify API Gateway',
    timestamp: new Date().toISOString(),
  });
}
