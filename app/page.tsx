import { FormNuevaCuenta } from "@/components/form-nueva-cuenta";

export default function Inicio() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-widest text-pagado">pey-split</p>
        <h1 className="text-3xl font-bold leading-tight">Divide la cuenta con un solo QR</h1>
        <p className="text-suave">
          Crea la cuenta, muestra el QR en la mesa y cada quien paga su parte con CoDi desde su celular.
        </p>
      </header>
      <section className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
        <FormNuevaCuenta />
      </section>
    </main>
  );
}
