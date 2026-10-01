import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const ACCOUNTS = [
  { id: "acc-1", name: "Conta Corrente", current_balance: 1000, color: "#8b5cf6", type: "checking" },
];

// The modal loads the user's accounts on open; the chain mirrors the query it builds.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          not: () => ({
            order: () => Promise.resolve({ data: ACCOUNTS, error: null }),
          }),
        }),
      }),
    }),
  },
}));

import GoalDepositModal from "./GoalDepositModal";

const setup = () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<GoalDepositModal open onClose={() => {}} onSubmit={onSubmit} goalName="Viagem" />);
  return onSubmit;
};

const typeAmount = () => {
  fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "200" } });
};

describe("GoalDepositModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("debits the chosen account for a deposit from one of the user's accounts", async () => {
    const onSubmit = setup();
    await screen.findByText("Conta Corrente");
    typeAmount();

    fireEvent.click(screen.getByRole("button", { name: /Confirmar Aporte/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ amount: 200, account_id: "acc-1" });
  });

  it("sends no account for external money, so the balance is left alone", async () => {
    const onSubmit = setup();
    await screen.findByText("Conta Corrente");

    fireEvent.click(screen.getByRole("button", { name: "Fora do app" }));
    typeAmount();
    fireEvent.click(screen.getByRole("button", { name: "Dinheiro vivo" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Aporte/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.account_id).toBeUndefined();
    expect(payload).toMatchObject({ amount: 200, source: "Dinheiro vivo" });
  });

  it("holds the deposit until an external source is named", async () => {
    setup();
    await screen.findByText("Conta Corrente");

    fireEvent.click(screen.getByRole("button", { name: "Fora do app" }));
    typeAmount();

    expect(screen.getByRole("button", { name: /Confirmar Aporte/i })).toBeDisabled();
  });

  it("lets external money exceed the account balance, which it never touches", async () => {
    const onSubmit = setup();
    await screen.findByText("Conta Corrente");

    // Over the account's 1000 balance: blocked from an account, fine from outside.
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "5000" } });
    expect(screen.getByRole("button", { name: /Confirmar Aporte/i })).toBeDisabled();
    expect(screen.getByText("Saldo insuficiente nesta conta")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Fora do app" }));
    fireEvent.click(screen.getByRole("button", { name: "Presente" }));
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Aporte/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ amount: 5000, source: "Presente" });
  });
});
