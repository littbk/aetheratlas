import { json, sessionValid } from './_auth.js';
export default function handler(request) { return json({ admin: sessionValid(request) }); }
