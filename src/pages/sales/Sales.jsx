import { useState } from "react";

import {
  FiSearch,
  FiShoppingCart,
  FiPlus,
  FiMinus,
  FiPercent,
} from "react-icons/fi";

import "./sales.scss";
import { formatPrice } from "../../utils/formatPrice";
import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import {
  RETURN_REASONS,
  applyReturnToSales,
  buildReturnRecord,
  getAvailableReturnQty,
  getItemDiscountTotal,
  getItemFinalPrice,
  getItemOriginalPrice,
  getSaleDiscountTotal,
  getSaleNetTotal,
  getSaleSubtotal,
  getSalesNetTotal,
  increaseInventoryQuantity,
} from "../../utils/returns";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiFlow";

function Sales() {
  const { currentUser } = useAuth();
  const {
    inventory,
    setInventory,
    dailySales,
    setDailySales,
    salesHistory,
    setSalesHistory,
    returns,
    setReturns,
    activeShift,
    addActivityLog,
  } = useStore();

  const [cart, setCart] = useState([]);
  const [discountModalItem, setDiscountModalItem] = useState(null);
  const [discountMode, setDiscountMode] = useState("percent");
  const [discountPercent, setDiscountPercent] = useState(5);
  const [customPercent, setCustomPercent] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountWarning, setDiscountWarning] = useState("");

  const [search, setSearch] = useState("");

  const [success, setSuccess] = useState(false);

  const [receiptModal, setReceiptModal] = useState(false);

  const [lastSale, setLastSale] = useState(null);

  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [permissionModal, setPermissionModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState("");

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  const [returnSaving, setReturnSaving] = useState(false);
  const [closeDaySaving, setCloseDaySaving] = useState(false);
  const [salesError, setSalesError] = useState("");

  const addToCart = (product) => {
    const exists = cart.find((item) => item.id === product.id);

    if (exists) {
      if (exists.quantity >= product.quantity) return;

      setCart(
        cart.map((item) =>
          item.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          ...product,
          price: product.sellPrice,
          originalPrice: product.sellPrice,
          finalPrice: product.sellPrice,
          itemDiscountPercent: 0,
          itemDiscountAmount: 0,
          quantity: 1,
        },
      ]);
    }
  };

  const increaseQty = (id) => {
    setCart(
      cart.map((item) => {
        if (item.id === id) {
          const originalProduct = inventory.find((p) => p.id === item.id);

          if (item.quantity >= originalProduct.quantity) {
            return item;
          }

          return {
            ...item,

            quantity: item.quantity + 1,
          };
        }

        return item;
      }),
    );
  };
  const decreaseQty = (id) => {
    setCart(
      cart
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const filteredProducts = inventory.filter(
    (product) =>
      String(product.name || "").toLowerCase().includes(search.toLowerCase()) ||
      String(product.sku || "").toLowerCase().includes(search.toLowerCase()),
  );

  const cartSubtotal = cart.reduce(
    (acc, item) => acc + getItemOriginalPrice(item) * Number(item.quantity || 0),
    0,
  );
  const cartDiscountTotal = cart.reduce(
    (acc, item) => acc + getItemDiscountTotal(item),
    0,
  );
  const total = cart.reduce(
    (acc, item) => acc + getItemFinalPrice(item) * Number(item.quantity || 0),
    0,
  );

  const todayISO = new Date().toISOString().slice(0, 10);

  const openDiscountModal = (item) => {
    setDiscountModalItem(item);
    setDiscountWarning("");

    if (Number(item.itemDiscountAmount || 0) > 0) {
      setDiscountMode("amount");
      setDiscountAmount(String(item.itemDiscountAmount));
      setDiscountPercent(5);
      setCustomPercent("");
      return;
    }

    const percent = Number(item.itemDiscountPercent || 0);
    setDiscountMode("percent");
    setDiscountPercent([5, 10, 15].includes(percent) ? percent : "custom");
    setCustomPercent([5, 10, 15].includes(percent) ? "" : String(percent || ""));
    setDiscountAmount("");
  };

  const getDiscountPreview = () => {
    if (!discountModalItem) return null;

    const originalPrice = getItemOriginalPrice(discountModalItem);
    const percent =
      discountMode === "percent"
        ? Number(discountPercent === "custom" ? customPercent : discountPercent)
        : 0;
    const amount = discountMode === "amount" ? Number(discountAmount || 0) : 0;
    const percentDiscount = (originalPrice * Math.max(0, percent)) / 100;
    const discountPerUnit = Math.min(
      originalPrice,
      Math.max(0, percentDiscount + Math.max(0, amount)),
    );
    const finalPrice = Math.max(0, originalPrice - discountPerUnit);
    const belowCost =
      Number(discountModalItem.costPrice || 0) > 0 &&
      finalPrice < Number(discountModalItem.costPrice || 0);

    return {
      percent: Math.min(100, Math.max(0, percent)),
      amount: Math.max(0, amount),
      discountPerUnit,
      finalPrice,
      belowCost,
    };
  };

  const applyDiscount = () => {
    const preview = getDiscountPreview();

    if (!discountModalItem || !preview) return;

    if (preview.belowCost && currentUser?.role !== "admin") {
      setDiscountWarning("Bu skidka tannarxdan past tushiradi. Kassirga ruxsat yo'q.");
      return;
    }

    if (preview.belowCost && currentUser?.role === "admin" && !discountWarning) {
      setDiscountWarning("Diqqat: final narx tannarxdan past. Qayta bossangiz saqlanadi.");
      return;
    }

    setCart((items) =>
      items.map((item) =>
        item.id === discountModalItem.id
          ? {
              ...item,
              price: preview.finalPrice,
              originalPrice: getItemOriginalPrice(item),
              finalPrice: preview.finalPrice,
              itemDiscountPercent:
                discountMode === "percent" ? preview.percent : 0,
              itemDiscountAmount:
                discountMode === "amount" ? preview.amount : 0,
            }
          : item,
      ),
    );
    setDiscountModalItem(null);
    setDiscountWarning("");
  };

  const handleCheckout = () => {
    if (checkoutSaving || cart.length === 0 || !activeShift) return;

    setCheckoutSaving(true);
    setSalesError("");
    const checkoutCart = cart;

    const salePayload = {
      id: crypto.randomUUID(),

      dateISO: todayISO,
      date: new Date().toLocaleDateString("uz-UZ"),

      sellerId: currentUser?.id,
      sellerName: currentUser?.name,
      sellerRole: currentUser?.role,

      items: cart.map((item) => ({
        ...item,
        price: getItemFinalPrice(item),
        originalPrice: getItemOriginalPrice(item),
        finalPrice: getItemFinalPrice(item),
        itemDiscountPercent: Number(item.itemDiscountPercent || 0),
        itemDiscountAmount: Number(item.itemDiscountAmount || 0),
        costPrice: item.costPrice || 0,
        returnedQty: 0,
        returnStatus: "none",
      })),

      total,
      saleSubtotal: cartSubtotal,
      saleDiscountTotal: cartDiscountTotal,
      saleTotal: total,
      returnedTotal: 0,
      paymentMethod,

      time: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setLastSale(salePayload);

    setReceiptModal(true);
    setSuccess(true);
    window.setTimeout(() => setSuccess(false), 1800);

    setDailySales([salePayload, ...dailySales]);

    const updatedInventory = inventory.map((product) => {
      const cartItem = cart.find((item) => item.id === product.id);

      if (cartItem) {
        return {
          ...product,

          quantity: product.quantity - cartItem.quantity,
          stock: product.quantity - cartItem.quantity,
        };
      }

      return product;
    });

    setInventory(updatedInventory, { sync: false });

    setCart([]);

    addActivityLog({
      type: "sale",
      title: "Savdo amalga oshirildi",
      description: `${salePayload.items.length} turdagi mahsulot ${formatPrice(
        getSaleNetTotal(salePayload),
      )}ga sotildi`,
      userName: currentUser?.name,
      userRole: currentUser?.role,
    });

    api
      .post("/sales", salePayload)
      .then(({ data }) => {
        setLastSale(data);
        setDailySales((sales) =>
          sales.map((sale) => (sale.id === salePayload.id ? data : sale)),
        );
      })
      .catch((error) => {
        setDailySales((sales) =>
          sales.filter((sale) => sale.id !== salePayload.id),
        );
        setInventory(inventory, { sync: false });
        setCart(checkoutCart);
        setReceiptModal(false);
        setSalesError(getApiErrorMessage(error, "Savdoni saqlashda xatolik"));
      })
      .finally(() => {
        setCheckoutSaving(false);
      });
  };

  const openReturnPermission = (sale) => {
    setSelectedSale(sale);
    setSelectedReturnItem(null);
    setReturnQty(1);
    setReturnReason("");
    setPermissionModal(true);
  };

  const openReturnModal = () => {
    setPermissionModal(false);
    setReturnModal(true);
  };

  const handleReturn = () => {
    if (returnSaving || !selectedSale || !selectedReturnItem || !returnReason) {
      return;
    }

    setReturnSaving(true);
    setSalesError("");

    const returnResult = applyReturnToSales(
      dailySales,
      selectedSale.id,
      selectedReturnItem.productId || selectedReturnItem.id,
      returnQty,
    );

    if (returnResult.quantity <= 0 || !returnResult.returnedItem) {
      setReturnSaving(false);
      return;
    }

    const nextInventory = increaseInventoryQuantity(
      inventory,
      selectedReturnItem.productId || selectedReturnItem.id,
      returnResult.quantity,
    );
    const optimisticReturn = buildReturnRecord({
      sale: selectedSale,
      item: returnResult.returnedItem,
      quantity: returnResult.quantity,
      amount: returnResult.amount,
      reason: returnReason,
      seller: currentUser,
    });

    setInventory(nextInventory, { sync: false });
    setDailySales(returnResult.sales);
    setReturns([optimisticReturn, ...returns]);

    api
      .post("/returns", {
        saleId: selectedSale.id,
        productId: selectedReturnItem.productId || selectedReturnItem.id,
        quantity: returnResult.quantity,
        reason: returnReason,
      })
      .then(({ data }) => {
        setReturns((current) =>
          current.map((item) =>
            item.id === optimisticReturn.id ? data : item,
          ),
        );
      })
      .catch((error) => {
        setInventory(inventory, { sync: false });
        setDailySales(dailySales);
        setReturns(returns);
        setSalesError(
          getApiErrorMessage(error, "Vozvratni saqlashda xatolik"),
        );
      })
      .finally(() => {
        setReturnSaving(false);
      });

    addActivityLog({
      type: "return",
      title: "Vozvrat qilindi",
      description: `${returnResult.returnedItem.name} vozvrat qilindi: ${returnResult.quantity} dona`,
      userName: currentUser?.name,
      userRole: currentUser?.role,
    });

    setReturnModal(false);
    setSelectedSale(null);
    setSelectedReturnItem(null);
    setReturnQty(1);
    setReturnReason("");
  };

  const cashTotal = dailySales
    .filter((sale) => sale.paymentMethod === "cash")
    .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

  const cardTotal = dailySales
    .filter((sale) => sale.paymentMethod === "card")
    .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

  const transferTotal = dailySales
    .filter((sale) => sale.paymentMethod === "transfer")
    .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

  const totalSalesAmount = getSalesNetTotal(dailySales);

  const closeDailySales = () => {
    if (closeDaySaving || dailySales.length === 0) return;

    setCloseDaySaving(true);
    setSalesError("");

    const historyItem = {
      id: crypto.randomUUID(),

      total: totalSalesAmount,

      cash: cashTotal,

      card: cardTotal,

      transfer: transferTotal,

      returnedTotal: dailySales.reduce(
        (acc, sale) => acc + Number(sale.returnedTotal || 0),
        0,
      ),

      count: dailySales.length,

      date: new Date().toLocaleDateString("uz-UZ"),

      sales: dailySales,

      dateISO: todayISO,

      closedBy: currentUser?.name,
    };

    const mergeHistoryDay = (history) => {
      const existing = history.find((day) => day.dateISO === historyItem.dateISO);

      if (!existing) {
        return [historyItem, ...history];
      }

      return history.map((day) =>
        day.dateISO === historyItem.dateISO
          ? {
              ...day,
              total: Number(day.total || 0) + Number(historyItem.total || 0),
              cash: Number(day.cash || 0) + Number(historyItem.cash || 0),
              card: Number(day.card || 0) + Number(historyItem.card || 0),
              transfer:
                Number(day.transfer || 0) + Number(historyItem.transfer || 0),
              returnedTotal:
                Number(day.returnedTotal || 0) +
                Number(historyItem.returnedTotal || 0),
              count: Number(day.count || 0) + Number(historyItem.count || 0),
              sales: [...(historyItem.sales || []), ...(day.sales || [])],
              closedBy: historyItem.closedBy,
            }
          : day,
      );
    };

    api
      .post("/sales/close-day", historyItem)
      .then(({ data }) => {
        if (!data?.report) return;

        setSalesHistory((history) =>
          history.map((day) =>
            day.dateISO === data.report.dateISO
              ? {
                  ...day,
                  ...data.report,
                  sales: day.sales || [],
                }
              : day,
          ),
        );
      })
      .catch((error) => {
        setSalesHistory(salesHistory);
        setDailySales(dailySales);
        setSalesError(
          getApiErrorMessage(error, "Kunlik savdoni yakunlashda xatolik"),
        );
      })
      .finally(() => {
        setCloseDaySaving(false);
      });

    setSalesHistory(mergeHistoryDay(salesHistory));

    setDailySales([]);

    setShowCloseModal(false);
  };

  const discountPreview = getDiscountPreview();

  return (
    <div className="sales-page">
      <div className="sales-products">
        <div className="sales-header">
          <h1>Savdo</h1>

          <div className="sales-search">
            <FiSearch />

            <input
              type="text"
              placeholder="Mahsulot qidirish..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="products-grid">
          {filteredProducts.map((product) => (
            <div className="product-card" key={product.id}>
              <h3>{product.name}</h3>

              <p className="product-sku">{product.sku}</p>

              <p>
                {product.quantity -
                  (cart.find((item) => item.id === product.id)?.quantity ||
                    0)}{" "}
                dona mavjud
              </p>

              <div className="product-bottom">
                <strong>{formatPrice(product.sellPrice)}</strong>

                <button
                  disabled={
                    !activeShift ||
                    product.quantity -
                      (cart.find((item) => item.id === product.id)?.quantity ||
                        0) <=
                      0
                  }
                  onClick={() => addToCart(product)}
                >
                  {!activeShift
                    ? "Kassa yopiq"
                    : product.quantity -
                          (cart.find((item) => item.id === product.id)
                            ?.quantity || 0) >
                        0
                      ? "Savatga"
                      : "Tugagan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cart-section">
        <div className="cart-header">
          <FiShoppingCart />

          <h2>Savat</h2>
        </div>

        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-cart">
              <h3>Savat bo‘sh</h3>

              <p>Mahsulot qo‘shilgandan keyin shu yerda ko‘rinadi</p>
            </div>
          ) : (
            cart.map((item) => (
              <div className="cart-item" key={item.id}>
                <div>
                  <h4>{item.name}</h4>

                  <p>
                    {getItemDiscountTotal(item) > 0 && (
                      <span className="old-price">
                        {formatPrice(getItemOriginalPrice(item))}
                      </span>
                    )}
                    {formatPrice(getItemFinalPrice(item))} × {item.quantity}
                  </p>

                  {getItemDiscountTotal(item) > 0 && (
                    <small className="discount-note">
                      Skidka: {formatPrice(getItemDiscountTotal(item))}
                    </small>
                  )}
                </div>

                <div className="cart-actions">
                  <button
                    className="discount-btn"
                    onClick={() => openDiscountModal(item)}
                    type="button"
                  >
                    <FiPercent />
                    Skidka
                  </button>

                  <div className="qty-controls">
                    <button onClick={() => decreaseQty(item.id)}>
                      <FiMinus />
                    </button>

                    <span>{item.quantity}</span>

                    <button onClick={() => increaseQty(item.id)}>
                      <FiPlus />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="cart-total-row">
            <span>Jami narx</span>
            <strong>{formatPrice(cartSubtotal)}</strong>
          </div>

          <div className="cart-total-row discount">
            <span>Skidka</span>
            <strong>-{formatPrice(cartDiscountTotal)}</strong>
          </div>

          <div className="total">
            <span>To'lovga:</span>

            <h2>{formatPrice(total)}</h2>
          </div>

          <div className="payment-method">
            <button
              className={
                paymentMethod === "cash" ? "payment-btn active" : "payment-btn"
              }
              onClick={() => setPaymentMethod("cash")}
            >
              Naqd
            </button>

            <button
              className={
                paymentMethod === "card" ? "payment-btn active" : "payment-btn"
              }
              onClick={() => setPaymentMethod("card")}
            >
              Karta
            </button>

            <button
              className={
                paymentMethod === "transfer"
                  ? "payment-btn active"
                  : "payment-btn"
              }
              onClick={() => setPaymentMethod("transfer")}
            >
              O‘tkazma
            </button>
          </div>

          <button
            className="checkout-btn"
            onClick={handleCheckout}
            disabled={cart.length === 0 || !activeShift || checkoutSaving}
          >
            {checkoutSaving
              ? "Saqlanmoqda..."
              : !activeShift
              ? "Avval kassa oching"
              : paymentMethod === "cash"
                ? "Naqd to‘lov"
                : paymentMethod === "card"
                  ? "Karta to‘lovi"
                  : "O‘tkazma"}
          </button>
        </div>
        <div className="daily-sales">
          <div className="daily-sales-header">
            <div>
              <span>Bugungi savdolar</span>
              <h3>{dailySales.length} ta savdo</h3>
            </div>

            <strong>{formatPrice(totalSalesAmount)}</strong>
          </div>

          <div className="daily-sales-list">
            {dailySales.length === 0 ? (
              <p className="no-sales">Hozircha savdo yo‘q</p>
            ) : (
              dailySales.map((sale) => (
                <div className="daily-sale-card" key={sale.id}>
                  <div className="daily-sale-top">
                    <strong>{formatPrice(getSaleNetTotal(sale))}</strong>

                    <span>{sale.time}</span>
                  </div>

                  <p className={`daily-payment-badge ${sale.paymentMethod}`}>
                    {sale.paymentMethod === "cash" && "Naqd"}

                    {sale.paymentMethod === "card" && "Karta"}

                    {sale.paymentMethod === "transfer" && "O‘tkazma"}
                  </p>

                  <div className="daily-products">
                    {sale.items.map((item) => (
                      <div className="daily-product-row" key={item.id}>
                        <div>
                          <span>
                            {item.name} × {item.quantity}
                            {item.returnedQty > 0 && (
                              <strong className="returned-badge">
                                Vozvrat: {item.returnedQty}
                              </strong>
                            )}
                          </span>
                          <small>
                            {getAvailableReturnQty(item)} dona qaytarish mumkin
                            {getItemDiscountTotal(item) > 0 &&
                              ` · skidka ${formatPrice(getItemDiscountTotal(item))}`}
                          </small>
                        </div>

                        <strong>
                          {formatPrice(
                            getItemFinalPrice(item) * Number(item.quantity || 0),
                          )}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className="return-sale-btn"
                    disabled={
                      !sale.items?.some(
                        (item) => getAvailableReturnQty(item) > 0,
                      )
                    }
                    onClick={() => openReturnPermission(sale)}
                  >
                    Vozvrat
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <button
          className="close-day-btn"
          onClick={() => setShowCloseModal(true)}
        >
          Kunlik savdoni yakunlash
        </button>
      </div>
      {success && (
        <div className="success-alert">Savdo muvaffaqiyatli yakunlandi</div>
      )}
      {salesError && <div className="success-alert error">{salesError}</div>}
      {discountModalItem && discountPreview && (
        <div className="modal-overlay">
          <div className="discount-modal">
            <h2>Skidka</h2>
            <p>{discountModalItem.name}</p>

            <div className="discount-type">
              <button
                className={discountMode === "percent" ? "active" : ""}
                onClick={() => {
                  setDiscountMode("percent");
                  setDiscountWarning("");
                }}
                type="button"
              >
                Foiz
              </button>

              <button
                className={discountMode === "amount" ? "active" : ""}
                onClick={() => {
                  setDiscountMode("amount");
                  setDiscountWarning("");
                }}
                type="button"
              >
                Summa
              </button>
            </div>

            {discountMode === "percent" ? (
              <div className="discount-options">
                {[5, 10, 15].map((percent) => (
                  <button
                    key={percent}
                    className={discountPercent === percent ? "active" : ""}
                    onClick={() => {
                      setDiscountPercent(percent);
                      setCustomPercent("");
                      setDiscountWarning("");
                    }}
                    type="button"
                  >
                    {percent}%
                  </button>
                ))}

                <button
                  className={discountPercent === "custom" ? "active" : ""}
                  onClick={() => {
                    setDiscountPercent("custom");
                    setDiscountWarning("");
                  }}
                  type="button"
                >
                  Custom
                </button>
              </div>
            ) : null}

            {discountMode === "percent" && discountPercent === "custom" && (
              <input
                className="discount-input"
                type="number"
                min="0"
                max="100"
                value={customPercent}
                onChange={(e) => {
                  setCustomPercent(e.target.value);
                  setDiscountWarning("");
                }}
                placeholder="Custom %"
              />
            )}

            {discountMode === "amount" && (
              <input
                className="discount-input"
                type="number"
                min="0"
                value={discountAmount}
                onChange={(e) => {
                  setDiscountAmount(e.target.value);
                  setDiscountWarning("");
                }}
                placeholder="Chegirma summasi"
              />
            )}

            <div className="discount-preview">
              <div>
                <span>Asl narx</span>
                <strong>{formatPrice(getItemOriginalPrice(discountModalItem))}</strong>
              </div>

              <div>
                <span>Skidka</span>
                <strong>-{formatPrice(discountPreview.discountPerUnit)}</strong>
              </div>

              <div>
                <span>Final narx</span>
                <strong>{formatPrice(discountPreview.finalPrice)}</strong>
              </div>
            </div>

            {discountWarning && (
              <div className="discount-warning">{discountWarning}</div>
            )}

            <div className="return-actions">
              <button
                className="cancel-return-btn"
                onClick={() => {
                  setDiscountModalItem(null);
                  setDiscountWarning("");
                }}
                type="button"
              >
                Bekor qilish
              </button>

              <button
                className="confirm-return-btn"
                onClick={applyDiscount}
                type="button"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
      {showCloseModal && (
        <div className="modal-overlay">
          <div className="close-modal">
            <h2>Kunlik savdoni yakunlash</h2>

            <div className="close-stats">
              <div>
                <span>Naqd</span>

                <strong>{formatPrice(cashTotal)}</strong>
              </div>

              <div>
                <span>Karta</span>

                <strong>{formatPrice(cardTotal)}</strong>
              </div>

              <div>
                <span>O‘tkazma</span>

                <strong>{formatPrice(transferTotal)}</strong>
              </div>

              <div>
                <span>Jami savdo</span>

                <strong>{formatPrice(totalSalesAmount)}</strong>
              </div>

              <div>
                <span>Savdolar soni</span>

                <strong>{dailySales.length}</strong>
              </div>
            </div>

            <div className="close-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowCloseModal(false)}
              >
                Ortga qaytish
              </button>

              <button
                className="confirm-btn"
                disabled={closeDaySaving}
                onClick={closeDailySales}
              >
                {closeDaySaving ? "Saqlanmoqda..." : "Yakunlash"}
              </button>
            </div>
          </div>
        </div>
      )}
      {receiptModal && lastSale && (
        <div className="modal-overlay">
          <div className="receipt-modal">
            <div className="receipt-header">
              <h2>TECHPRO</h2>

              <p>Savdo cheki</p>
            </div>

            <div className="receipt-info">
              <span>Sana:</span>

              <strong>{new Date().toLocaleDateString("uz-UZ")}</strong>
            </div>

            <div className="receipt-info">
              <span>Vaqt:</span>

              <strong>{lastSale.time}</strong>
            </div>

            <div className="receipt-info">
              <span>To‘lov:</span>

              <strong>{lastSale.paymentMethod}</strong>
            </div>

            <div className="receipt-products">
              {lastSale.items.map((item) => (
                <div className="receipt-item" key={item.id}>
                  <div>
                    <span>{item.name}</span>
                    {getItemDiscountTotal(item) > 0 && (
                      <small>
                        Skidka: {formatPrice(getItemDiscountTotal(item))}
                      </small>
                    )}
                  </div>

                  <strong>
                    ×{item.quantity} ·{" "}
                    {formatPrice(
                      getItemFinalPrice(item) * Number(item.quantity || 0),
                    )}
                  </strong>
                </div>
              ))}
            </div>

            <div className="receipt-info receipt-money">
              <span>Jami narx:</span>

              <strong>{formatPrice(getSaleSubtotal(lastSale))}</strong>
            </div>

            <div className="receipt-info receipt-money discount">
              <span>Skidka:</span>

              <strong>-{formatPrice(getSaleDiscountTotal(lastSale))}</strong>
            </div>

            <div className="receipt-total">
              <span>To'lovga</span>

              <h2>{formatPrice(getSaleNetTotal(lastSale))}</h2>
            </div>

            <button
              className="close-receipt"
              onClick={() => setReceiptModal(false)}
            >
              Yopish
            </button>
          </div>
        </div>
      )}
      {permissionModal && (
        <div className="modal-overlay">
          <div className="return-permission-modal">
            <h2>Admin ruxsati kerak</h2>

            <p>
              Vozvrat qilishdan oldin admin yoki do‘kon egasidan ruxsat so‘rang.
            </p>

            <div className="return-actions">
              <button
                className="cancel-return-btn"
                onClick={() => setPermissionModal(false)}
              >
                Orqaga qaytish
              </button>

              <button className="confirm-return-btn" onClick={openReturnModal}>
                So‘radim
              </button>
            </div>
          </div>
        </div>
      )}

      {returnModal && selectedSale && (
        <div className="modal-overlay">
          <div className="return-modal">
            <h2>Vozvrat qilish</h2>

            <p>Qaytariladigan mahsulotni tanlang</p>

            <div className="return-products">
              {selectedSale.items.map((item) => {
                const availableQty = getAvailableReturnQty(item);

                return (
                  <button
                    key={item.id}
                    disabled={availableQty <= 0}
                    className={
                      selectedReturnItem?.id === item.id ? "active" : ""
                    }
                    onClick={() => {
                      setSelectedReturnItem(item);
                      setReturnQty(1);
                    }}
                  >
                    <span>{item.name}</span>
                    <strong>{availableQty} dona</strong>
                  </button>
                );
              })}
            </div>

            {selectedReturnItem && (
              <>
                <div className="return-qty">
                  <span>Qaytariladigan son</span>

                  <input
                    type="number"
                    min="1"
                    max={getAvailableReturnQty(selectedReturnItem)}
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value)}
                  />
                </div>

                <div className="return-reasons">
                  {RETURN_REASONS.map((reason) => (
                    <button
                      key={reason}
                      className={returnReason === reason ? "active" : ""}
                      onClick={() => setReturnReason(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="return-actions">
              <button
                className="cancel-return-btn"
                onClick={() => {
                  setReturnModal(false);
                  setSelectedSale(null);
                  setSelectedReturnItem(null);
                  setReturnReason("");
                }}
              >
                Bekor qilish
              </button>

              <button
                className="confirm-return-btn"
                disabled={returnSaving}
                onClick={handleReturn}
              >
                {returnSaving ? "Saqlanmoqda..." : "Vozvratni saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;
