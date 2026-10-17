import { NextRequest } from 'next/server';
import { handle } from '../../../lib/handler';
export const runtime = 'nodejs';
export const maxDuration = 45;
export async function POST(request: NextRequest) { return handle(request,'chat'); }
