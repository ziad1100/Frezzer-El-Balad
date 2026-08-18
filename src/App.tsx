import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, ScrollRestoration, useLocation } from 'react-router';
import { RootLayout } from '@/components/layout/RootLayout';
import { ProtectedRoute, GuestRoute, AdminRoute } from '@/routes/guards';
import { HomePage } from '@/pages/HomePage';
import { useTheme } from '@/hooks/useTheme';

const MenuPage = lazy(() => import('@/pages/MenuPage').then((m) => ({ default: m.MenuPage })));
const OffersPage = lazy(() => import('@/pages/OffersPage').then((m) => ({ default: m.OffersPage })));
const OfferDetailPage = lazy(() => import('@/pages/OfferDetailPage').then((m) => ({ default: m.OfferDetailPage })));
const ProductPage = lazy(() => import('@/pages/ProductPage').then((m) => ({ default: m.ProductPage })));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const OrdersPage = lazy(() => import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })));
const BranchesPage = lazy(() => import('@/pages/BranchesPage').then((m) => ({ default: m.BranchesPage })));
const BlogPage = lazy(() => import('@/pages/BlogPage').then((m) => ({ default: m.BlogPage })));
const PostPage = lazy(() => import('@/pages/PostPage').then((m) => ({ default: m.PostPage })));
const GalleryPage = lazy(() => import('@/pages/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const ContactPage = lazy(() => import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const AdminIndexPage = lazy(() => import('@/pages/admin/AdminIndexPage').then((m) => ({ default: m.AdminIndexPage })));
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminOrdersPage = lazy(() => import('@/pages/admin/AdminOrdersPage').then((m) => ({ default: m.AdminOrdersPage })));
const AdminUsersPage = lazy(() => import('@/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminPostsPage = lazy(() => import('@/pages/admin/AdminPostsPage').then((m) => ({ default: m.AdminPostsPage })));
const AdminBranchesPage = lazy(() => import('@/pages/admin/AdminBranchesPage').then((m) => ({ default: m.AdminBranchesPage })));
const AdminCouponsPage = lazy(() => import('@/pages/admin/AdminCouponsPage').then((m) => ({ default: m.AdminCouponsPage })));
const AdminOffersPage = lazy(() => import('@/pages/admin/AdminOffersPage').then((m) => ({ default: m.AdminOffersPage })));
const AdminBannersPage = lazy(() => import('@/pages/admin/AdminBannersPage').then((m) => ({ default: m.AdminBannersPage })));
const AdminContactsPage = lazy(() => import('@/pages/admin/AdminContactsPage').then((m) => ({ default: m.AdminContactsPage })));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminAccountPage = lazy(() => import('@/pages/admin/AdminAccountPage').then((m) => ({ default: m.AdminAccountPage })));
const AdminReviewsPage = lazy(() => import('@/pages/admin/AdminReviewsPage').then((m) => ({ default: m.AdminReviewsPage })));
const AdminGalleryPage = lazy(() => import('@/pages/admin/AdminGalleryPage').then((m) => ({ default: m.AdminGalleryPage })));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-night-950">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  );
}

function ThemeBootstrap() {
  useTheme();
  return null;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <ScrollToTop />
        <ScrollRestoration />
        <RootLayout />
      </>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'menu', element: <MenuPage /> },
      { path: 'offers', element: <OffersPage /> },
      { path: 'offers/:id', element: <OfferDetailPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      {
        path: 'login',
        element: (
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        ),
      },
      {
        path: 'register',
        element: (
          <GuestRoute>
            <RegisterPage />
          </GuestRoute>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <GuestRoute>
            <ForgotPasswordPage />
          </GuestRoute>
        ),
      },
      {
        path: 'reset-password',
        element: (
          <GuestRoute>
            <ResetPasswordPage />
          </GuestRoute>
        ),
      },
      {
        path: 'verify-email',
        element: <VerifyEmailPage />,
      },
      {
        path: 'auth/callback',
        element: <AuthCallbackPage />,
      },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      { path: 'about', element: <AboutPage /> },
      { path: 'branches', element: <BranchesPage /> },
      { path: 'blog', element: <BlogPage /> },
      { path: 'blog/:slug', element: <PostPage /> },
      { path: 'gallery', element: <GalleryPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <AdminRoute>
        <AdminLayout />
      </AdminRoute>
    ),
    children: [
      { index: true, element: <AdminIndexPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'offers', element: <AdminOffersPage /> },
      { path: 'coupons', element: <AdminCouponsPage /> },
      { path: 'banners', element: <AdminBannersPage /> },
      { path: 'gallery', element: <AdminGalleryPage /> },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'reviews', element: <AdminReviewsPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'posts', element: <AdminPostsPage /> },
      { path: 'branches', element: <AdminBranchesPage /> },
      { path: 'contacts', element: <AdminContactsPage /> },
      { path: 'settings', element: <AdminSettingsPage /> },
      { path: 'account', element: <AdminAccountPage /> },
    ],
  },
]);

export function App() {
  return (
    <>
      <ThemeBootstrap />
      <Suspense fallback={<PageFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </>
  );
}
