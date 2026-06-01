import { useState } from "react";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";

import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import { formatPrice } from "../../utils/formatPrice";
import {
  notifyDailyReport,
} from "../../services/telegramService";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiFlow";
import {
  RETURN_REASONS,
  applyReturnToHistory,
  buildReturnRecord,
  getDayNetTotal,
  getAvailableReturnQty,
  getSaleNetTotal,
  increaseInventoryQuantity,
} from "../../utils/returns";

import "./history.scss";

function History() {
  const { currentUser } = useAuth();
  const {
    salesHistory,
    setSalesHistory,
    inventory,
    setInventory,
    returns,
    setReturns,
    addActivityLog,
  } = useStore();
  const [expandedDay, setExpandedDay] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [permissionModal, setPermissionModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedReturnItem, setSelectedReturnItem] = useState(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState("");
  const [returnSaving, setReturnSaving] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const paymentLabels = {
    cash: "Naqd",
    card: "Karta",
    transfer: "O'tkazma",
  };

  const normalizeDate = (date) => {
    if (!date) return "";

    const dateValue = String(date);

    if (dateValue.includes("-")) {
      return dateValue;
    }

    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
      return "";
    }

    return `${parsedDate.getFullYear()}-${String(
      parsedDate.getMonth() + 1,
    ).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
  };

  const getDayPaymentTotal = (day, paymentMethod) => {
    const savedTotal = Number(day[paymentMethod] || 0);

    if (!day.sales?.length) {
      return savedTotal;
    }

    return day.sales
      .filter((sale) => sale.paymentMethod === paymentMethod)
      .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);
  };

  const saleMatchesSearch = (day, sale) => {
    const value = search.trim().toLowerCase();

    if (!value) return true;

    const dayDate = String(day.date || "").toLowerCase();
    const normalizedDate = normalizeDate(day.dateISO || day.date).toLowerCase();
    const paymentText = String(
      paymentLabels[sale.paymentMethod] || "",
    ).toLowerCase();

    return (
      dayDate.includes(value) ||
      normalizedDate.includes(value) ||
      String(sale.time || "")
        .toLowerCase()
        .includes(value) ||
      String(getSaleNetTotal(sale)).includes(value) ||
      paymentText.includes(value) ||
      (sale.items || []).some((product) =>
        String(product.name || "")
          .toLowerCase()
          .includes(value),
      )
    );
  };

  const filteredHistory = salesHistory
    .filter((day) => {
      const dayDate = normalizeDate(day.dateISO || day.date);

      if (filterMode === "day" && selectedDate) {
        return dayDate === selectedDate;
      }

      if (filterMode === "month" && selectedMonth) {
        return dayDate.startsWith(selectedMonth);
      }

      return true;
    })
    .map((day) => {
      const daySales = day.sales || [];
      const visibleSales = daySales.filter(
        (sale) =>
          (filterType === "all" || sale.paymentMethod === filterType) &&
          saleMatchesSearch(day, sale),
      );

      const getVisiblePaymentTotal = (paymentMethod) => {
        if (!daySales.length) {
          return getDayPaymentTotal(day, paymentMethod);
        }

        return visibleSales
          .filter((sale) => sale.paymentMethod === paymentMethod)
          .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);
      };

      const fallbackTotal =
        filterType === "all"
          ? getDayNetTotal(day)
          : getDayPaymentTotal(day, filterType);

      const visibleTotal = daySales.length
        ? visibleSales.reduce((acc, sale) => acc + getSaleNetTotal(sale), 0)
        : fallbackTotal;

      const visibleCount = daySales.length
        ? visibleSales.length
        : Number(day.count || 0);

      const hasFallbackData =
        !daySales.length &&
        (!search.trim() ||
          String(day.date || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase())) &&
        visibleTotal > 0;

      return {
        ...day,
        visibleSales,
        visibleTotal,
        visibleCash: getVisiblePaymentTotal("cash"),
        visibleCard: getVisiblePaymentTotal("card"),
        visibleTransfer: getVisiblePaymentTotal("transfer"),
        visibleCount,
        hasVisibleData: visibleSales.length > 0 || hasFallbackData,
      };
    })
    .filter((day) => day.hasVisibleData);

  const totalRevenue = filteredHistory.reduce(
    (acc, day) => acc + Number(day.visibleTotal || 0),
    0,
  );

  const totalCash = filteredHistory.reduce(
    (acc, day) => acc + Number(day.visibleCash || 0),
    0,
  );

  const totalCard = filteredHistory.reduce(
    (acc, day) => acc + Number(day.visibleCard || 0),
    0,
  );

  const totalTransfer = filteredHistory.reduce(
    (acc, day) => acc + Number(day.visibleTransfer || 0),
    0,
  );

  const totalCount = filteredHistory.reduce(
    (acc, day) => acc + Number(day.visibleCount || 0),
    0,
  );

  const averageCheck = totalCount > 0 ? totalRevenue / totalCount : 0;

  const returnMatchesSearch = (item) => {
    const value = search.trim().toLowerCase();

    if (!value) return true;

    const paymentText = String(
      paymentLabels[item.paymentMethod] || "",
    ).toLowerCase();

    return (
      String(item.productName || "")
        .toLowerCase()
        .includes(value) ||
      String(item.sku || "")
        .toLowerCase()
        .includes(value) ||
      String(item.reason || "")
        .toLowerCase()
        .includes(value) ||
      String(item.sellerName || "")
        .toLowerCase()
        .includes(value) ||
      String(item.date || "")
        .toLowerCase()
        .includes(value) ||
      String(item.dateISO || "")
        .toLowerCase()
        .includes(value) ||
      String(item.amount || "").includes(value) ||
      paymentText.includes(value)
    );
  };

  const filteredReturns = returns.filter((item) => {
    const returnDate = normalizeDate(item.dateISO || item.date);

    if (filterMode === "day" && selectedDate && returnDate !== selectedDate) {
      return false;
    }

    if (
      filterMode === "month" &&
      selectedMonth &&
      !returnDate.startsWith(selectedMonth)
    ) {
      return false;
    }

    if (filterType !== "all" && item.paymentMethod !== filterType) {
      return false;
    }

    return returnMatchesSearch(item);
  });

  const totalReturnAmount = filteredReturns.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0,
  );

  const totalReturnQuantity = filteredReturns.reduce(
    (acc, item) => acc + Number(item.quantity || 0),
    0,
  );

  const openReturnPermission = (sale, day) => {
    setSelectedSale(sale);
    setSelectedDay(day);
    setSelectedReturnItem(null);
    setReturnQty(1);
    setReturnReason("");
    setPermissionModal(true);
  };

  const openReturnModal = () => {
    setPermissionModal(false);
    setReturnModal(true);
  };

  const sendDailyReportToTelegram = async (day) => {
    await notifyDailyReport({
      date: day.date,
      total: getDayNetTotal(day),
      cash: getDayPaymentTotal(day, "cash"),
      card: getDayPaymentTotal(day, "card"),
      transfer: getDayPaymentTotal(day, "transfer"),
      count: day.sales?.length ? day.sales.length : Number(day.count || 0),
      closedBy: day.closedBy || currentUser?.name,
    });

    setHistoryError("");
  };

  const handleReturn = async () => {
    if (
      returnSaving ||
      !selectedSale ||
      !selectedDay ||
      !selectedReturnItem ||
      !returnReason
    ) {
      return;
    }

    setReturnSaving(true);
    setHistoryError("");

    const dayId = selectedDay.id || selectedDay.date;
    const returnResult = applyReturnToHistory(
      salesHistory,
      dayId,
      selectedSale.id,
      selectedReturnItem.productId || selectedReturnItem.id,
      returnQty,
    );

    if (returnResult.quantity <= 0 || !returnResult.returnedItem) {
      setReturnSaving(false);
      return;
    }

    const optimisticReturn = buildReturnRecord({
      sale: selectedSale,
      item: returnResult.returnedItem,
      quantity: returnResult.quantity,
      amount: returnResult.amount,
      reason: returnReason,
      seller: currentUser,
    });
    const nextInventory = increaseInventoryQuantity(
      inventory,
      selectedReturnItem.productId || selectedReturnItem.id,
      returnResult.quantity,
    );

    setReturns([optimisticReturn, ...returns]);
    setInventory(nextInventory);
    setSalesHistory(returnResult.history);

    try {
      const { data } = await api.post("/returns", {
        saleId: selectedSale.id,
        productId: selectedReturnItem.productId || selectedReturnItem.id,
        quantity: returnResult.quantity,
        reason: returnReason,
      });
      setReturns((current) =>
        current.map((item) => (item.id === optimisticReturn.id ? data : item)),
      );
    } catch (error) {
      setReturns(returns);
      setInventory(inventory);
      setSalesHistory(salesHistory);
      setHistoryError(
        getApiErrorMessage(error, "Vozvratni saqlashda xatolik"),
      );
      setReturnSaving(false);
      return;
    } finally {
      setReturnSaving(false);
    }

    addActivityLog({
      type: "return",
      title: "Vozvrat qilindi",
      description: `${returnResult.returnedItem.name} vozvrat qilindi: ${returnResult.quantity} dona`,
      userName: currentUser?.name,
      userRole: currentUser?.role,
    });

    setReturnModal(false);
    setSelectedSale(null);
    setSelectedDay(null);
    setSelectedReturnItem(null);
    setReturnQty(1);
    setReturnReason("");
  };

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1>Savdo tarixi</h1>
          <p>Yakunlangan kunlik savdolar</p>
        </div>

        <div className="history-date-filter">
          <button
            className={filterMode === "all" ? "active" : ""}
            onClick={() => setFilterMode("all")}
            type="button"
          >
            Hammasi
          </button>

          <button
            className={filterMode === "day" ? "active" : ""}
            onClick={() => setFilterMode("day")}
            type="button"
          >
            Kun
          </button>

          <button
            className={filterMode === "month" ? "active" : ""}
            onClick={() => setFilterMode("month")}
            type="button"
          >
            Oy
          </button>

          {filterMode === "day" && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          )}

          {filterMode === "month" && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="history-summary">
        <div className="history-summary-card">
          <span>Jami savdo</span>
          <h2>{formatPrice(totalRevenue)}</h2>
        </div>

        <div className="history-summary-card">
          <span>Naqd</span>
          <h2>{formatPrice(totalCash)}</h2>
        </div>

        <div className="history-summary-card">
          <span>Karta</span>
          <h2>{formatPrice(totalCard)}</h2>
        </div>

        <div className="history-summary-card">
          <span>O'tkazma</span>
          <h2>{formatPrice(totalTransfer)}</h2>
        </div>

        <div className="history-summary-card">
          <span>Savdolar soni</span>
          <h2>{totalCount}</h2>
        </div>

        <div className="history-summary-card">
          <span>O'rtacha chek</span>
          <h2>{formatPrice(Math.floor(averageCheck))}</h2>
        </div>

        <div className="history-summary-card return">
          <span>Vozvrat summasi</span>
          <h2>{formatPrice(totalReturnAmount)}</h2>
        </div>

        <div className="history-summary-card return">
          <span>Vozvrat soni</span>
          <h2>{totalReturnQuantity}</h2>
        </div>
      </div>

      <div className="history-toolbar">
        {historyError && <div className="form-error">{historyError}</div>}

        <div className="history-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Sana, mahsulot yoki to'lov turi bo'yicha qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="history-filters">
          <button
            className={filterType === "all" ? "active" : ""}
            onClick={() => setFilterType("all")}
            type="button"
          >
            Barchasi
          </button>

          <button
            className={filterType === "cash" ? "active cash" : ""}
            onClick={() => setFilterType("cash")}
            type="button"
          >
            Naqd
          </button>

          <button
            className={filterType === "card" ? "active card" : ""}
            onClick={() => setFilterType("card")}
            type="button"
          >
            Karta
          </button>

          <button
            className={filterType === "transfer" ? "active transfer" : ""}
            onClick={() => setFilterType("transfer")}
            type="button"
          >
            O'tkazma
          </button>
        </div>
      </div>

      <div className="history-grid">
        {filteredHistory.length === 0 ? (
          <div className="empty-history">
            <h2>Tarix mavjud emas</h2>
            <p>Yakunlangan savdolar shu yerda ko'rinadi</p>
          </div>
        ) : (
          filteredHistory.map((day) => {
            const dayKey = day.id || day.date;

            return (
              <div className="history-card" key={dayKey}>
                <div className="history-top">
                  <div>
                    <span>Sana</span>
                    <h3>{day.date}</h3>
                  </div>

                  <div className="history-top-actions">
                    <div className="history-badge">{day.visibleCount} savdo</div>

                    <button
                      className="history-telegram-btn"
                      onClick={() => sendDailyReportToTelegram(day)}
                      type="button"
                    >
                      Telegram
                    </button>

                    <button
                      className="expand-btn"
                      onClick={() =>
                        setExpandedDay(expandedDay === dayKey ? null : dayKey)
                      }
                      type="button"
                    >
                      {expandedDay === dayKey ? (
                        <FiChevronUp />
                      ) : (
                        <FiChevronDown />
                      )}
                    </button>
                  </div>
                </div>

                <div className="history-stats">
                  <div>
                    <span>Naqd</span>
                    <strong>{formatPrice(day.visibleCash)}</strong>
                  </div>

                  <div>
                    <span>Karta</span>
                    <strong>{formatPrice(day.visibleCard)}</strong>
                  </div>

                  <div>
                    <span>O'tkazma</span>
                    <strong>{formatPrice(day.visibleTransfer)}</strong>
                  </div>
                </div>

                <div className="history-total">
                  <span>Jami</span>
                  <h2>{formatPrice(day.visibleTotal)}</h2>
                </div>

                {expandedDay === dayKey && (
                  <div className="history-sales-list">
                    <h4>Cheklar</h4>

                    {day.visibleSales.length === 0 ? (
                      <p className="history-sale-empty">Cheklar mavjud emas</p>
                    ) : (
                      day.visibleSales.map((sale) => (
                        <div className="history-sale-item" key={sale.id}>
                          <div className="history-sale-top">
                            <div>
                              <strong>{formatPrice(getSaleNetTotal(sale))}</strong>
                              <span>{sale.time}</span>
                            </div>

                            <div
                              className={`payment-badge ${sale.paymentMethod}`}
                            >
                              {paymentLabels[sale.paymentMethod] || "Noma'lum"}
                            </div>
                          </div>

                          <div className="history-sale-products">
                            {(sale.items || []).map((product) => (
                              <div key={product.id}>
                                <span>
                                  {product.name}

                                  {product.returnedQty > 0 && (
                                    <strong className="returned-badge">
                                      Vozvrat: {product.returnedQty}
                                    </strong>
                                  )}
                                  <small>
                                    {getAvailableReturnQty(product)} dona
                                    qaytarish mumkin
                                  </small>
                                </span>

                                <strong>× {product.quantity}</strong>
                              </div>
                            ))}
                          </div>
                          <button
                            className="history-return-btn"
                            disabled={
                              !sale.items?.some(
                                (product) =>
                                  getAvailableReturnQty(product) > 0,
                              )
                            }
                            onClick={() => openReturnPermission(sale, day)}
                          >
                            Vozvrat
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="returns-history-section">
        <div className="returns-history-header">
          <div>
            <h2>Vozvrat tarixi</h2>
            <p>Qaytarilgan mahsulotlar ro'yxati</p>
          </div>

          <div className="returns-history-total">
            <span>{filteredReturns.length} ta yozuv</span>
            <strong>{formatPrice(totalReturnAmount)}</strong>
          </div>
        </div>

        <div className="returns-history-list">
          {filteredReturns.length === 0 ? (
            <div className="returns-empty">
              Vozvrat qilingan mahsulotlar mavjud emas
            </div>
          ) : (
            filteredReturns.map((item) => (
              <div className="return-history-card" key={item.id}>
                <div className="return-history-main">
                  <div>
                    <h3>{item.productName}</h3>
                    <span>{item.sku || "SKU yo'q"}</span>
                  </div>

                  <div className="return-history-amount">
                    <strong>{formatPrice(item.amount)}</strong>
                    <span>{item.quantity} dona</span>
                  </div>
                </div>

                <div className="return-history-meta">
                  <span>{item.reason}</span>
                  <span>{paymentLabels[item.paymentMethod] || "Noma'lum"}</span>
                  <span>{item.sellerName || "Sotuvchi ko'rsatilmagan"}</span>
                  <span>
                    {item.date} • {item.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
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
              {(selectedSale.items || []).map((item) => {
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
                    max={
                      getAvailableReturnQty(selectedReturnItem)
                    }
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
                  setSelectedDay(null);
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

export default History;
