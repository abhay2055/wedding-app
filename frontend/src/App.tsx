import { Route, Routes } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { VendorDashboardPage } from "./pages/VendorDashboardPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { VendorSearchPage } from "./pages/VendorSearchPage";
import { VendorPublicProfilePage } from "./pages/VendorPublicProfilePage";
import { WeddingSetupPage } from "./pages/WeddingSetupPage";
import { EditWeddingPage } from "./pages/EditWeddingPage";
import { FavoritesPage } from "./pages/FavoritesPage";
import { AdminCategoriesPage } from "./pages/AdminCategoriesPage";
import { AdminVendorsPage } from "./pages/AdminVendorsPage";
import { BookingRequestPage } from "./pages/BookingRequestPage";
import { CustomerBookingsPage } from "./pages/CustomerBookingsPage";
import { CustomerBookingDetailPage } from "./pages/CustomerBookingDetailPage";
import { VendorBookingsPage } from "./pages/VendorBookingsPage";
import { VendorBookingDetailPage } from "./pages/VendorBookingDetailPage";
import { CustomerPaymentsPage } from "./pages/CustomerPaymentsPage";
import { VendorPaymentsPage } from "./pages/VendorPaymentsPage";
import { AdminPaymentsPage } from "./pages/AdminPaymentsPage";
import { CustomerReviewsPage } from "./pages/CustomerReviewsPage";
import { VendorReviewsPage } from "./pages/VendorReviewsPage";
import { AdminReviewsPage } from "./pages/AdminReviewsPage";
import { AdminCustomersPage } from "./pages/AdminCustomersPage";
import { AdminBookingsPage } from "./pages/AdminBookingsPage";
import { AdminAnalyticsPage } from "./pages/AdminAnalyticsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { MessagesPage } from "./pages/MessagesPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/vendors" element={<VendorSearchPage />} />
          <Route path="/vendors/:slug" element={<VendorPublicProfilePage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wedding/new"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <WeddingSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/wedding/:id/edit"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <EditWeddingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <FavoritesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/booking/new"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <BookingRequestPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/bookings"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <CustomerBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/bookings/:id"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <CustomerBookingDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/payments"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <CustomerPaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/reviews"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <CustomerReviewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/notifications"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/messages"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <MessagesPage basePath="/dashboard/messages" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/messages/:conversationId"
            element={
              <ProtectedRoute allowedRoles={["CUSTOMER"]}>
                <MessagesPage basePath="/dashboard/messages" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/bookings"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/bookings/:id"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorBookingDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/payments"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorPaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/reviews"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <VendorReviewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/notifications"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/messages"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <MessagesPage basePath="/vendor/messages" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/messages/:conversationId"
            element={
              <ProtectedRoute allowedRoles={["VENDOR"]}>
                <MessagesPage basePath="/vendor/messages" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminCategoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/vendors"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminVendorsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/payments"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminPaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminCustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/reviews"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminReviewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={["ADMIN"]}>
                <AdminAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
