import type { MenuLocale } from "@/lib/i18n/translations";

export type WaiterUiKey =
  | "nav.home"
  | "nav.orders"
  | "nav.new"
  | "nav.calls"
  | "nav.tables"
  | "nav.fiscal"
  | "nav.more"
  | "status.free"
  | "status.active"
  | "status.ready"
  | "status.call"
  | "status.pendingApproval"
  | "status.paymentRequested"
  | "table.noZone"
  | "table.ordersCount"
  | "empty.noTables"
  | "empty.tableFree"
  | "empty.noActiveOrders"
  | "pull.hint"
  | "pull.release"
  | "pull.refreshing"
  | "toast.newOrder"
  | "toast.newOrders"
  | "toast.waiterCall"
  | "toast.waiterCalls"
  | "order.delivered"
  | "order.ready"
  | "order.status.new"
  | "order.status.accepted"
  | "order.status.preparing"
  | "order.status.ready"
  | "order.status.delivered"
  | "order.status.pendingApproval"
  | "order.updateFailed"
  | "summary.orders"
  | "summary.calls"
  | "summary.payments"
  | "action.newOrder"
  | "action.bill"
  | "action.allTables"
  | "action.deliver"
  | "action.markReady"
  | "action.pickedUp"
  | "action.served"
  | "session.activeOrders"
  | "table.backToTables"
  | "table.notFound"
  | "table.guestCalledWaiter"
  | "table.guestRequestedBill"
  | "table.busTitle"
  | "table.busCta"
  | "table.busWaitSuffix"
  | "table.missionTitle"
  | "table.missionCta"
  | "session.since"
  | "calls.pending"
  | "calls.empty"
  | "calls.emptyHint"
  | "calls.dismiss"
  | "calls.onMyWay"
  | "calls.handled"
  | "calls.handledBy"
  | "calls.reasonLabel";

type Table = Record<WaiterUiKey, string>;

const en: Table = {
  "nav.home": "Home",
  "nav.orders": "Orders",
  "nav.new": "New",
  "nav.calls": "Calls",
  "nav.tables": "Tables",
  "nav.fiscal": "Fiscal",
  "nav.more": "More",
  "status.free": "Free",
  "status.active": "Active",
  "status.ready": "Ready",
  "status.call": "Call",
  "status.pendingApproval": "Approval",
  "status.paymentRequested": "Payment requested",
  "table.noZone": "No zone",
  "table.ordersCount": "· {count} orders",
  "empty.noTables": "No tables configured.",
  "empty.tableFree": "Table is free",
  "empty.noActiveOrders": "No active orders",
  "pull.hint": "Pull to refresh",
  "pull.release": "Release to refresh",
  "pull.refreshing": "Refreshing…",
  "toast.newOrder": "New order — check Orders",
  "toast.newOrders": "{delta} new orders · {total} waiting",
  "toast.waiterCall": "Waiter call from a table",
  "toast.waiterCalls": "{delta} new calls · {total} open",
  "order.delivered": "Order delivered.",
  "order.ready": "Order marked ready.",
  "order.status.new": "New",
  "order.status.accepted": "Accepted",
  "order.status.preparing": "Preparing",
  "order.status.ready": "Ready",
  "order.status.delivered": "Delivered",
  "order.status.pendingApproval": "Approval",
  "order.updateFailed": "Could not update status.",
  "summary.orders": "Orders",
  "summary.calls": "Calls",
  "summary.payments": "Payments",
  "action.newOrder": "New order",
  "action.bill": "Bill",
  "action.allTables": "All tables",
  "action.deliver": "Delivered",
  "action.markReady": "Ready",
  "action.pickedUp": "Picked up",
  "action.served": "Served",
  "session.activeOrders": "Active orders",
  "table.backToTables": "All tables",
  "table.notFound": "Table not found.",
  "table.guestCalledWaiter": "Guest called for waiter.",
  "table.guestRequestedBill": "Guest requested the bill.",
  "table.busTitle": "Bus table {table} — guests paid",
  "table.busCta": "Table cleared",
  "table.busWaitSuffix": "min since payment",
  "table.missionTitle": "Denis needs help at {table}",
  "table.missionCta": "Mark handled",
  "session.since": "Session since {time}",
  "calls.pending": "{count} pending",
  "calls.empty": "No waiter calls",
  "calls.emptyHint": "Calls appear here when guests request a waiter",
  "calls.dismiss": "Dismiss",
  "calls.onMyWay": "On my way ({name})",
  "calls.handled": "Handled",
  "calls.handledBy": "Handled by {name} · {time}",
  "calls.reasonLabel": "Guest said: {reason}",
};

