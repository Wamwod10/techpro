import {
  FiDollarSign,
  FiShoppingBag,
  FiAlertTriangle,
  FiTruck,
  FiRefreshCcw,
} from "react-icons/fi";

import { useStore } from "../../context/StoreContext";

import { formatPrice } from "../../utils/formatPrice";
import {
  getDayNetTotal,
  getNetSoldQty,
  getSaleNetTotal,
  getSaleProfit,
} from "../../utils/returns";

import "./dashboard.scss";

function Dashboard() {
  const { inventory, dailySales, suppliers, salesHistory } = useStore();

  const expenses = JSON.parse(localStorage.getItem("techpro_expenses") || "[]");
  const returns = JSON.parse(localStorage.getItem("techpro_returns") || "[]");

  const totalReturns = returns.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0,
  );
  const totalReturnsCount = returns.length;

  const allSales = [
    ...dailySales,
    ...salesHistory.flatMap((day) => day.sales || []),
  ];

  const recentSoldProducts = allSales
    .flatMap((sale) =>
      (sale.items || []).map((item) => ({
        id: `${sale.id}-${item.id}`,
        productName: item.name,
        sku: item.sku,
        quantity: getNetSoldQty(item),
        price: Number(item.price || 0),
        total: Number(item.price || 0) * getNetSoldQty(item),
        paymentMethod: sale.paymentMethod,
        time: sale.time,
        date: sale.date,
      })),
    )
    .filter((item) => item.quantity > 0)
    .slice(0, 10);

  const totalSales = dailySales.reduce(
    (acc, sale) => acc + getSaleNetTotal(sale),
    0,
  );

  const cashSales = dailySales
    .filter((sale) => sale.paymentMethod === "cash")
    .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

  const cardSales = dailySales
    .filter((sale) => sale.paymentMethod === "card")
    .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

  const transferSales = dailySales
    .filter((sale) => sale.paymentMethod === "transfer")
    .reduce((acc, sale) => acc + getSaleNetTotal(sale), 0);

  const inventoryValue = inventory.reduce(
    (acc, item) => acc + item.sellPrice * item.quantity,
    0,
  );

  const lowStock = inventory.filter((item) => item.quantity < 15);

  const totalHistorySales = salesHistory.reduce(
    (acc, day) => acc + getDayNetTotal(day),
    0,
  );

  const historyTransactions = salesHistory.reduce(
    (acc, day) => acc + Number(day.count || 0),
    0,
  );

  const totalTransactions = historyTransactions + dailySales.length;

  const historyProfit = salesHistory.reduce(
    (acc, day) =>
      acc +
      (day.sales || []).reduce(
        (salesAcc, sale) => salesAcc + getSaleProfit(sale),
        0,
      ),
    0,
  );

  const dailyProfit = dailySales.reduce(
    (acc, sale) => acc + getSaleProfit(sale),
    0,
  );

  const totalExpenses = expenses.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0,
  );

  const totalRevenue = totalHistorySales + totalSales;

  const totalProfit = historyProfit + dailyProfit - totalExpenses;

  const rawProfitMargin =
    totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;

  const profitMargin = Math.max(0, Math.min(rawProfitMargin, 100));

  const averageCheck =
    totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const supplierDebt = suppliers.reduce(
    (acc, supplier) =>
      acc + (Number(supplier.debt || 0) - Number(supplier.paid || 0)),
    0,
  );

  const sortedHistory = [...salesHistory].sort(
    (a, b) => new Date(b.date) - new Date(a.date),
  );

  const latestDay = sortedHistory[0];
  const previousDay = sortedHistory[1];

  const latestRevenue = getDayNetTotal(latestDay);
  const previousRevenue = getDayNetTotal(previousDay);

  const salesGrowth =
    previousRevenue > 0
      ? Math.round(((latestRevenue - previousRevenue) / previousRevenue) * 100)
      : 0;

  const salesGrowthText =
    salesGrowth > 0 ? `+${salesGrowth}%` : `${salesGrowth}%`;

  const categoryProfitMap = {};

  for (const item of inventory) {
    const category = item.category || "Boshqa";

    if (!categoryProfitMap[category]) {
      categoryProfitMap[category] = 0;
    }

    allSales.forEach((sale) => {
      (sale.items || []).forEach((saleItem) => {
        if (saleItem.id === item.id) {
          categoryProfitMap[category] +=
            (Number(saleItem.price || 0) -
              Number(saleItem.costPrice || item.costPrice || 0)) *
            getNetSoldQty(saleItem);
        }
      });
    });
  }

  const bestCategory =
    Object.entries(categoryProfitMap).sort((a, b) => b[1] - a[1])[0] || [];

  const activeProducts = inventory.filter(
    (item) => item.quantity > 0 && item.quantity < 20,
  ).length;

  const activeStockRatio =
    inventory.length > 0
      ? Math.round((activeProducts / inventory.length) * 100)
      : 0;

  const healthScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        profitMargin * 1.2 +
          activeStockRatio * 0.5 +
          Math.max(salesGrowth, 0) * 0.8,
      ),
    ),
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Boshqaruv paneli</h1>

          <p>Real vaqt biznes statistikasi</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* 1-QATOR */}

        <div className="dashboard-card">
          <div className="card-icon sales">
            <FiDollarSign />
          </div>

          <div>
            <span>Bugungi savdo</span>

            <h2>{formatPrice(totalSales)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon profit">
            <FiDollarSign />
          </div>

          <div>
            <span>Sof foyda</span>

            <h2>{formatPrice(totalProfit)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon expense">
            <FiDollarSign />
          </div>

          <div>
            <span>Harajatlar</span>

            <h2>{formatPrice(totalExpenses)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon history">
            <FiDollarSign />
          </div>

          <div>
            <span>Umumiy savdo</span>

            <h2>{formatPrice(totalRevenue)}</h2>
          </div>
        </div>

        {/* 2-QATOR */}

        <div className="dashboard-card">
          <div className="card-icon cash">
            <FiShoppingBag />
          </div>

          <div>
            <span>Naqd savdo</span>

            <h2>{formatPrice(cashSales)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon card">
            <FiShoppingBag />
          </div>

          <div>
            <span>Karta savdo</span>

            <h2>{formatPrice(cardSales)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon transfer">
            <FiShoppingBag />
          </div>

          <div>
            <span>O‘tkazma</span>

            <h2>{formatPrice(transferSales)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon average">
            <FiDollarSign />
          </div>

          <div>
            <span>O‘rtacha savdo</span>

            <h2>{formatPrice(Math.floor(averageCheck))}</h2>
          </div>
        </div>

        {/* 3-QATOR */}

        <div className="dashboard-card">
          <div className="card-icon transaction">
            <FiShoppingBag />
          </div>

          <div>
            <span>Tranzaksiyalar</span>

            <h2>{totalTransactions}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon inventory">
            <FiShoppingBag />
          </div>

          <div>
            <span>Ombor qiymati</span>

            <h2>{formatPrice(inventoryValue)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon warning">
            <FiAlertTriangle />
          </div>

          <div>
            <span>Kam qolganlar</span>

            <h2>{lowStock.length}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon supplier">
            <FiTruck />
          </div>

          <div>
            <span>Supplier qarzi</span>

            <h2>{formatPrice(supplierDebt)}</h2>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="card-icon expense">
            <FiRefreshCcw />
          </div>

          <div>
            <span>Vozvratlar summasi</span>

            <h2>{formatPrice(totalReturns)}</h2>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-icon warning">
            <FiRefreshCcw />
          </div>

          <div>
            <span>Vozvratlar soni</span>

            <h2>{totalReturnsCount}</h2>
          </div>
        </div>
      </div>

      <div className="dashboard-profit-section">
        <div className="dashboard-profit-card">
          <div className="dashboard-profit-info">
            <span>Foyda marjasi</span>

            <h2>{profitMargin}%</h2>

            <p>Savdoga nisbatan sof foyda</p>

            <div className="dashboard-profit-meta">
              <div>
                <span>Sof foyda</span>
                <strong>{formatPrice(totalProfit)}</strong>
              </div>

              <div>
                <span>Jami savdo</span>
                <strong>{formatPrice(totalRevenue)}</strong>
              </div>
            </div>
          </div>

          <div className="dashboard-progress-wrapper">
            <svg className="dashboard-progress-ring" width="140" height="140">
              <circle
                className="dashboard-progress-bg"
                cx="70"
                cy="70"
                r="54"
              />

              <circle
                className="dashboard-progress-bar"
                cx="70"
                cy="70"
                r="54"
                style={{
                  strokeDashoffset: 339 - (339 * profitMargin) / 100,
                }}
              />
            </svg>

            <div className="dashboard-progress-text">{profitMargin}%</div>
          </div>
        </div>

        <div className="dashboard-mini-analytics">
          <div className="dashboard-mini-card growth">
            <span>Savdo o‘sishi</span>

            <h3>{salesGrowthText}</h3>

            <p>Oldingi davrga nisbatan</p>
          </div>

          <div className="dashboard-mini-card category">
            <span>Eng foydali kategoriya</span>

            <h3>{bestCategory[0] || "Yo‘q"}</h3>

            <p>
              {bestCategory[1] ? formatPrice(bestCategory[1]) : "Ma’lumot yo‘q"}
            </p>
          </div>

          <div className="dashboard-mini-card stock">
            <span>Active stock ratio</span>

            <h3>{activeStockRatio}%</h3>

            <p>Aktiv mahsulotlar</p>
          </div>

          <div className="dashboard-mini-card health">
            <span>AI Health Score</span>

            <h3>{healthScore}/100</h3>

            <p>Biznes holati</p>
          </div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="dashboard-table">
          <div className="section-header">
            <h3>Kam qolgan mahsulotlar</h3>
          </div>

          {lowStock.length === 0 ? (
            <p className="dashboard-empty-text">Kam qolgan mahsulot yo‘q</p>
          ) : (
            lowStock.map((item) => (
              <div className="stock-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>

                  <span>{item.sku}</span>
                </div>

                <div className="stock-badge">{item.quantity} dona</div>
              </div>
            ))
          )}
        </div>

        <div className="dashboard-table">
          <div className="section-header">
            <h3>Oxirgi savdolar</h3>
          </div>

          {recentSoldProducts.length === 0 ? (
            <p className="dashboard-empty-text">Savdolar mavjud emas</p>
          ) : (
            recentSoldProducts.map((item) => (
              <div className="sale-item" key={item.id}>
                <div>
                  <strong>{item.productName}</strong>

                  <span>
                    {item.quantity} dona × {formatPrice(item.price)}
                  </span>
                </div>

                <div className="sale-time">
                  <strong>{formatPrice(item.total)}</strong>
                  <span>{item.time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
