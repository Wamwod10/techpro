import { formatPrice } from "../utils/formatPrice";

const paymentLabels = {
  cash: "Naqd",
  card: "Karta",
  transfer: "O'tkazma",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const formatPaymentMethod = (paymentMethod) =>
  paymentLabels[paymentMethod] || "Noma'lum";

const formatProductList = (items = []) =>
  items
    .map(
      (item, index) =>
        `${index + 1}. ${escapeHtml(item.name)} - ${Number(
          item.quantity || 0,
        )} dona x ${formatPrice(Number(item.price || item.sellPrice || 0))}`,
    )
    .join("\n");

export const getTelegramSettings = () => {
  return JSON.parse(
    localStorage.getItem("techpro_telegram_settings") || "null"
  );
};

export const saveTelegramSettings = (settings) => {
  localStorage.setItem(
    "techpro_telegram_settings",
    JSON.stringify(settings)
  );
};

export const sendTelegramMessage = async (message, eventType) => {
  const settings = getTelegramSettings();

  if (!settings?.botToken || !settings?.chatId) return;

  if (eventType && settings[eventType] === false) return;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${settings.botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: settings.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );

    return await response.json();
  } catch (error) {
    console.error("Telegram send error:", error);
  }
};

export const notifyNewSale = (sale) => {
  const message = [
    "🛒 <b>Yangi savdo</b>",
    "",
    `👤 <b>Sotuvchi:</b> ${escapeHtml(sale.sellerName || "Noma'lum")}`,
    `💰 <b>Summa:</b> ${formatPrice(Number(sale.total || 0))}`,
    `💳 <b>To'lov turi:</b> ${formatPaymentMethod(sale.paymentMethod)}`,
    `🕒 <b>Vaqt:</b> ${escapeHtml(sale.time || "")}`,
    "",
    "<b>Mahsulotlar:</b>",
    formatProductList(sale.items),
  ].join("\n");

  return sendTelegramMessage(message, "newSale");
};

export const notifyDailyReport = (report) => {
  const message = [
    "📊 <b>Kunlik hisobot</b>",
    "",
    `📅 <b>Sana:</b> ${escapeHtml(report.date || "")}`,
    `💰 <b>Jami savdo:</b> ${formatPrice(Number(report.total || 0))}`,
    `💵 <b>Naqd:</b> ${formatPrice(Number(report.cash || 0))}`,
    `💳 <b>Karta:</b> ${formatPrice(Number(report.card || 0))}`,
    `🏦 <b>O'tkazma:</b> ${formatPrice(Number(report.transfer || 0))}`,
    `🧾 <b>Tranzaksiyalar:</b> ${Number(report.count || 0)} ta`,
    `👤 <b>Yakunlagan xodim:</b> ${escapeHtml(
      report.closedBy || "Noma'lum",
    )}`,
  ].join("\n");

  return sendTelegramMessage(message, "dailyReport");
};

export const notifyReturn = (returnItem) => {
  const message = [
    "↩️ <b>Vozvrat</b>",
    "",
    `📦 <b>Mahsulot:</b> ${escapeHtml(returnItem.productName)}`,
    `🔢 <b>Miqdor:</b> ${Number(returnItem.quantity || 0)} dona`,
    `💰 <b>Summa:</b> ${formatPrice(Number(returnItem.amount || 0))}`,
    `📝 <b>Sabab:</b> ${escapeHtml(returnItem.reason || "Ko'rsatilmagan")}`,
    `👤 <b>Xodim:</b> ${escapeHtml(returnItem.sellerName || "Noma'lum")}`,
  ].join("\n");

  return sendTelegramMessage(message, "returns");
};

export const notifyLowStock = (item) => {
  const message = [
    "⚠️ <b>Kam qolgan mahsulot</b>",
    "",
    `📦 <b>Mahsulot:</b> ${escapeHtml(item.name)}`,
    `🏷️ <b>SKU:</b> ${escapeHtml(item.sku || "SKU yo'q")}`,
    `📉 <b>Qoldiq:</b> ${Number(item.quantity || 0)} dona`,
  ].join("\n");

  return sendTelegramMessage(message, "lowStock");
};

export const notifyOutOfStock = (item) => {
  const message = [
    "🚫 <b>Mahsulot tugadi</b>",
    "",
    `📦 <b>Mahsulot:</b> ${escapeHtml(item.name)}`,
    `🏷️ <b>SKU:</b> ${escapeHtml(item.sku || "SKU yo'q")}`,
    "📉 <b>Qoldiq:</b> 0 dona",
  ].join("\n");

  return sendTelegramMessage(message, "outOfStock");
};

export const notifyStockAlertsForInventoryChange = (
  previousInventory = [],
  nextInventory = [],
) => {
  const previousById = new Map(
    previousInventory.map((item) => [item.id, Number(item.quantity || 0)]),
  );

  nextInventory.forEach((item) => {
    const previousQty = previousById.get(item.id);
    const nextQty = Number(item.quantity || 0);

    if (nextQty === 0 && previousQty !== 0) {
      void notifyOutOfStock(item);
      return;
    }

    const isNewLowStock = previousQty === undefined && nextQty > 0 && nextQty <= 5;
    const crossedLowStock = previousQty > 5 && nextQty > 0 && nextQty <= 5;

    if (isNewLowStock || crossedLowStock) {
      void notifyLowStock(item);
    }
  });
};

export const notifyShiftOpen = (shift) => {
  const message = [
    "🟢 <b>Shift ochildi</b>",
    "",
    `👤 <b>Kassir:</b> ${escapeHtml(shift.cashierName || "Noma'lum")}`,
    `💵 <b>Boshlang'ich kassa:</b> ${formatPrice(
      Number(shift.openingCash || 0),
    )}`,
    `🕒 <b>Vaqt:</b> ${escapeHtml(shift.openedAt || "")}`,
  ].join("\n");

  return sendTelegramMessage(message, "shiftOpen");
};

export const notifyShiftClose = (shift) => {
  const message = [
    "🔴 <b>Shift yopildi</b>",
    "",
    `👤 <b>Kassir:</b> ${escapeHtml(shift.cashierName || "Noma'lum")}`,
    `💵 <b>Yakuniy kassa:</b> ${formatPrice(Number(shift.closingCash || 0))}`,
    `💰 <b>Bugungi savdo:</b> ${formatPrice(Number(shift.totalSales || 0))}`,
    `💵 <b>Naqd:</b> ${formatPrice(Number(shift.cashSales || 0))}`,
    `💳 <b>Karta:</b> ${formatPrice(Number(shift.cardSales || 0))}`,
    `🏦 <b>O'tkazma:</b> ${formatPrice(Number(shift.transferSales || 0))}`,
    `🧾 <b>Tranzaksiyalar:</b> ${Number(shift.transactions || 0)} ta`,
    `🕒 <b>Vaqt:</b> ${escapeHtml(shift.closedAt || "")}`,
  ].join("\n");

  return sendTelegramMessage(message, "shiftClose");
};
