import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { Outlet, NavLink, useNavigate } from "react-router-dom";

import {
  FiGrid,
  FiShoppingCart,
  FiPackage,
  FiArchive,
  FiTruck,
  FiSearch,
  FiBell,
  FiCalendar,
  FiClock,
  FiCreditCard,
  FiLock,
  FiBarChart2,
  FiMoon,
  FiSun,
  FiUserCheck,
  FiActivity,
  FiMenu,
  FiX,
  FiBriefcase,
  FiMapPin,
  FiChevronDown,
  FiCheck,
} from "react-icons/fi";

import "./mainlayout.scss";
import { isLowStock } from "../utils/stock";

function MainLayout() {
  const {
    inventory,
    loading,
    error,
    stores,
    currentStore,
    currentStoreId,
    setSelectedStoreId,
  } = useStore();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showStoreMenu, setShowStoreMenu] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("techpro_theme") || "light";
  });

  const isDarkMode = theme === "dark";

  useEffect(() => {
    document.body.classList.toggle("dark-mode", isDarkMode);
    localStorage.setItem("techpro_theme", theme);
  }, [isDarkMode, theme]);

  useEffect(() => {
    if (!isSidebarOpen) {
      document.body.classList.remove("sidebar-open");
      return undefined;
    }

    const scrollY = window.scrollY;

    document.body.dataset.sidebarScrollY = String(scrollY);
    document.body.classList.add("sidebar-open");
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    return () => {
      const savedScrollY = Number(document.body.dataset.sidebarScrollY || 0);

      document.body.classList.remove("sidebar-open");
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      delete document.body.dataset.sidebarScrollY;
      window.scrollTo(0, savedScrollY);
    };
  }, [isSidebarOpen]);

  const searchResults = inventory
    .filter((product) => {
      const value = headerSearch.toLowerCase();

      return (
        String(product.name || "").toLowerCase().includes(value) ||
        String(product.sku || "").toLowerCase().includes(value)
      );
    })
    .slice(0, 5);

  const outOfStockProducts = inventory.filter(
    (product) => Number(product.quantity || 0) <= 0,
  );
  const lowStockProducts = inventory.filter((product) =>
    isLowStock(product.quantity),
  );

  const notifications = [
    ...outOfStockProducts.map((product) => ({
      id: `out-${product.id}`,
      title: "Mahsulot tugagan",
      text: `${product.name} omborda 0 dona qoldi`,
      type: "danger",
    })),
    ...lowStockProducts.map((product) => ({
      id: `low-${product.id}`,
      title: "Kam qolgan mahsulot",
      text: `${product.name} omborda ${product.quantity} dona qoldi`,
      type: "warning",
    })),
  ];

  const months = [
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "Iyun",
    "Iyul",
    "Avgust",
    "Sentabr",
    "Oktabr",
    "Noyabr",
    "Dekabr",
  ];

  const today = new Date();
  const formattedDate = `${today.getDate()} ${
    months[today.getMonth()]
  }, ${today.getFullYear()}`;

  const { currentUser, logout } = useAuth();
  const activeStoreName = currentStore?.name || currentStoreId;

  const menuItems = [
    {
      title: "Boshqaruv Paneli",
      path: "/",
      icon: <FiGrid />,
      roles: ["admin"],
    },
    {
      title: "Kassa / Shift",
      path: "/shifts",
      icon: <FiBriefcase />,
      roles: ["admin", "cashier"],
    },
    {
      title: "Savdo",
      path: "/sales",
      icon: <FiShoppingCart />,
      roles: ["admin", "cashier"],
    },
    {
      title: "Savdo tarixi",
      path: "/history",
      icon: <FiClock />,
      roles: ["admin", "cashier"],
    },
    {
      title: "Mahsulotlar",
      path: "/products",
      icon: <FiPackage />,
      roles: ["admin", "cashier"],
    },
    {
      title: "Ombor",
      path: "/inventory",
      icon: <FiArchive />,
      roles: ["admin"],
    },
    {
      title: "Ta’minotchilar",
      path: "/suppliers",
      icon: <FiTruck />,
      roles: ["admin"],
    },
    {
      title: "Xarajatlar",
      path: "/expenses",
      icon: <FiCreditCard />,
      roles: ["admin"],
    },
    {
      title: "Analitika",
      path: "/analytics",
      icon: <FiBarChart2 />,
      roles: ["admin"],
    },
    {
      title: "Amallar tarixi",
      path: "/activity-log",
      icon: <FiActivity />,
      roles: ["admin"],
    },
    {
      title: "Sotuvchi tahlili",
      path: "/seller-analytics",
      icon: <FiUserCheck />,
      roles: ["admin", "cashier"],
    },
  ];
  return (
    <div className={`layout ${isSidebarOpen ? "sidebar-open" : ""}`}>
      <aside className="sidebar">
        <div className="logo">
          <img src="/1.png" alt="TechPro logo" />
          <span>TECHPRO</span>
        </div>

        <button
          className="sidebar-close"
          type="button"
          aria-label="Menyuni yopish"
          onClick={() => setIsSidebarOpen(false)}
        >
          <FiX />
        </button>

        <nav className="menu">
          {menuItems.map((item) => {
            const isAllowed = item.roles.includes(currentUser?.role);

            if (!isAllowed) {
              return (
                <div className="menu-item locked" key={item.path}>
                  {item.icon}

                  <span>{item.title}</span>

                  <FiLock className="lock-icon" />
                </div>
              );
            }

            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setIsSidebarOpen(false)}
                className={({ isActive }) =>
                  isActive ? "menu-item active" : "menu-item"
                }
              >
                {item.icon}

                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <button
        className="sidebar-backdrop"
        type="button"
        aria-label="Menyuni yopish"
        onClick={() => setIsSidebarOpen(false)}
      />

      <div className="main">
        <header className="header">
          <button
            className="menu-toggle"
            type="button"
            aria-label="Menyuni ochish"
            onClick={() => setIsSidebarOpen(true)}
          >
            <FiMenu />
          </button>

          <div className="search-box">
            <FiSearch />

            <input
              type="text"
              placeholder="Mahsulot qidirish..."
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
            />

            {headerSearch && (
              <div className="search-dropdown">
                {searchResults.length === 0 ? (
                  <div className="search-empty">Mahsulot topilmadi</div>
                ) : (
                  searchResults.map((product) => (
                    <div
                      className="search-result-item"
                      key={product.id}
                      onClick={() => {
                        navigate("/products");
                        setHeaderSearch("");
                      }}
                    >
                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.sku}</span>
                      </div>

                      <p>{product.quantity} dona</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="header-right">
            {currentUser?.role === "admin" && (
              <div
                className={`store-selector ${showStoreMenu ? "is-open" : ""}`}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setShowStoreMenu(false);
                  }
                }}
              >
                <button
                  className="store-selector-trigger"
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={showStoreMenu}
                  onClick={() => setShowStoreMenu((value) => !value)}
                >
                  <span className="store-selector-label">
                    <FiMapPin />
                    Do'kon tanlash
                  </span>

                  <strong>{activeStoreName}</strong>
                  <FiChevronDown className="store-selector-chevron" />
                </button>

                {showStoreMenu && (
                  <div className="store-selector-menu" role="listbox">
                    {stores.map((store) => {
                      const isActive = store.id === currentStoreId;

                      return (
                        <button
                          key={store.id}
                          className={isActive ? "active" : ""}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => {
                            setSelectedStoreId(store.id);
                            setShowStoreMenu(false);
                          }}
                        >
                          <span>{store.name}</span>
                          {isActive && <FiCheck />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              className="theme-toggle"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              type="button"
              aria-label={isDarkMode ? "Light mode" : "Dark mode"}
            >
              {isDarkMode ? <FiSun /> : <FiMoon />}
            </button>

            <div className="header-date">
              <FiCalendar />
              <span>{formattedDate}</span>
            </div>

            <div
              className="notification"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <FiBell />

              {notifications.length > 0 && (
                <span className="notification-count">
                  {notifications.length}
                </span>
              )}

              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header">
                    <h4>Bildirishnomalar</h4>
                    <span>{notifications.length} ta</span>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="notification-empty">Bildirishnoma yo‘q</div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        className={`notification-item ${item.type}`}
                        key={item.id}
                      >
                        <h4>{item.title}</h4>
                        <p>{item.text}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="profile">
              <div className="avatar">{currentUser?.name?.charAt(0)}</div>

              <div className="profile-info">
                <h4>{currentUser?.name}</h4>
                <p>
                  {currentUser?.role === "admin"
                    ? `Admin - ${activeStoreName}`
                    : "Sotuvchi"}
                </p>
              </div>
            </div>

            <button className="logout-btn" onClick={logout}>
              Chiqish
            </button>
          </div>
        </header>

        <div className="content">
          {loading && <div className="page-state-banner">Yuklanmoqda...</div>}
          {error && <div className="page-state-banner error">{error}</div>}
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
