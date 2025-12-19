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
            <Link href="/about" className="text-foreground hover:text-primary transition-colors">
              About
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
          <p className="text-primary font-semibold mb-4 tracking-wide uppercase text-sm">
            European Tech Intelligence
          </p>
          <h2 className="text-5xl font-semibold text-foreground mb-6">
            Your Gateway to the European Tech Ecosystem
          </h2>
          <p className="text-xl text-foreground/70 mb-12 max-w-3xl mx-auto">
            Access comprehensive reports and insights on Europe&apos;s thriving startup landscape.
            From funding trends to deep tech innovations, explore the data shaping the future of European technology.
          </p>

          <div className="flex justify-center gap-4 mb-16">
            <Link
              href="/reports"
              className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold"
            >
              Browse Reports
            </Link>
            <Link
              href="/about"
              className="bg-white text-foreground px-8 py-3 rounded-lg hover:bg-foreground/5 transition-colors border border-foreground/10"
            >
              Learn More
            </Link>
          </div>

          {/* Stats Section */}
          <div className="grid md:grid-cols-3 gap-8 mb-16 py-8 border-y border-foreground/10">
            <div>
              <p className="text-4xl font-semibold text-primary">€3.1B+</p>
              <p className="text-foreground/60 mt-2">Dutch VC funding in 2024</p>
            </div>
            <div>
              <p className="text-4xl font-semibold text-primary">#4</p>
              <p className="text-foreground/60 mt-2">Largest European startup hub</p>
            </div>
            <div>
              <p className="text-4xl font-semibold text-primary">35%</p>
              <p className="text-foreground/60 mt-2">Deep tech ecosystem share</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Reports Card */}
            <Link
              href="/reports"
              className="bg-white p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Explore Reports</h3>
              <p className="text-foreground/60">
                Browse the State of Dutch Tech and other ecosystem analyses
              </p>
            </Link>

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
              <h3 className="text-xl font-semibold mb-2">Semantic Search</h3>
              <p className="text-foreground/60">
                Find insights across all reports with AI-powered search
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
              <h3 className="text-xl font-semibold mb-2">Ask Questions</h3>
              <p className="text-foreground/60">
                Chat with AI to get answers from ecosystem reports
              </p>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <p className="text-foreground/60 text-sm">
              Powered by Techleap — Accelerating the Dutch tech ecosystem
            </p>
            <Link href="/about" className="text-primary hover:text-primary/80 text-sm">
              About Techleap
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
