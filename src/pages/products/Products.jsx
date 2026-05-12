import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

import {
  FiSearch,
  FiPackage,
  FiEdit2,
  FiTrash2,
  FiX,
  FiChevronDown,
  FiCheck,
} from "react-icons/fi";

import { formatPrice } from "../../utils/formatPrice";

import { useStore } from "../../context/StoreContext";

import "./product.scss";

function Products() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const [search, setSearch] = useState("");

  const { inventory, setInventory, addActivityLog } = useStore();

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [sortType, setSortType] = useState("az");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openFilter, setOpenFilter] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    quantity: "",
    costPrice: "",
    sellPrice: "",
    supplier: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      sku: "",
      category: "",
      quantity: "",
      costPrice: "",
      sellPrice: "",
      supplier: "",
    });

    setEditingProduct(null);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);

    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      quantity: product.quantity,
      costPrice: product.costPrice,
      sellPrice: product.sellPrice,
      supplier: product.supplier,
    });

    setShowModal(true);
  };

  const handleSaveProduct = () => {
    if (!formData.name || !formData.sku || !formData.sellPrice) return;

    if (editingProduct) {
      const nextSellPrice = Number(formData.sellPrice);
      const nextQuantity = Number(formData.quantity);

      const updated = inventory.map((item) =>
        item.id === editingProduct.id
          ? {
              ...item,
              ...formData,
              quantity: Number(formData.quantity),
              costPrice: Number(formData.costPrice),
              sellPrice: Number(formData.sellPrice),
            }
          : item,
      );

      setInventory(updated);

      addActivityLog({
        type: "product",
        title: "Mahsulot tahrirlandi",
        description: `${formData.name} ma'lumotlari yangilandi`,
        userName: currentUser?.name,
        userRole: currentUser?.role,
      });

      if (Number(editingProduct.sellPrice) !== nextSellPrice) {
        addActivityLog({
          type: "price",
          title: "Narx o'zgartirildi",
          description: `${editingProduct.name} narxi ${formatPrice(
            editingProduct.sellPrice,
          )}dan ${formatPrice(nextSellPrice)}ga o'zgartirildi`,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        });
      }

      if (Number(editingProduct.quantity) !== nextQuantity) {
        addActivityLog({
          type: "stock",
          title: "Qoldiq o'zgartirildi",
          description: `${editingProduct.name} qoldig'i ${editingProduct.quantity} donadan ${nextQuantity} donaga o'zgartirildi`,
          userName: currentUser?.name,
          userRole: currentUser?.role,
        });
      }
    } else {
      const newProduct = {
        id: crypto.randomUUID(),
        ...formData,
        quantity: Number(formData.quantity),
        costPrice: Number(formData.costPrice),
        sellPrice: Number(formData.sellPrice),
      };

      setInventory([newProduct, ...inventory]);

      addActivityLog({
        type: "product",
        title: "Yangi mahsulot qo'shildi",
        description: `${newProduct.name} katalogga qo'shildi`,
        userName: currentUser?.name,
        userRole: currentUser?.role,
      });
    }

    resetForm();
    setShowModal(false);
  };

  const handleDeleteProduct = (id) => {
    const product = inventory.find((item) => item.id === id);
    const filtered = inventory.filter((item) => item.id !== id);
    setInventory(filtered);

    if (product) {
      addActivityLog({
        type: "product",
        title: "Mahsulot o'chirildi",
        description: `${product.name} katalogdan o'chirildi`,
        userName: currentUser?.name,
        userRole: currentUser?.role,
      });
    }
  };

  const getStatus = (qty) => {
    if (qty === 0) {
      return {
        text: "Tugagan",

        className: "danger",
      };
    }

    if (qty <= 10) {
      return {
        text: "Kam qolgan",

        className: "warning",
      };
    }

    return {
      text: "Mavjud",

      className: "success",
    };
  };

  const sortOptions = [
    { value: "az", label: "A-Z" },
    { value: "za", label: "Z-A" },
    { value: "priceHigh", label: "Qimmat" },
    { value: "priceLow", label: "Arzon" },
    { value: "stockHigh", label: "Qoldiq ko'p" },
    { value: "stockLow", label: "Qoldiq kam" },
  ];

  const statusOptions = [
    { value: "all", label: "Barchasi" },
    { value: "success", label: "Mavjud", className: "success" },
    { value: "warning", label: "Kam qolgan", className: "warning" },
    { value: "danger", label: "Tugagan", className: "danger" },
  ];

  const selectedSort =
    sortOptions.find((option) => option.value === sortType) || sortOptions[0];

  const selectedStatus =
    statusOptions.find((option) => option.value === statusFilter) ||
    statusOptions[0];

  const filteredProducts = inventory
    .filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.sku.toLowerCase().includes(search.toLowerCase());

      const status = getStatus(Number(product.quantity)).className;

      const matchesStatus = statusFilter === "all" || statusFilter === status;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortType === "az") {
        return a.name.localeCompare(b.name);
      }

      if (sortType === "za") {
        return b.name.localeCompare(a.name);
      }

      if (sortType === "priceHigh") {
        return Number(b.sellPrice) - Number(a.sellPrice);
      }

      if (sortType === "priceLow") {
        return Number(a.sellPrice) - Number(b.sellPrice);
      }

      if (sortType === "stockHigh") {
        return Number(b.quantity) - Number(a.quantity);
      }

      if (sortType === "stockLow") {
        return Number(a.quantity) - Number(b.quantity);
      }

      return 0;
    });

  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <h1>Mahsulotlar</h1>

          <p>Umumiy mahsulot katalogi</p>
        </div>

        <div className="products-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Mahsulot qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="products-filters">
          <div className="filter-group filter-dropdown">
            <button
              className="filter-trigger"
              onClick={() =>
                setOpenFilter(openFilter === "sort" ? null : "sort")
              }
              type="button"
            >
              <span>Saralash</span>
              <strong>{selectedSort.label}</strong>
              <FiChevronDown />
            </button>

            {openFilter === "sort" && (
              <div className="filter-menu">
                {sortOptions.map((option) => (
                  <button
                    className={sortType === option.value ? "active" : ""}
                    key={option.value}
                    onClick={() => {
                      setSortType(option.value);
                      setOpenFilter(null);
                    }}
                    type="button"
                  >
                    <span>{option.label}</span>

                    {sortType === option.value && <FiCheck />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="filter-group filter-dropdown">
            <button
              className={`filter-trigger ${selectedStatus.className || ""}`}
              onClick={() =>
                setOpenFilter(openFilter === "status" ? null : "status")
              }
              type="button"
            >
              <span>Status</span>
              <strong>{selectedStatus.label}</strong>
              <FiChevronDown />
            </button>

            {openFilter === "status" && (
              <div className="filter-menu">
                {statusOptions.map((option) => (
                  <button
                    className={`${statusFilter === option.value ? "active" : ""} ${
                      option.className || ""
                    }`}
                    key={option.value}
                    onClick={() => {
                      setStatusFilter(option.value);
                      setOpenFilter(null);
                    }}
                    type="button"
                  >
                    <span>{option.label}</span>

                    {statusFilter === option.value && <FiCheck />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="filter-group filter-group-old">
            <button
              className={sortType === "az" ? "active" : ""}
              onClick={() => setSortType("az")}
            >
              A-Z
            </button>

            <button
              className={sortType === "priceHigh" ? "active" : ""}
              onClick={() => setSortType("priceHigh")}
            >
              Qimmat
            </button>

            <button
              className={sortType === "priceLow" ? "active" : ""}
              onClick={() => setSortType("priceLow")}
            >
              Arzon
            </button>

            <button
              className={sortType === "stockHigh" ? "active" : ""}
              onClick={() => setSortType("stockHigh")}
            >
              Qoldiq ko‘p
            </button>

            <button
              className={sortType === "stockLow" ? "active" : ""}
              onClick={() => setSortType("stockLow")}
            >
              Qoldiq kam
            </button>
          </div>

          <div className="filter-group filter-group-old">
            <button
              className={statusFilter === "all" ? "active" : ""}
              onClick={() => setStatusFilter("all")}
            >
              Barchasi
            </button>

            <button
              className={statusFilter === "success" ? "active success" : ""}
              onClick={() => setStatusFilter("success")}
            >
              Mavjud
            </button>

            <button
              className={statusFilter === "warning" ? "active warning" : ""}
              onClick={() => setStatusFilter("warning")}
            >
              Kam qolgan
            </button>

            <button
              className={statusFilter === "danger" ? "active danger" : ""}
              onClick={() => setStatusFilter("danger")}
            >
              Tugagan
            </button>
          </div>
        </div>
      </div>

      <div className="products-table-wrapper">
        <table className="products-table">
          <thead>
            <tr>
              <th>Mahsulot</th>

              <th>SKU</th>

              <th>Kategoriya</th>

              <th>Narx</th>

              <th>Qoldiq</th>

              <th>Status</th>

              <th>Amallar</th>
            </tr>
          </thead>

          <tbody>
            {filteredProducts.map((product) => (
              <tr key={product.id}>
                <td>
                  <div className="product-name">
                    <div className="product-icon">
                      <FiPackage />
                    </div>

                    <span>{product.name}</span>
                  </div>
                </td>

                <td>{product.sku}</td>

                <td>{product.category || "Kategoriya yo‘q"}</td>

                <td>{formatPrice(product.sellPrice)}</td>

                <td>{product.quantity} dona</td>

                <td>
                  <span
                    className={`status-badge ${
                      getStatus(product.quantity).className
                    }`}
                  >
                    {getStatus(product.quantity).text}
                  </span>
                </td>

                <td>
                  <div
                    className={`product-actions ${!isAdmin ? "disabled" : ""}`}
                  >
                    <button
                      onClick={() => {
                        if (!isAdmin) return;
                        openEditModal(product);
                      }}
                    >
                      <FiEdit2 />
                    </button>

                    <button
                      className="delete"
                      onClick={() => {
                        if (!isAdmin) return;
                        handleDeleteProduct(product.id);
                      }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="modal-overlay">
          <div className="product-modal">
            <div className="modal-top">
              <div>
                <h2>
                  {editingProduct ? "Mahsulotni tahrirlash" : "Yangi mahsulot"}
                </h2>
                <p>Mahsulot ma’lumotlarini kiriting</p>
              </div>

              <button onClick={() => setShowModal(false)}>
                <FiX />
              </button>
            </div>

            <div className="product-form">
              <input
                type="text"
                placeholder="Mahsulot nomi"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="SKU"
                value={formData.sku}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="Kategoriya"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Soni"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Tannarx"
                value={formData.costPrice}
                onChange={(e) =>
                  setFormData({ ...formData, costPrice: e.target.value })
                }
              />

              <input
                type="number"
                placeholder="Sotuv narxi"
                value={formData.sellPrice}
                onChange={(e) =>
                  setFormData({ ...formData, sellPrice: e.target.value })
                }
              />

              <input
                type="text"
                placeholder="Ta’minotchi"
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
              />

              <button className="save-product-btn" onClick={handleSaveProduct}>
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Products;
