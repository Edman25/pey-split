// Filas de las tablas de Supabase (ver supabase/migrations/0001_init.sql).
// Montos en centavos; fechas como string ISO (así las regresa la API de Supabase).

export type EstadoSesion = "abierta" | "liquidada";
export type EstadoAportacion = "reservada" | "pagada" | "expirada";

export interface Sesion {
  id: string;
  nombre: string;
  total_centavos: number;
  pagado_centavos: number;
  estado: EstadoSesion;
  created_at: string;
  liquidada_at: string | null;
}

export interface Aportacion {
  id: string;
  sesion_id: string;
  nombre: string;
  monto_centavos: number;
  estado: EstadoAportacion;
  expira_at: string;
  pey_link_id: string | null;
  pey_link_url: string | null;
  pey_transaction_id: string | null;
  monto_pagado_centavos: number | null;
  monto_no_coincide: boolean;
  pagada_at: string | null;
  created_at: string;
}
