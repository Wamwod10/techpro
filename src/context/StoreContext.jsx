import { createContext, useContext, useEffect, useState } from "react";
import { normalizeSaleReturns } from "../utils/returns";

const StoreContext = createContext();

export const StoreProvider = ({ children }) => {
  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem("techpro_inventory");

    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            sku: "TP-4821",
            name: "iPhone 15 Pro Case",
            category: "Chexol",
            quantity: 50,
            costPrice: 70000,
            sellPrice: 120000,
            supplier: "Mobile Market",
          },
          {
            id: 2,
            sku: "TP-1934",
            name: "AirPods Pro Case",
            category: "AirPods",
            quantity: 35,
            costPrice: 45000,
            sellPrice: 85000,
            supplier: "iStore",
          },
        ];
  });

  const [dailySales, setDailySales] = useState(() => {
    const saved = localStorage.getItem("techpro_daily_sales");

    return saved ? JSON.parse(saved).map(normalizeSaleReturns) : [];
  });

  const [salesHistory, setSalesHistory] = useState(() => {
    const saved = localStorage.getItem("techpro_sales_history");

    return saved
      ? JSON.parse(saved).map((day) => ({
          ...day,
          returnedTotal: Number(day.returnedTotal || 0),
          sales: (day.sales || []).map(normalizeSaleReturns),
        }))
      : [];
  });

  const [suppliers, setSuppliers] = useState(() => {
    const saved = localStorage.getItem("techpro_suppliers");

    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 1,
            name: "Mobile Market",
            debt: 4500000,
            transactions: [],
          },
          {
            id: 2,
            name: "iStore",
            debt: 2800000,
            transactions: [],
          },
        ];
  });

  const [activityLogs, setActivityLogs] = useState(() => {
    const saved = localStorage.getItem("techpro_activity_logs");

    return saved ? JSON.parse(saved) : [];
  });

  const addActivityLog = (log) => {
    const now = new Date();

    const newLog = {
      id: crypto.randomUUID(),
      type: log.type || "general",
      title: log.title || "Amal bajarildi",
      description: log.description || "",
      userName: log.userName || "Noma'lum foydalanuvchi",
      userRole: log.userRole || "unknown",
      date: now.toLocaleDateString("uz-UZ"),
      time: now.toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAt: now.toISOString(),
    };

    setActivityLogs((prevLogs) => [newLog, ...prevLogs].slice(0, 500));
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
    localStorage.setItem("techpro_suppliers", JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(
      "techpro_activity_logs",
      JSON.stringify(activityLogs),
    );
  }, [activityLogs]);

  return (
    <StoreContext.Provider
      value={{
        inventory,
        setInventory,

        dailySales,
        setDailySales,

        salesHistory,
        setSalesHistory,

        suppliers,
        setSuppliers,

        activityLogs,
        setActivityLogs,
        addActivityLog,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
