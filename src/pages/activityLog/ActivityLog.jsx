import { useState } from "react";
import {
  FiActivity,
  FiArchive,
  FiDollarSign,
  FiPackage,
  FiShoppingCart,
  FiTruck,
} from "react-icons/fi";

import { useStore } from "../../context/StoreContext";

import "./activityLog.scss";

const filterTabs = [
  { value: "all", label: "Barchasi" },
  { value: "product", label: "Mahsulot" },
  { value: "inventory", label: "Ombor" },
  { value: "sale", label: "Savdo" },
  { value: "return", label: "Vozvrat" },
  { value: "supplier", label: "Supplier" },
  { value: "price", label: "Narx" },
];

const typeLabels = {
  product: "Mahsulot",
  inventory: "Ombor",
  sale: "Savdo",
  return: "Vozvrat",
  supplier: "Supplier",
  price: "Narx",
  stock: "Qoldiq",
};

function ActivityLog() {
  const { activityLogs } = useStore();
  const [activeFilter, setActiveFilter] = useState("all");

  const today = new Date().toLocaleDateString("uz-UZ");

  const filteredLogs =
    activeFilter === "all"
      ? activityLogs
      : activityLogs.filter((log) => {
          if (activeFilter === "product") {
            return ["product", "stock"].includes(log.type);
          }

          if (activeFilter === "inventory") {
            return ["inventory", "stock"].includes(log.type);
          }

          return log.type === activeFilter;
        });

  const todayLogs = activityLogs.filter((log) => log.date === today);
  const productLogs = activityLogs.filter((log) =>
    ["product", "inventory", "price", "stock"].includes(log.type),
  );
  const supplierLogs = activityLogs.filter((log) => log.type === "supplier");

  const summaryCards = [
    {
      title: "Jami amallar",
      value: activityLogs.length,
      icon: <FiActivity />,
      className: "total",
    },
    {
      title: "Bugungi amallar",
      value: todayLogs.length,
      icon: <FiShoppingCart />,
      className: "today",
    },
    {
      title: "Mahsulot amallari",
      value: productLogs.length,
      icon: <FiPackage />,
      className: "product",
    },
    {
      title: "Supplier amallari",
      value: supplierLogs.length,
      icon: <FiTruck />,
      className: "supplier",
    },
  ];

  const getLogIcon = (type) => {
    if (type === "supplier") return <FiTruck />;
    if (type === "inventory" || type === "stock") return <FiArchive />;
    if (type === "price") return <FiDollarSign />;
    if (type === "sale" || type === "return") return <FiShoppingCart />;
    return <FiPackage />;
  };

  return (
    <div className="activity-log-page">
      <div className="activity-log-header">
        <div>
          <h1>Amallar tarixi</h1>
          <p>Tizimdagi muhim o'zgarishlar va faoliyat jurnali</p>
        </div>
      </div>

      <div className="activity-summary">
        {summaryCards.map((card) => (
          <div className={`activity-summary-card ${card.className}`} key={card.title}>
            <div className="activity-summary-icon">{card.icon}</div>

            <div>
              <span>{card.title}</span>
              <h2>{card.value}</h2>
            </div>
          </div>
        ))}
      </div>

      <div className="activity-panel">
        <div className="activity-filters">
          {filterTabs.map((tab) => (
            <button
              className={activeFilter === tab.value ? "active" : ""}
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="activity-timeline">
          {filteredLogs.length === 0 ? (
            <div className="activity-empty">
              <h2>Hali log mavjud emas</h2>
              <p>Muhim amallar bajarilganda shu yerda ko'rinadi</p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div className="activity-log-item" key={log.id}>
                <div className={`activity-node ${log.type}`}>
                  {getLogIcon(log.type)}
                </div>

                <div className="activity-log-card">
                  <div className="activity-log-top">
                    <div>
                      <h3>{log.title}</h3>
                      <p>{log.description}</p>
                    </div>

                    <span className={`activity-type-badge ${log.type}`}>
                      {typeLabels[log.type] || log.type}
                    </span>
                  </div>

                  <div className="activity-log-meta">
                    <span>
                      {log.userName} ·{" "}
                      {log.userRole === "admin" ? "Admin" : "Sotuvchi"}
                    </span>
                    <span>
                      {log.date} · {log.time}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityLog;
