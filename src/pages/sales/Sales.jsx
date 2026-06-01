import { useState } from "react";

import { FiSearch, FiShoppingCart, FiPlus, FiMinus } from "react-icons/fi";

import "./sales.scss";
import { formatPrice } from "../../utils/formatPrice";
import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import {
  RETURN_REASONS,
  applyReturnToSales,
  buildReturnRecord,
  getAvailableReturnQty,
  getSaleNetTotal,
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

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const todayISO = new Date().toISOString().slice(0, 10);

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
        costPrice: item.costPrice || 0,
        returnedQty: 0,
        returnStatus: "none",
      })),

      total,
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

    api
      .post("/sales/close-day", historyItem)
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

    setSalesHistory([historyItem, ...salesHistory]);

    setDailySales([]);

    setShowCloseModal(false);
  };

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
                    {formatPrice(item.price)} × {item.quantity}
                  </p>
                </div>

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
            ))
          )}
        </div>

        <div className="cart-footer">
          <div className="total">
            <span>Jami:</span>

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
                          </small>
                        </div>

                        <strong>
                          {formatPrice(item.price * item.quantity)}
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
                  <div>{item.name}</div>

                  <strong>×{item.quantity}</strong>
                </div>
              ))}
            </div>

            <div className="receipt-total">
              <span>Jami</span>

              <h2>{formatPrice(lastSale.total)}</h2>
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
