/** Lee una variable de entorno obligatoria; falla con un mensaje claro si falta. */
export function envObligatoria(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre} (ver .env.example)`);
  }
  return valor;
}

/** URL pública de la app, sin "/" final. */
export function appUrl(): string {
  return envObligatoria("APP_URL").replace(/\/+$/, "");
}
