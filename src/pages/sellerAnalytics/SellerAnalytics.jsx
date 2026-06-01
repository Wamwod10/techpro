import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import { formatPrice } from "../../utils/formatPrice";
import {
  getNetSoldQty,
  getSaleNetTotal,
  getSaleProfit,
} from "../../utils/returns";

import "./sellerAnalytics.scss";

function SellerAnalytics() {
  const { currentUser } = useAuth();
  const { dailySales, salesHistory } = useStore();

  const isAdmin = currentUser?.role === "admin";

  const allSales = useMemo(
    () => [
      ...dailySales,
      ...salesHistory.flatMap((day) => day.sales || []),
    ],
    [dailySales, salesHistory],
  );

  const sellers = useMemo(
    () => [
      ...new Map(
        allSales
          .filter((sale) => sale.sellerId)
          .map((sale) => [
            sale.sellerId,
            {
              id: sale.sellerId,
              name: sale.sellerName,
              role: sale.sellerRole,
            },
          ]),
      ).values(),
    ],
    [allSales],
  );

  const [selectedSellerId, setSelectedSellerId] = useState(
    isAdmin ? sellers[0]?.id || "" : currentUser?.id,
  );

  useEffect(() => {
    if (isAdmin && !selectedSellerId && sellers[0]?.id) {
      setSelectedSellerId(sellers[0].id);
    }
  }, [isAdmin, selectedSellerId, sellers]);

  const activeSellerId = isAdmin ? selectedSellerId : currentUser?.id;

  const sellerSales = allSales.filter(
    (sale) => sale.sellerId === activeSellerId,
  );

  const totalSales = sellerSales.reduce(
    (acc, sale) => acc + getSaleNetTotal(sale),
    0,
  );

  const transactionCount = sellerSales.length;

  const averageCheck = transactionCount > 0 ? totalSales / transactionCount : 0;

  const soldProducts = sellerSales.flatMap((sale) => sale.items || []);

  const totalSoldQty = soldProducts.reduce(
    (acc, item) => acc + getNetSoldQty(item),
    0,
  );

  const totalProfit = sellerSales.reduce(
    (acc, sale) => acc + getSaleProfit(sale),
    0,
  );

  const profitMargin =
    totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  const productMap = soldProducts.reduce((acc, item) => {
    if (!acc[item.name]) {
      acc[item.name] = {
        name: item.name,
        quantity: 0,
        revenue: 0,
        profit: 0,
      };
    }

    const netQty = getNetSoldQty(item);

    acc[item.name].quantity += netQty;
    acc[item.name].revenue += Number(item.price || 0) * netQty;
    acc[item.name].profit +=
      (Number(item.price || 0) - Number(item.costPrice || 0)) *
      netQty;

    return acc;
  }, {});

  const topSoldProducts = Object.values(productMap)
    .filter((item) => item.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const topProfitProducts = Object.values(productMap)
    .filter((item) => item.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const performanceScore = Math.min(
    100,
    Math.round(
      Math.min(transactionCount * 8, 35) +
        Math.min(totalSoldQty * 4, 25) +
        Math.min(averageCheck / 100000, 20) +
        Math.min(profitMargin, 20),
    ),
  );

  const salesEfficiencyScore = Math.min(100, Math.round(transactionCount * 10));

  const customerHandlingScore = Math.min(100, Math.round(totalSoldQty * 8));

  const averageCheckScore = Math.min(100, Math.round(averageCheck / 3000));

  const productStrategyScore = isAdmin
    ? Math.min(100, Math.round(profitMargin * 3))
    : Math.min(100, Math.round(topSoldProducts.length * 20));

  const subScores = [
    {
      title: "Savdo samaradorligi",
      value: salesEfficiencyScore,
    },
    {
      title: "Xaridor bilan ishlash",
      value: customerHandlingScore,
    },
    {
      title: "Chek sifati",
      value: averageCheckScore,
    },
    {
      title: "Mahsulot tanlovi",
      value: productStrategyScore,
    },
  ];

  const generateInsights = () => {
    const strengths = [];
    const warnings = [];
    const recommendations = [];
    const opportunities = [];

    if (transactionCount >= 10) {
      strengths.push(
        "Savdo faolligi yuqori. Xaridorlar bilan ishlash yaxshi ketmoqda.",
      );
    } else {
      warnings.push(
        "Tranzaksiyalar soni past. Faol mahsulotlarni ko‘proq tavsiya qilish kerak.",
      );
    }

    if (averageCheck >= 300000) {
      strengths.push(
        "O‘rtacha chek yaxshi. Premium mahsulotlar muvaffaqiyatli sotilyapti.",
      );
    } else {
      recommendations.push(
        "O‘rtacha chekni oshirish uchun qo‘shimcha aksessuar tavsiya qilish kerak.",
      );
    }

    if (profitMargin >= 25) {
      strengths.push("Yuqori foydali mahsulotlar yaxshi sotilyapti.");
    } else if (isAdmin) {
      warnings.push(
        "Foyda marjasi past. Yuqori marjali mahsulotlarga e’tibor berish kerak.",
      );
    }

    if (topSoldProducts.length > 0) {
      opportunities.push(
        `${topSoldProducts[0]?.name} xaridorlar orasida talab yuqori mahsulot hisoblanadi.`,
      );
    }

    if (performanceScore >= 80) {
      strengths.push("Umumiy ish samaradorligi yuqori darajada.");
    }

    if (transactionCount <= 3) {
      warnings.push(
        "Faollik sust. Xaridor bilan ishlash tezligini oshirish tavsiya qilinadi.",
      );
    }

    recommendations.push(
      "Har bir xaridorga qo‘shimcha mahsulot taklif qilish savdoni oshirishi mumkin.",
    );

    opportunities.push(
      "Premium mahsulotlarni ko‘proq tavsiya qilish foydani oshiradi.",
    );

    return {
      strengths,
      warnings,
      recommendations,
      opportunities,
    };
  };

  const insights = generateInsights();

  return (
    <div className="seller-analytics-page">
      <div className="seller-analytics-header">
        <div>
          <h1>Sotuvchi tahlili</h1>
          <p>Sotuvchi ish faoliyati bo‘yicha tahlil</p>
        </div>

        {isAdmin && (
          <div className="seller-switch">
            {sellers.map((seller) => (
              <button
                key={seller.id}
                className={selectedSellerId === seller.id ? "active" : ""}
                onClick={() => setSelectedSellerId(seller.id)}
              >
                {seller.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="seller-score-card">
        <div className="seller-score-top">
          <div>
            <span>AI ish bahosi</span>

            <h2>{performanceScore}/100</h2>

            <p>
              Sotuvchining savdo faolligi, tranzaksiyalar soni, o‘rtacha chek va
              mahsulot samaradorligi asosida hisoblandi.
            </p>
          </div>
        </div>

        <div className="seller-sub-scores">
          {subScores.map((score) => (
            <div className="seller-sub-score" key={score.title}>
              <div>
                <span>{score.title}</span>
                <strong>{score.value}%</strong>
              </div>

              <div className="seller-score-line">
                <div style={{ width: `${score.value}%` }}></div>
              </div>
            </div>
          ))}
        </div>

        <div className="seller-ai-grid">
          <div className="seller-ai-box strengths">
            <h3>🟢 Kuchli tomonlar</h3>

            {insights.strengths.map((item, index) => (
              <div className="seller-ai-item" key={index}>
                {item}
              </div>
            ))}
          </div>

          <div className="seller-ai-box warnings">
            <h3>⚠️ E’tibor kerak joylar</h3>

            {insights.warnings.length === 0 ? (
              <div className="seller-ai-item">Jiddiy muammo aniqlanmadi.</div>
            ) : (
              insights.warnings.map((item, index) => (
                <div className="seller-ai-item" key={index}>
                  {item}
                </div>
              ))
            )}
          </div>

          <div className="seller-ai-box recommendations">
            <h3>💡 AI tavsiyalar</h3>

            {insights.recommendations.map((item, index) => (
              <div className="seller-ai-item" key={index}>
                {item}
              </div>
            ))}
          </div>

          <div className="seller-ai-box opportunities">
            <h3>📈 O‘sish imkoniyatlari</h3>

            {insights.opportunities.map((item, index) => (
              <div className="seller-ai-item" key={index}>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="seller-summary">
        <div className="seller-card">
          <span>Umumiy savdo</span>
          <h2>{formatPrice(totalSales)}</h2>
        </div>

        <div className="seller-card">
          <span>Tranzaksiyalar</span>
          <h2>{transactionCount}</h2>
        </div>

        <div className="seller-card">
          <span>O‘rtacha chek</span>
          <h2>{formatPrice(Math.floor(averageCheck))}</h2>
        </div>

        <div className="seller-card">
          <span>Sotilgan mahsulot</span>
          <h2>{totalSoldQty} dona</h2>
        </div>

        {isAdmin && (
          <>
            <div className="seller-card admin-only">
              <span>Sof foyda</span>
              <h2>{formatPrice(totalProfit)}</h2>
            </div>

            <div className="seller-card admin-only">
              <span>Foyda marjasi</span>
              <h2>{profitMargin}%</h2>
            </div>
          </>
        )}
      </div>

      <div className="seller-grid">
        <div className="seller-box">
          <h3>Eng ko‘p sotilgan mahsulotlar</h3>

          {topSoldProducts.length === 0 ? (
            <p className="empty-text">Ma’lumot mavjud emas</p>
          ) : (
            topSoldProducts.map((item, index) => (
              <div className="seller-row" key={item.name}>
                <strong>
                  {index + 1}. {item.name}
                </strong>

                <span>{item.quantity} dona</span>
              </div>
            ))
          )}
        </div>

        {isAdmin && (
          <div className="seller-box">
            <h3>Eng ko‘p foyda bergan mahsulotlar</h3>

            {topProfitProducts.length === 0 ? (
              <p className="empty-text">Ma’lumot mavjud emas</p>
            ) : (
              topProfitProducts.map((item, index) => (
                <div className="seller-row" key={item.name}>
                  <strong>
                    {index + 1}. {item.name}
                  </strong>

                  <span>{formatPrice(item.profit)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default SellerAnalytics;
