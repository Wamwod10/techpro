import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/dashboard/Dashboard";
import Sales from "./pages/sales/Sales";
import Products from "./pages/products/Products";
import Inventory from "./pages/inventory/Inventory";
import Suppliers from "./pages/suppliers/Suppliers";
import History from "./pages/history/History";
import Expenses from "./pages/expenses/Expenses";
import Login from "./pages/login/Login";
import Analytics from "./pages/analytics/Analytics";
import SellerAnalytics from "./pages/sellerAnalytics/SellerAnalytics";
import ActivityLog from "./pages/activityLog/ActivityLog";
import { useAuth } from "./context/AuthContext";
import Shifts from "./pages/shifts/Shifts";

function ProtectedRoute({ children }) {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function RoleRoute({ children, roles }) {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return null;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!roles.includes(currentUser.role)) {
    return (
      <Navigate to={currentUser.role === "cashier" ? "/sales" : "/"} replace />
    );
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/shifts" element={<Shifts />} />
          <Route
            index
            element={
              <RoleRoute roles={["admin"]}>
                <Dashboard />
              </RoleRoute>
            }
          />
          <Route path="sales" element={<Sales />} />
          <Route path="products" element={<Products />} />
          <Route
            path="inventory"
            element={
              <RoleRoute roles={["admin"]}>
                <Inventory />
              </RoleRoute>
            }
          />
          <Route
            path="suppliers"
            element={
              <RoleRoute roles={["admin"]}>
                <Suppliers />
              </RoleRoute>
            }
          />
          <Route path="history" element={<History />} />
          <Route
            path="expenses"
            element={
              <RoleRoute roles={["admin"]}>
                <Expenses />
              </RoleRoute>
            }
          />
          <Route
            path="analytics"
            element={
              <RoleRoute roles={["admin"]}>
                <Analytics />
              </RoleRoute>
            }
          />
          <Route
            path="activity-log"
            element={
              <RoleRoute roles={["admin"]}>
                <ActivityLog />
              </RoleRoute>
            }
          />
          <Route path="/seller-analytics" element={<SellerAnalytics />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
