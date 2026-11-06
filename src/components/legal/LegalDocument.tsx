import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OPERATOR, type LegalBlock, type LegalDoc } from "@/lib/legal";

/**
 * The Terms or the Privacy Policy, as a page of the site. The text is the same one
 * the app shows (lib/legal), so the "always current" link in the app lands here on
 * exactly what was read there.
 */
export default function LegalDocument({ doc }: { doc: LegalDoc }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-16 pt-6 md:pt-10">
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        className="mb-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] transition-colors hover:bg-white/[0.1]"
        aria-label="Voltar"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{doc.kicker}</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">{doc.title}</h1>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Versão {doc.version} · atualizada em {doc.updated}
      </p>
      <p className="mt-6 text-[16px] font-semibold leading-relaxed">{doc.intro}</p>

      {doc.sections.map((s) => (
        <section key={s.title} className="mt-9">
          <h2 className="text-lg font-extrabold tracking-tight">{s.title}</h2>
          {s.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </section>
      ))}

      <p className="mt-12 text-[13px] leading-relaxed text-muted-foreground/70">
        Contato: {OPERATOR.email} · {OPERATOR.name}, {OPERATOR.city}
      </p>
    </div>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if ("p" in block) return <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{block.p}</p>;
  if ("list" in block)
    return (
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-muted-foreground">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl bg-white/[0.04]">
      <table className="w-full text-left text-[14px]">
        <thead className="bg-white/[0.06]">
          <tr>
            {block.table.head.map((h) => (
              <th key={h} className="px-4 py-3 text-[12px] font-bold uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, r) => (
            <tr key={r} className="border-t border-white/[0.05]">
              {row.map((cell, k) => (
                <td key={k} className={k === 0 ? "px-4 py-3" : "px-4 py-3 text-muted-foreground"}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
