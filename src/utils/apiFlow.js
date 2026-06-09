export const getApiErrorMessage = (error, fallback) => {
  if (error?.code === "ECONNABORTED") {
    return "Server javobi kechikyapti. Amal qayta urinilmagan, xavfsiz tarzda yana bosib ko'rishingiz mumkin.";
  }

  if (!error?.response && error?.message === "Network Error") {
    return "Serverga ulanish sekin. Render backend uyg'onayotgan bo'lishi mumkin, birozdan keyin yana urinib ko'ring.";
  }

  return error?.response?.data?.message || error?.message || fallback;
};

export const parseProductSaveResponse = (data) => ({
  product: data?.product || data,
  supplier: data?.supplier || null,
});

export const upsertById = (items = [], nextItem) => {
  if (!nextItem?.id) {
    return items;
  }

  const exists = items.some((item) => String(item.id) === String(nextItem.id));

  if (!exists) {
    return [nextItem, ...items];
  }

  return items.map((item) =>
    String(item.id) === String(nextItem.id) ? nextItem : item,
  );
};

export const isCreditPaymentStatus = (status) =>
  ["credit", "debt", "qarz"].includes(String(status || "").toLowerCase());
