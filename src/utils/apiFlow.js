export const getApiErrorMessage = (error, fallback) => {
  if (error?.code === "ECONNABORTED") {
    return "Server sekin javob bermoqda. Internet yoki backend holatini tekshiring.";
  }

  if (!error?.response && error?.message === "Network Error") {
    return "Serverga ulanib bo'lmadi. Internet yoki backend URL ni tekshiring.";
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
