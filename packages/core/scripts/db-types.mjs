// Canlı Supabase şemasından src/db/database.types.ts üretir (supabase-js Database biçiminde).
// Şema, PostgREST'in OpenAPI çıktısından okunur; bu uç yalnızca service_role anahtarı kabul eder.
// Anahtar kökteki .env dosyasından (SUPABASE_SERVICE_ROLE_KEY) okunur, hiçbir yere yazılmaz ve basılmaz.
// Kullanım: npm run db:types -w @bekofy/core

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const envFile = new URL('../../../.env', import.meta.url);
const env = { ...process.env };
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const config = readFileSync(new URL('../src/config.ts', import.meta.url), 'utf8');
const url = env.SUPABASE_URL || config.match(/SUPABASE_URL = '([^']+)'/)?.[1];
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY boş. Supabase panelinden (Project Settings > API) alıp kökteki .env dosyasına yaz.');
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' } });
if (!res.ok) {
  console.error(`Şema okunamadı: HTTP ${res.status}. Anahtarın service_role olduğundan emin ol.`);
  process.exit(1);
}
const spec = await res.json();
const defs = spec.definitions ?? {};

const SCALAR = {
  uuid: 'string', text: 'string', 'character varying': 'string', character: 'string', citext: 'string',
  'timestamp with time zone': 'string', 'timestamp without time zone': 'string', date: 'string',
  'time without time zone': 'string', 'time with time zone': 'string', interval: 'string', inet: 'string', bytea: 'string',
  integer: 'number', bigint: 'number', smallint: 'number', numeric: 'number', 'double precision': 'number', real: 'number',
  boolean: 'boolean', json: 'Json', jsonb: 'Json',
};
const tsOf = (p) => {
  if (p.enum) return p.enum.map((v) => JSON.stringify(v)).join(' | ');
  const fmt = p.format ?? '';
  if (fmt.endsWith('[]') || p.type === 'array') {
    const inner = p.items ? tsOf(p.items) : SCALAR[fmt.slice(0, -2)] ?? 'unknown';
    return `(${inner})[]`;
  }
  return SCALAR[fmt] ?? ({ string: 'string', integer: 'number', number: 'number', boolean: 'boolean' })[p.type] ?? 'unknown';
};
const FK = /<fk table='([^']+)' column='([^']+)'\/>/;
const prop = (name) => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name));

const tables = Object.keys(defs).sort().map((table) => {
  const def = defs[table];
  const required = new Set(def.required ?? []);
  const cols = Object.entries(def.properties ?? {});
  const row = [], insert = [], update = [], rels = [];
  for (const [col, p] of cols) {
    const t = tsOf(p);
    const hasDefault = p.default !== undefined;
    const notNull = required.has(col) || hasDefault;
    row.push(`          ${prop(col)}: ${t}${notNull ? '' : ' | null'};`);
    insert.push(`          ${prop(col)}${required.has(col) && !hasDefault ? '' : '?'}: ${t}${notNull ? '' : ' | null'};`);
    update.push(`          ${prop(col)}?: ${t}${notNull ? '' : ' | null'};`);
    const fk = (p.description ?? '').match(FK);
    if (fk) {
      rels.push(`          {\n            foreignKeyName: ${JSON.stringify(`${table}_${col}_fkey`)};\n            columns: [${JSON.stringify(col)}];\n            isOneToOne: false;\n            referencedRelation: ${JSON.stringify(fk[1])};\n            referencedColumns: [${JSON.stringify(fk[2])}];\n          },`);
    }
  }
  return `      ${prop(table)}: {
        Row: {
${row.join('\n')}
        };
        Insert: {
${insert.join('\n')}
        };
        Update: {
${update.join('\n')}
        };
        Relationships: [
${rels.join('\n')}
        ];
      };`;
});

const out = `// Otomatik üretildi: npm run db:types -w @bekofy/core (kaynak: canlı Supabase şeması). Elle düzenleme.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tables.join('\n')}
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
`;
writeFileSync(new URL('../src/db/database.types.ts', import.meta.url), out);
console.log(`database.types.ts: ${tables.length} tablo yazıldı.`);
