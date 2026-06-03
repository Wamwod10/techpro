export const RETURN_REASONS = [
  "Mahsulot ishlamadi",
  "Model mos kelmadi",
  "Mijoz fikridan qaytdi",
  "Brak mahsulot",
];

export const getReturnedQty = (item) => Number(item?.returnedQty || 0);

export const getAvailableReturnQty = (item) =>
  Math.max(0, Number(item?.quantity || 0) - getReturnedQty(item));

export const getReturnStatus = (item) => {
  const returnedQty = getReturnedQty(item);

  if (returnedQty <= 0) {
    return "none";
  }

  return getAvailableReturnQty(item) <= 0 ? "returned" : "partial_returned";
};

export const getItemOriginalPrice = (item) =>
  Number(item?.originalPrice ?? item?.price ?? item?.sellPrice ?? 0);

export const getItemFinalPrice = (item) =>
  Number(item?.finalPrice ?? item?.price ?? item?.sellPrice ?? 0);

export const getItemDiscountPerUnit = (item) =>
  Math.max(0, getItemOriginalPrice(item) - getItemFinalPrice(item));

export const getItemDiscountTotal = (item, qty = Number(item?.quantity || 0)) =>
  getItemDiscountPerUnit(item) * Number(qty || 0);

export const normalizeSaleItemReturn = (item) => {
  const originalPrice = getItemOriginalPrice(item);
  const finalPrice = getItemFinalPrice(item);

  return {
    ...item,
    price: finalPrice,
    originalPrice,
    finalPrice,
    itemDiscountPercent: Number(item?.itemDiscountPercent || 0),
    itemDiscountAmount: Number(item?.itemDiscountAmount || 0),
    returnedQty: getReturnedQty(item),
    returnStatus: item?.returnStatus || getReturnStatus(item),
  };
};

export const getSaleSubtotal = (sale) => {
  const items = sale?.items || [];

  if (!items.length) {
    return Number(sale?.saleSubtotal || sale?.total || sale?.saleTotal || 0);
  }

  return items.reduce(
    (acc, item) => acc + getItemOriginalPrice(item) * Number(item.quantity || 0),
    0,
  );
};

export const getSaleDiscountTotal = (sale) => {
  const items = sale?.items || [];

  if (!items.length) {
    return Number(sale?.saleDiscountTotal || 0);
  }

  return items.reduce(
    (acc, item) => acc + getItemDiscountTotal(item, item.quantity),
    0,
  );
};

export const normalizeSaleReturns = (sale) => {
  const items = (sale?.items || []).map(normalizeSaleItemReturn);
  const normalized = {
    ...sale,
    items,
    returnedTotal: Number(sale?.returnedTotal || 0),
  };

  const saleSubtotal = Number(sale?.saleSubtotal ?? getSaleSubtotal(normalized));
  const saleDiscountTotal = Number(
    sale?.saleDiscountTotal ?? getSaleDiscountTotal(normalized),
  );
  const saleTotal =
    Number(sale?.saleTotal || 0) > 0
      ? Number(sale.saleTotal || 0)
      : Number(sale?.total ?? saleSubtotal - saleDiscountTotal);

  return {
    ...normalized,
    saleSubtotal,
    saleDiscountTotal,
    saleTotal,
    total: Number(sale?.total ?? saleTotal),
  };
};

export const getNetSoldQty = (item) => getAvailableReturnQty(item);

export const getSaleNetTotal = (sale) => {
  const items = sale?.items || [];

  if (!items.length) {
    return Math.max(
      0,
      Number(sale?.total || 0) - Number(sale?.returnedTotal || 0),
    );
  }

  return items.reduce(
    (acc, item) => acc + getItemFinalPrice(item) * getNetSoldQty(item),
    0,
  );
};

export const getSalesNetTotal = (sales) =>
  (sales || []).reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

export const getDayNetTotal = (day) => {
  const sales = day?.sales || [];

  if (sales.length) {
    return getSalesNetTotal(sales);
  }

  return Math.max(
    0,
    Number(day?.total || 0) - Number(day?.returnedTotal || 0),
  );
};

export const getSaleProfit = (sale) =>
  (sale?.items || []).reduce((acc, item) => {
    const netQty = getNetSoldQty(item);
    const profitPerItem =
      getItemFinalPrice(item) - Number(item.costPrice || 0);

    return acc + profitPerItem * netQty;
  }, 0);

