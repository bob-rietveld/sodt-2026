import Link from "next/link";
import { Header } from "@/components/ui/header";
import { HomeContent } from "./home-content";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        <div className="text-center">
          <p className="text-primary font-semibold mb-4 tracking-wide uppercase text-sm">
            European Tech Intelligence
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4 sm:mb-6">
            Your Gateway to the European Tech Ecosystem
          </h2>
          <p className="text-lg sm:text-xl text-foreground/70 mb-8 sm:mb-12 max-w-3xl mx-auto">
            Access comprehensive reports and insights on Europe&apos;s thriving startup landscape.
            From funding trends to deep tech innovations, explore the data shaping the future of European technology.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mb-12 sm:mb-16">
            <Link
              href="/reports"
              className="bg-primary text-white px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold text-center"
            >
              Browse Reports
            </Link>
            <Link
              href="/about"
              className="bg-white text-foreground px-8 py-3 rounded-lg hover:bg-foreground/5 transition-colors border border-foreground/10 text-center"
            >
              Learn More
            </Link>
          </div>

          {/* Dynamic Stats and Latest Reports */}
          <HomeContent />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Reports Card */}
            <Link
              href="/reports"
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Explore Reports</h3>
              <p className="text-foreground/60 text-sm sm:text-base">
                Browse the State of Dutch Tech and other ecosystem analyses
              </p>
            </Link>

            {/* Search Card */}
            <Link
              href="/search"
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Semantic Search</h3>
              <p className="text-foreground/60 text-sm sm:text-base">
                Find insights across all reports with AI-powered search
              </p>
            </Link>

            {/* Chat Card */}
            <Link
              href="/chat"
              className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group sm:col-span-2 lg:col-span-1"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 mx-auto group-hover:bg-primary/20 transition-colors">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2">Ask Questions</h3>
              <p className="text-foreground/60 text-sm sm:text-base">
                Chat with AI to get answers from ecosystem reports
              </p>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/10 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-foreground/60 text-sm text-center sm:text-left">
              European Tech Intelligence — Curated insights on the European startup ecosystem
            </p>
            <Link href="/about" className="text-primary hover:text-primary/80 text-sm">
              About this project
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
