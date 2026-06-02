import "./inventory.scss";

import { useState } from "react";

import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

import {
  FiPlus,
  FiPackage,
  FiTrash2,
  FiEdit2,
  FiX,
  FiChevronDown,
  FiCheck,
} from "react-icons/fi";
import { formatPrice } from "../../utils/formatPrice";
import {
  getApiErrorMessage,
  isCreditPaymentStatus,
  parseProductSaveResponse,
  upsertById,
} from "../../utils/apiFlow";

function Inventory() {
  const { currentUser } = useAuth();
  const defaultCategories = [
    "Chexollar",
    "Quloqchinlar",
    "Zaryadkalar",
    "Kabellar",
    "Aksessuarlar",
  ];

  const [showModal, setShowModal] = useState(false);

  const [editModal, setEditModal] = useState(false);

  const [editingItem, setEditingItem] = useState(null);
  const [openSelect, setOpenSelect] = useState(null);

  const [savedCategories, setSavedCategories] = useState([]);
  const [savingInventory, setSavingInventory] = useState(false);
  const [deletingInventoryId, setDeletingInventoryId] = useState(null);
  const [inventoryError, setInventoryError] = useState("");

  const generateSku = () => {
    return `TP-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    supplier: "",
    quantity: "",
    costPrice: "",
    sellPrice: "",
    returnDays: "",
    paymentStatus: "paid",
    debtAmount: "",
    supplierPhone: "",
    category: "",
    customCategory: "",
    date: new Date().toISOString().split("T")[0],
  });

  const {
    inventory,
    setInventory,

    suppliers,
    setSuppliers,

    addActivityLog,
  } = useStore();

  const handleEdit = (item) => {
    setEditingItem(item);
    setInventoryError("");

    setFormData({
      ...item,
      paymentStatus: item.paymentStatus || "paid",
      debtAmount: item.debtAmount || "",
      supplierPhone: item.supplierPhone || "",
      returnDays: item.returnDays || "",
      customCategory: item.customCategory || "",
      date: item.date || new Date().toISOString().split("T")[0],
    });

    setEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      sku: generateSku(),
      supplier: "",
      quantity: "",
      costPrice: "",
      sellPrice: "",
      returnDays: "",
      paymentStatus: "paid",
      debtAmount: "",
      supplierPhone: "",
      category: "",
      customCategory: "",
      date: new Date().toISOString().split("T")[0],
    });
  };

  const categoryOptions = [
    ...new Set([
      ...defaultCategories,
      ...savedCategories,
      ...inventory
        .map((item) => item.category)
        .filter((category) => category && category !== "Boshqa"),
    ]),
  ];

  const paymentOptions = [
    { value: "paid", label: "To'langan" },
    { value: "debt", label: "Qarzga olingan" },
  ];

  const selectedCategoryLabel = formData.category || "Kategoriya tanlang";

  const selectedPaymentLabel =
    isCreditPaymentStatus(formData.paymentStatus)
      ? "Qarzga olingan"
      : paymentOptions.find((option) => option.value === formData.paymentStatus)
          ?.label || "To'lov holati";

  const supplierOptions = [
    ...new Set(
      [...suppliers.map((supplier) => supplier.name), ...inventory.map((item) => item.supplier)]
        .map((name) => (name || "").trim())
        .filter(Boolean),
    ),
  ];

  const purchaseTotal =
    Number(formData.costPrice || 0) * Number(formData.quantity || 0);

  const normalizedDebtAmount =
    isCreditPaymentStatus(formData.paymentStatus)
      ? Number(formData.debtAmount || purchaseTotal || 0)
      : 0;

  const buildProductPayload = () => {
    const selectedCategory =
      formData.category === "Boshqa"
        ? (formData.customCategory || "").trim()
        : formData.category;

    const quantity = Math.max(0, Number(formData.quantity || 0));
    const sellPrice = Number(formData.sellPrice || 0);

    return {
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode || null,
      supplier: (formData.supplier || "").trim(),
      quantity,
      stock: quantity,
      costPrice: Number(formData.costPrice || 0),
      sellPrice,
      price: sellPrice,
      category: selectedCategory || "Boshqa",
      returnDays: formData.returnDays || "",
      paymentStatus: isCreditPaymentStatus(formData.paymentStatus)
        ? "credit"
        : "paid",
      debtAmount:
        isCreditPaymentStatus(formData.paymentStatus)
          ? Number(formData.debtAmount || normalizedDebtAmount || 0)
          : 0,
      supplierPhone: formData.supplierPhone || "",
      date: formData.date || new Date().toISOString().split("T")[0],
    };
  };

  const saveNewCategory = (category) => {
    const cleanCategory = category.trim();

    if (
      !cleanCategory ||
      cleanCategory === "Boshqa" ||
      defaultCategories.includes(cleanCategory) ||
      savedCategories.includes(cleanCategory)
    ) {
      return;
    }

    const nextCategories = [...savedCategories, cleanCategory];

    setSavedCategories(nextCategories);
  };

  const handleUpdate = () => {
    if (savingInventory || !editingItem) return;

    setSavingInventory(true);
    setInventoryError("");

    const productPayload = buildProductPayload();
    const nextCostPrice = productPayload.costPrice;
    const nextSellPrice = productPayload.sellPrice;
    const nextQuantity = productPayload.quantity;

    const updatedInventory = inventory.map((item) =>
      String(item.id) === String(editingItem.id)
        ? {
            ...item,
            ...productPayload,
            id: editingItem.id,
          }
        : item,
    );

    setInventory(updatedInventory, { sync: false });

    api
      .put(`/products/${String(editingItem.id)}`, productPayload)
      .then(({ data }) => {
        const { product, supplier } = parseProductSaveResponse(data);

        setInventory(
          (current) =>
            current.map((item) =>
              String(item.id) === String(editingItem.id) ? product : item,
            ),
          { sync: false },
        );

        if (supplier) {
          setSuppliers((current) => upsertById(current, supplier));
        }

        addActivityLog({
          type: "inventory",
          title: "Mahsulot tahrirlandi",
          description: `${formData.name} ombor ma'lumotlari yangilandi`,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        });

        if (Number(editingItem.sellPrice) !== nextSellPrice) {
          addActivityLog({
            type: "price",
            title: "Narx o'zgartirildi",
            description: `${editingItem.name} sotuv narxi ${formatPrice(
              editingItem.sellPrice,
            )}dan ${formatPrice(nextSellPrice)}ga o'zgartirildi`,
            userName: currentUser?.name,
            userRole: currentUser?.role,
          });
        }

        if (Number(editingItem.costPrice) !== nextCostPrice) {
          addActivityLog({
            type: "price",
            title: "Tannarx o'zgartirildi",
            description: `${editingItem.name} tannarxi ${formatPrice(
              editingItem.costPrice,
            )}dan ${formatPrice(nextCostPrice)}ga o'zgartirildi`,
            userName: currentUser?.name,
            userRole: currentUser?.role,
          });
        }

        if (Number(editingItem.quantity) !== nextQuantity) {
          addActivityLog({
            type: "stock",
            title: "Qoldiq o'zgartirildi",
            description: `${editingItem.name} qoldig'i ${editingItem.quantity} donadan ${nextQuantity} donaga o'zgartirildi`,
            userName: currentUser?.name,
            userRole: currentUser?.role,
          });
        }

        setEditModal(false);
        setEditingItem(null);
        resetForm();
      })
      .catch((error) => {
        console.error(
          "Inventory product update error:",
          error.response?.data || error,
        );
        setInventory(inventory, { sync: false });
        setInventoryError(
          getApiErrorMessage(error, "Mahsulot qoldig'ini saqlashda xatolik"),
        );
      })
      .finally(() => setSavingInventory(false));
  };

  const handleSave = () => {
    if (savingInventory) return;

    setSavingInventory(true);
    setInventoryError("");

    const productPayload = buildProductPayload();
    const selectedCategory = productPayload.category;

    saveNewCategory(selectedCategory);

    const cleanSupplierName = productPayload.supplier;
    const debtAmount = productPayload.debtAmount;

    const newItem = {
      ...productPayload,
      id: Date.now(),
    };

    setInventory([newItem, ...inventory], { sync: false });

    api
      .post("/products", newItem)
      .then(({ data }) => {
        const { product, supplier } = parseProductSaveResponse(data);

        setInventory(
          (current) =>
            current.map((item) =>
              String(item.id) === String(newItem.id) ? product : item,
            ),
          { sync: false },
        );

        if (supplier) {
          setSuppliers((current) => upsertById(current, supplier));
        }

        addActivityLog({
          type: "inventory",
          title: "Yangi kirim qilindi",
          description: `${newItem.name} ${newItem.quantity} dona kirim qilindi`,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        });

        if (isCreditPaymentStatus(formData.paymentStatus) && debtAmount > 0) {
          addActivityLog({
            type: "supplier",
            title: "Supplier qarzi qo'shildi",
            description: `${cleanSupplierName} supplieriga ${formatPrice(
              debtAmount,
            )} qarz qo'shildi`,
            userName: currentUser?.name,
            userRole: currentUser?.role,
          });
        }

        setShowModal(false);
        resetForm();
      })
      .catch((error) => {
        console.error(
          "Inventory product create error:",
          error.response?.data || error,
        );
        setInventory(inventory, { sync: false });
        setInventoryError(
          getApiErrorMessage(error, "Mahsulot kirimini saqlashda xatolik"),
        );
      })
      .finally(() => setSavingInventory(false));
  };

  const totalProducts = inventory.length;

  const totalItems = inventory.reduce(
    (acc, item) => acc + Number(item.quantity),
    0,
  );

  const totalCostValue = inventory.reduce(
    (acc, item) => acc + Number(item.quantity) * Number(item.costPrice || 0),
    0,
  );

  const totalSellValue = inventory.reduce(
    (acc, item) => acc + Number(item.quantity) * Number(item.sellPrice || 0),
    0,
  );
  const lowStock = inventory.filter((item) => item.quantity < 20).length;

  const handleDelete = (product) => {
    if (deletingInventoryId) return;

    const deletedItem = product;
    const filtered = inventory.filter(
      (item) => String(item.id) !== String(product.id),
    );

    setDeletingInventoryId(product.id);
    setInventory(filtered, { sync: false });

    api
      .delete(`/products/${String(product.id)}`)
      .then(() => {
        if (deletedItem) {
          addActivityLog({
            type: "inventory",
            title: "Mahsulot o'chirildi",
            description: `${deletedItem.name} ombordan o'chirildi`,
            userName: currentUser?.name,
            userRole: currentUser?.role,
          });
        }
      })
      .catch((error) => {
        setInventory(inventory, { sync: false });
        setInventoryError(
          getApiErrorMessage(error, "Mahsulotni o'chirishda xatolik"),
        );
      })
      .finally(() => setDeletingInventoryId(null));
  };

  return (
    <div className="inventory-page">
      <div className="inventory-header">
        <div>
          <h1>Ombor</h1>

          <p>Mahsulot kirimi va ombor nazorati</p>
        </div>

        <button
          className="inventory-btn"
          onClick={() => {
            setShowModal(true);
            setInventoryError("");

            resetForm();
          }}
        >
          <FiPlus />

          <span>Yangi kirim</span>
        </button>
      </div>

      {inventoryError && !showModal && !editModal && (
        <div className="form-error">{inventoryError}</div>
      )}

      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <h3>Mahsulotlar</h3>

          <h2>{totalProducts}</h2>
        </div>

        <div className="inventory-stat-card">
          <h3>Jami mahsulot soni</h3>

          <h2>{totalItems}</h2>
        </div>

        <div className="inventory-stat-card">
          <h3>Umumiy tannarx</h3>

          <h2>{formatPrice(totalCostValue)}</h2>
        </div>

        <div className="inventory-stat-card">
          <h3>Umumiy sotuv qiymati</h3>

          <h2>{formatPrice(totalSellValue)}</h2>
        </div>

        <div className="inventory-stat-card danger">
          <h3>Kam qolganlar</h3>

          <h2>{lowStock}</h2>
        </div>
      </div>

      <div className="inventory-grid">
        {inventory.map((item, index) => (
          <div
            className={
              item.quantity < 20 ? "inventory-card low-stock" : "inventory-card"
            }
            key={index}
          >
            <div className="inventory-top">
              <div className="inventory-icon">
                <FiPackage />
              </div>

              <span
                className={
                  item.quantity < 20
                    ? "inventory-badge danger"
                    : "inventory-badge"
                }
              >
                {item.quantity} dona
              </span>
            </div>

            <div className="inventory-card-title">
              <h2>{item.name}</h2>

              <p>{item.sku}</p>
            </div>

            <div className="inventory-info">
              <div>
                <span>Tannarx</span>

                <strong>{formatPrice(item.costPrice)}</strong>
              </div>

              <div>
                <span>Sotuv narxi</span>

                <strong>{formatPrice(item.sellPrice)}</strong>
              </div>
            </div>

            <div className="inventory-supplier">
              <span>Ta’minotchi</span>

              <strong>{item.supplier}</strong>
            </div>

            <div className="inventory-card-footer">
              <div className="inventory-payment">
                <span
                  className={`inventory-payment-badge ${
                    isCreditPaymentStatus(item.paymentStatus) ? "debt" : "paid"
                  }`}
                >
                  {isCreditPaymentStatus(item.paymentStatus)
                    ? "Qarzga olingan"
                    : "To'langan"}
                </span>

                {isCreditPaymentStatus(item.paymentStatus) && (
                  <strong>{formatPrice(item.debtAmount || 0)}</strong>
                )}
              </div>

              <div className="inventory-card-actions">
                <button
                  className="edit-btn"
                  onClick={() => handleEdit(item)}
                  type="button"
                >
                  <FiEdit2 />
                </button>

                <button
                  className="delete-btn"
                  disabled={deletingInventoryId === item.id}
                  onClick={() => handleDelete(item)}
                  type="button"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2>Yangi mahsulot kirimi</h2>

              <button onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>

            <div className="modal-form inventory-entry-form">
              <datalist id="supplier-options">
                {supplierOptions.map((supplierName) => (
                  <option key={supplierName} value={supplierName} />
                ))}
              </datalist>

              <div className="modal-section full-width">
                <h3>Mahsulot</h3>

                <div className="section-grid two-columns">
                  <input
                    type="text"
                    placeholder="Mahsulot nomi"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                  />

                  <input type="text" value={formData.sku} readOnly />
                </div>

                <div className="section-grid">
                  <div className="custom-select full-width">
                    <button
                      className="custom-select-trigger"
                      onClick={() =>
                        setOpenSelect(
                          openSelect === "category" ? null : "category",
                        )
                      }
                      type="button"
                    >
                      <span>Kategoriya</span>
                      <strong>{selectedCategoryLabel}</strong>
                      <FiChevronDown />
                    </button>

                    {openSelect === "category" && (
                      <div className="custom-select-menu">
                        {[...categoryOptions, "Boshqa"].map((category) => (
                          <button
                            className={
                              formData.category === category ? "active" : ""
                            }
                            key={category}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                category,
                                customCategory:
                                  category === "Boshqa"
                                    ? formData.customCategory
                                    : "",
                              });
                              setOpenSelect(null);
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

                  {formData.category === "Boshqa" && (
                    <input
                      className="full-width"
                      type="text"
                      placeholder="Kategoriya nomi"
                      value={formData.customCategory || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customCategory: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              </div>

              <div className="modal-section">
                <h3>Narx</h3>

                <input
                  type="number"
                  placeholder="Tannarx"
                  value={formData.costPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costPrice: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Sotuv narxi"
                  value={formData.sellPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sellPrice: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-section">
                <h3>Son</h3>

                <input
                  type="number"
                  placeholder="Mahsulot soni"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Qaytarish muddati"
                  value={formData.returnDays || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      returnDays: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-section">
                <h3>Supplier</h3>

                <input
                  list="supplier-options"
                  type="text"
                  placeholder="Ta'minotchi nomi"
                  value={formData.supplier}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      supplier: e.target.value,
                    })
                  }
                />

                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      date: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-section">
                <h3>Qarz holati</h3>

                <div className="custom-select">
                  <button
                    className="custom-select-trigger"
                    onClick={() =>
                      setOpenSelect(openSelect === "payment" ? null : "payment")
                    }
                    type="button"
                  >
                    <span>To'lov</span>
                    <strong>{selectedPaymentLabel}</strong>
                    <FiChevronDown />
                  </button>

                  {openSelect === "payment" && (
                    <div className="custom-select-menu">
                      {paymentOptions.map((option) => (
                        <button
                          className={
                            (option.value === "debt"
                              ? isCreditPaymentStatus(formData.paymentStatus)
                              : formData.paymentStatus === option.value)
                              ? "active"
                              : ""
                          }
                          key={option.value}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              paymentStatus: option.value,
                              debtAmount:
                                option.value === "debt"
                                  ? formData.debtAmount || String(purchaseTotal)
                                  : "",
                              supplierPhone:
                                option.value === "debt"
                                  ? formData.supplierPhone
                                  : "",
                            });
                            setOpenSelect(null);
                          }}
                          type="button"
                        >
                          <span>{option.label}</span>
                          {(option.value === "debt"
                            ? isCreditPaymentStatus(formData.paymentStatus)
                            : formData.paymentStatus === option.value) && (
                            <FiCheck />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {isCreditPaymentStatus(formData.paymentStatus) && (
                  <>
                    <input
                      type="number"
                      placeholder="Qarz summasi"
                      value={formData.debtAmount || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          debtAmount: e.target.value,
                        })
                      }
                    />

                    <input
                      type="text"
                      placeholder="Telefon raqam"
                      value={formData.supplierPhone || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          supplierPhone: e.target.value,
                        })
                      }
                    />
                  </>
                )}
              </div>

              <div className="modal-actions full-width">
                {inventoryError && (
                  <div className="form-error">{inventoryError}</div>
                )}

                <button
                  className="save-btn"
                  disabled={savingInventory}
                  onClick={handleSave}
                >
                  {savingInventory ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {editModal && (
        <div className="modal-overlay">
          <div className="inventory-modal">
            <div className="modal-header">
              <h2>Mahsulotni tahrirlash</h2>

              <button onClick={() => setEditModal(false)}>×</button>
            </div>

            <div className="modal-form edit-product-form">
              <div className="modal-section full-width">
                <h3>Mahsulot</h3>

                <div className="section-grid two-columns">
                  <input
                    type="text"
                    placeholder="Mahsulot nomi"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        name: e.target.value,
                      })
                    }
                  />

                  <input
                    type="text"
                    placeholder="SKU"
                    value={formData.sku}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sku: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="modal-section">
                <h3>Son</h3>

                <input
                  type="number"
                  placeholder="Miqdori"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      quantity: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-section">
                <h3>Narx</h3>

                <input
                  type="number"
                  placeholder="Tannarx"
                  value={formData.costPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costPrice: e.target.value,
                    })
                  }
                />

                <input
                  type="number"
                  placeholder="Sotuv narxi"
                  value={formData.sellPrice}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sellPrice: e.target.value,
                    })
                  }
                />
              </div>

              <div className="modal-actions full-width">
                {inventoryError && (
                  <div className="form-error">{inventoryError}</div>
                )}

                <button
                  className="save-btn"
                  disabled={savingInventory}
                  onClick={handleUpdate}
                >
                  {savingInventory ? "Saqlanmoqda..." : "Saqlash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Inventory;
