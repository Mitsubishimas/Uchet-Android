const STATUSES = ["created", "paid", "shipped"];
const DELIVERIES = ["post", "site", "cdek"];

const STATUS_LABELS = {
  created: "Создан",
  paid: "Оплачен",
  shipped: "Отгружен",
};

const DELIVERY_LABELS = {
  post: "Почта",
  site: "Сайт MasterMitsu.ru",
  cdek: "СДЭК",
};

const TZ = "Asia/Novosibirsk";

function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekPeriod(today) {
  const base = parseISO(today);
  const day = base.getUTCDay() || 7; // Mon=1 … Sun=7
  const from = new Date(base);
  from.setUTCDate(base.getUTCDate() - (day - 1));
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
  const label =
    from.getUTCMonth() === to.getUTCMonth()
      ? `${from.getUTCDate()}–${dayMonth.format(to)}`
      : `${dayMonth.format(from)} – ${dayMonth.format(to)}`;
  return { from: toISO(from), to: toISO(to), label };
}

function monthPeriod(today) {
  const base = parseISO(today);
  const from = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const to = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
  const label = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(from);
  return { from: toISO(from), to: toISO(to), label };
}

function inPeriod(order, period) {
  return order.created_at >= period.from && order.created_at <= period.to;
}

function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseISO(iso));
}

function formatMoney(cents) {
  return (
    new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100) + " ₽"
  );
}

function formatNumber(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value) + suffix;
}

function parseMoney(raw) {
  const cleaned = String(raw || "")
    .replace(/\s|\u00a0/g, "")
    .replace(",", ".");
  if (!cleaned) return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function parseNumberField(raw) {
  const cleaned = String(raw || "")
    .replace(/\s|\u00a0/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return "invalid";
  return Number(cleaned);
}

function moneyInput(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function itemsLabel(order) {
  const items = [order.item_firmware ? "Прошивка" : "", order.item_ecu ? "Блок управления" : ""];
  return items.filter(Boolean).join(" + ") || "—";
}

function analyticsFor(orders, period, key, title) {
  const rows = orders.filter((o) => inPeriod(o, period));
  const sum = rows.reduce((t, o) => t + o.amount_cents, 0);
  const earned = rows.filter((o) => o.status !== "created").reduce((t, o) => t + o.amount_cents, 0);
  const byStatus = STATUSES.map((status) => ({
    label: STATUS_LABELS[status],
    count: rows.filter((o) => o.status === status).length,
    sum_cents: rows.filter((o) => o.status === status).reduce((t, o) => t + o.amount_cents, 0),
  }));
  const byDelivery = DELIVERIES.map((delivery) => ({
    label: DELIVERY_LABELS[delivery],
    count: rows.filter((o) => o.delivery === delivery).length,
    sum_cents: rows.filter((o) => o.delivery === delivery).reduce((t, o) => t + o.amount_cents, 0),
  }));
  return {
    key,
    title,
    period,
    count: rows.length,
    sum_cents: sum,
    earned_cents: earned,
    average_cents: rows.length ? Math.round(sum / rows.length) : 0,
    byStatus,
    byDelivery,
  };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.UchetDomain = {
  STATUSES,
  DELIVERIES,
  STATUS_LABELS,
  DELIVERY_LABELS,
  todayISO,
  weekPeriod,
  monthPeriod,
  inPeriod,
  formatDate,
  formatMoney,
  formatNumber,
  parseMoney,
  parseNumberField,
  moneyInput,
  itemsLabel,
  analyticsFor,
  escapeHtml,
};
