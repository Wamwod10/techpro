import { useEffect, useState } from "react";

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
  getDayNetTotal,
  getSaleNetTotal,
  getSalesNetTotal,
  increaseInventoryQuantity,
} from "../../utils/returns";
import {
  notifyDailyReport,
  notifyNewSale,
  notifyReturn,
  notifyStockAlertsForInventoryChange,
} from "../../services/telegramService";

function Sales() {
  const { currentUser } = useAuth();
  const {
    inventory,
    setInventory,
    dailySales,
    setDailySales,
    salesHistory,
    setSalesHistory,
    addActivityLog,
  } = useStore();

  const activeShift = JSON.parse(
    localStorage.getItem("techpro_active_shift") || "null",
  );

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
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase()),
  );

  const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const todayISO = new Date().toISOString().slice(0, 10);

  const closeOldDailySales = () => {
    const savedDailySales = JSON.parse(
      localStorage.getItem("techpro_daily_sales") || "[]",
    );

    if (savedDailySales.length === 0) return;

    const oldSales = savedDailySales.filter(
      (sale) => sale.dateISO && sale.dateISO !== todayISO,
    );

    const todaySales = savedDailySales.filter(
      (sale) => !sale.dateISO || sale.dateISO === todayISO,
    );

    if (oldSales.length === 0) return;

    const savedHistory = JSON.parse(
      localStorage.getItem("techpro_sales_history") || "[]",
    );

    const groupedByDate = oldSales.reduce((acc, sale) => {
      if (!acc[sale.dateISO]) {
        acc[sale.dateISO] = [];
      }

      acc[sale.dateISO].push(sale);

      return acc;
    }, {});

    const historyItems = Object.entries(groupedByDate).map(
      ([dateISO, sales]) => {
        const total = getSalesNetTotal(sales);

        const cash = sales
          .filter((sale) => sale.paymentMethod === "cash")
          .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

        const card = sales
          .filter((sale) => sale.paymentMethod === "card")
          .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

        const transfer = sales
          .filter((sale) => sale.paymentMethod === "transfer")
          .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

        const returnedTotal = sales.reduce(
          (acc, sale) => acc + Number(sale.returnedTotal || 0),
          0,
        );

        return {
          id: crypto.randomUUID(),
          dateISO,
          date: new Date(dateISO).toLocaleDateString("uz-UZ"),
          total,
          cash,
          card,
          transfer,
          returnedTotal,
          count: sales.length,
          sales,
          autoClosed: true,
        };
      },
    );

    const updatedHistory = [...historyItems, ...savedHistory];

    localStorage.setItem(
      "techpro_sales_history",
      JSON.stringify(updatedHistory),
    );
    localStorage.setItem("techpro_daily_sales", JSON.stringify(todaySales));

    setSalesHistory(updatedHistory);
    setDailySales(todaySales);
  };

  const saveRecentSoldProducts = (sale) => {
    const saved = JSON.parse(
      localStorage.getItem("techpro_recent_sold_products") || "[]",
    );

    const soldProducts = sale.items.map((item) => ({
      id: crypto.randomUUID(),
      productName: item.name,
      sku: item.sku,
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity,
      paymentMethod: sale.paymentMethod,
      time: sale.time,
      date: new Date().toLocaleDateString("uz-UZ"),
    }));

    const updated = [...soldProducts, ...saved].slice(0, 10);

    localStorage.setItem(
      "techpro_recent_sold_products",
      JSON.stringify(updated),
    );
  };

  const handleCheckout = () => {
    const sale = {
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
    setLastSale(sale);

    saveRecentSoldProducts(sale);

    setReceiptModal(true);
    setSuccess(true);
    window.setTimeout(() => setSuccess(false), 1800);

    setDailySales([sale, ...dailySales]);

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

    setInventory(updatedInventory);
    notifyStockAlertsForInventoryChange(inventory, updatedInventory);

    void notifyNewSale(sale);

    setCart([]);

    addActivityLog({
      type: "sale",
      title: "Savdo amalga oshirildi",
      description: `${sale.items.length} turdagi mahsulot ${formatPrice(
        getSaleNetTotal(sale),
      )}ga sotildi`,
      userName: currentUser?.name,
      userRole: currentUser?.role,
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
    if (!selectedSale || !selectedReturnItem || !returnReason) return;

    const returnResult = applyReturnToSales(
      dailySales,
      selectedSale.id,
      selectedReturnItem.id,
      returnQty,
    );

    if (returnResult.quantity <= 0 || !returnResult.returnedItem) return;

    const returnHistory = JSON.parse(
      localStorage.getItem("techpro_returns") || "[]",
    );

    const returnItem = buildReturnRecord({
      sale: returnResult.sale,
      item: returnResult.returnedItem,
      quantity: returnResult.quantity,
      amount: returnResult.amount,
      reason: returnReason,
      seller: currentUser,
    });

    localStorage.setItem(
      "techpro_returns",
      JSON.stringify([returnItem, ...returnHistory]),
    );

    setInventory(
      increaseInventoryQuantity(
        inventory,
        selectedReturnItem.id,
        returnResult.quantity,
      ),
    );
    setDailySales(returnResult.sales);

    void notifyReturn(returnItem);

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

    const existingDay = salesHistory.find(
      (day) => day.date === historyItem.date,
    );

    if (existingDay) {
      const updatedHistory = salesHistory.map((day) => {
        if (day.date === historyItem.date) {
          const getExistingPaymentTotal = (paymentMethod) =>
            day.sales?.length
              ? day.sales
                  .filter((sale) => sale.paymentMethod === paymentMethod)
                  .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0)
              : Number(day[paymentMethod] || 0);

          return {
            ...day,

            total: getDayNetTotal(day) + historyItem.total,

            cash: getExistingPaymentTotal("cash") + historyItem.cash,

            card: getExistingPaymentTotal("card") + historyItem.card,

            transfer:
              getExistingPaymentTotal("transfer") + historyItem.transfer,

            returnedTotal:
              Number(day.returnedTotal || 0) +
              Number(historyItem.returnedTotal || 0),

            count: day.count + historyItem.count,

            sales: [...day.sales, ...historyItem.sales],

            closedBy: historyItem.closedBy,
          };
        }

        return day;
      });

      setSalesHistory(updatedHistory);
    } else {
      setSalesHistory([historyItem, ...salesHistory]);
    }

    void notifyDailyReport(historyItem);

    setDailySales([]);

    setShowCloseModal(false);
  };

  useEffect(() => {
    localStorage.setItem("techpro_inventory", JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem("techpro_daily_sales", JSON.stringify(dailySales));
  }, [dailySales]);

  useEffect(() => {
    localStorage.setItem("techpro_sales_history", JSON.stringify(salesHistory));
  }, [salesHistory]);

  useEffect(() => {
    closeOldDailySales();
  }, []);

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
            disabled={cart.length === 0 || !activeShift}
          >
            {!activeShift
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
                onClick={closeDailySales}
              >
                Yakunlash
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

              <button className="confirm-return-btn" onClick={handleReturn}>
                Vozvratni saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;
