import React, { useState } from "react";

const DESTINATIONS = [
  { name: "Goa", price: "₹5,499", gradientClass: "gradient-goa" },
  { name: "Delhi", price: "₹4,299", gradientClass: "gradient-delhi" },
  { name: "Mumbai", price: "₹4,899", gradientClass: "gradient-mumbai" },
];

const FEATURES = [
  {
    title: "24/7 AI support",
    desc: "Real answers anytime, no hold music.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    ),
  },
  {
    title: "Instant confirmation",
    desc: "Bookings confirmed in seconds, not days.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    title: "Verified partners",
    desc: "Every airline and hotel is checked and trusted.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Live availability",
    desc: "See real seats and rooms, never a phantom booking.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

export default function LandingPage({ onOpenChatWithMessage }) {
  const [destinationInput, setDestinationInput] = useState("Goa, India");
  const [datesInput, setDatesInput] = useState("Oct 12 - Oct 19");

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSearchClick = () => {
    const query = destinationInput.trim() || "Goa";
    onOpenChatWithMessage?.(`Find me a hotel in ${query}`);
  };

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="nav-bar">
        <div className="nav-logo" onClick={() => scrollToSection("hero")} role="button" tabIndex={0}>
          <span className="logo-icon">सह</span>
          <span className="logo-text">Sahayak Travel</span>
        </div>
        <div className="nav-links">
          <span className="nav-link" onClick={() => scrollToSection("destinations")}>
            Flights
          </span>
          <span className="nav-link" onClick={() => scrollToSection("destinations")}>
            Hotels
          </span>
          <span className="nav-link" onClick={() => scrollToSection("why-us")}>
            Support
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="hero" className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Wherever you're headed, we've got you</h1>
          <p className="hero-subtitle">
            Experience stress-free travel planning with 24/7 AI-powered assistance.
          </p>
        </div>

        {/* Floating Search Bar Card */}
        <div className="search-card">
          <div className="search-field">
            <label htmlFor="destination-input">Destination</label>
            <input
              id="destination-input"
              type="text"
              placeholder="Where to?"
              value={destinationInput}
              onChange={(e) => setDestinationInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchClick()}
            />
          </div>
          <div className="search-field">
            <label htmlFor="dates-input">Dates</label>
            <input
              id="dates-input"
              type="text"
              placeholder="Add dates"
              value={datesInput}
              onChange={(e) => setDatesInput(e.target.value)}
            />
          </div>
          <button className="search-button" type="button" onClick={handleSearchClick}>
            Search
          </button>
        </div>
      </header>

      {/* How it works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-header">
          <p className="section-tag">Simple & Fast</p>
          <h2 className="section-title">How it works</h2>
        </div>
        <div className="steps-container">
          <div className="step-card">
            <div className="step-badge">1</div>
            <h3 className="step-title">Ask Sahayak</h3>
            <p className="step-desc">Tell us where you want to go, your dates, or preferences in plain words.</p>
          </div>
          <div className="step-connector" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <div className="step-card">
            <div className="step-badge">2</div>
            <h3 className="step-title">We search live inventory</h3>
            <p className="step-desc">Our AI agents scan verified airline & hotel partners instantly.</p>
          </div>
          <div className="step-connector" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
          <div className="step-card">
            <div className="step-badge">3</div>
            <h3 className="step-title">Get instant confirmation</h3>
            <p className="step-desc">Confirm your booking in seconds with guaranteed partner rates.</p>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section id="partners" className="partners-section">
        <p className="partners-label">Our travel partners</p>
        <div className="partners-rows">
          <div className="partners-row">
            <span className="partner-badge">IndiGo</span>
            <span className="partner-badge">Air India</span>
            <span className="partner-badge">SpiceJet</span>
            <span className="partner-badge">Vistara</span>
          </div>
          <div className="partners-row">
            <span className="partner-badge">Beachside Resort</span>
            <span className="partner-badge">Palm Grove Inn</span>
            <span className="partner-badge">Sunset Villas</span>
          </div>
        </div>
      </section>

      {/* Why Sahayak Section */}
      <section id="why-us" className="why-us-section">
        <div className="section-header">
          <p className="section-tag">Seamless Experience</p>
          <h2 className="section-title">Why travel with Sahayak</h2>
        </div>
        <div className="features-grid">
          {FEATURES.map((feat, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon">{feat.icon}</div>
              <h3 className="feature-title">{feat.title}</h3>
              <p className="feature-desc">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Strip */}
      <section id="stats" className="stats-section">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-number">500+</span>
            <span className="stat-label">Happy travelers</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">50+</span>
            <span className="stat-label">Destinations</span>
          </div>
          <div className="stat-divider" aria-hidden="true" />
          <div className="stat-item">
            <span className="stat-number">4.8★</span>
            <span className="stat-label">Average rating</span>
          </div>
        </div>
      </section>

      {/* Destinations Section */}
      <section id="destinations" className="destinations-section">
        <h2 className="destinations-title">Popular destinations</h2>
        <div className="destinations-grid">
          {DESTINATIONS.map((dest) => (
            <div
              key={dest.name}
              className="destination-card clickable"
              onClick={() => onOpenChatWithMessage?.(`Find me a hotel in ${dest.name}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onOpenChatWithMessage?.(`Find me a hotel in ${dest.name}`)}
              aria-label={`Ask AI about hotels in ${dest.name}`}
            >
              <div className={`card-image ${dest.gradientClass}`} />
              <div className="card-info">
                <h3>{dest.name}</h3>
                <span className="price-tag">From {dest.price}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>Sahayak Travel — AI-powered travel support</p>
      </footer>
    </div>
  );
}