const de: Table = {
  ...en,
  "nav.home": "Start",
  "nav.orders": "Bestellungen",
  "nav.new": "Neu",
  "nav.calls": "Rufe",
  "nav.tables": "Tische",
  "nav.fiscal": "Kasse",
  "nav.more": "Mehr",
  "status.free": "Frei",
  "status.active": "Aktiv",
  "status.ready": "Fertig",
  "status.call": "Ruf",
  "status.pendingApproval": "Freigabe",
  "status.paymentRequested": "Zahlung angefordert",
  "table.noZone": "Keine Zone",
  "table.ordersCount": "· {count} Best.",
  "empty.noTables": "Keine Tische konfiguriert.",
  "empty.tableFree": "Tisch ist frei",
  "empty.noActiveOrders": "Keine aktiven Bestellungen",
  "pull.hint": "Ziehen zum Aktualisieren",
  "pull.release": "Loslassen zum Aktualisieren",
  "pull.refreshing": "Aktualisiere…",
  "toast.newOrder": "Neue Bestellung — Bestellungen prüfen",
  "toast.newOrders": "{delta} neue Bestellungen · {total} offen",
  "toast.waiterCall": "Kellnerruf vom Tisch",
  "toast.waiterCalls": "{delta} neue Rufe · {total} offen",
  "order.delivered": "Bestellung geliefert.",
  "order.ready": "Bestellung ist fertig.",
  "order.status.new": "Neu",
  "order.status.accepted": "Angenommen",
  "order.status.preparing": "Zubereitung",
  "order.status.ready": "Fertig",
  "order.status.delivered": "Geliefert",
  "order.status.pendingApproval": "Freigabe",
  "order.updateFailed": "Status konnte nicht aktualisiert werden.",
  "summary.orders": "Bestellungen",
  "summary.calls": "Rufe",
  "summary.payments": "Zahlungen",
  "action.newOrder": "Neue Bestellung",
  "action.bill": "Rechnung",
  "action.allTables": "Alle Tische",
  "action.deliver": "Geliefert",
  "action.markReady": "Fertig",
  "action.pickedUp": "Abgeholt",
  "action.served": "Serviert",
  "session.activeOrders": "Aktive Bestellungen",
  "table.backToTables": "Alle Tische",
  "table.notFound": "Tisch nicht gefunden.",
  "table.guestCalledWaiter": "Gast hat Kellner gerufen.",
  "table.guestRequestedBill": "Gast hat Rechnung angefordert.",
  "table.busTitle": "Tisch {table} abräumen — bezahlt",
  "table.busCta": "Abgeräumt",
  "table.busWaitSuffix": "Min seit Zahlung",
  "table.missionTitle": "Denis braucht Hilfe an Tisch {table}",
  "table.missionCta": "Als erledigt markieren",
  "session.since": "Sitzung seit {time}",
  "calls.pending": "{count} offen",
  "calls.empty": "Keine Kellnerrufe",
  "calls.emptyHint": "Rufe erscheinen hier, wenn Gäste den Kellner rufen",
  "calls.dismiss": "Schließen",
  "calls.onMyWay": "Unterwegs ({name})",
  "calls.handled": "Erledigt",
  "calls.handledBy": "Erledigt von {name} · {time}",
  "calls.reasonLabel": "Gast sagt: {reason}",
};

