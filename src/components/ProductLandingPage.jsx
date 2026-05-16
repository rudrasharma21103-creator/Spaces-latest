import React, { useState } from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Check,
  FileText,
  Menu,
  MessageSquare,
  Moon,
  Network,
  Play,
  Sun,
  X,
} from "lucide-react"
import SmartImage from "./SmartImage"

const asset = file => `/${file.replaceAll(" ", "%20")}`
const MotionDiv = motion.div

const media = {
  logoForLight: asset("logo SD.png"),
  logoForDark: asset("logo SL.png"),
  waves: asset("landing-waves.png"),
  wavesPurple: asset("landing-waves-purple.png"),
  wavesDark: asset("landing-waves-dark.png"),
  home: asset("landing-home.png"),
  chat: asset("landing-chat.png"),
  docs: asset("Screenshot 2026-05-14 160842.png"),
  gmail: asset("Screenshot 2026-05-14 160919.png"),
  tasks: asset("Screenshot 2026-05-14 161000.png"),
  network: asset("Screenshot 2026-05-14 160554.png"),
  demo: asset("Video Project 14.mp4"),
}

const WAITLIST_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfGVyOa8nXf5Vrm8OPJsmd8-x87hJWE4xXcvqbr5NgNwCkI1g/viewform?usp=header"

const story = [
  ["Message", "The work starts in the conversation."],
  ["Context", "Important moments are captured before they disappear."],
  ["Action", "Tasks, files, and decisions keep the source attached."],
]

const surfaces = [
  {
    icon: MessageSquare,
    title: "Messages become memory",
    body: "Channels are not just streams. They carry decisions, files, reactions, and reusable context.",
    image: media.chat,
    alt: "Spacess message workspace",
  },
  {
    icon: FileText,
    title: "Files stay beside the thread",
    body: "Docs, Gmail attachments, and shared assets live where the team is already discussing the work.",
    image: media.docs,
    alt: "Spacess documents screen",
  },
  {
    icon: Network,
    title: "Teams see the whole system",
    body: "Home, tasks, files, people, and network activity form one calm operating surface.",
    image: media.home,
    alt: "Spacess home dashboard",
  },
]

function Logo({ isDarkMode, className = "" }) {
  return (
    <SmartImage
      src={isDarkMode ? media.logoForDark : media.logoForLight}
      alt=""
      className={`launch-logo ${className}`}
      loading="eager"
      fetchPriority="high"
    />
  )
}

