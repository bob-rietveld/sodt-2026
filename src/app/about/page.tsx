import Link from "next/link";
import { Header } from "@/components/ui/header";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-16">
        {/* Hero Section */}
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-primary font-semibold mb-4 tracking-wide uppercase text-sm">
            About Us
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-foreground mb-4 sm:mb-6">
            Accelerating the Dutch Tech Ecosystem
          </h1>
          <p className="text-lg sm:text-xl text-foreground/70 max-w-3xl mx-auto">
            Techleap is a non-profit organisation funded by the Dutch Ministry of Economic Affairs,
            dedicated to helping Dutch tech scaleups grow and compete on the global stage.
          </p>
        </div>

        {/* Mission Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-12 shadow-sm border border-foreground/5 mb-8 sm:mb-12">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 sm:mb-6">Our Mission</h2>
              <p className="text-foreground/70 mb-4 text-sm sm:text-base">
                Techleap exists to quantify and accelerate the tech ecosystem of the Netherlands.
                We believe that technology is increasingly decisive in international competition,
                and Dutch tech companies need better access to growth capital, talent, and global markets.
              </p>
              <p className="text-foreground/70 mb-4 text-sm sm:text-base">
                Through comprehensive research, ecosystem mapping, and founder support programs,
                we help create the conditions for Dutch startups and scaleups to thrive.
              </p>
              <p className="text-foreground/70 text-sm sm:text-base">
                Our goal is to help create at least ten new technology and market leaders
                in the Netherlands over the next decade.
              </p>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl p-6 sm:p-8">
              <div className="grid grid-cols-3 md:grid-cols-1 gap-4 sm:gap-6">
                <div className="text-center md:text-left">
                  <p className="text-2xl sm:text-4xl font-semibold text-primary">#13</p>
                  <p className="text-foreground/60 text-xs sm:text-base">Global Startup Ranking</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-2xl sm:text-4xl font-semibold text-secondary">#2</p>
                  <p className="text-foreground/60 text-xs sm:text-base">European Talent</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-2xl sm:text-4xl font-semibold text-primary">47%</p>
                  <p className="text-foreground/60 text-xs sm:text-base">VC Funding Growth</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Focus Areas */}
        <div className="mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-6 sm:mb-8 text-center">What We Do</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-foreground/5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Ecosystem Research</h3>
              <p className="text-foreground/60 text-sm sm:text-base">
                We publish the annual State of Dutch Tech report and other comprehensive
                analyses to track the health and growth of the Dutch tech ecosystem.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-foreground/5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Founder Support</h3>
              <p className="text-foreground/60 text-sm sm:text-base">
                We provide programs and resources to help founders scale their companies,
                with a particular focus on deep tech sectors like AI, quantum computing, and semiconductors.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-foreground/5 sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">Ecosystem Development</h3>
              <p className="text-foreground/60 text-sm sm:text-base">
                We connect startups with investors, corporates, and talent while advocating
                for policies that support innovation and entrepreneurship in the Netherlands.
              </p>
            </div>
          </div>
        </div>

        {/* Deep Tech Section */}
        <div className="bg-secondary/5 rounded-2xl p-6 sm:p-8 lg:p-12 mb-8 sm:mb-12">
          <div className="text-center mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3 sm:mb-4">Deep Tech Focus</h2>
            <p className="text-foreground/70 max-w-2xl mx-auto text-sm sm:text-base">
              The Dutch deep tech sector now accounts for 35% of the ecosystem and attracted
              over 1.1 billion in investments. We&apos;re committed to helping these companies scale.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center">
              <p className="text-xl sm:text-2xl font-semibold text-secondary mb-1 sm:mb-2">AI</p>
              <p className="text-foreground/60 text-xs sm:text-sm">Artificial Intelligence</p>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center">
              <p className="text-xl sm:text-2xl font-semibold text-secondary mb-1 sm:mb-2">Quantum</p>
              <p className="text-foreground/60 text-xs sm:text-sm">Quantum Computing</p>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center">
              <p className="text-xl sm:text-2xl font-semibold text-secondary mb-1 sm:mb-2">Semi</p>
              <p className="text-foreground/60 text-xs sm:text-sm">Semiconductors</p>
            </div>
            <div className="bg-white rounded-xl p-4 sm:p-6 text-center">
              <p className="text-xl sm:text-2xl font-semibold text-secondary mb-1 sm:mb-2">Biotech</p>
              <p className="text-foreground/60 text-xs sm:text-sm">Life Sciences</p>
            </div>
          </div>
        </div>

        {/* This Platform Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-12 shadow-sm border border-foreground/5 mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 sm:mb-6 text-center">
            About This Platform
          </h2>
          <p className="text-foreground/70 text-center max-w-3xl mx-auto mb-6 sm:mb-8 text-sm sm:text-base">
            This platform serves as a repository for reports and research on the European tech ecosystem.
            Using AI-powered chat, you can quickly find insights across
            all our published research, from funding trends to talent analyses.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link
              href="/reports"
              className="bg-primary text-white px-6 sm:px-8 py-3 rounded-lg hover:bg-primary/90 transition-colors font-semibold text-center"
            >
              Browse Reports
            </Link>
            <Link
              href="/chat"
              className="bg-secondary text-white px-6 sm:px-8 py-3 rounded-lg hover:bg-secondary/90 transition-colors font-semibold text-center"
            >
              Chat with AI
            </Link>
          </div>
        </div>

        {/* Easter Egg Section */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 lg:p-12 shadow-sm border border-foreground/5 mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground mb-4 sm:mb-6 text-center">
            About the Homepage Image
          </h2>
          <p className="text-foreground/70 text-center max-w-3xl mx-auto mb-4 text-sm sm:text-base">
            Sharp-eyed visitors may have noticed the illustration on our homepage. It&apos;s a tribute to
            a legendary moment in Dutch political history: D66 politician Alexander Pechtold demonstrating
            the power of a stapler during a parliamentary debate.
          </p>
          <p className="text-foreground/70 text-center max-w-3xl mx-auto mb-6 text-sm sm:text-base">
            In 2011, Pechtold used a stapler as a prop to make a point about keeping things together —
            which perfectly captures our mission of &quot;stapling together&quot; all the important tech
            ecosystem reports in one place. The clip became an iconic piece of Dutch political culture.
          </p>
          <div className="flex justify-center">
            <a
              href="https://www.youtube.com/watch?v=Y8GVbHqWroM"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold"
            >
              Watch the original clip
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>

        {/* Contact/Links Section */}
        <div className="text-center">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-3 sm:mb-4">Learn More</h2>
          <p className="text-foreground/70 mb-4 sm:mb-6 text-sm sm:text-base">
            Visit the official Techleap website for more information about our programs and initiatives.
          </p>
          <a
            href="https://techleap.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold"
          >
            Visit techleap.nl
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-foreground/10 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-foreground/60 text-sm text-center sm:text-left">
              Powered by Techleap — Accelerating the Dutch tech ecosystem
            </p>
            <Link href="/" className="text-primary hover:text-primary/80 text-sm">
              Back to Home
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