const sr: Table = {
  ...en,
  "nav.home": "Početna",
  "nav.orders": "Narudžbe",
  "nav.new": "Nova",
  "nav.calls": "Pozivi",
  "nav.tables": "Stolovi",
  "status.free": "Slobodan",
  "status.active": "Aktivan",
  "status.ready": "Spremno",
  "status.call": "Poziv",
  "status.pendingApproval": "Odobrenje",
  "status.paymentRequested": "Plaćanje zatraženo",
  "table.noZone": "Bez zone",
  "table.ordersCount": "· {count} nar.",
  "empty.noTables": "Nema konfigurisanih stolova.",
  "empty.tableFree": "Sto je slobodan",
  "empty.noActiveOrders": "Nema aktivnih narudžbi",
  "pull.hint": "Povuci za osvježavanje",
  "pull.release": "Pusti za osvježavanje",
  "pull.refreshing": "Osvježavam…",
  "toast.newOrder": "Nova narudžba — pogledaj Narudžbe",
  "toast.newOrders": "{delta} novih narudžbi · {total} čeka",
  "toast.waiterCall": "Poziv konobara sa stola",
  "toast.waiterCalls": "{delta} novih poziva · {total} otvorenih",
  "order.delivered": "Narudžba dostavljena.",
  "order.ready": "Narudžba spremna.",
  "order.status.new": "Nova",
  "order.status.accepted": "Prihvaćeno",
  "order.status.preparing": "Priprema",
  "order.status.ready": "Spremno",
  "order.status.delivered": "Dostavljeno",
  "order.status.pendingApproval": "Odobrenje",
  "order.updateFailed": "Status nije ažuriran.",
  "summary.orders": "Narudžbe",
  "summary.calls": "Pozivi",
  "summary.payments": "Plaćanja",
  "action.newOrder": "Nova narudžba",
  "action.bill": "Račun",
  "action.allTables": "Svi stolovi",
  "action.deliver": "Dostavljeno",
  "action.markReady": "Spremno",
  "action.pickedUp": "Preuzeto",
  "action.served": "Isporučeno",
  "session.activeOrders": "Aktivne narudžbe",
  "table.backToTables": "Svi stolovi",
  "table.notFound": "Sto nije pronađen.",
  "table.guestCalledWaiter": "Gost je pozvao konobara.",
  "table.guestRequestedBill": "Gost je zatražio račun.",
  "table.busTitle": "Raspremi sto {table} — gosti platili",
  "table.busCta": "Raspremljeno",
  "table.busWaitSuffix": "min od plaćanja",
  "table.missionTitle": "Denisu treba pomoć za sto {table}",
  "table.missionCta": "Označi kao rešeno",
  "session.since": "Sesija od {time}",
  "calls.pending": "{count} otvorenih",
  "calls.empty": "Nema poziva konobara",
  "calls.emptyHint": "Pozivi se pojavljuju kada gosti pozovu konobara",
  "calls.dismiss": "Odbaci",
  "calls.onMyWay": "Na putu ({name})",
  "calls.handled": "Obrađeno",
  "calls.handledBy": "Obrađio {name} · {time}",
  "calls.reasonLabel": "Gost kaže: {reason}",
};

const hr: Table = { ...sr };
const tr: Table = {
  ...en,
  "nav.home": "Ana",
  "nav.orders": "Siparişler",
  "nav.new": "Yeni",
  "nav.calls": "Çağrılar",
  "nav.tables": "Masalar",
  "status.free": "Boş",
  "status.active": "Aktif",
  "status.ready": "Hazır",
  "status.call": "Çağrı",
  "action.newOrder": "Yeni sipariş",
  "action.bill": "Hesap",
};

const ar: Table = {
  ...en,
  "nav.home": "الرئيسية",
  "nav.orders": "الطلبات",
  "nav.calls": "النداءات",
  "nav.tables": "الطاولات",
  "status.free": "فارغ",
  "action.newOrder": "طلب جديد",
  "action.bill": "الفاتورة",
};

const es: Table = {
  ...en,
  "nav.home": "Inicio",
  "nav.orders": "Pedidos",
  "nav.new": "Nuevo",
  "nav.calls": "Llamadas",
  "nav.tables": "Mesas",
  "status.free": "Libre",
  "action.newOrder": "Nuevo pedido",
  "action.bill": "Cuenta",
};

const fr: Table = { ...en, "nav.home": "Accueil", "nav.orders": "Commandes" };
const it: Table = { ...en, "nav.home": "Home", "nav.orders": "Ordini" };
const ru: Table = { ...en, "nav.home": "Главная", "nav.orders": "Заказы" };

const BY_LOCALE: Record<MenuLocale, Table> = {
  de,
  sr,
  hr,
  tr,
  ar,
  es,
  fr,
  it,
  ru,
};

export function waiterUiT(
  key: WaiterUiKey,
  menuLocale: MenuLocale,
  vars?: Record<string, string | number>
): string {
  const table = BY_LOCALE[menuLocale] ?? en;
  let text = table[key] ?? en[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function waiterUiEnglish(key: WaiterUiKey, vars?: Record<string, string | number>) {
  return formatVars(en[key] ?? key, vars);
}

function formatVars(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  let out = text;
  for (const [name, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

export function wt(
  key: WaiterUiKey,
  menuLocale: MenuLocale,
  vars?: Record<string, string | number>
): string {
  return waiterUiT(key, menuLocale, vars);
}
