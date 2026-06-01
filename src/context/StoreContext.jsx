import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api from "../services/api";
import { normalizeSaleReturns } from "../utils/returns";

const StoreContext = createContext();

const normalizeHistory = (history = []) =>
  history.map((day) => ({
    ...day,
    returnedTotal: Number(day.returnedTotal || 0),
    sales: (day.sales || []).map(normalizeSaleReturns),
  }));

export const StoreProvider = ({ children }) => {
  const [inventory, setInventoryState] = useState([]);
  const [dailySales, setDailySalesState] = useState([]);
  const [salesHistory, setSalesHistoryState] = useState([]);
  const [suppliers, setSuppliersState] = useState([]);
  const [expenses, setExpensesState] = useState([]);
  const [returns, setReturnsState] = useState([]);
  const [activeShift, setActiveShift] = useState(null);
  const [shiftHistory, setShiftHistory] = useState([]);
  const [activityLogs, setActivityLogsState] = useState([]);
  const [telegramSettings, setTelegramSettingsState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStore = useCallback(async () => {
    if (!localStorage.getItem("techpro_token")) return;

    setLoading(true);
    setError("");

    try {
      const { data } = await api.get("/bootstrap");

      setInventoryState(data.inventory || []);
      setDailySalesState((data.dailySales || []).map(normalizeSaleReturns));
      setSalesHistoryState(normalizeHistory(data.salesHistory || []));
      setSuppliersState(data.suppliers || []);
      setExpensesState(data.expenses || []);
      setReturnsState(data.returns || []);
      setActiveShift(data.activeShift || null);
      setShiftHistory(data.shiftHistory || []);
      setActivityLogsState(data.activityLogs || []);
      setTelegramSettingsState(data.telegramSettings || null);
    } catch (err) {
      setError(err.response?.data?.message || "Serverdan ma'lumot olishda xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStore();
  }, [loadStore]);

  const setInventory = (updater) => {
    setInventoryState((previous) => {
      const next =
        typeof updater === "function" ? updater(previous) : updater || [];

      return next;
    });
  };

  const setDailySales = (updater) => {
    setDailySalesState((previous) =>
      typeof updater === "function" ? updater(previous) : updater || [],
    );
  };

  const setSalesHistory = (updater) => {
    setSalesHistoryState((previous) =>
      normalizeHistory(
        typeof updater === "function" ? updater(previous) : updater || [],
      ),
    );
  };

  const setSuppliers = (updater) => {
    setSuppliersState((previous) =>
      typeof updater === "function" ? updater(previous) : updater || [],
    );
  };

  const setActivityLogs = (updater) => {
    setActivityLogsState((previous) =>
      typeof updater === "function" ? updater(previous) : updater || [],
    );
  };

  const addActivityLog = async (log) => {
    const fallbackLog = {
      id: crypto.randomUUID(),
      type: log.type || "general",
      title: log.title || "Amal bajarildi",
      description: log.description || "",
      userName: log.userName || "Noma'lum foydalanuvchi",
      userRole: log.userRole || "unknown",
      date: new Date().toLocaleDateString("uz-UZ"),
      time: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      createdAt: new Date().toISOString(),
    };

    setActivityLogsState((prevLogs) => [fallbackLog, ...prevLogs].slice(0, 500));

    try {
      const { data } = await api.post("/activity-logs", log);
      setActivityLogsState((prevLogs) =>
        [data, ...prevLogs.filter((item) => item.id !== fallbackLog.id)].slice(
          0,
          500,
        ),
      );
    } catch {
      // Optimistic log remains visible if the network is temporarily unavailable.
    }
  };

  const value = useMemo(
    () => ({
      inventory,
      setInventory,
      dailySales,
      setDailySales,
      salesHistory,
      setSalesHistory,
      suppliers,
      setSuppliers,
      expenses,
      setExpenses: setExpensesState,
      returns,
      setReturns: setReturnsState,
      activeShift,
      setActiveShift,
      shiftHistory,
      setShiftHistory,
      telegramSettings,
      setTelegramSettings: setTelegramSettingsState,
      activityLogs,
      setActivityLogs,
      addActivityLog,
      loading,
      error,
      reloadStore: loadStore,
    }),
    [
      inventory,
      dailySales,
      salesHistory,
      suppliers,
      expenses,
      returns,
      activeShift,
      shiftHistory,
      telegramSettings,
      activityLogs,
      loading,
      error,
      loadStore,
    ],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
