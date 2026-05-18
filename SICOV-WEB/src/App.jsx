import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage as HomePage } from './pages/DashboardPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OrdersListPage } from './pages/orders/OrdersListPage';
import { NewOrderPage } from './pages/orders/NewOrderPage';
import { OrderDetailPage } from './pages/orders/OrderDetailPage';
import { EditOrderPage } from './pages/orders/EditOrderPage';
import { ClientsListPage } from './pages/clients/ClientsListPage';
import { ClientFormPage } from './pages/clients/ClientFormPage';
import { ClientDetailPage } from './pages/clients/ClientDetailPage';
import { ProductsListPage } from './pages/products/ProductsListPage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { ProductFormPage } from './pages/products/ProductFormPage';
import { CommissionsListPage } from './pages/commissions/CommissionsListPage';
import { QuotationsListPage } from './pages/quotations/QuotationsListPage';
import { NewQuotationPage } from './pages/quotations/NewQuotationPage';
import { QuotationDetailPage } from './pages/quotations/QuotationDetailPage';
import { EditQuotationPage } from './pages/quotations/EditQuotationPage';
import { SuppliersListPage } from './pages/suppliers/SuppliersListPage';
import { SupplierFormPage } from './pages/suppliers/SupplierFormPage';
import { SupplierDetailPage } from './pages/suppliers/SupplierDetailPage';
import { UsersListPage } from './pages/users/UsersListPage';
import { UserFormPage } from './pages/users/UserFormPage';
import { SettingsPage } from './pages/settings/SettingsPage';

function PublicRoute({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<HomePage />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Pedidos */}
        <Route path="orders" element={<OrdersListPage />} />
        <Route path="orders/new" element={<NewOrderPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="orders/:id/edit" element={<EditOrderPage />} />

        {/* Orçamentos */}
        <Route path="quotations" element={<QuotationsListPage />} />
        <Route path="quotations/new" element={<NewQuotationPage />} />
        <Route path="quotations/:id" element={<QuotationDetailPage />} />
        <Route path="quotations/:id/edit" element={<EditQuotationPage />} />

        {/* Comissões */}
        <Route path="commissions" element={<CommissionsListPage />} />

        {/* Clientes */}
        <Route path="clients" element={<ClientsListPage />} />
        <Route path="clients/new" element={<ClientFormPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="clients/:id/edit" element={<ClientFormPage />} />

        {/* Produtos */}
        <Route path="products" element={<ProductsListPage />} />
        <Route path="products/new" element={<ProtectedRoute adminOnly><ProductFormPage /></ProtectedRoute>} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="products/:id/edit" element={<ProtectedRoute adminOnly><ProductFormPage /></ProtectedRoute>} />

        {/* Fornecedores */}
        <Route path="suppliers" element={<SuppliersListPage />} />
        <Route path="suppliers/new" element={<ProtectedRoute adminOnly><SupplierFormPage /></ProtectedRoute>} />
        <Route path="suppliers/:id" element={<SupplierDetailPage />} />
        <Route path="suppliers/:id/edit" element={<ProtectedRoute adminOnly><SupplierFormPage /></ProtectedRoute>} />

        {/* Representantes (admin) */}
        <Route path="users" element={<ProtectedRoute adminOnly><UsersListPage /></ProtectedRoute>} />
        <Route path="users/new" element={<ProtectedRoute adminOnly><UserFormPage /></ProtectedRoute>} />
        <Route path="users/:id/edit" element={<ProtectedRoute adminOnly><UserFormPage /></ProtectedRoute>} />

        {/* Configurações */}
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
