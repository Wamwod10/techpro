import { FiTruck, FiDollarSign, FiTrash2 } from "react-icons/fi";

import { useState } from "react";

import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";

import { formatPrice } from "../../utils/formatPrice";

import "./supplier.scss";

function Suppliers() {
  const { currentUser } = useAuth();
  const { suppliers, setSuppliers, addActivityLog } = useStore();

  const [showModal, setShowModal] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const [paymentAmount, setPaymentAmount] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);

  const [supplierName, setSupplierName] = useState("");

  const [supplierDebt, setSupplierDebt] = useState("");

  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierTelegram, setSupplierTelegram] = useState("");
  const [supplierDeadline, setSupplierDeadline] = useState("");
  const getSupplierStatus = (supplier, balance) => {
    if (balance <= 0) {
      return {
        text: "To‘langan",
        className: "success",
      };
    }

    if (supplier.deadline && new Date(supplier.deadline) < new Date()) {
      return {
        text: "Muddati o‘tgan",
        className: "danger",
      };
    }

    if (Number(supplier.paid || 0) > 0) {
      return {
        text: "Qisman to‘langan",
        className: "warning",
      };
    }

    return {
      text: "Qarzdor",
      className: "danger",
    };
  };

  // const getSupplierAdvice = (supplierStatus, balance) =>
  //   balance <= 0
  //     ? "Bu ta’minotchi bo‘yicha qarz yopilgan. Keyingi buyurtma uchun xavf past."
  //     : supplierStatus.className === "danger"
  //       ? "Qarz yoki to‘lov muddati bo‘yicha e’tibor kerak. Keyingi buyurtmadan oldin balansni kamaytirish tavsiya qilinadi."
  //       : "Qarz qisman yopilgan. To‘lov rejasini davom ettirish tavsiya qilinadi.";

  const selectedSupplierBalance = selectedSupplier
    ? Number(selectedSupplier.debt || 0) - Number(selectedSupplier.paid || 0)
    : 0;
  const paymentValue = Number(paymentAmount);
  const isPaymentInvalid =
    selectedSupplierBalance <= 0 ||
    !paymentAmount ||
    paymentValue <= 0 ||
    paymentValue > selectedSupplierBalance;

  return (
    <div className="suppliers-page">
      <div className="suppliers-header">
        <h1>Ta’minotchilar</h1>

        <p>Supplier qarz va to‘lov nazorati</p>
        <button
          className="add-supplier-btn"
          onClick={() => setShowAddModal(true)}
        >
          + Yangi ta’minotchi
        </button>
      </div>

      <div className="suppliers-grid">
        {suppliers.map((supplier) => {
          const balance =
            Number(supplier.debt || 0) - Number(supplier.paid || 0);
          const supplierStatus = getSupplierStatus(supplier, balance);
          // const supplierAdvice = getSupplierAdvice(supplierStatus, balance);

          return (
            <div className="supplier-card" key={supplier.id}>
              <div className="supplier-top">
                <div className="supplier-icon">
                  <FiTruck />
                </div>

                <div className="supplier-top-actions">
                  <div className={`supplier-badge ${supplierStatus.className}`}>
                    {supplierStatus.text}
                  </div>

                  <button
                    className="supplier-delete-btn"
                    type="button"
                    aria-label={`${supplier.name} ni o'chirish`}
                    onClick={() => {
                      setSuppliers(
                        suppliers.filter((item) => item.id !== supplier.id)
                      );
                    }}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>

              <h2>{supplier.name}</h2>

              <div className="supplier-contact">
                {supplier.phone && <span>Tel: {supplier.phone}</span>}
                {supplier.telegram && (
                  <span>Telegram: {supplier.telegram}</span>
                )}
                {supplier.deadline && (
                  <span>Qarz olingan sana {supplier.deadline}</span>
                )}
              </div>

              {/* <div className="supplier-ai-advice">{supplierAdvice}</div> */}

              <div className="supplier-stats">
                <div>
                  <span>Umumiy qarz</span>

                  <strong>{formatPrice(supplier.debt || 0)}</strong>
                </div>

                <div>
                  <span>To‘langan</span>

                  <strong className="paid">
                    {formatPrice(supplier.paid || 0)}
                  </strong>
                </div>

                <div>
                  <span>Qoldiq</span>

                  <strong className="debt">{formatPrice(balance)}</strong>
                </div>
              </div>

              <div className="supplier-history">
                <h4>To‘lov tarixi</h4>

                {supplier.transactions?.length > 0 ? (
                  supplier.transactions.map((transaction) => (
                    <div className="transaction-item" key={transaction.id}>
                      <div>
                        {transaction.productName && (
                          <span className="transaction-product">
                            {transaction.productName}
                          </span>
                        )}

                        <strong>{formatPrice(transaction.amount)}</strong>

                        <span>
                          {transaction.date} • {transaction.time}
                        </span>
                        {transaction.phone && (
                          <span>Tel: {transaction.phone}</span>
                        )}
                      </div>

                      {transaction.status && (
                        <span className="transaction-status">
                          {transaction.status}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="empty-transactions">To‘lovlar mavjud emas</p>
                )}
              </div>

              <button
                className="supplier-btn"
                onClick={() => {
                  setSelectedSupplier(supplier);

                  setShowModal(true);
                }}
              >
                <FiDollarSign />

                <span>To‘lov qilish</span>
              </button>
            </div>
          );
        })}
      </div>
      {showModal && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <h2>To‘lov qilish</h2>

            <p>{selectedSupplier?.name}</p>

            <input
              type="number"
              placeholder="To‘lov summasi"
              min="1"
              max={selectedSupplierBalance}
              value={paymentAmount}
              onChange={(e) => {
                const value = e.target.value;

                if (value === "") {
                  setPaymentAmount("");
                  return;
                }

                if (selectedSupplierBalance <= 0) {
                  setPaymentAmount("");
                  return;
                }

                const nextAmount = Number(value);

                if (nextAmount < 0) {
                  return;
                }

                setPaymentAmount(
                  String(Math.min(nextAmount, selectedSupplierBalance))
                );
              }}
            />

            <div className="payment-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowModal(false)}
              >
                Bekor qilish
              </button>

              <button
                className="confirm-btn"
                disabled={isPaymentInvalid}
                onClick={() => {
                  if (isPaymentInvalid) {
                    return;
                  }

                  const updatedSuppliers = suppliers.map((item) => {
                    if (item.id === selectedSupplier.id) {
                      return {
                        ...item,

                        paid: Number(item.paid || 0) + Number(paymentAmount),

                        transactions: [
                          {
                            id: Date.now(),

                            amount: Number(paymentAmount),

                            date: new Date().toLocaleDateString("uz-UZ"),

                            time: new Date().toLocaleTimeString("uz-UZ", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          },

                          ...(item.transactions || []),
                        ],
                      };
                    }

                    return item;
                  });

                  setSuppliers(updatedSuppliers);

                  addActivityLog({
                    type: "supplier",
                    title: "Supplier to'lovi qilindi",
                    description: `${selectedSupplier.name} supplieriga ${formatPrice(
                      Number(paymentAmount),
                    )} to'lov qilindi`,
                    userName: currentUser?.name,
                    userRole: currentUser?.role,
                  });

                  setPaymentAmount("");

                  setShowModal(false);
                }}
              >
                To‘lovni saqlash
              </button>
            </div>
          </div>
        </div>
      )}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <h2>Yangi ta’minotchi</h2>

            <input
              type="text"
              placeholder="Ta’minotchi nomi"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />

            <input
              type="number"
              placeholder="Boshlang‘ich qarz"
              value={supplierDebt}
              onChange={(e) => setSupplierDebt(e.target.value)}
            />

            <input
              type="text"
              placeholder="Telefon raqam"
              value={supplierPhone}
              onChange={(e) => setSupplierPhone(e.target.value)}
            />

            <input
              type="date"
              value={supplierDeadline}
              onChange={(e) => setSupplierDeadline(e.target.value)}
            />

            <div className="payment-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowAddModal(false)}
              >
                Bekor qilish
              </button>

              <button
                className="confirm-btn"
                onClick={() => {
                  const newSupplier = {
                    id: Date.now(),

                    name: supplierName,

                    debt: Number(supplierDebt) || 0,

                    paid: 0,

                    transactions: [],

                    phone: supplierPhone,
                    telegram: supplierTelegram,
                    deadline: supplierDeadline,
                    orders: [],
                  };

                  setSuppliers([newSupplier, ...suppliers]);

                  if (Number(supplierDebt) > 0) {
                    addActivityLog({
                      type: "supplier",
                      title: "Supplier qarzi qo'shildi",
                      description: `${supplierName} supplieriga ${formatPrice(
                        Number(supplierDebt),
                      )} qarz qo'shildi`,
                      userName: currentUser?.name,
                      userRole: currentUser?.role,
                    });
                  }

                  setSupplierName("");

                  setSupplierDebt("");

                  setShowAddModal(false);

                  setSupplierPhone("");
                  setSupplierTelegram("");
                  setSupplierDeadline("");
                }}
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Suppliers;
