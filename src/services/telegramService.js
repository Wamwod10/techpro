import api from "./api";

export const getTelegramSettings = async () => {
  const { data } = await api.get("/telegram/settings");
  return data;
};

export const saveTelegramSettings = async (settings) => {
  const { data } = await api.put("/telegram/settings", settings);
  return data;
};

export const sendTelegramMessage = async () => {
  const { data } = await api.post("/telegram/test");
  return data;
};

const sendTelegramEvent = async (eventType, payload) => {
  const { data } = await api.post(`/telegram/events/${eventType}`, payload);
  return data;
};

export const notifyNewSale = (sale) => sendTelegramEvent("newSale", sale);

export const notifyDailyReport = (report) =>
  sendTelegramEvent("dailyReport", report);

export const notifyReturn = (returnItem) =>
  sendTelegramEvent("returns", returnItem);

export const notifyLowStock = (item) => sendTelegramEvent("lowStock", item);

export const notifyOutOfStock = (item) =>
  sendTelegramEvent("outOfStock", item);

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

    const isNewLowStock =
      previousQty === undefined && nextQty > 0 && nextQty <= 5;
    const crossedLowStock = previousQty > 5 && nextQty > 0 && nextQty <= 5;

    if (isNewLowStock || crossedLowStock) {
      void notifyLowStock(item);
    }
  });
};

export const notifyShiftOpen = (shift) => sendTelegramEvent("shiftOpen", shift);

export const notifyShiftClose = (shift) =>
  sendTelegramEvent("shiftClose", shift);
