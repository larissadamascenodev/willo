/**
 * Types for the Financial Projection Engine
 */

export interface MonthProjection {
  month: number;
  year: number;
  balance: number;
  delta: number;
  income: number;
  expense: number;
  risk: "positivo" | "atencao" | "risco";
  /** True when the month has nothing launched yet and the figures are the 3-month average. */
  estimated?: boolean;
}

export interface DailyLimitResult {
  safeToSpend: number;
  daysLeft: number;
  spendRatio: number;
  tone: "positive" | "neutral" | "negative";
  message: string;
}

export interface SimulationResult {
  projections: MonthProjection[];
  impact3m: number;
  impact6m: number;
  saldoFinal: number;
  saldoFinalBase: number;
  hasSimulation: boolean;
}

export interface HealthFactor {
  label: string;
  value: number;
  max: number;
}

export interface HealthScoreResult {
  score: number;
  label: string;
  factors: HealthFactor[];
}

export interface SimulationParams {
  savingsBoost: number;
  incomeBoost: number;
}
