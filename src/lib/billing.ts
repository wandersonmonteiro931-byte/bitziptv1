export type BillingDueDate = {
  id: string;
  label?: string | null;
  day_of_month: number;
  grace_days: number;
  is_active?: boolean;
};

export type FirstCycleCalculation = {
  amount: number;
  days: number;
  dailyValue: number;
  dueDate: Date;
  isProportional: boolean;
};

export const clampBillingDay = (day: number) => Math.max(1, Math.min(31, Number(day) || 10));

export const toDateOnlyString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const parseDateOnly = (value?: string | null) => {
  if (!value) return new Date();

  const [y, m, d] = String(value).split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return new Date();

  return new Date(y, m - 1, d);
};

export const formatDateBR = (date: Date) =>
  `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;

export const daysInMonth = (year: number, monthIndex: number) => new Date(year, monthIndex + 1, 0).getDate();

export const makeBillingDate = (year: number, monthIndex: number, day: number) => {
  const safeDay = Math.min(clampBillingDay(day), daysInMonth(year, monthIndex));
  return new Date(year, monthIndex, safeDay);
};

export const getNextBillingDueDate = (from: Date, day: number) => {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let due = makeBillingDate(base.getFullYear(), base.getMonth(), day);

  if (due < base) {
    due = makeBillingDate(base.getFullYear(), base.getMonth() + 1, day);
  }

  return due;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const diffDays = (from: Date, to: Date) => {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

export const daysInclusive = (from: Date, to: Date) => Math.max(1, diffDays(from, to) + 1);

export const calculateFirstCycleCharge = (
  monthlyTotal: number,
  startDateInput: string | Date,
  dueDay: number,
): FirstCycleCalculation => {
  const startDate = startDateInput instanceof Date ? startDateInput : parseDateOnly(startDateInput);
  const dueDate = getNextBillingDueDate(startDate, dueDay);
  const days = Math.min(30, daysInclusive(startDate, dueDate));
  const dailyValue = Number(monthlyTotal || 0) / 30;
  const amount = days >= 30 ? Number(monthlyTotal || 0) : Math.max(0.01, Number((dailyValue * days).toFixed(2)));

  return {
    amount: Number(amount.toFixed(2)),
    days,
    dailyValue: Number(dailyValue.toFixed(2)),
    dueDate,
    isProportional: days < 30,
  };
};

export const pickBillingDueDate = (dueDates: BillingDueDate[], user: any): BillingDueDate | null => {
  const active = (dueDates || []).filter((item) => item?.is_active !== false);
  const byId = active.find((item) => item.id && item.id === user?.billing_due_date_id);
  if (byId) return byId;

  const byDay = active.find((item) => Number(item.day_of_month) === Number(user?.iptv_due_day));
  if (byDay) return byDay;

  return active[0] || null;
};

export const getBillingGraceDays = (dueDate: BillingDueDate | null, user: any, fallback = 5) => {
  const override = Number(user?.billing_grace_days_override);
  if (Number.isFinite(override) && override >= 0) return override;

  const fromDate = Number(dueDate?.grace_days);
  if (Number.isFinite(fromDate) && fromDate >= 0) return fromDate;

  return fallback;
};

export const getBillingCycleStartDate = (user: any) => {
  // Compatibilidade: próximas cobranças não usam a data do último pagamento.
  // Elas usam a validade/vencimento fixo do cliente.
  return user?.iptv_expiry || user?.billing_cycle_started_at || user?.created_at || toDateOnlyString(new Date());
};

export const getFirstCycleStartDate = (user: any) => {
  // Para o 1º pagamento proporcional, a base deve ser o cadastro do usuário.
  // Se não houver cadastro, usa billing_cycle_started_at; se não houver, hoje.
  return user?.billing_cycle_started_at || user?.created_at || toDateOnlyString(new Date());
};

export const addBillingMonthsByFixedDay = (from: Date, months: number, fixedDay: number) => {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const targetMonth = base.getMonth() + Math.max(1, Number(months) || 1);
  return makeBillingDate(base.getFullYear(), targetMonth, fixedDay);
};

export const getFixedBillingCycleStartDate = (user: any, dueDay: number) => {
  // Depois do 1º proporcional, a base da próxima cobrança é SEMPRE
  // o vencimento fixo configurado para o cliente, não a data que ele pagou.
  if (user?.iptv_expiry) return user.iptv_expiry;
  return toDateOnlyString(getNextBillingDueDate(new Date(), dueDay));
};
