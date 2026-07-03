import { Lock, Minus, Plus } from "lucide-react";

/* ─── Hero phone frame (hero only) ─── */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[280px] rounded-[2.5rem] border-[6px] border-[#e5e9ef] bg-[#f7f9fb] p-2 shadow-[0_22px_60px_-30px_rgba(31,35,40,0.35)]">
      <div className="absolute left-1/2 top-0 z-10 h-6 w-[120px] -translate-x-1/2 rounded-b-2xl bg-[#f7f9fb]" />
      <div className="pointer-events-none overflow-hidden rounded-[2rem] bg-[#fbfcfd]">
        {children}
      </div>
    </div>
  );
}

/* ─── Browser window (feature sections — straight, no transforms) ─── */

function BrowserWindow({
  children,
  url,
  width = "default",
}: {
  children: React.ReactNode;
  url?: string;
  width?: "default" | "wide";
}) {
  const widthClass = width === "wide" ? "max-w-2xl" : "max-w-lg";

  return (
    <div className={`mx-auto w-full ${widthClass}`}>
      <div className="overflow-hidden rounded-xl border border-[#dfe5ed] bg-white shadow-[0_18px_52px_-28px_rgba(31,35,40,0.22)]">
        <div className="flex items-center gap-3 border-b border-[#e7ebf0] bg-[#fbfcfd] px-4 py-3">
          <div className="flex shrink-0 gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400/80" />
            <div className="size-2.5 rounded-full bg-amber-400/80" />
            <div className="size-2.5 rounded-full bg-emerald-400/80" />
          </div>
          {url ? (
            <div className="min-w-0 flex-1 rounded-md bg-white px-3 py-1 text-center text-[11px] text-[#6b7280] ring-1 ring-[#e7ebf0]">
              {url}
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
        <div className="pointer-events-none overflow-hidden bg-[#fbfcfd]">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Shared UI atoms ─── */

function ProductGradient({
  gradient,
  name,
  className = "",
}: {
  gradient: string;
  name: string;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${gradient} ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      <span className="absolute bottom-1.5 left-1.5 text-lg font-bold text-white/15">
        {name.charAt(0)}
      </span>
    </div>
  );
}

const menuProducts = [
  {
    name: "Aperol Spritz",
    price: "€9.50",
    gradient: "from-amber-400 via-orange-500 to-orange-700",
  },
  {
    name: "Negroni",
    price: "€12.00",
    gradient: "from-rose-700 via-red-800 to-red-950",
  },
  {
    name: "Espresso Martini",
    price: "€13.00",
    gradient: "from-amber-900 via-stone-800 to-stone-950",
  },
  {
    name: "Hugo Spritz",
    price: "€10.00",
    gradient: "from-emerald-400 via-teal-500 to-emerald-700",
  },
];

const categories = ["Cocktails", "Wine", "Beer", "Food"];

/* ─── Inner UI screens ─── */

function MenuScreen() {
  return (
    <div className="flex aspect-[16/10] flex-col bg-[#fbfcfd] p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[#1f2328]">Skyline Lounge</p>
          <p className="text-[11px] text-[#6b7280]">Rooftop · Hamburg</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Table 8
        </span>
      </div>

      <div className="mt-2.5 flex gap-1.5 overflow-hidden">
        {categories.map((c, i) => (
          <span
            key={c}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
              i === 0
                ? "bg-[#1f2328] text-white"
                : "bg-white text-[#6b7280] ring-1 ring-[#e7ebf0]"
            }`}
          >
            {c}
          </span>
        ))}
      </div>

      <p className="mt-2.5 text-[10px] font-semibold text-[#6b7280]">
        Cocktails
      </p>

      <div className="mt-2 grid flex-1 grid-cols-2 grid-rows-2 gap-2">
        {menuProducts.map((item) => (
          <div
            key={item.name}
            className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#e3e7ee] bg-white"
          >
            <ProductGradient
              gradient={item.gradient}
              name={item.name}
              className="min-h-0 flex-1"
            />
            <div className="flex shrink-0 items-center justify-between px-2 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold text-[#1f2328]">
                  {item.name}
                </p>
                <span className="text-[10px] font-bold text-[#1f2328]">
                  {item.price}
                </span>
              </div>
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1f2328] text-[10px] font-bold text-white">
                +
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex h-9 shrink-0 items-center justify-between rounded-lg bg-[#1f2328] px-3">
        <span className="text-[11px] font-semibold text-white">
          3 items · €31.50
        </span>
        <span className="text-xs font-bold text-white">→</span>
      </div>
    </div>
  );
}

function ModifiersScreen() {
  return (
    <div className="grid aspect-[16/10] grid-cols-2 bg-[#fbfcfd]">
      <ProductGradient
        gradient="from-amber-900 via-stone-800 to-stone-950"
        name="Espresso Martini"
        className="h-full"
      />
      <div className="flex flex-col p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#1f2328]">Espresso Martini</h3>
          <span className="text-sm font-bold text-[#1f2328]">€13</span>
        </div>

        <p className="mb-1.5 mt-2.5 text-[9px] font-semibold text-[#6b7280]">
          Size
        </p>
        {[
          { label: "Regular", selected: true },
          { label: "Large +€2", selected: false },
        ].map((opt) => (
          <div
            key={opt.label}
            className={`mb-1 flex items-center gap-2 rounded-md border px-2 py-1.5 text-[10px] ${
              opt.selected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-[#e3e7ee] bg-white text-[#596273]"
            }`}
          >
            <span
              className={`size-2.5 shrink-0 rounded-full ${
                opt.selected ? "bg-emerald-500" : "border border-[#cfd6df]"
              }`}
            />
            {opt.label}
          </div>
        ))}

        <p className="mb-1.5 mt-2 text-[9px] font-semibold text-[#6b7280]">
          Extras
        </p>
        {[
          { label: "Extra Shot +€1.50" },
          { label: "Vanilla +€0.50" },
        ].map((extra) => (
          <div
            key={extra.label}
            className="mb-1 flex items-center gap-2 rounded-md border border-[#e3e7ee] bg-white px-2 py-1.5 text-[10px] text-[#596273]"
          >
            <span className="size-2.5 shrink-0 rounded border border-[#cfd6df]" />
            {extra.label}
          </div>
        ))}

        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md border border-[#dfe5ed] bg-white text-[#6b7280]">
              <Minus className="size-3" />
            </span>
            <span className="text-xs font-bold text-[#1f2328]">2</span>
            <span className="flex size-6 items-center justify-center rounded-md border border-[#dfe5ed] bg-white text-[#6b7280]">
              <Plus className="size-3" />
            </span>
          </div>
          <div className="rounded-lg bg-[#1f2328] px-3 py-1.5 text-[10px] font-bold text-white">
            Add · €28.00
          </div>
        </div>
      </div>
    </div>
  );
}

function ApplePayLogo() {
  return (
    <svg viewBox="0 0 50 20" className="h-4 w-auto fill-white" aria-hidden>
      <path d="M9.6 2.1c-.6.7-1.5 1.3-2.5 1.2-.1-1 .4-2 .9-2.7.6-.8 1.6-1.3 2.4-1.4.1 1.1-.3 2.1-.8 2.9zm.8 1.5c-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.6.7 2.8.7 1.1 0 1.9-1.1 2.6-2.2.8-1.2 1.2-2.4 1.2-2.5-.1 0-2.4-.9-2.4-3.7 0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8zM18.5 1.5v16.9h2.7V9.8h3.8c3.5 0 6-2.4 6-5.7 0-3.3-2.4-5.6-5.9-5.6h-6.6zm2.7 2.2h3.2c2.4 0 3.8 1.3 3.8 3.5s-1.4 3.5-3.8 3.5h-3.2V3.7zm14.8 14.7c1.5 0 2.9-.8 3.5-2h.1v1.8h2.5V8.9c0-2.7-2.1-4.4-5.4-4.4-3 0-5.2 1.7-5.3 4.1h2.4c.2-1.2 1.3-2 2.9-2 1.9 0 2.9 1 2.9 2.5v1.1l-3.8.2c-3.6.2-5.5 1.7-5.5 4.2 0 2.5 1.9 4.1 4.7 4.1zm.7-2c-1.6 0-2.6-.8-2.6-2 0-1.2 1-2 3-2.1l3.4-.2v1.1c0 1.8-1.5 3.2-3.8 3.2z" />
    </svg>
  );
}

function CheckoutScreen() {
  return (
    <div className="bg-[#fbfcfd] p-4">
      <p className="text-sm font-semibold text-[#1f2328]">Checkout</p>
      <p className="text-[11px] text-[#6b7280]">Table 8 · Skyline Lounge</p>

      <div className="mt-3 rounded-lg border border-[#e3e7ee] bg-white p-3">
        <div className="flex justify-between text-[11px] text-[#596273]">
          <span>2× Espresso Martini</span>
          <span className="tabular-nums">€28.00</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-[#edf1f5] pt-1.5 text-[11px] font-bold text-[#1f2328]">
          <span>Total</span>
          <span className="tabular-nums">€44.63</span>
        </div>
      </div>

      <button
        type="button"
        className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-black text-white"
      >
        <ApplePayLogo />
        <span className="text-[11px] font-medium">Pay</span>
      </button>

      <div className="my-2.5 flex items-center gap-2">
        <div className="h-px flex-1 bg-[#e7ebf0]" />
        <span className="text-[9px] text-[#8b95a4]">or pay with card</span>
        <div className="h-px flex-1 bg-[#e7ebf0]" />
      </div>

      <div className="space-y-2">
        <div className="flex h-8 items-center rounded-md border border-[#e3e7ee] bg-white px-2.5">
          <span className="text-[10px] tracking-widest text-[#6b7280]">
            4242 ···· ···· 4242
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex h-8 items-center rounded-md border border-[#e3e7ee] bg-white px-2.5">
            <span className="text-[10px] text-[#6b7280]">12 / 28</span>
          </div>
          <div className="flex h-8 items-center rounded-md border border-[#e3e7ee] bg-white px-2.5">
            <span className="text-[10px] text-[#6b7280]">CVC</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex h-9 items-center justify-center rounded-lg bg-[#1f2328] text-[11px] font-bold text-white">
        Pay €44.63
      </div>

      <p className="mt-2 flex items-center justify-center gap-1 text-[9px] text-[#8b95a4]">
        <Lock className="size-2.5" />
        Secure payment via Stripe
      </p>
    </div>
  );
}

const kitchenOrders = [
  {
    table: "Table 8",
    id: "#052",
    items: "2× Aperol Spritz / 1× Cola",
    timer: "3m",
    timerColor: "text-[#1f2328]",
    border: "border-l-sky-500",
    status: "In prep",
    statusColor: "text-sky-700 bg-sky-50 ring-1 ring-sky-200",
  },
  {
    table: "VIP 2",
    id: "#045",
    items: "3× Beer / 1× Nachos",
    timer: "12m",
    timerColor: "text-orange-700",
    border: "border-l-emerald-500",
    status: "Ready pickup",
    statusColor: "text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200",
  },
  {
    table: "Bar 1",
    id: "#044",
    items: "1× Negroni",
    timer: "1m",
    timerColor: "text-[#1f2328]",
    border: "border-l-blue-500",
    status: "Queued",
    statusColor: "text-[#596273] bg-[#eef1f5] ring-1 ring-[#dfe5ed]",
  },
];

function KitchenScreen() {
  return (
    <div className="bg-[#fbfcfd] p-4">
      <div className="mb-3 flex items-center justify-between border-b border-[#e7ebf0] pb-3">
        <p className="text-xs font-bold text-[#1f2328]">
          Kitchen station
        </p>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {kitchenOrders.map((order) => (
          <div
            key={order.id}
            className={`rounded-lg border border-[#e3e7ee] border-l-[3px] ${order.border} bg-white p-3`}
          >
            <div className="flex items-start justify-between gap-1">
              <div>
                <p className="text-xs font-black leading-tight text-[#1f2328]">
                  {order.table}
                </p>
                <p className="text-[9px] font-medium text-[#8b95a4]">
                  {order.id}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold tabular-nums ${order.timerColor}`}
              >
                {order.timer}
              </span>
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-[#596273]">
              {order.items}
            </p>
            <p
              className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${order.statusColor}`}
            >
              {order.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Feature mockup exports ─── */

export function MenuMockup() {
  return (
    <BrowserWindow>
      <MenuScreen />
    </BrowserWindow>
  );
}

export function ModifiersMockup() {
  return (
    <BrowserWindow>
      <ModifiersScreen />
    </BrowserWindow>
  );
}

export function CheckoutMockup() {
  return (
    <BrowserWindow>
      <CheckoutScreen />
    </BrowserWindow>
  );
}

export function KitchenMockup() {
  return (
    <BrowserWindow url="dashboard.qrorder.app/kitchen" width="wide">
      <KitchenScreen />
    </BrowserWindow>
  );
}

/* ─── Hero phone (straight, no rotation) ─── */

export function HeroPhoneMockup() {
  return (
    <div className="relative py-2">
      <div className="absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1f2328]/10 blur-[200px]" />
      </div>
      <PhoneFrame>
        <div className="relative flex min-h-[520px] flex-col bg-[#fbfcfd]">
          <div className="px-3.5 pb-2 pt-9">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[12px] font-semibold leading-tight text-[#1f2328]">
                  Skyline Lounge
                </p>
                <p className="text-[9px] text-[#6b7280]">Rooftop · Hamburg</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Table 8
              </span>
            </div>
            <div className="mt-2.5 flex gap-1 overflow-hidden">
              {categories.map((c, i) => (
                <span
                  key={c}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-medium ${
                    i === 0
                      ? "bg-[#1f2328] text-white"
                      : "bg-white text-[#6b7280] ring-1 ring-[#e7ebf0]"
                  }`}
                >
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[9px] font-semibold text-[#6b7280]">
              Cocktails
            </p>
          </div>
          <div className="flex-1 px-3.5 pb-14">
            <div className="grid grid-cols-2 gap-1.5">
              {menuProducts.map((item) => (
                <div
                  key={item.name}
                  className="overflow-hidden rounded-lg border border-[#e3e7ee] bg-white"
                >
                  <div
                    className={`flex h-12 items-center justify-center bg-gradient-to-br ${item.gradient}`}
                  >
                    <span className="text-lg font-bold text-white/25">
                      {item.name.charAt(0)}
                    </span>
                  </div>
                  <div className="p-1.5">
                    <p className="truncate text-[8px] font-medium text-[#1f2328]">
                      {item.name}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[8px] font-semibold text-[#1f2328]">
                        {item.price}
                      </span>
                      <span className="flex size-4 items-center justify-center rounded-full bg-[#1f2328] text-[9px] font-bold text-white">
                        +
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex h-11 items-center justify-between border-t border-[#e7ebf0] bg-white px-3.5">
            <span className="text-[10px] font-semibold text-[#1f2328]">
              3 items · €31.50
            </span>
            <span className="rounded-lg bg-[#1f2328] px-3 py-1.5 text-[10px] font-bold text-white">
              Cart →
            </span>
          </div>
        </div>
      </PhoneFrame>
    </div>
  );
}
