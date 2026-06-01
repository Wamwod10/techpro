import { useState } from "react";

import {
  FiPlus,
  FiTrash2,
  FiX,
  FiCreditCard,
  FiChevronDown,
  FiCheck,
} from "react-icons/fi";

import { formatPrice } from "../../utils/formatPrice";
import { useStore } from "../../context/StoreContext";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiFlow";

import "./expenses.scss";

const expenseCategoryColors = {
  Ijara: {
    backgroundColor: "#e0e7ff",
    color: "#3730a3",
    borderColor: "#c7d2fe",
  },
  Reklama: {
    backgroundColor: "#fef3c7",
    color: "#b45309",
    borderColor: "#fde68a",
  },
  Internet: {
    backgroundColor: "#cffafe",
    color: "#0e7490",
    borderColor: "#a5f3fc",
  },
  Dostavka: {
    backgroundColor: "#dcfce7",
    color: "#15803d",
    borderColor: "#bbf7d0",
  },
  Oylik: {
    backgroundColor: "#ffe4e6",
    color: "#be123c",
    borderColor: "#fecdd3",
  },
  Boshqa: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    borderColor: "#e2e8f0",
  },
};

const defaultCategoryColor = {
  backgroundColor: "#f8fafc",
  color: "#64748b",
  borderColor: "#dbe2ea",
};

const getCategoryColor = (category) =>
  expenseCategoryColors[category] || defaultCategoryColor;

function Expenses() {
  const { expenses, setExpenses } = useStore();
  const expenseCategoryOptions = [
    "Ijara",
    "Reklama",
    "Internet",
    "Dostavka",
    "Oylik",
    "Boshqa",
  ];

  const [showModal, setShowModal] = useState(false);
  const [openSelect, setOpenSelect] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = useState(null);
  const [expenseError, setExpenseError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    category: "",
    amount: "",
    note: "",
  });

  const handleSave = async () => {
    if (savingExpense || !formData.title || !formData.amount) return;

    setSavingExpense(true);
    setExpenseError("");

    const optimisticExpense = {
      id: crypto.randomUUID(),
      title: formData.title,
      category: formData.category || "Boshqa",
      amount: Number(formData.amount),
      note: formData.note,
      date: new Date().toLocaleDateString("uz-UZ"),
    };

    setExpenses([optimisticExpense, ...expenses]);

    try {
      const { data: newExpense } = await api.post("/expenses", {
        title: formData.title,
        category: formData.category || "Boshqa",
        amount: Number(formData.amount),
        note: formData.note,
      });

      setExpenses((current) =>
        current.map((item) =>
          item.id === optimisticExpense.id ? newExpense : item,
        ),
      );

      setFormData({
        title: "",
        category: "",
        amount: "",
        note: "",
      });

      setShowModal(false);
    } catch (error) {
      setExpenses(expenses);
      setExpenseError(getApiErrorMessage(error, "Xarajat saqlashda xatolik"));
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDelete = async (id) => {
    if (deletingExpenseId) return;

    const previousExpenses = expenses;
    setDeletingExpenseId(id);
    setExpenses(expenses.filter((item) => item.id !== id));

    try {
      await api.delete(`/expenses/${id}`);
    } catch (error) {
      setExpenses(previousExpenses);
      setExpenseError(getApiErrorMessage(error, "Xarajat o'chirishda xatolik"));
    } finally {
      setDeletingExpenseId(null);
    }
  };

  const totalExpenses = expenses.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0
  );

  const selectedCategoryLabel = formData.category || "Kategoriya tanlang";

  return (
    <div className="expenses-page">
      <div className="expenses-header">
        <div>
          <h1>Xarajatlar</h1>

          <p>Savdo pulidan qilingan barcha xarajatlar</p>
        </div>

        <button
          className="expense-btn"
          onClick={() => {
            setExpenseError("");
            setShowModal(true);
          }}
        >
          <FiPlus />

          <span>Xarajat qo‘shish</span>
        </button>
      </div>

      {expenseError && !showModal && <div className="form-error">{expenseError}</div>}

      <div className="expenses-summary">
        <div className="summary-icon">
          <FiCreditCard />
        </div>

        <div>
          <span>Umumiy xarajat</span>

          <h2>{formatPrice(totalExpenses)}</h2>
        </div>
      </div>

      <div className="expenses-list">
        {expenses.length === 0 ? (
          <div className="empty-expenses">
            <h2>Xarajatlar yo‘q</h2>

            <p>Yangi xarajat qo‘shilganda shu yerda ko‘rinadi.</p>
          </div>
        ) : (
          expenses.map((item) => (
            <div className="expense-card" key={item.id}>
              <div className="expense-left">
                <div
                  className="expense-category"
                  style={getCategoryColor(item.category)}
                >
                  {item.category}
                </div>

                <h3>{item.title}</h3>

                {item.note && <p>{item.note}</p>}

                <span>{item.date}</span>
              </div>

              <div className="expense-right">
                <strong>{formatPrice(item.amount)}</strong>

                <button
                  disabled={deletingExpenseId === item.id}
                  onClick={() => handleDelete(item.id)}
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="expense-modal">
            <div className="modal-top">
              <div>
                <h2>Xarajat qo‘shish</h2>

                <p>Bugungi biznes xarajatini kiriting</p>
              </div>

              <button onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>

            <div className="expense-form">
              <input
                type="text"
                placeholder="Xarajat nomi"
                value={formData.title}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    title: e.target.value,
                  })
                }
              />

              <div className="custom-select">
                <button
                  className="custom-select-trigger"
                  onClick={() => setOpenSelect(!openSelect)}
                  type="button"
                >
                  <span>Kategoriya</span>
                  <strong>{selectedCategoryLabel}</strong>
                  <FiChevronDown />
                </button>

                {openSelect && (
                  <div className="custom-select-menu">
                    {expenseCategoryOptions.map((category) => (
                      <button
                        className={formData.category === category ? "active" : ""}
                        key={category}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            category,
                          });
                          setOpenSelect(false);
                        }}
                        type="button"
                      >
                        <span>{category}</span>
                        {formData.category === category && <FiCheck />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="number"
                placeholder="Summa"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    amount: e.target.value,
                  })
                }
              />

              <textarea
                placeholder="Izoh"
                value={formData.note}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    note: e.target.value,
                  })
                }
              />

              {expenseError && <div className="form-error">{expenseError}</div>}

              <button
                className="save-expense-btn"
                disabled={savingExpense}
                onClick={handleSave}
              >
                {savingExpense ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Expenses;