export const clampReturnQty = (item, qty) => {
  const availableQty = getAvailableReturnQty(item);
  const value = Math.floor(Number(qty || 0));

  if (availableQty <= 0) {
    return 0;
  }

  return Math.min(Math.max(value, 1), availableQty);
};

export const applyReturnToSale = (sale, productId, requestedQty) => {
  const normalizedSale = normalizeSaleReturns(sale);
  const targetItem = normalizedSale.items.find(
    (item) => String(item.productId || item.id) === String(productId),
  );

  if (!targetItem) {
    return {
      sale: normalizedSale,
      returnedItem: null,
      quantity: 0,
      amount: 0,
    };
  }

  const quantity = clampReturnQty(targetItem, requestedQty);
  const amount = getItemFinalPrice(targetItem) * quantity;

  if (quantity <= 0) {
    return {
      sale: normalizedSale,
      returnedItem: targetItem,
      quantity: 0,
      amount: 0,
    };
  }

  const updatedItems = normalizedSale.items.map((item) => {
    if (String(item.productId || item.id) !== String(productId)) {
      return normalizeSaleItemReturn(item);
    }

    const returnedQty = getReturnedQty(item) + quantity;
    const updatedItem = {
      ...item,
      returnedQty,
    };

    return {
      ...updatedItem,
      returnStatus: getReturnStatus(updatedItem),
    };
  });

  return {
    sale: {
      ...normalizedSale,
      items: updatedItems,
      total: Number(normalizedSale.total || 0),
      saleTotal: Number(normalizedSale.saleTotal || normalizedSale.total || 0),
      returnedTotal: Number(normalizedSale.returnedTotal || 0) + amount,
    },
    returnedItem: targetItem,
    quantity,
    amount,
  };
};

export const applyReturnToSales = (sales, saleId, productId, requestedQty) => {
  let result = {
    sale: null,
    returnedItem: null,
    quantity: 0,
    amount: 0,
  };

  const updatedSales = (sales || []).map((sale) => {
    if (String(sale.id) !== String(saleId)) {
      return normalizeSaleReturns(sale);
    }

    result = applyReturnToSale(sale, productId, requestedQty);
    return result.sale;
  });

  return {
    sales: updatedSales,
    ...result,
  };
};

export const applyReturnToHistory = (
  salesHistory,
  dayId,
  saleId,
  productId,
  requestedQty,
) => {
  let result = {
    sale: null,
    returnedItem: null,
    quantity: 0,
    amount: 0,
  };

  const history = (salesHistory || []).map((day) => {
    const matchesDay =
      String(day.id) === String(dayId) || String(day.date) === String(dayId);

    if (!matchesDay) {
      return {
        ...day,
        sales: (day.sales || []).map(normalizeSaleReturns),
      };
    }

    const salesResult = applyReturnToSales(
      day.sales || [],
      saleId,
      productId,
      requestedQty,
    );

    result = salesResult;

    const paymentMethod = salesResult.sale?.paymentMethod;
    const amount = salesResult.amount;

    return {
      ...day,
      sales: salesResult.sales,
      total: Math.max(0, Number(day.total || 0) - amount),
      cash:
        paymentMethod === "cash"
          ? Math.max(0, Number(day.cash || 0) - amount)
          : Number(day.cash || 0),
      card:
        paymentMethod === "card"
          ? Math.max(0, Number(day.card || 0) - amount)
          : Number(day.card || 0),
      transfer:
        paymentMethod === "transfer"
          ? Math.max(0, Number(day.transfer || 0) - amount)
          : Number(day.transfer || 0),
      returnedTotal: Number(day.returnedTotal || 0) + amount,
    };
  });

  return {
    history,
    ...result,
  };
};

export const increaseInventoryQuantity = (inventory, productId, quantity) =>
  (inventory || []).map((product) =>
    String(product.id) === String(productId)
      ? {
          ...product,
          quantity: Number(product.quantity || 0) + Number(quantity || 0),
          stock: Number(product.quantity || 0) + Number(quantity || 0),
        }
      : product,
  );

export const buildReturnRecord = ({
  sale,
  item,
  quantity,
  amount,
  reason,
  seller,
}) => {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    saleId: sale.id,
    productId: item.productId || item.id,
    productName: item.name,
    sku: item.sku,
    quantity,
    amount,
    reason,
    sellerId: sale.sellerId || seller?.id || "",
    sellerName: sale.sellerName || seller?.name || "",
    paymentMethod: sale.paymentMethod,
    date: now.toLocaleDateString("uz-UZ"),
    dateISO: now.toISOString().slice(0, 10),
    time: now.toLocaleTimeString("uz-UZ", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};
