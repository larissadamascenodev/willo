import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadMonthTransactions, type MonthTransactions } from "@/services/monthTransactions";

const EMPTY: MonthTransactions = { transactions: [], accounts: [], creditCards: [], customCategories: [] };

/**
 * A lista de transações de um mês, a mesma do site (serviço compartilhado), que se
 * recarrega sozinha quando algo é lançado, editado ou apagado em qualquer tela.
 */
export function useMonthTransactions(month: number, year: number) {
  const { user } = useAuth();
  const [data, setData] = useState<MonthTransactions>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // um pedido mais antigo que chega depois de trocar de mês não pode sobrescrever o atual
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!user) return;
    const ticket = ++latest.current;
    try {
      const result = await loadMonthTransactions(month, year);
      if (ticket !== latest.current) return;
      setData(result);
      setError(false);
    } catch {
      if (ticket === latest.current) setError(true);
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, [user, month, year]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  useEffect(() => {
    const w = window as any;
    w.addEventListener("transaction-created", reload);
    w.addEventListener("finance-data-changed", reload);
    return () => {
      w.removeEventListener("transaction-created", reload);
      w.removeEventListener("finance-data-changed", reload);
    };
  }, [reload]);

  return { ...data, loading, error, reload };
}
