import Link from "next/link";
import Image from "next/image";
import { Header } from "@/components/ui/header";
import { HomeContent } from "./home-content";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero Section with Background Illustration */}
      <main className="relative overflow-hidden">
        {/* Background illustration */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="max-w-7xl mx-auto h-full relative px-4 sm:px-6 lg:px-8">
            <div className="absolute right-0 top-0 bottom-0 w-[500px] lg:w-[600px]">
              <Image
                src="/pechtold.png"
                alt=""
                fill
                className="object-contain object-right-bottom opacity-30"
                priority
              />
            </div>
          </div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="max-w-3xl">
          

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground mb-6 leading-tight">
              All the Reports,{" "}
              <span className="text-primary">Stapled Together</span>
            </h1>

            <p className="text-lg sm:text-xl text-foreground/70 mb-8 sm:mb-10 leading-relaxed">
              TechStaple brings together the essential reports on the Dutch and European tech ecosystem.
              Chat with AI to explore years of data, analyze trends, and get insights from the documents
              that shape policy and investment decisions.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-8">
              <Link
                href="/reports"
                className="bg-primary text-white px-8 py-3.5 rounded-lg hover:bg-primary/90 transition-colors font-semibold text-center inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Browse Reports
              </Link>
              <Link
                href="/chat"
                className="bg-white text-foreground px-8 py-3.5 rounded-lg hover:bg-foreground/5 transition-colors border border-foreground/10 text-center inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with AI
              </Link>
            </div>

            {/* Quick stats teaser */}
            <div className="flex flex-wrap gap-6 text-sm text-foreground/60">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 6v12M20 6v12"/>
                </svg>
                <span>State of Dutch Tech reports</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>AI-powered analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>Trend tracking</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Stats and Reports Section */}
      <section className="bg-white border-t border-foreground/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <HomeContent />
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3">
            Your Tech Report Toolkit
          </h2>
          <p className="text-foreground/60 max-w-2xl mx-auto">
            Navigate years of research and data with powerful tools designed for policy makers, investors, and ecosystem builders.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Reports Card */}
          <Link
            href="/reports"
            className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Explore Reports</h3>
            <p className="text-foreground/60 text-sm sm:text-base">
              Browse the State of Dutch Tech and other ecosystem analyses — all stapled in one place
            </p>
          </Link>

          {/* Chat Card */}
          <Link
            href="/chat"
            className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group sm:col-span-2 lg:col-span-1"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2">Chat with AI</h3>
            <p className="text-foreground/60 text-sm sm:text-base">
              Ask questions and get AI-powered answers from ecosystem reports
            </p>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-foreground/10 mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-foreground/60 text-sm">
              <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 6v12M20 6v12"/>
              </svg>
              <span>TechStaple — Dutch Tech Intelligence, stapled together</span>
            </div>
            <Link href="/about" className="text-primary hover:text-primary/80 text-sm">
              About this project
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
