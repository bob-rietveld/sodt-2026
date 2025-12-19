import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-foreground/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-primary">Techleap</h1>
          <nav className="flex items-center gap-6">
            <Link href="/reports" className="text-foreground hover:text-primary transition-colors">
              Reports
            </Link>
            <Link href="/search" className="text-foreground hover:text-primary transition-colors">
              Search
            </Link>
            <Link href="/chat" className="text-foreground hover:text-primary transition-colors">
              Chat
            </Link>
            <Link href="/upload" className="text-foreground hover:text-primary transition-colors">
              Upload
            </Link>
            <Link
              href="/admin"
              className="bg-secondary text-white px-4 py-2 rounded-lg hover:bg-secondary/90 transition-colors"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-5xl font-semibold text-foreground mb-6">
            PDF Intelligence Platform
          </h2>
          <p className="text-xl text-foreground/70 mb-12 max-w-2xl mx-auto">
            Search through documents, chat with your PDFs using AI, and manage your document library with ease.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            {/* Search Card */}
            <Link
              href="/search"
              className="bg-white p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Search</h3>
              <p className="text-foreground/60">
                Find relevant documents instantly with semantic search
              </p>
            </Link>

            {/* Chat Card */}
            <Link
              href="/chat"
              className="bg-white p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Chat</h3>
              <p className="text-foreground/60">
                Ask questions and get AI-powered answers from your documents
              </p>
            </Link>

            {/* Upload Card */}
            <Link
              href="/upload"
              className="bg-white p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload</h3>
              <p className="text-foreground/60">
                Add new PDF documents to the knowledge base
              </p>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
