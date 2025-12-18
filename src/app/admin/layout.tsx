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
            <Link href="/" className="text-2xl font-semibold">
              Techleap
            </Link>
            <span className="text-white/60">Admin</span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="flex items-center gap-6">
              <Link
                href="/admin"
                className="text-white/80 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/admin/pdfs"
                className="text-white/80 hover:text-white transition-colors"
              >
                PDFs
              </Link>
              <Link
                href="/admin/pending"
                className="text-white/80 hover:text-white transition-colors"
              >
                Pending
              </Link>
              <Link
                href="/admin/status"
                className="text-white/80 hover:text-white transition-colors"
              >
                Status
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
