/**
 * Supabase de demonstração, em memória, para ver as telas com dados sem usar o banco de verdade.
 *
 * Só entra no pacote quando o Metro roda com EXPO_PUBLIC_MOCK=1 (ver metro.config.js); o app
 * normal usa platform/supabase.ts. Implementa o pedaço da API que a lógica do site chama:
 * select/insert/update/delete com os filtros comuns, rpc e functions vazias.
 */

type Row = Record<string, any>;

const now = new Date();
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m0: number, d: number) => {
  const date = new Date(y, m0, d);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const monthsFromNow = (offset: number) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
const iso = (y: number, m0: number, d: number) => `${ymd(y, m0, d)}T12:00:00.000Z`;

const USER_ID = "demo-user";
const Y = now.getFullYear();
const M = now.getMonth();

let nextId = 1000;
const id = () => `demo-${nextId++}`;

const tx = (over: Row): Row => ({
  id: id(),
  user_id: USER_ID,
  time: null,
  status: "pago",
  payment_method: "conta",
  recurrence_type: "unica",
  account_id: "acc-main",
  credit_card_id: null,
  installments: null,
  installment_current: null,
  parent_transaction_id: null,
  to_account_id: null,
  observation: null,
  created_at: iso(Y, M - 2, 1),
  updated_at: iso(Y, M, 1),
  ...over,
});

function seed(): Record<string, Row[]> {
  const today = now.getDate();
  const past = (d: number) => Math.min(d, Math.max(today - 1, 1));

  const transactions: Row[] = [
    tx({ id: "t-salary", name: "Salário", category: "Salário", type: "receita", amount: 6450, date: ymd(Y, M - 3, 5), recurrence_type: "fixa" }),
    tx({ id: "t-rent", name: "Aluguel", category: "Moradia", type: "despesa", amount: 1450, date: ymd(Y, M - 3, 5), recurrence_type: "fixa" }),
    tx({ id: "t-net", name: "Internet", category: "Telefone e Internet", type: "despesa", amount: 119.9, date: ymd(Y, M - 3, 12), recurrence_type: "fixa" }),
    tx({ id: "t-gym", name: "Academia", category: "Saúde", type: "despesa", amount: 129, date: ymd(Y, M - 3, 8), recurrence_type: "fixa" }),
    tx({ id: "t-freela", name: "Freela de design", category: "Freelance", type: "receita", amount: 850, date: ymd(Y, M, past(3)) }),
    tx({ id: "t-market", name: "Mercado", category: "Supermercado", type: "despesa", amount: 386.4, date: ymd(Y, M, past(2)) }),
    tx({ id: "t-uber", name: "Uber", category: "Transporte", type: "despesa", amount: 28.9, date: ymd(Y, M, past(2)) }),
    tx({ id: "t-lunch", name: "Almoço", category: "Alimentação", type: "despesa", amount: 42.5, date: ymd(Y, M, past(1)) }),
    tx({ id: "t-pharm", name: "Farmácia", category: "Saúde", type: "despesa", amount: 67.8, date: ymd(Y, M, past(1)) }),
    tx({ id: "t-light", name: "Conta de luz", category: "Moradia", type: "despesa", amount: 180, date: ymd(Y, M, 22), status: "pendente" }),
    // cartão: compras à vista e parceladas
    tx({ id: "t-c1", name: "iFood", category: "Alimentação", type: "despesa", amount: 64.9, date: ymd(Y, M, past(2)), payment_method: "cartao", credit_card_id: "card-1", account_id: null }),
    tx({ id: "t-c2", name: "Netflix", category: "Assinaturas", type: "despesa", amount: 39.9, date: ymd(Y, M, past(1)), payment_method: "cartao", credit_card_id: "card-1", account_id: null, recurrence_type: "fixa" }),
    tx({ id: "t-c3", name: "Spotify", category: "Assinaturas", type: "despesa", amount: 21.9, date: ymd(Y, M, past(1)), payment_method: "cartao", credit_card_id: "card-1", account_id: null, recurrence_type: "fixa" }),
  ];

  // Notebook em 6x no cartão: 3 parcelas já cobradas e 3 por vir
  const notebookStart = M - 2;
  for (let i = 0; i < 6; i++) {
    transactions.push(
      tx({
        id: `t-nb-${i}`,
        name: "Notebook",
        category: "Tecnologia",
        type: "despesa",
        amount: 520,
        date: ymd(Y, notebookStart + i, 8),
        payment_method: "cartao",
        credit_card_id: "card-1",
        account_id: null,
        recurrence_type: "parcelado",
        installments: 6,
        installment_current: i + 1,
        parent_transaction_id: i === 0 ? null : "t-nb-0",
        status: "pendente",
      }),
    );
  }
  // Curso em 4x direto na conta
  for (let i = 0; i < 4; i++) {
    transactions.push(
      tx({
        id: `t-course-${i}`,
        name: "Curso de inglês",
        category: "Educação",
        type: "despesa",
        amount: 310,
        date: ymd(Y, M - 1 + i, 15),
        recurrence_type: "parcelado",
        installments: 4,
        installment_current: i + 1,
        parent_transaction_id: i === 0 ? null : "t-course-0",
        status: i <= 1 ? "pago" : "pendente",
      }),
    );
  }

  const invoices: Row[] = [];
  for (let off = -2; off <= 6; off++) {
    const d = monthsFromNow(off);
    const items = transactions.filter((t) => t.credit_card_id === "card-1" && t.date.startsWith(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`));
    const recurring = off > 0 ? 39.9 + 21.9 : 0; // as assinaturas do cartão voltam todo mês
    const total = items.reduce((s, t) => s + t.amount, 0) + recurring;
    invoices.push({
      id: `inv-${off}`,
      credit_card_id: "card-1",
      user_id: USER_ID,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      total_amount: Math.round(total * 100) / 100,
      is_paid: off < 0,
      paid_amount: off < 0 ? Math.round(total * 100) / 100 : 0,
      paid_at: off < 0 ? iso(d.getFullYear(), d.getMonth(), 10) : null,
      created_at: iso(Y, M - 3, 1),
      updated_at: iso(Y, M, 1),
    });
  }

  return {
    profiles: [
      {
        id: USER_ID,
        display_name: "Larissa",
        avatar_url: null,
        bio: null,
        has_completed_profile: true,
        has_account: true,
        has_transactions: true,
        has_card: true,
        has_fixed_expenses: true,
        initial_score: 72,
        initial_score_label: "Bom",
      },
    ],
    accounts: [
      { id: "acc-main", user_id: USER_ID, name: "Nubank", type: "checking", color: "#8B5CF6", initial_balance: 1200, current_balance: 3420.5, is_active: true, is_default: true, created_at: iso(Y, M - 4, 1), updated_at: iso(Y, M, 1) },
      { id: "acc-save", user_id: USER_ID, name: "Caixinha", type: "savings", color: "#34D399", initial_balance: 0, current_balance: 1800, is_active: true, is_default: false, created_at: iso(Y, M - 4, 1), updated_at: iso(Y, M, 1) },
    ],
    credit_cards: [
      { id: "card-1", user_id: USER_ID, name: "Nubank Roxinho", color: "#8B5CF6", limit: 8000, used_limit: 1200, due_day: 10, closing_day: 3, is_active: true, last_four_digits: "4821", created_at: iso(Y, M - 4, 1), updated_at: iso(Y, M, 1) },
    ],
    transactions,
    invoices,
    invoice_items: [],
    invoice_payments: [],
    recurring_exclusions: [],
    finance_events: [],
    goals: [
      { id: "goal-1", user_id: USER_ID, name: "Viagem para a Itália", target_amount: 8000, current_amount: 5320, monthly_contribution: 670, deadline: ymd(Y, M + 4, 1), cover_image: null, created_at: iso(Y, M - 5, 1), updated_at: iso(Y, M, 1) },
      { id: "goal-2", user_id: USER_ID, name: "Reserva de emergência", target_amount: 12000, current_amount: 4200, monthly_contribution: 500, deadline: null, cover_image: null, created_at: iso(Y, M - 5, 1), updated_at: iso(Y, M, 1) },
    ],
    goal_transactions: [],
    category_limits: [],
    notifications: [],
    notification_settings: [],
  };
}

const tables = seed();

/* ─────────────── consulta encadeável ─────────────── */

type Filter = (row: Row) => boolean;

class Query<T = any> implements PromiseLike<{ data: T; error: null; count?: number | null }> {
  private filters: Filter[] = [];
  private action: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private orderBy: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private wantSingle: "single" | "maybe" | null = null;
  private wantCount = false;
  private returning = false;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.action !== "select") this.returning = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
  insert(rows: Row | Row[]) { this.action = "insert"; this.payload = rows; return this; }
  update(values: Row) { this.action = "update"; this.payload = values; return this; }
  upsert(rows: Row | Row[]) { this.action = "upsert"; this.payload = rows; return this; }
  delete() { this.action = "delete"; return this; }

  eq(col: string, v: any) { this.filters.push((r) => r[col] === v); return this; }
  neq(col: string, v: any) { this.filters.push((r) => r[col] !== v); return this; }
  gt(col: string, v: any) { this.filters.push((r) => r[col] > v); return this; }
  gte(col: string, v: any) { this.filters.push((r) => r[col] >= v); return this; }
  lt(col: string, v: any) { this.filters.push((r) => r[col] < v); return this; }
  lte(col: string, v: any) { this.filters.push((r) => r[col] <= v); return this; }
  in(col: string, vs: any[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  is(col: string, v: any) { this.filters.push((r) => (v === null ? r[col] == null : r[col] === v)); return this; }
  not(col: string, op: string, v: any) {
    if (op === "is") this.filters.push((r) => (v === null ? r[col] != null : r[col] !== v));
    else if (op === "eq") this.filters.push((r) => r[col] !== v);
    return this;
  }
  ilike(col: string, pattern: string) {
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle));
    return this;
  }
  or() { return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderBy.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  range(from: number, to: number) { this.max = to - from + 1; return this; }
  single() { this.wantSingle = "single"; return this; }
  maybeSingle() { this.wantSingle = "maybe"; return this; }

  private run() {
    const rows = (tables[this.table] ??= []);
    const matches = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[] = [];

    if (this.action === "insert" || this.action === "upsert") {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => ({
        id: id(),
        user_id: USER_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...r,
      }));
      rows.push(...list);
      out = this.returning ? list : [];
    } else if (this.action === "update") {
      out = rows.filter(matches);
      out.forEach((r) => Object.assign(r, this.payload, { updated_at: new Date().toISOString() }));
      if (!this.returning) out = [];
    } else if (this.action === "delete") {
      const gone = rows.filter(matches);
      tables[this.table] = rows.filter((r) => !gone.includes(r));
      out = [];
    } else {
      out = rows.filter(matches);
    }

    for (const { col, asc } of [...this.orderBy].reverse()) {
      out = [...out].sort((a, b) => (a[col] === b[col] ? 0 : (a[col] > b[col] ? 1 : -1) * (asc ? 1 : -1)));
    }
    const count = this.wantCount ? out.length : null;
    if (this.max !== null) out = out.slice(0, this.max);

    if (this.wantSingle) {
      if (out.length === 0 && this.wantSingle === "single") return { data: null as any, error: { message: "Linha não encontrada", code: "PGRST116" } as any, count };
      return { data: (out[0] ?? null) as any, error: null, count };
    }
    return { data: out as any, error: null, count };
  }

  then<R1 = any, R2 = never>(onfulfilled?: ((v: any) => R1 | PromiseLike<R1>) | null, onrejected?: ((e: any) => R2 | PromiseLike<R2>) | null) {
    return Promise.resolve().then(() => this.run()).then(onfulfilled, onrejected);
  }
}

/* ─────────────── sessão fictícia ─────────────── */

const user = {
  id: USER_ID,
  email: "demo@willo.app",
  user_metadata: { display_name: "Larissa" },
  app_metadata: {},
  aud: "authenticated",
  created_at: iso(Y, M - 4, 1),
};
const session = { access_token: "demo", refresh_token: "demo", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user };

let signedIn = true;
const authListeners = new Set<(event: string, s: any) => void>();

export const supabase: any = {
  auth: {
    getSession: async () => ({ data: { session: signedIn ? session : null }, error: null }),
    refreshSession: async () => ({ data: { session: signedIn ? session : null, user: signedIn ? user : null }, error: null }),
    getUser: async () => ({ data: { user: signedIn ? user : null }, error: null }),
    onAuthStateChange: (cb: (event: string, s: any) => void) => {
      authListeners.add(cb);
      setTimeout(() => cb("INITIAL_SESSION", signedIn ? session : null), 0);
      return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
    },
    signInWithPassword: async () => {
      signedIn = true;
      authListeners.forEach((cb) => cb("SIGNED_IN", session));
      return { data: { session, user }, error: null };
    },
    signOut: async () => {
      signedIn = false;
      authListeners.forEach((cb) => cb("SIGNED_OUT", null));
      return { error: null };
    },
    updateUser: async () => ({ data: { user }, error: null }),
    startAutoRefresh: () => {},
    stopAutoRefresh: () => {},
  },
  from: (table: string) => new Query(table),
  // tempo real: nada chega, mas a lógica pode assinar e cancelar
  channel: () => {
    const channel: any = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };
    return channel;
  },
  removeChannel: () => {},
  rpc: async () => ({ data: null, error: null }),
  functions: { invoke: async () => ({ data: null, error: { message: "Modo demonstração: função indisponível" } }) },
  storage: {
    from: () => ({
      upload: async () => ({ data: { path: "demo" }, error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "" } }),
      remove: async () => ({ data: null, error: null }),
    }),
  },
};
