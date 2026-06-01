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

export const normalizeSaleItemReturn = (item) => ({
  ...item,
  returnedQty: getReturnedQty(item),
  returnStatus: item?.returnStatus || getReturnStatus(item),
});

export const normalizeSaleReturns = (sale) => ({
  ...sale,
  returnedTotal: Number(sale?.returnedTotal || 0),
  items: (sale?.items || []).map(normalizeSaleItemReturn),
});

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
    (acc, item) => acc + Number(item.price || 0) * getNetSoldQty(item),
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
      Number(item.price || 0) - Number(item.costPrice || 0);

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
  const amount = Number(targetItem.price || 0) * quantity;

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
      total: Math.max(0, Number(normalizedSale.total || 0) - amount),
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
