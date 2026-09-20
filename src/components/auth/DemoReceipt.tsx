/**
 * A paper receipt lying on a dark table, "photographed" — used by the
 * welcome showcase and the onboarding scan demo in place of a real photo.
 */
const LINES: [string, string][] = [
  ["Arroz tipo 1 5kg", "28,90"],
  ["Café torrado 500g", "19,50"],
  ["Azeite extra virgem", "42,90"],
  ["Carne moída 1kg", "54,80"],
  ["Frutas e verduras", "36,40"],
  ["Laticínios", "61,20"],
  ["Limpeza", "68,70"],
];

const DemoReceipt = ({ className = "" }: { className?: string }) => (
  <div className={`absolute inset-0 overflow-hidden ${className}`}>
    {/* Table */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_45%_35%,#3b3631_0%,#221e1a_48%,#0d0c0b_100%)]" />
    <div
      className="absolute inset-0 opacity-[0.18]"
      style={{ backgroundImage: "repeating-linear-gradient(95deg, rgba(0,0,0,0.5) 0 2px, transparent 2px 22px)" }}
    />
    {/* A card and a coffee cup at the edges, like a real snapshot */}
    <div className="absolute -right-10 top-[8%] h-[120px] w-[190px] rotate-[18deg] rounded-[14px] bg-gradient-to-br from-[#2b2b2e] to-[#141416] shadow-[0_20px_40px_rgba(0,0,0,0.6)]">
      <span className="absolute left-5 top-6 h-6 w-8 rounded-[5px] bg-gradient-to-br from-[#d8c38a] to-[#a8894a]" />
      <span className="absolute bottom-5 left-5 text-[11px] tracking-[0.25em] text-white/50">•••• 4821</span>
    </div>
    <div className="absolute -left-14 bottom-[10%] h-[150px] w-[150px] rounded-full bg-[radial-gradient(circle,#1a120c_0%,#3b2a1f_55%,#e9e4da_58%,#cfc9be_70%,transparent_71%)] shadow-[0_24px_50px_rgba(0,0,0,0.7)]" />

    {/* Receipt */}
    <div
      className="absolute left-1/2 top-[13%] w-[64%] -translate-x-1/2 rotate-[-3.5deg] bg-[#F4F1EA] px-5 pb-7 pt-5 font-mono text-[#2b2b2b] shadow-[0_34px_60px_-10px_rgba(0,0,0,0.85)]"
      style={{ clipPath: "polygon(0 0,100% 0,100% 97%,95% 100%,90% 97%,85% 100%,80% 97%,75% 100%,70% 97%,65% 100%,60% 97%,55% 100%,50% 97%,45% 100%,40% 97%,35% 100%,30% 97%,25% 100%,20% 97%,15% 100%,10% 97%,5% 100%,0 97%)" }}
    >
      <p className="text-center text-[14px] font-bold tracking-wide">SUPERMERCADO EXTRA</p>
      <p className="text-center text-[9.5px] text-black/50">AV. PAULISTA, 1000 · SÃO PAULO</p>
      <p className="mt-0.5 text-center text-[9.5px] text-black/50">18/09/2026 18:42</p>
      <div className="my-3 border-t border-dashed border-black/30" />
      <div className="space-y-1.5 text-[10.5px]">
        {LINES.map(([n, v]) => (
          <div key={n} className="flex justify-between gap-2"><span className="truncate">{n}</span><span>{v}</span></div>
        ))}
      </div>
      <div className="my-3 border-t border-dashed border-black/30" />
      <div className="flex justify-between text-[14px] font-bold"><span>TOTAL</span><span>R$ 312,40</span></div>
      <p className="mt-1 text-[9.5px] text-black/50">CARTÃO DÉBITO · APROVADO</p>
    </div>
    {/* Warm light falloff */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
  </div>
);

export default DemoReceipt;

const STATEMENT: [string, string, string][] = [
  ["02/09", "IFOOD *RESTAURANTE", "45,90"],
  ["04/09", "UBER *TRIP", "27,90"],
  ["05/09", "NETFLIX.COM", "55,90"],
  ["09/09", "SUPERMERCADO EXTRA", "312,40"],
  ["12/09", "DROGASIL 0147", "89,50"],
  ["14/09", "POSTO SHELL", "180,00"],
];

/** A printed card statement on the table — the onboarding demo reads it line by line. */
export const DemoStatement = () => (
  <div className="absolute inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_45%_35%,#3b3631_0%,#221e1a_48%,#0d0c0b_100%)]" />
    <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "repeating-linear-gradient(95deg, rgba(0,0,0,0.5) 0 2px, transparent 2px 22px)" }} />
    <div className="absolute -right-6 bottom-[16%] h-[18px] w-[190px] rotate-[-24deg] rounded-full bg-gradient-to-r from-[#1b1b1b] via-[#3a3a3a] to-[#111] shadow-[0_12px_20px_rgba(0,0,0,0.6)]" />
    <div className="absolute left-1/2 top-[12%] w-[78%] -translate-x-1/2 rotate-[2.5deg] rounded-[3px] bg-[#F6F4EF] px-5 pb-6 pt-5 text-[#262626] shadow-[0_34px_60px_-10px_rgba(0,0,0,0.85)]">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-extrabold tracking-tight">Fatura do cartão</p>
        <span className="h-5 w-8 rounded-[4px] bg-gradient-to-br from-[#d8c38a] to-[#a8894a]" />
      </div>
      <p className="text-[10px] text-black/50">Vencimento 20/09/2026 · final 4821</p>
      <div className="mt-3 flex items-end justify-between border-b border-black/15 pb-2">
        <span className="text-[10px] uppercase tracking-wide text-black/50">Total</span>
        <span className="text-[18px] font-extrabold">R$ 711,60</span>
      </div>
      <div className="mt-2 space-y-2 font-mono text-[10px]">
        {STATEMENT.map(([d, n, v]) => (
          <div key={n} className="flex items-center gap-2">
            <span className="text-black/45">{d}</span>
            <span className="min-w-0 flex-1 truncate">{n}</span>
            <span className="font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
  </div>
);
