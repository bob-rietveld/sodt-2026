import { UserButton } from "@/components/clerk/user-button";
import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-secondary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-semibold flex items-center gap-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 6v12M20 6v12"/>
                <rect x="7" y="10" width="10" height="6" rx="1" fill="currentColor" opacity="0.2"/>
              </svg>
              TechStaple
            </Link>
            <span className="text-white/60">Admin Panel</span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-1">
              <Link
                href="/admin"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Overview
              </Link>
              <Link
                href="/admin/pdfs"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Documents
              </Link>
              <Link
                href="/admin/pending"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Review Queue
              </Link>
              <Link
                href="/admin/status"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Processing
              </Link>
              <Link
                href="/admin/analytics"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Analytics
              </Link>
              <Link
                href="/admin/settings"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Settings
              </Link>
              <Link
                href="/admin/faq"
                className="px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-medium"
              >
                Help
              </Link>
            </nav>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
