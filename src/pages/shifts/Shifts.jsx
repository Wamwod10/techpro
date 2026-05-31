import { useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import {
  notifyShiftClose,
  notifyShiftOpen,
} from "../../services/telegramService";
import { formatPrice } from "../../utils/formatPrice";

import "./shifts.scss";

function Shifts() {
  const { currentUser } = useAuth();
  const { dailySales } = useStore();

  const [cashierName, setCashierName] = useState(currentUser?.name || "");
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");

  const [activeShift, setActiveShift] = useState(() => {
    const saved = localStorage.getItem("techpro_active_shift");
    return saved ? JSON.parse(saved) : null;
  });

  const [shiftHistory, setShiftHistory] = useState(() => {
    const saved = localStorage.getItem("techpro_shift_history");
    return saved ? JSON.parse(saved) : [];
  });

  const todaySales = dailySales.reduce(
    (acc, sale) => acc + Number(sale.total || 0),
    0,
  );

  const cashSales = dailySales
    .filter((sale) => sale.paymentMethod === "cash")
    .reduce((acc, sale) => acc + Number(sale.total || 0), 0);

  const cardSales = dailySales
    .filter((sale) => sale.paymentMethod === "card")
    .reduce((acc, sale) => acc + Number(sale.total || 0), 0);

  const transferSales = dailySales
    .filter((sale) => sale.paymentMethod === "transfer")
    .reduce((acc, sale) => acc + Number(sale.total || 0), 0);

  const openShift = () => {
    if (!cashierName || !openingCash) return;

    const newShift = {
      id: crypto.randomUUID(),
      cashierName,
      openedBy: currentUser?.name,
      openingCash: Number(openingCash),
      openedAt: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      openedAtISO: new Date().toISOString(),
      date: new Date().toLocaleDateString("uz-UZ"),
      status: "open",
    };

    localStorage.setItem("techpro_active_shift", JSON.stringify(newShift));
    setActiveShift(newShift);
    setOpeningCash("");
    void notifyShiftOpen(newShift);
  };

  const closeShift = () => {
    if (!activeShift || !closingCash) return;

    const openedDate = activeShift.openedAtISO
      ? new Date(activeShift.openedAtISO)
      : new Date();
    const closedDate = new Date();

    const durationMinutes = Math.max(
      0,
      Math.floor((closedDate - openedDate) / 1000 / 60),
    );

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    const shiftDuration =
      hours > 0 ? `${hours} soat ${minutes} daqiqa` : `${minutes} daqiqa`;

    const closedShift = {
      ...activeShift,
      status: "closed",
      closedAt: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      closedAtISO: closedDate.toISOString(),
      closingCash: Number(closingCash),
      totalSales: todaySales,
      cashSales,
      cardSales,
      transferSales,
      transactions: dailySales.length,
      duration: shiftDuration,
      cashDifference:
        Number(closingCash) -
        (Number(activeShift.openingCash || 0) + cashSales),
    };

    const updatedHistory = [closedShift, ...shiftHistory];

    localStorage.setItem(
      "techpro_shift_history",
      JSON.stringify(updatedHistory),
    );
    localStorage.removeItem("techpro_active_shift");

    setShiftHistory(updatedHistory);
    setActiveShift(null);
    setClosingCash("");
    void notifyShiftClose(closedShift);
  };

  return (
    <div className="shifts-page">
      <div className="shifts-header">
        <div>
          <h1>Kassa / Shift</h1>
          <p>Kassani ochish, yopish va smena nazorati</p>
        </div>

        <div className={`shift-status ${activeShift ? "open" : "closed"}`}>
          {activeShift ? "Shift ochiq" : "Shift yopiq"}
        </div>
      </div>

      <div className="shift-summary">
        <div className="shift-card">
          <span>Bugungi savdo</span>
          <h2>{formatPrice(todaySales)}</h2>
        </div>

        <div className="shift-card">
          <span>Naqd savdo</span>
          <h2>{formatPrice(cashSales)}</h2>
        </div>

        <div className="shift-card">
          <span>Karta</span>
          <h2>{formatPrice(cardSales)}</h2>
        </div>

        <div className="shift-card">
          <span>O‘tkazma</span>
          <h2>{formatPrice(transferSales)}</h2>
        </div>
      </div>

      {!activeShift ? (
        <div className="shift-panel">
          <h3>Shift ochish</h3>

          <div className="shift-form">
            <input
              type="text"
              placeholder="Kassir ismi"
              value={cashierName}
              onChange={(e) => setCashierName(e.target.value)}
            />

            <input
              type="number"
              placeholder="Boshlang‘ich kassa"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />

            <button onClick={openShift}>Shiftni ochish</button>
          </div>
        </div>
      ) : (
        <div className="shift-panel">
          <h3>Shift yopish</h3>

          <div className="active-shift-info">
            <div>
              <span>Kassir</span>
              <strong>{activeShift.cashierName}</strong>
            </div>

            <div>
              <span>Ochilgan vaqt</span>
              <strong>{activeShift.openedAt}</strong>
            </div>

            <div>
              <span>Boshlang‘ich kassa</span>
              <strong>{formatPrice(activeShift.openingCash)}</strong>
            </div>
          </div>

          <div className="shift-form close">
            <input
              type="number"
              placeholder="Yakuniy kassa"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
            />

            <button onClick={closeShift}>Shiftni yopish</button>
          </div>
        </div>
      )}

      <div className="shift-history">
        <h3>Shift tarixi</h3>

        {shiftHistory.length === 0 ? (
          <p className="empty-text">Hali yopilgan shiftlar yo‘q</p>
        ) : (
          shiftHistory.map((shift) => (
            <div className="shift-history-card" key={shift.id}>
              <div>
                <strong>{shift.cashierName}</strong>
                <span>
                  {shift.date} • {shift.openedAt} - {shift.closedAt}
                </span>
              </div>

              <div>
                <span>Jami savdo</span>
                <strong>{formatPrice(shift.totalSales)}</strong>
              </div>

              <div>
                <span>Yakuniy kassa</span>
                <strong>{formatPrice(shift.closingCash)}</strong>
              </div>

              <div className="shift-duration-badge">
                🕒 {shift.duration || "Hisoblanmagan"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Shifts;
