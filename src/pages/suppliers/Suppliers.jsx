import { useState } from "react";
import { FiDollarSign, FiEdit2, FiTrash2, FiTruck, FiX } from "react-icons/fi";

import { useAuth } from "../../context/AuthContext";
import { useStore } from "../../context/StoreContext";
import api from "../../services/api";
import { getApiErrorMessage } from "../../utils/apiFlow";
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    deadline: "",
    debt: "",
    paid: "",
    notes: "",
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingSupplierId, setDeletingSupplierId] = useState(null);
  const [supplierError, setSupplierError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [editError, setEditError] = useState("");

  const isAdmin = currentUser?.role === "admin";

  const selectedSupplierBalance = selectedSupplier
    ? Math.max(
        0,
        Number(selectedSupplier.debt || 0) - Number(selectedSupplier.paid || 0),
      )
    : 0;
  const paymentValue = Number(paymentAmount);
  const isPaymentInvalid =
    selectedSupplierBalance <= 0 ||
    !paymentAmount ||
    paymentValue <= 0 ||
    paymentValue > selectedSupplierBalance;
  const editBalance = Math.max(
    0,
    Number(editForm.debt || 0) - Number(editForm.paid || 0),
  );

  const getSupplierStatus = (supplier, balance) => {
    if (balance <= 0) {
      return { text: "To'langan", className: "success" };
    }

    if (supplier.deadline && new Date(supplier.deadline) < new Date()) {
      return { text: "Muddati o'tgan", className: "danger" };
    }

    if (Number(supplier.paid || 0) > 0) {
      return { text: "Qisman to'langan", className: "warning" };
    }

    return { text: "Qarzdor", className: "danger" };
  };

  const handleDeleteSupplier = (supplier) => {
    if (deletingSupplierId) return;

    setDeletingSupplierId(supplier.id);
    setSuppliers(suppliers.filter((item) => item.id !== supplier.id));

    api
      .delete(`/suppliers/${supplier.id}`)
      .catch((error) => {
        setSuppliers(suppliers);
        setSupplierError(
          getApiErrorMessage(error, "Supplier o'chirishda xatolik"),
        );
      })
      .finally(() => setDeletingSupplierId(null));
  };

  const openEditModal = (supplier) => {
    setEditingSupplier(supplier);
    setEditForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      deadline: supplier.deadline || "",
      debt: String(supplier.debt ?? 0),
      paid: String(supplier.paid ?? 0),
      notes: supplier.notes || "",
    });
    setEditError("");
    setSupplierError("");
    setShowEditModal(true);
  };

  const updateEditField = (field, value) => {
    if (["debt", "paid"].includes(field) && Number(value) < 0) return;

    setEditForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleUpdateSupplier = () => {
    if (savingEdit || !editingSupplier) return;

    const payload = {
      name: editForm.name.trim(),
      phone: editForm.phone.trim() || null,
      date: editForm.deadline || null,
      totalDebt: Number(editForm.debt || 0),
      paidAmount: Number(editForm.paid || 0),
      notes: editForm.notes.trim() || null,
    };

    if (!payload.name) {
      setEditError("Supplier nomi bo'sh bo'lmasin");
      return;
    }

    if (
      Number.isNaN(payload.totalDebt) ||
      Number.isNaN(payload.paidAmount) ||
      payload.totalDebt < 0 ||
      payload.paidAmount < 0
    ) {
      setEditError("Summalar manfiy bo'lishi mumkin emas");
      return;
    }

    setSavingEdit(true);
    setEditError("");

    const nextSupplier = {
      ...editingSupplier,
      name: payload.name,
      phone: payload.phone,
      deadline: payload.date,
      debt: payload.totalDebt,
      paid: payload.paidAmount,
      notes: payload.notes,
    };

    setSuppliers((current) =>
      current.map((item) =>
        item.id === editingSupplier.id ? nextSupplier : item,
      ),
    );

    api
      .put(`/suppliers/${editingSupplier.id}`, payload)
      .then(({ data }) => {
        setSuppliers((current) =>
          current.map((item) =>
            item.id === editingSupplier.id ? data : item,
          ),
        );
        setSelectedSupplier((current) =>
          current?.id === editingSupplier.id ? data : current,
        );
        void addActivityLog({
          type: "supplier",
          title: "Ta’minotchi ma’lumotlari o‘zgartirildi",
          description: data.name,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        });
        setShowEditModal(false);
        setEditingSupplier(null);
      })
      .catch((error) => {
        setSuppliers(suppliers);
        setEditError(
          getApiErrorMessage(error, "Supplier tahrirlashda xatolik"),
        );
      })
      .finally(() => setSavingEdit(false));
  };

  const handleSupplierPayment = () => {
    if (savingPayment || isPaymentInvalid) return;

    setSavingPayment(true);
    setPaymentError("");

    const transaction = {
      id: crypto.randomUUID(),
      amount: Number(paymentAmount),
      status: "To'lov",
      date: new Date().toLocaleDateString("uz-UZ"),
      time: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setSuppliers(
      suppliers.map((item) =>
        item.id === selectedSupplier.id
          ? {
              ...item,
              paid: Number(item.paid || 0) + Number(paymentAmount),
              transactions: [transaction, ...(item.transactions || [])],
            }
          : item,
      ),
    );
    setSelectedSupplier((supplier) =>
      supplier
        ? {
            ...supplier,
            paid: Number(supplier.paid || 0) + Number(paymentAmount),
            transactions: [transaction, ...(supplier.transactions || [])],
          }
        : supplier,
    );

    api
      .post(`/suppliers/${selectedSupplier.id}/payments`, {
        amount: Number(paymentAmount),
        date: transaction.date,
        time: transaction.time,
      })
      .then(({ data }) => {
        const nextSupplier = {
          ...data.supplier,
          transactions:
            data.supplier?.transactions || [
              data.transaction,
              ...(selectedSupplier.transactions || []).filter(
                (entry) => entry.id !== transaction.id,
              ),
            ],
        };

        setSuppliers((current) =>
          current.map((item) =>
            item.id === selectedSupplier.id
              ? nextSupplier
              : item,
          ),
        );
        setSelectedSupplier(nextSupplier);

        setPaymentAmount("");
        setShowModal(false);
      })
      .catch((error) => {
        setSuppliers(suppliers);
        setSelectedSupplier(selectedSupplier);
        setPaymentError(
          getApiErrorMessage(error, "Supplier to'lovini saqlashda xatolik"),
        );
      })
      .finally(() => setSavingPayment(false));

    addActivityLog({
      type: "supplier",
      title: "Supplier to'lovi qilindi",
      description: `${selectedSupplier.name} supplieriga ${formatPrice(
        Number(paymentAmount),
      )} to'lov qilindi`,
      userName: currentUser?.name,
      userRole: currentUser?.role,
    });

  };

  const handleAddSupplier = () => {
    if (savingSupplier || !supplierName) return;

    setSavingSupplier(true);
    setSupplierError("");

    const newSupplier = {
      id: crypto.randomUUID(),
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

    api
      .post("/suppliers", newSupplier)
      .then(({ data }) => {
        setSuppliers((current) =>
          current.map((item) =>
            String(item.id) === String(newSupplier.id) ? data : item,
          ),
        );

        setSupplierName("");
        setSupplierDebt("");
        setShowAddModal(false);
        setSupplierPhone("");
        setSupplierTelegram("");
        setSupplierDeadline("");
      })
      .catch((error) => {
        setSuppliers(suppliers);
        setSupplierError(
          getApiErrorMessage(error, "Supplier saqlashda xatolik"),
        );
      })
      .finally(() => setSavingSupplier(false));

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

  };

  return (
    <div className="suppliers-page">
      <div className="suppliers-header">
        <h1>Ta'minotchilar</h1>
        <p>Supplier qarz va to'lov nazorati</p>
        <button
          className="add-supplier-btn"
          onClick={() => {
            setSupplierError("");
            setShowAddModal(true);
          }}
        >
          + Yangi ta'minotchi
        </button>
      </div>

      {supplierError && !showAddModal && !showEditModal && (
        <div className="form-error">{supplierError}</div>
      )}

      <div className="suppliers-grid">
        {suppliers.map((supplier) => {
          const balance = Math.max(
            0,
            Number(supplier.debt || 0) - Number(supplier.paid || 0),
          );
          const supplierStatus = getSupplierStatus(supplier, balance);

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

                  {isAdmin && (
                    <>
                      <button
                        className="supplier-edit-btn"
                        type="button"
                        aria-label={`${supplier.name} ni tahrirlash`}
                        onClick={() => openEditModal(supplier)}
                      >
                        <FiEdit2 />
                        <span>Tahrirlash</span>
                      </button>

                      <button
                        className="supplier-delete-btn"
                        disabled={deletingSupplierId === supplier.id}
                        type="button"
                        aria-label={`${supplier.name} ni o'chirish`}
                        onClick={() => handleDeleteSupplier(supplier)}
                      >
                        <FiTrash2 />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <h2>{supplier.name}</h2>

              <div className="supplier-contact">
                {supplier.phone && <span>Tel: {supplier.phone}</span>}
                {supplier.telegram && <span>Telegram: {supplier.telegram}</span>}
                {supplier.deadline && (
                  <span>Qarz olingan sana {supplier.deadline}</span>
                )}
                {supplier.notes && <span>Izoh: {supplier.notes}</span>}
              </div>

              <div className="supplier-stats">
                <div>
                  <span>Umumiy qarz</span>
                  <strong>{formatPrice(supplier.debt || 0)}</strong>
                </div>

                <div>
                  <span>To'langan</span>
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
                <h4>To'lov tarixi</h4>

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
                        {transaction.phone && <span>Tel: {transaction.phone}</span>}
                      </div>

                      {transaction.status && (
                        <span className="transaction-status">
                          {transaction.status}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="empty-transactions">To'lovlar mavjud emas</p>
                )}
              </div>

              <button
                className="supplier-btn"
                onClick={() => {
                  setPaymentError("");
                  setSelectedSupplier(supplier);
                  setShowModal(true);
                }}
              >
                <FiDollarSign />
                <span>To'lov qilish</span>
              </button>
            </div>
          );
        })}
      </div>

      {showEditModal && (
        <div className="modal-overlay">
          <div className="payment-modal supplier-edit-modal">
            <div className="supplier-modal-header">
              <div>
                <h2>Ta'minotchini tahrirlash</h2>
                <p>{editingSupplier?.name}</p>
              </div>

              <button
                className="supplier-modal-close"
                onClick={() => setShowEditModal(false)}
                type="button"
                aria-label="Modalni yopish"
              >
                <FiX />
              </button>
            </div>

            <div className="supplier-edit-form">
              <label>
                <span>Supplier nomi</span>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => updateEditField("name", e.target.value)}
                />
              </label>

              <label>
                <span>Telefon raqami</span>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => updateEditField("phone", e.target.value)}
                />
              </label>

              <label>
                <span>Sana</span>
                <input
                  type="date"
                  value={editForm.deadline}
                  onChange={(e) => updateEditField("deadline", e.target.value)}
                />
              </label>

              <label>
                <span>Umumiy qarz</span>
                <input
                  type="number"
                  min="0"
                  value={editForm.debt}
                  onChange={(e) => updateEditField("debt", e.target.value)}
                />
              </label>

              <label>
                <span>To'langan summa</span>
                <input
                  type="number"
                  min="0"
                  value={editForm.paid}
                  onChange={(e) => updateEditField("paid", e.target.value)}
                />
              </label>

              <label>
                <span>Qolgan qarz</span>
                <input type="text" value={formatPrice(editBalance)} readOnly />
              </label>

              <label className="full-width">
                <span>Izoh</span>
                <textarea
                  rows="3"
                  value={editForm.notes}
                  onChange={(e) => updateEditField("notes", e.target.value)}
                />
              </label>
            </div>

            <div className="payment-actions">
              {editError && <div className="form-error">{editError}</div>}

              <button
                className="cancel-btn"
                onClick={() => setShowEditModal(false)}
              >
                Bekor qilish
              </button>

              <button
                className="confirm-btn"
                disabled={savingEdit}
                onClick={handleUpdateSupplier}
              >
                {savingEdit ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <h2>To'lov qilish</h2>
            <p>{selectedSupplier?.name}</p>

            <input
              type="number"
              placeholder="To'lov summasi"
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

                if (nextAmount < 0) return;

                setPaymentAmount(
                  String(Math.min(nextAmount, selectedSupplierBalance)),
                );
              }}
            />

            <div className="payment-actions">
              {paymentError && <div className="form-error">{paymentError}</div>}

              <button className="cancel-btn" onClick={() => setShowModal(false)}>
                Bekor qilish
              </button>

              <button
                className="confirm-btn"
                disabled={isPaymentInvalid || savingPayment}
                onClick={handleSupplierPayment}
              >
                {savingPayment ? "Saqlanmoqda..." : "To'lovni saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="payment-modal">
            <h2>Yangi ta'minotchi</h2>

            <input
              type="text"
              placeholder="Ta'minotchi nomi"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />

            <input
              type="number"
              placeholder="Boshlang'ich qarz"
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
              {supplierError && (
                <div className="form-error">{supplierError}</div>
              )}

              <button
                className="cancel-btn"
                onClick={() => setShowAddModal(false)}
              >
                Bekor qilish
              </button>

              <button
                className="confirm-btn"
                disabled={savingSupplier}
                onClick={handleAddSupplier}
              >
                {savingSupplier ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Suppliers;
