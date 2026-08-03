// api/_kv.js — Cliente Redis (Upstash) compartido
// Funciona con las variables que Vercel inyecta al conectar Upstash:
//   UPSTASH_REDIS_REST_URL  y  UPSTASH_REDIS_REST_TOKEN
// (también acepta los nombres KV_REST_API_* por compatibilidad)
import { Redis } from "@upstash/redis";

export const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
