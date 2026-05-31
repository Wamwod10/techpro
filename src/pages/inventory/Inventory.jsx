import "./inventory.scss";

import { useState } from "react";

import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import { notifyStockAlertsForInventoryChange } from "../../services/telegramService";

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

  const [savedCategories, setSavedCategories] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("techpro_inventory_categories") || "[]",
      );
    } catch {
      return [];
    }
  });

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
    paymentOptions.find((option) => option.value === formData.paymentStatus)
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
    formData.paymentStatus === "debt"
      ? Number(formData.debtAmount || purchaseTotal || 0)
      : 0;

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
    localStorage.setItem(
      "techpro_inventory_categories",
      JSON.stringify(nextCategories),
    );
  };

  const upsertSupplierDebt = (supplierName, supplierPhone, debtAmount, item) => {
    const cleanSupplierName = supplierName.trim();

    if (!cleanSupplierName || debtAmount <= 0) {
      return suppliers;
    }

    const debtEntry = {
      id: Date.now(),
      type: "inventory",
      status: "Qarz",
      productName: item.name,
      amount: debtAmount,
      phone: supplierPhone,
      date: item.date,
      time: new Date().toLocaleTimeString("uz-UZ", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const existingSupplier = suppliers.find(
      (supplier) =>
        supplier.name?.trim().toLowerCase() ===
        cleanSupplierName.toLowerCase(),
    );

    if (!existingSupplier) {
      return [
        {
          id: Date.now(),
          name: cleanSupplierName,
          phone: supplierPhone,
          debt: debtAmount,
          paid: 0,
          deadline: item.date,
          transactions: [debtEntry],
          orders: [debtEntry],
        },
        ...suppliers,
      ];
    }

    return suppliers.map((supplier) => {
      if (supplier.id !== existingSupplier.id) {
        return supplier;
      }

      return {
        ...supplier,
        phone: supplier.phone || supplierPhone,
        deadline: supplier.deadline || item.date,
        debt: Number(supplier.debt || 0) + debtAmount,
        transactions: [debtEntry, ...(supplier.transactions || [])],
        orders: [debtEntry, ...(supplier.orders || [])],
      };
    });
  };

  const handleUpdate = () => {
    const nextCostPrice = Number(formData.costPrice);
    const nextSellPrice = Number(formData.sellPrice);
    const nextQuantity = Number(formData.quantity);

    const updatedInventory = inventory.map((item) =>
      item.id === editingItem.id
        ? {
            ...formData,

            id: editingItem.id,
          }
        : item,
    );

    setInventory(updatedInventory);
    notifyStockAlertsForInventoryChange(inventory, updatedInventory);

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
  };

  const handleSave = () => {
    const selectedCategory =
      formData.category === "Boshqa"
        ? (formData.customCategory || "").trim()
        : formData.category;

    saveNewCategory(selectedCategory);

    const cleanSupplierName = formData.supplier.trim();
    const debtAmount =
      formData.paymentStatus === "debt" ? normalizedDebtAmount : 0;

    const newItem = {
      name: formData.name,
      sku: formData.sku,
      quantity: Number(formData.quantity),
      costPrice: Number(formData.costPrice),
      sellPrice: Number(formData.sellPrice),
      supplier: cleanSupplierName,
      id: Date.now(),
      category: selectedCategory || "Boshqa",
      returnDays: formData.returnDays,
      paymentStatus: formData.paymentStatus,
      debtAmount,
      supplierPhone: formData.supplierPhone,
      date: formData.date,
    };

    setInventory([newItem, ...inventory]);
    notifyStockAlertsForInventoryChange(inventory, [newItem, ...inventory]);

    addActivityLog({
      type: "inventory",
      title: "Yangi kirim qilindi",
      description: `${newItem.name} ${newItem.quantity} dona kirim qilindi`,
      userName: currentUser?.name,
      userRole: currentUser?.role,
    });

    if (formData.paymentStatus === "debt" && debtAmount > 0) {
      setSuppliers(
        upsertSupplierDebt(
          cleanSupplierName,
          formData.supplierPhone,
          debtAmount,
          newItem,
        ),
      );

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
  };

  const totalProducts = inventory.length;

  const totalItems = inventory.reduce(
    (acc, item) => acc + Number(item.quantity),
    0,
  );

  const totalValue = inventory.reduce(
    (acc, item) => acc + Number(item.quantity) * Number(item.sellPrice),
    0,
  );
  const lowStock = inventory.filter((item) => item.quantity < 20).length;

  const handleDelete = (sku) => {
    const deletedItem = inventory.find((item) => item.sku === sku);
    const filtered = inventory.filter((item) => item.sku !== sku);

    setInventory(filtered);

    if (deletedItem) {
      addActivityLog({
        type: "inventory",
        title: "Mahsulot o'chirildi",
        description: `${deletedItem.name} ombordan o'chirildi`,
        userName: currentUser?.name,
        userRole: currentUser?.role,
      });
    }
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

            resetForm();
          }}
        >
          <FiPlus />

          <span>Yangi kirim</span>
        </button>
      </div>

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
          <h3>Umumiy qiymat</h3>

          <h2>{formatPrice(totalValue)}</h2>
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
                    item.paymentStatus === "debt" ? "debt" : "paid"
                  }`}
                >
                  {item.paymentStatus === "debt"
                    ? "Qarzga olingan"
                    : "To'langan"}
                </span>

                {item.paymentStatus === "debt" && (
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
                  onClick={() => handleDelete(item.sku)}
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
                            formData.paymentStatus === option.value
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
                          {formData.paymentStatus === option.value && (
                            <FiCheck />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {formData.paymentStatus === "debt" && (
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
                <button className="save-btn" onClick={handleSave}>
                  Saqlash
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
                <button className="save-btn" onClick={handleUpdate}>
                  Saqlash
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
