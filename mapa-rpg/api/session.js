import { json, sessionValid } from '../lib/auth.js';
export function GET(request) { return json({ admin: sessionValid(request) }); }
