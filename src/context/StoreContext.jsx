import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import api, { SELECTED_STORE_STORAGE_KEY } from "../services/api";
import { useAuth } from "./AuthContext";
import { normalizeSaleReturns } from "../utils/returns";

const StoreContext = createContext();
const DEFAULT_STORE_ID = "dokon-1";
const DEFAULT_STORES = [
  { id: "dokon-1", name: "dokon-1" },
  { id: "dokon-2", name: "dokon-2" },
];

const normalizeHistory = (history = []) =>
  history.map((day) => ({
    ...day,
    returnedTotal: Number(day.returnedTotal || 0),
    sales: (day.sales || []).map(normalizeSaleReturns),
  }));

const normalizeInventory = (items = []) =>
  items
    .filter((item) => !item?.isDeleted)
    .map((item) => ({
      ...item,
      quantity: Number(item.quantity ?? item.stock ?? 0),
      sellPrice: Number(item.sellPrice ?? item.price ?? 0),
    }));

const getStoreErrorMessage = (err) => {
  const message = err.response?.data?.message || err.message || "";

  if (
    message.toLowerCase().includes("column") ||
    message.toLowerCase().includes("migration")
  ) {
    return "Server database migration to'liq apply qilinmagan. Iltimos, Render loglarini tekshiring.";
  }

  return message || "Serverdan ma'lumot olishda xatolik";
};

export const StoreProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [stores, setStores] = useState(DEFAULT_STORES);
  const [selectedStoreId, setSelectedStoreIdState] = useState(() => {
    return localStorage.getItem(SELECTED_STORE_STORAGE_KEY) || DEFAULT_STORE_ID;
  });
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

  const isAdmin = currentUser?.role === "admin";
  const currentStoreId = isAdmin
    ? selectedStoreId || DEFAULT_STORE_ID
    : currentUser?.storeId || DEFAULT_STORE_ID;
  const currentStore = useMemo(
    () =>
      stores.find((store) => store.id === currentStoreId) || {
        id: currentStoreId,
        name: currentStoreId,
      },
    [currentStoreId, stores],
  );

  const clearStoreData = useCallback(() => {
    setInventoryState([]);
    setDailySalesState([]);
    setSalesHistoryState([]);
    setSuppliersState([]);
    setExpensesState([]);
    setReturnsState([]);
    setActiveShift(null);
    setShiftHistory([]);
    setActivityLogsState([]);
    setTelegramSettingsState(null);
  }, []);

  const setSelectedStoreId = useCallback(
    (storeId) => {
      if (!isAdmin || !storeId) return;

      localStorage.setItem(SELECTED_STORE_STORAGE_KEY, storeId);
      setSelectedStoreIdState(storeId);
    },
    [isAdmin],
  );

  const loadStore = useCallback(async () => {
    if (!currentUser || !currentStoreId) return;

    clearStoreData();
    setLoading(true);
    setError("");

    try {
      const { data } = await api.get("/bootstrap", {
        params: { includeHistory: false },
      });

      setStores(data.stores?.length ? data.stores : DEFAULT_STORES);
      setInventoryState(normalizeInventory(data.inventory || []));
      setDailySalesState((data.dailySales || []).map(normalizeSaleReturns));
      setSalesHistoryState(normalizeHistory(data.salesHistory || []));
      setSuppliersState(data.suppliers || []);
      setExpensesState(data.expenses || []);
      setReturnsState(data.returns || []);
      setActiveShift(data.activeShift || null);
      setShiftHistory(data.shiftHistory || []);
      setActivityLogsState(data.activityLogs || []);
      setTelegramSettingsState(data.telegramSettings || null);

      void api
        .get("/sales/history")
        .then(({ data: history }) => {
          setSalesHistoryState(normalizeHistory(history || []));
        })
        .catch(() => {
          // Core store data is already usable; history can be retried manually.
        });
    } catch (err) {
      setError(getStoreErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [clearStoreData, currentStoreId, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      clearStoreData();
      setLoading(false);
      setError("");
      return;
    }

    if (currentUser.role !== "admin") {
      localStorage.removeItem(SELECTED_STORE_STORAGE_KEY);
    }

    loadStore();
  }, [clearStoreData, currentUser, loadStore]);

  const setInventory = (updater) => {
    setInventoryState((previous) => {
      const next =
        typeof updater === "function" ? updater(previous) : updater || [];

      return normalizeInventory(next);
    });
  };

  const setDailySales = (updater) => {
    setDailySalesState((previous) =>
      (typeof updater === "function" ? updater(previous) : updater || []).map(
        normalizeSaleReturns,
      ),
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
      stores,
      currentStore,
      currentStoreId,
      selectedStoreId,
      setSelectedStoreId,
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
      stores,
      currentStore,
      currentStoreId,
      selectedStoreId,
      setSelectedStoreId,
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
