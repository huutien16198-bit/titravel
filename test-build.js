import { build } from 'vite';
process.env.GEMINI_API_KEY = '';
build().catch(console.error);