function Reveal({ children, className = "", delay = 0 }) {
  return (
    <MotionDiv
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-72px" }}
      transition={{ duration: 0.52, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </MotionDiv>
  )
}

function Frame({ src, alt, className = "", priority = false }) {
  return (
    <figure className={`launch-frame ${className}`}>
      <div className="launch-frame-top">
        <span />
        <span />
        <span />
      </div>
      <SmartImage
        src={src}
        alt={alt}
        className="launch-frame-image"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
      />
    </figure>
  )
}

export default function ProductLandingPage({ isDarkMode, setIsDarkMode, onLogin, onSignup }) {
  const [navOpen, setNavOpen] = useState(false)

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setNavOpen(false)
  }

  return (
    <main className="launch-landing">
      <section id="top" className="launch-hero" style={{ "--wave-url": `url(${media.waves})` }}>
        <nav className="launch-nav">
          <button className="launch-brand" onClick={() => scrollTo("top")} aria-label="Spacess home">
            <Logo isDarkMode={isDarkMode} />
            <span>Spacess</span>
          </button>

          <div className="launch-nav-links">
            <button onClick={() => scrollTo("product")}>Product</button>
            <button onClick={() => scrollTo("story")}>How it works</button>
            <button onClick={() => scrollTo("different")}>Why different</button>
            <button onClick={() => scrollTo("demo")}>Watch Video</button>
            <button onClick={() => scrollTo("pricing")}>Pricing</button>
          </div>

          <div className="launch-nav-actions">
            <button
              className="launch-theme-toggle"
              onClick={() => setIsDarkMode(!isDarkMode)}
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDarkMode ? <Sun /> : <Moon />}
            </button>
            <button className="launch-login" onClick={onLogin}>
              Log in
            </button>
            <button className="launch-primary nav" onClick={onSignup}>
              Start free
            </button>
            <button
              className="launch-menu"
              onClick={() => setNavOpen(open => !open)}
              aria-label="Toggle navigation"
              aria-expanded={navOpen}
            >
              {navOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>

        {navOpen && (
          <div className="launch-mobile-menu">
            <button onClick={() => scrollTo("product")}>Product</button>
            <button onClick={() => scrollTo("story")}>How it works</button>
            <button onClick={() => scrollTo("different")}>Why different</button>
            <button onClick={() => scrollTo("demo")}>Watch Video</button>
            <button onClick={onLogin}>Log in</button>
            <button onClick={onSignup}>Start free</button>
          </div>
        )}

        <a
          className="launch-waitlist-link"
          href={WAITLIST_FORM_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Waitlist is live. Open the waitlist form"
        >
          <span className="launch-waitlist-copy">
            <span>Waitlist Is Live</span>
            <span>Join the early access form</span>
          </span>
          <ArrowRight aria-hidden="true" />
        </a>

        <div className="launch-hero-inner">
          <Reveal className="launch-hero-copy">
            <p className="launch-pill">Context-first collaboration</p>
            <h1>
              Teams don&apos;t lose messages. <span>They lose context.</span>
            </h1>
            <p>
              Spacess turns conversations into context, tasks, files, and decisions your team can
              actually reuse.
            </p>
            <div className="launch-actions">
              <button className="launch-primary" onClick={onSignup}>
                Start free
                <ArrowRight aria-hidden="true" />
              </button>
              <button className="launch-secondary" onClick={() => scrollTo("demo")}>
                <Play aria-hidden="true" />
                Watch demo
              </button>
            </div>
          </Reveal>

          <Reveal className="launch-screen-stage" delay={0.08}>
            <Frame src={media.home} alt="Spacess home dashboard" priority className="main-screen" />
            <Frame src={media.chat} alt="Spacess channel messages" className="float-screen chat" />
            <Frame src={media.gmail} alt="Spacess files library" className="float-screen files" />
          </Reveal>
        </div>
      </section>

      <section id="demo" className="launch-demo launch-demo-up">
        <Reveal className="launch-section-heading centered">
          <p className="launch-label">Video Project 14</p>
          <h2>Watch Spacess turn chat into context.</h2>
          <p>A quick walkthrough of the real workspace in motion.</p>
        </Reveal>
        <Reveal className="launch-demo-player">
          <video controls playsInline preload="metadata" poster={media.chat}>
            <source src={media.demo} type="video/mp4" />
          </video>
        </Reveal>
      </section>

      <section id="story" className="launch-story launch-wave-section purple" style={{ "--section-wave-url": `url(${media.wavesPurple})` }}>
        <Reveal className="launch-section-heading">
          <p className="launch-label">The workspace after chat</p>
          <h2>Every message can become something useful.</h2>
          <p>
            Spacess gives a team one path from conversation to shared memory, without inventing a
            new ritual.
          </p>
        </Reveal>
        <div className="launch-story-rail">
          {story.map(([title, body], index) => (
            <Reveal className="launch-story-step" delay={index * 0.05} key={title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="product" className="launch-product">
        <Reveal className="launch-section-heading centered">
          <p className="launch-label">Product surfaces</p>
          <h2>A connected workspace, shown through the real product.</h2>
        </Reveal>
        <div className="launch-surface-stack">
          {surfaces.map((surface, index) => {
            const Icon = surface.icon
            return (
              <section className={`launch-surface ${index % 2 ? "reverse" : ""}`} key={surface.title}>
                <Reveal className="launch-surface-copy">
                  <Icon aria-hidden="true" />
                  <h3>{surface.title}</h3>
                  <p>{surface.body}</p>
                </Reveal>
                <Reveal delay={0.08}>
                  <Frame src={surface.image} alt={surface.alt} />
                </Reveal>
              </section>
            )
          })}
        </div>
      </section>

      <section id="different" className="launch-different launch-wave-section darkwave" style={{ "--section-wave-url": `url(${media.wavesDark})` }}>
        <Reveal className="launch-different-copy">
          <p className="launch-label">Why different</p>
          <h2>
            
            <span>Spacess connects conversations to work.</span>
          </h2>
        </Reveal>
        <Reveal className="launch-proof-grid" delay={0.08}>
          {[
            "Messages become tasks",
            "Decisions stay visible",
            "Files keep their thread",
            "Context compounds over time",
          ].map(item => (
            <span key={item}>
              <Check aria-hidden="true" />
              {item}
            </span>
          ))}
        </Reveal>
      </section>

      <section id="pricing" className="launch-final">
        <Logo isDarkMode={isDarkMode} className="large" />
        <h2>Build a workspace where context survives the conversation.</h2>
        <p>Start free and bring your team's messages, files, tasks, and decisions into one place.</p>
        <div className="launch-actions">
          <button className="launch-primary" onClick={onSignup}>
            Start free
            <ArrowRight aria-hidden="true" />
          </button>
          <button className="launch-secondary on-light" onClick={onLogin}>
            Log in
          </button>
        </div>
      </section>
    </main>
  )
}
