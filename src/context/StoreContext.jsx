import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api, {
  BOOTSTRAP_TIMEOUT,
  SELECTED_STORE_STORAGE_KEY,
  SERVER_WARMING_MESSAGE,
} from "../services/api";
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

const requestStoreConfig = (storeId, signal, config = {}) => ({
  ...config,
  signal,
  timeout: config.timeout || BOOTSTRAP_TIMEOUT,
  params: {
    ...(config.params || {}),
    storeId,
  },
});

const getStoreErrorMessage = (err) => {
  if (err.code === "ERR_CANCELED") {
    return "";
  }

  if (err.code === "ECONNABORTED") {
    return "Server javobi kechikyapti. Qayta urinib ko'ring yoki biroz kuting.";
  }

  const message = err.response?.data?.message || err.message || "";

  if (!err.response && message === "Network Error") {
    return "Serverga ulanish sekin. Render backend uyg'onayotgan bo'lishi mumkin.";
  }

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
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");
  const activeLoadRef = useRef({ id: 0, controller: null });

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

    activeLoadRef.current.controller?.abort();
    const controller = new AbortController();
    const requestId = activeLoadRef.current.id + 1;
    activeLoadRef.current = { id: requestId, controller };

    clearStoreData();
    setLoading(true);
    setLoadingMessage("Yuklanmoqda...");
    setError("");

    const coldStartTimer = window.setTimeout(() => {
      if (activeLoadRef.current.id === requestId && !controller.signal.aborted) {
        setLoadingMessage(SERVER_WARMING_MESSAGE);
      }
    }, 1500);

    const isCurrentRequest = () =>
      activeLoadRef.current.id === requestId && !controller.signal.aborted;

    try {
      const { data } = await api.get("/bootstrap", {
        ...requestStoreConfig(currentStoreId, controller.signal, {
          params: {
            includeHistory: false,
            includeBackground: false,
          },
        }),
      });

      if (!isCurrentRequest()) return;

      setStores(data.stores?.length ? data.stores : DEFAULT_STORES);
      setInventoryState(normalizeInventory(data.inventory || []));
      setDailySalesState((data.dailySales || []).map(normalizeSaleReturns));
      setActiveShift(data.activeShift || null);

      setLoading(false);
      setLoadingMessage("");

      const backgroundRequests = [
        api
          .get("/returns", requestStoreConfig(currentStoreId, controller.signal))
          .then(({ data: returnsData }) => {
            if (isCurrentRequest()) setReturnsState(returnsData || []);
          }),
        api
          .get("/shifts", requestStoreConfig(currentStoreId, controller.signal))
          .then(({ data: shiftsData }) => {
            if (!isCurrentRequest()) return;

            setShiftHistory(
              (shiftsData || []).filter((shift) => shift.status === "closed"),
            );
          }),
        api
          .get(
            "/sales/history",
            requestStoreConfig(currentStoreId, controller.signal),
          )
          .then(({ data: history }) => {
            if (isCurrentRequest()) {
              setSalesHistoryState(normalizeHistory(history || []));
            }
          }),
      ];

      if (isAdmin) {
        backgroundRequests.push(
          api
            .get(
              "/suppliers",
              requestStoreConfig(currentStoreId, controller.signal),
            )
            .then(({ data: suppliersData }) => {
              if (isCurrentRequest()) setSuppliersState(suppliersData || []);
            }),
          api
            .get(
              "/expenses",
              requestStoreConfig(currentStoreId, controller.signal),
            )
            .then(({ data: expensesData }) => {
              if (isCurrentRequest()) setExpensesState(expensesData || []);
            }),
          api
            .get(
              "/activity-logs",
              requestStoreConfig(currentStoreId, controller.signal),
            )
            .then(({ data: logsData }) => {
              if (isCurrentRequest()) setActivityLogsState(logsData || []);
            }),
          api
            .get(
              "/telegram/settings",
              requestStoreConfig(currentStoreId, controller.signal),
            )
            .then(({ data: settings }) => {
              if (isCurrentRequest()) setTelegramSettingsState(settings || null);
            }),
        );
      }

      void Promise.allSettled(backgroundRequests).then((results) => {
        if (!isCurrentRequest()) return;

        const failed = results.some(
          (result) =>
            result.status === "rejected" &&
            result.reason?.code !== "ERR_CANCELED",
        );

        if (failed) {
          setError(
            "Asosiy ma'lumotlar yuklandi. Qo'shimcha tarix yoki loglar sekin kelyapti.",
          );
        }
      });
    } catch (err) {
      if (isCurrentRequest()) {
        setError(getStoreErrorMessage(err));
      }
    } finally {
      window.clearTimeout(coldStartTimer);

      if (isCurrentRequest()) {
        setLoading(false);
        setLoadingMessage("");
      }
    }
  }, [clearStoreData, currentStoreId, currentUser, isAdmin]);

  useEffect(() => {
    if (!currentUser) {
      clearStoreData();
      setLoading(false);
      setLoadingMessage("");
      setError("");
      activeLoadRef.current.controller?.abort();
      return;
    }

    if (currentUser.role !== "admin") {
      localStorage.removeItem(SELECTED_STORE_STORAGE_KEY);
    }

    loadStore();

    return () => {
      activeLoadRef.current.controller?.abort();
    };
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
      loadingMessage,
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
      loadingMessage,
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
