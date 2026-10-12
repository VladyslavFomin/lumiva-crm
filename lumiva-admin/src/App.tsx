import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './auth'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import BlogListPage from './pages/BlogListPage'
import BlogEditorPage from './pages/BlogEditorPage'
import CasesListPage from './pages/CasesListPage'
import CaseEditorPage from './pages/CaseEditorPage'
import FormsPage from './pages/FormsPage'
import MediaPage from './pages/MediaPage'
import SettingsPage from './pages/SettingsPage'
import NewsletterPage from './pages/NewsletterPage'

function Require({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Require><Layout /></Require>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="blog" element={<BlogListPage />} />
          <Route path="blog/new" element={<BlogEditorPage />} />
          <Route path="blog/:id" element={<BlogEditorPage />} />
          <Route path="cases" element={<CasesListPage />} />
          <Route path="cases/new" element={<CaseEditorPage />} />
          <Route path="cases/:id" element={<CaseEditorPage />} />
          <Route path="forms" element={<FormsPage />} />
          <Route path="newsletter" element={<NewsletterPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
