import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage as HomePage } from './pages/DashboardPage';

// Lazy-loaded pages (code splitting)
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const OrdersListPage = lazy(() => import('./pages/orders/OrdersListPage').then(m => ({ default: m.OrdersListPage })));
const NewOrderPage = lazy(() => import('./pages/orders/NewOrderPage').then(m => ({ default: m.NewOrderPage })));
const OrderDetailPage = lazy(() => import('./pages/orders/OrderDetailPage').then(m => ({ default: m.OrderDetailPage })));
const EditOrderPage = lazy(() => import('./pages/orders/EditOrderPage').then(m => ({ default: m.EditOrderPage })));
const ClientsListPage = lazy(() => import('./pages/clients/ClientsListPage').then(m => ({ default: m.ClientsListPage })));
const ClientFormPage = lazy(() => import('./pages/clients/ClientFormPage').then(m => ({ default: m.ClientFormPage })));
const ClientDetailPage = lazy(() => import('./pages/clients/ClientDetailPage').then(m => ({ default: m.ClientDetailPage })));
const ProductsListPage = lazy(() => import('./pages/products/ProductsListPage').then(m => ({ default: m.ProductsListPage })));
const ProductDetailPage = lazy(() => import('./pages/products/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })));
const ProductFormPage = lazy(() => import('./pages/products/ProductFormPage').then(m => ({ default: m.ProductFormPage })));
const CommissionsListPage = lazy(() => import('./pages/commissions/CommissionsListPage').then(m => ({ default: m.CommissionsListPage })));
const QuotationsListPage = lazy(() => import('./pages/quotations/QuotationsListPage').then(m => ({ default: m.QuotationsListPage })));
const NewQuotationPage = lazy(() => import('./pages/quotations/NewQuotationPage').then(m => ({ default: m.NewQuotationPage })));
const QuotationDetailPage = lazy(() => import('./pages/quotations/QuotationDetailPage').then(m => ({ default: m.QuotationDetailPage })));
const EditQuotationPage = lazy(() => import('./pages/quotations/EditQuotationPage').then(m => ({ default: m.EditQuotationPage })));
const SuppliersListPage = lazy(() => import('./pages/suppliers/SuppliersListPage').then(m => ({ default: m.SuppliersListPage })));
const SupplierFormPage = lazy(() => import('./pages/suppliers/SupplierFormPage').then(m => ({ default: m.SupplierFormPage })));
const SupplierDetailPage = lazy(() => import('./pages/suppliers/SupplierDetailPage').then(m => ({ default: m.SupplierDetailPage })));
const UsersListPage = lazy(() => import('./pages/users/UsersListPage').then(m => ({ default: m.UsersListPage })));
const UserFormPage = lazy(() => import('./pages/users/UserFormPage').then(m => ({ default: m.UserFormPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

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
