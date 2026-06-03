import { useStore } from "../../context/StoreContext";
import { formatPrice } from "../../utils/formatPrice";
import { getItemFinalPrice, getNetSoldQty } from "../../utils/returns";
import "./analytics.scss";

function Analytics() {
  const { inventory, dailySales, salesHistory } = useStore();

  const allSales = [
    ...dailySales,
    ...salesHistory.flatMap((day) => day.sales || []),
  ];

  const productMap = new Map(
    inventory.map((product) => [String(product.id), product]),
  );

  allSales.forEach((sale) => {
    (sale.items || []).forEach((item) => {
      const productKey = String(item.productId || item.id || item.name);

      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          id: productKey,
          name: item.name,
          sku: item.sku,
          quantity: 0,
          sellPrice: getItemFinalPrice(item),
          costPrice: Number(item.costPrice || 0),
          category: "Arxiv",
        });
      }
    });
  });

  const productStats = [...productMap.values()].map((product) => {
    const soldItems = allSales.flatMap((sale) =>
      (sale.items || []).filter(
        (item) =>
          String(item.productId || item.id || item.name) ===
          String(product.id),
      ),
    );

    const soldQty = soldItems.reduce(
      (acc, item) => acc + getNetSoldQty(item),
      0,
    );

    const revenue = soldItems.reduce(
      (acc, item) => acc + getItemFinalPrice(item) * getNetSoldQty(item),
      0,
    );

    const profit = soldItems.reduce(
      (acc, item) =>
        acc +
        (getItemFinalPrice(item) -
          Number(item.costPrice || product.costPrice || 0)) *
          getNetSoldQty(item),
      0,
    );

    const margin =
      product.sellPrice > 0 && product.costPrice > 0
        ? Math.round(
            ((product.sellPrice - product.costPrice) / product.sellPrice) * 100,
          )
        : 0;

    return {
      ...product,
      soldQty,
      revenue,
      profit,
      margin,
    };
  });

  const topProducts = [...productStats]
    .filter((item) => item.soldQty > 0)
    .sort((a, b) => b.soldQty - a.soldQty)
    .slice(0, 10);

  const stableProducts = [...productStats]
    .filter((item) => item.soldQty > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const slowProducts = [...productStats]
    .filter((item) => item.soldQty <= 2)
    .sort((a, b) => a.soldQty - b.soldQty);

  const topProfitProducts = [...productStats]
    .filter((item) => item.profit > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 5);

  const deadStockProducts = [...productStats]
    .filter((item) => item.quantity > 0 && item.soldQty <= 1)
    .sort((a, b) => b.quantity * b.sellPrice - a.quantity * a.sellPrice)
    .slice(0, 5);

  const getDiscountAdvice = (product) => {
    const discounts = [5, 10, 15, 20];

    const validDiscounts = discounts
      .map((discount) => {
        const newPrice = Math.round(product.sellPrice * (1 - discount / 100));
        const profit = newPrice - Number(product.costPrice || 0);
        const profitPercent =
          newPrice > 0 ? Math.round((profit / newPrice) * 100) : 0;

        return {
          discount,
          newPrice,
          profit,
          profitPercent,
        };
      })
      .filter((item) => item.profit > 0);

    return validDiscounts[validDiscounts.length - 1] || null;
  };

  const generateAdvice = (product) => {
    if (product.soldQty >= 5) {
      return {
        text: `${product.name} juda yaxshi sotilyapti. Omborni ko‘paytirish tavsiya qilinadi.`,
        type: "success",
      };
    }

    if (product.soldQty === 0) {
      return {
        text: `${product.name} umuman sotilmagan. 10-15% skidka tavsiya qilinadi.`,
        type: "danger",
      };
    }

    if (product.soldQty <= 2) {
      return {
        text: `${product.name} sekin sotilyapti. Aksiya yoki skidka qilish mumkin.`,
        type: "warning",
      };
    }

    return {
      text: `${product.name} normal darajada sotilyapti.`,
      type: "default",
    };
  };

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1>Analitika</h1>
          <p>Mahsulotlar sotilishi va foyda tahlili</p>
        </div>
      </div>

      <div className="analytics-summary">
        <div className="analytics-card">
          <span>Jami sotilgan mahsulot</span>
          <h2>
            {productStats.reduce((acc, item) => acc + item.soldQty, 0)} dona
          </h2>
        </div>

        <div className="analytics-card">
          <span>Eng ko‘p sotilgan</span>
          <h2>{topProducts[0]?.name || "Yo‘q"}</h2>
        </div>

        <div className="analytics-card">
          <span>Kam sotilganlar</span>
          <h2>{slowProducts.length} ta</h2>
        </div>

        <div className="analytics-card">
          <span>Omborda qolgan qiymat</span>
          <h2>
            {formatPrice(
              inventory.reduce(
                (acc, item) => acc + item.quantity * item.sellPrice,
                0,
              ),
            )}
          </h2>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-box">
          <h3>TOP 10 eng ko‘p sotilgan</h3>

          {topProducts.map((item, index) => (
            <div className="analytics-row" key={item.id}>
              <strong>
                {index + 1}. {item.name}
              </strong>
              <span>{item.soldQty} dona</span>
            </div>
          ))}
        </div>

        <div className="analytics-box">
          <h3>TOP 10 doimiy sotiladiganlar</h3>

          {stableProducts.map((item, index) => (
            <div className="analytics-row" key={item.id}>
              <strong>
                {index + 1}. {item.name}
              </strong>
              <span>{formatPrice(item.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-box">
          <h3>TOP 5 eng ko‘p foyda berganlar</h3>

          {topProfitProducts.length === 0 ? (
            <p className="empty-text">Ma’lumot mavjud emas</p>
          ) : (
            topProfitProducts.map((item, index) => (
              <div className="analytics-row" key={item.id}>
                <strong>
                  {index + 1}. {item.name}
                </strong>

                <span>{formatPrice(item.profit)}</span>
              </div>
            ))
          )}
        </div>

        <div className="analytics-box">
          <h3>Omborda pul ushlab qolgan mahsulotlar</h3>

          {deadStockProducts.length === 0 ? (
            <p className="empty-text">Barcha mahsulotlar aylanyapti</p>
          ) : (
            deadStockProducts.map((item, index) => (
              <div className="analytics-row" key={item.id}>
                <strong>
                  {index + 1}. {item.name}
                </strong>

                <span>{formatPrice(item.quantity * item.sellPrice)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="analytics-box full">
        <h3>Kam sotilgan / sotilmagan mahsulotlar va skidka tavsiyasi</h3>

        {slowProducts.length === 0 ? (
          <p className="empty-text">Kam sotilgan mahsulot yo‘q</p>
        ) : (
          slowProducts.map((item) => {
            const advice = getDiscountAdvice(item);

            return (
              <div className="discount-row" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    Sotilgan: {item.soldQty} dona · Qoldiq: {item.quantity} dona
                  </p>
                </div>

                <div>
                  <span>Tannarx</span>
                  <strong>{formatPrice(item.costPrice || 0)}</strong>
                </div>

                <div>
                  <span>Hozirgi narx</span>
                  <strong>{formatPrice(item.sellPrice)}</strong>
                </div>

                {advice ? (
                  <div className="advice">
                    <span>Tavsiya</span>
                    <strong>
                      -{advice.discount}% → {formatPrice(advice.newPrice)}
                    </strong>
                    <p>Foyda: {formatPrice(advice.profit)}</p>
                  </div>
                ) : (
                  <div className="advice danger">
                    <span>Tavsiya</span>
                    <strong>Skidka xavfli</strong>
                    <p>Foyda qolmaydi</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="analytics-box full">
        <h3>AI tavsiyalar</h3>

        <div className="ai-advice-list">
          {productStats.slice(0, 6).map((product) => {
            const advice = generateAdvice(product);

            return (
              <div className={`ai-advice-card ${advice.type}`} key={product.id}>
                <strong>{product.name}</strong>

                <p>{advice.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Analytics;
