import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-pagado">pey-split</p>
      <h1 className="text-3xl font-bold">Esta cuenta no existe</h1>
      <p className="text-suave">Revisa el enlace o pide que te muestren el QR de nuevo.</p>
      <Link href="/" className="rounded-xl bg-pagado px-5 py-3 font-semibold text-white dark:text-black">
        Crear una cuenta
      </Link>
    </main>
  );
}
