import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../components/ButtonLink'
import { CheckMark, Sparkle } from '../components/Icons'
import { ShaderCanvas } from '../components/ShaderCanvas'
import { SiteHeader } from '../components/SiteHeader'

gsap.registerPlugin(useGSAP)

const steps = [
  {
    number: '01',
    title: 'Bring the raw material',
    description:
      'Drop in the brief, the messy notes, the links, and everything you know so far.',
    detail: 'Your context, your way',
  },
  {
    number: '02',
    title: 'Get to the good questions',
    description:
      'A thoughtful set of prompts helps uncover the decisions behind the work.',
    detail: 'Guided, not interrogated',
  },
  {
    number: '03',
    title: 'Shape a story that lands',
    description:
      'Turn your process into a clear, considered case study you can make your own.',
    detail: 'A first draft, not the final word',
  },
]

const trustNotes = ['Your voice stays yours', 'Built around your process']

function ProjectPreview() {
  return (
    <div aria-label="Preview of a website redesign case study" className="project-preview">
      <div className="project-preview__topbar">
        <span className="preview-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span>FIELDNOTES / CASE 024</span>
        <span className="preview-live"><i /> DRAFT</span>
      </div>
      <div className="project-preview__canvas">
        <div className="preview-sidebar">
          <span className="preview-sidebar__logo">f.</span>
          <span className="preview-sidebar__line preview-sidebar__line--active" />
          <span className="preview-sidebar__line" />
          <span className="preview-sidebar__line preview-sidebar__line--short" />
          <span className="preview-sidebar__bottom">↗</span>
        </div>
        <div className="preview-content">
          <div className="preview-content__meta">
            <span>PRODUCT DESIGN · 2025</span>
            <span>04 MIN READ</span>
          </div>
          <div className="preview-content__title">
            Making room
            <br />
            for the <em>everyday</em>
          </div>
          <p>A calmer way to find your next favorite thing.</p>
          <div className="preview-image">
            <div className="preview-image__orb" />
            <span>FIELD<br />NOTES</span>
            <div className="preview-image__caption">
              <span>THE OBJECTS WE KEEP</span>
              <span>01 — 04</span>
            </div>
          </div>
          <div className="preview-progress">
            <span />
          </div>
        </div>
        <div className="preview-note">
          <span className="preview-note__icon"><Sparkle /></span>
          <div>
            <span>STORY THREAD</span>
            <strong>Less friction.<br />More feeling.</strong>
          </div>
        </div>
      </div>
      <div className="project-preview__footer">
        <span><i /> YOUR NEXT CASE STUDY</span>
        <span>MADE WITH INTENTION</span>
      </div>
    </div>
  )
}

function StepCard({
  number,
  title,
  description,
  detail,
}: (typeof steps)[number]) {
  return (
    <article className="step-card" data-reveal>
      <span className="step-card__number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <span className="step-card__detail"><CheckMark /> {detail}</span>
    </article>
  )
}

export function HomePage() {
  const pageRef = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches
      if (reducedMotion) return

      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro
        .from('.hero-copy > *', { y: 30, opacity: 0, duration: 0.8, stagger: 0.11 })
        .from(
          '.project-preview',
          { y: 28, opacity: 0, scale: 0.98, duration: 1 },
          '-=0.55',
        )

      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
        gsap.from(element, {
          y: 28,
          opacity: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: element,
            start: 'top 88%',
            once: true,
          },
        })
      })
    },
    { scope: pageRef },
  )

  return (
    <main className="home-page" ref={pageRef}>
      <section className="hero">
        <ShaderCanvas />
        <div className="hero__grain" />
        <div className="hero__inner">
          <SiteHeader dark />
          <div className="hero__content">
            <div className="hero-copy">
              <span className="eyebrow hero-copy__eyebrow">
                <span className="eyebrow__spark"><Sparkle /></span>
                A SMALL STUDIO FOR BIG IDEAS
              </span>
              <h1>
                Make the
                <br />
                <span className="hero-copy__serif">thinking</span> visible.
              </h1>
              <p className="hero-copy__description">
                Turn the work behind your work into a case study worth spending
                time with. Start with what you have. Find the story as you go.
              </p>
              <div className="hero-copy__actions">
                <ButtonLink to="/try-now">Start a case study</ButtonLink>
                <Link className="hero-copy__secondary" to="/#how-it-works">
                  See how it works <span aria-hidden="true">↓</span>
                </Link>
              </div>
              <div className="hero-copy__trust">
                {trustNotes.map((note) => (
                  <span key={note}><CheckMark /> {note}</span>
                ))}
              </div>
            </div>
            <ProjectPreview />
          </div>
          <div className="hero__bottom">
            <span>YOUR PROCESS HAS A POINT OF VIEW.</span>
            <span className="hero__scroll">SCROLL TO EXPLORE <i /></span>
            <span>SCROLL Nº 01 — 03</span>
          </div>
        </div>
      </section>

      <section className="intro-strip">
        <div className="intro-strip__inner">
          <span className="eyebrow">LESS BLANK PAGE, MORE CLEAR THINKING</span>
          <p>
            Good work deserves a story that feels as considered as the work
            itself.
          </p>
          <span className="intro-strip__mark">✳</span>
        </div>
      </section>

      <section className="steps-section section-shell" id="how-it-works">
        <div className="section-heading" data-reveal>
          <div>
            <span className="eyebrow"><span className="eyebrow__dot" /> A GOOD STORY, IN THREE MOVES</span>
            <h2>
              From scattered notes
              <br />
              to <span className="serif-accent">something clear.</span>
            </h2>
          </div>
          <p className="section-heading__aside">
            No perfect brief required. Just bring the pieces, and we’ll help
            you see how they fit.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map((step) => <StepCard key={step.number} {...step} />)}
        </div>
        <div className="section-footnote" data-reveal>
          <span><Sparkle /> MADE FOR DESIGNERS, NOT DECKS</span>
          <span>01 / THE PROCESS</span>
        </div>
      </section>

      <section className="manifesto">
        <div className="manifesto__inner" data-reveal>
          <span className="eyebrow">A LITTLE HELP, A LOT OF YOU</span>
          <h2>
            AI can help find
            <br />
            the <span className="serif-accent">thread.</span>
            <br />
            You make it yours.
          </h2>
          <p>
            Think of it as a thoughtful collaborator: useful for sorting,
            shaping, and asking what’s missing. The point of view is still
            yours.
          </p>
          <ButtonLink to="/try-now" variant="outline">Find your starting point</ButtonLink>
          <div className="manifesto__stamp" aria-hidden="true">
            <span>YOUR VOICE</span>
            <strong>×</strong>
            <span>GOOD QUESTIONS</span>
          </div>
        </div>
      </section>

      <section className="closing section-shell" data-reveal>
        <div className="closing__spark"><Sparkle /></div>
        <span className="eyebrow">THE FIRST DRAFT STARTS HERE</span>
        <h2>
          Your next good story
          <br />
          is <span className="serif-accent">closer than you think.</span>
        </h2>
        <ButtonLink to="/try-now">Try the studio</ButtonLink>
        <span className="closing__note">No perfect brief. No blank-page panic.</span>
      </section>

      <footer className="site-footer">
        <Link aria-label="Case Study Studio home" className="brand" to="/">
          <span aria-hidden="true" className="brand__mark">
            <span /><span /><span />
          </span>
          <span className="brand__name">case study studio</span>
        </Link>
        <span>A little space to think out loud.</span>
        <Link to="/try-now">MAKE SOMETHING CLEAR <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  )
}
