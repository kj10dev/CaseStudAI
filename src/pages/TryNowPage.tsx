import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Link } from 'react-router-dom'
import { ButtonLink } from '../components/ButtonLink'
import { CheckMark, Sparkle } from '../components/Icons'
import { SiteHeader } from '../components/SiteHeader'

gsap.registerPlugin(useGSAP)

type Provider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'openai-compatible'
type Palette = [string, string, string]
type ProjectField =
  | 'project'
  | 'business'
  | 'challenge'
  | 'goal'
  | 'role'
  | 'decisions'
  | 'results'
  | 'quote'
  | 'timeframe'

type ProjectDetails = Record<ProjectField, string>

const fieldLabels: Record<ProjectField, string> = {
  project: 'What did you work on?',
  business: 'Who is the business and who are its customers?',
  challenge: 'What was not working before?',
  goal: 'What did the owner want to change?',
  role: 'What did you personally design or build?',
  decisions: 'What key decisions shaped the redesign, and why?',
  results: 'What results do you have? Include measured outcomes and source/date, public profile metrics with platform/date, or say none.',
  quote: 'Client quote or qualitative feedback (optional)',
  timeframe: 'When did the project happen? When were results measured?',
}

const blankDetails: ProjectDetails = {
  project: '',
  business: '',
  challenge: '',
  goal: '',
  role: '',
  decisions: '',
  results: '',
  quote: '',
  timeframe: '',
}

const providerDetails: Record<Provider, { label: string; model: string; hosted: boolean }> = {
  openai: { label: 'OpenAI', model: 'gpt-4o-mini', hosted: true },
  anthropic: { label: 'Anthropic', model: 'claude-3-5-sonnet-latest', hosted: true },
  gemini: { label: 'Google Gemini', model: 'gemini-2.5-flash', hosted: true },
  ollama: { label: 'Ollama · open source', model: 'llama3.1', hosted: false },
  'openai-compatible': { label: 'OpenAI-compatible', model: 'local-model', hosted: false },
}

const modelSuggestions: Record<Provider, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o3-mini'],
  anthropic: ['claude-3-5-sonnet-latest', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  ollama: ['llama3.1', 'qwen2.5', 'mistral', 'llama3.2-vision'],
  'openai-compatible': ['local-model', 'llama3.1', 'qwen2.5'],
}

const defaultPalette: Palette = ['#ed693e', '#d6fb45', '#bd3c97']

function getTextColor(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255)
  if (!channels || channels.length !== 3) return '#171414'
  const luminance = channels
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0)
  return luminance > 0.179 ? '#171414' : '#fff8ed'
}

const sectionRules = `Write a truthful website redesign case study for a busy small-business owner in plain language. Do not invent client names, quotes, dates, tools, or metrics. Ground every claim in the project details and any public profile evidence you can verify. If business outcome metrics are missing, explicitly say no measured outcome figures were provided and describe only qualitative outcomes. Public profile metrics such as ratings, review counts, followers, or reactions are platform-specific context, not proof of business performance or redesign impact; label their source and observation date/window. Do not infer private reach, impressions, clicks, bookings, conversions, or trends from public profile counts. Do not turn design intent into measured impact. Include honest caveats for early or unknown measurement windows. Use a concrete CTA. Include one pull quote only if a quote was provided and approved, otherwise include [ADD: approved client quote]. Include a short image plan. Return Markdown with exactly these four sections in this order:
# <one-line problem-solved headline>
## The project summary
## The challenge
## What we did
## The result
After the four sections, include the CTA and an image plan. Keep to about 600–900 words.`

const workflow = [
  ['01', 'Bring the evidence', 'Add the project context, constraints, decisions, and proof you have.'],
  ['02', 'Choose your model', 'Use OpenAI, Anthropic, Google Gemini, Ollama, or a compatible endpoint.'],
  ['03', 'Review the draft', 'Edit the generated case study right here. Copy it or save it as a PDF.'],
]

function getPrompt(
  details: ProjectDetails,
  brand: {
    companyName: string
    websiteUrl: string
    githubUrl: string
    googleBusinessUrl: string
    facebookUrl: string
    publicProfileEvidence: string
    palette: Palette
    hasUploadedLogo: boolean
  },
) {
  const entries = Object.entries(details)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${fieldLabels[key as ProjectField]}\n${value.trim()}`)
  const brandEntries = [
    brand.companyName.trim() && `Company or brand name\n${brand.companyName.trim()}`,
    brand.websiteUrl.trim() && `Website to analyze\n${brand.websiteUrl.trim()}`,
    brand.githubUrl.trim() && `GitHub repository to analyze\n${brand.githubUrl.trim()}`,
    brand.googleBusinessUrl.trim() && `Google Business Profile to analyze\n${brand.googleBusinessUrl.trim()}`,
    brand.facebookUrl.trim() && `Public Facebook page or profile to analyze\n${brand.facebookUrl.trim()}`,
    brand.publicProfileEvidence.trim() && `Public profile data supplied by the user\n${brand.publicProfileEvidence.trim()}`,
    `${brand.hasUploadedLogo ? 'Palette extracted from the uploaded logo' : 'Current workspace palette'}\n${brand.palette.join(', ')}`,
  ].filter(Boolean)
  const brandGuidance = brand.companyName.trim()
    ? `Use "${brand.companyName.trim()}" as the supplied company or brand name when relevant; do not substitute an invented name.`
    : ''
  return `${sectionRules}\n\nProject evidence:\n${entries.join('\n\n')}\n\nBrand and analysis references:\n${brandEntries.join('\n\n')}\n\n${brandGuidance}\nAnalyze provided website, repository, Google Business Profile, or public Facebook references only if you can actually access them. Publicly visible Google profile ratings/review counts and public Facebook page follower, reaction, or engagement counts may be used as platform-specific context when verifiable. Distinguish public counts from private analytics (such as reach, impressions, clicks, bookings, or conversions), which must never be inferred. For every sourced metric, state the platform/source and observation date or measurement window when available; do not present a snapshot as a trend or proof of redesign impact. Treat links as references, not verified evidence: do not claim to have browsed a page or use any details you cannot actually access.`
}

function extractResponse(provider: Provider, payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('The model returned an unreadable response.')
  }
  const response = payload as {
    content?: Array<{ type?: string; text?: string }>
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
    message?: { content?: string }
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    error?: { message?: string }
  }
  if (response.error?.message) throw new Error(response.error.message)

  if (provider === 'anthropic') {
    return response.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim() ?? ''
  }
  if (provider === 'gemini') {
    return response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('\n')
      .trim() ?? ''
  }
  if (provider === 'ollama') return response.message?.content?.trim() ?? ''

  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  return content?.map((part) => part.text ?? '').join('\n').trim() ?? ''
}

async function requestDraft(
  provider: Provider,
  model: string,
  apiKey: string,
  baseUrl: string,
  prompt: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let endpoint: string
  let body: object
  if (provider === 'gemini') {
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
    headers['x-goog-api-key'] = apiKey
    body = {
      systemInstruction: {
        parts: [{ text: 'You write accurate, evidence-based case studies.' }],
      },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4500 },
    }
  } else if (provider === 'anthropic') {
    endpoint = 'https://api.anthropic.com/v1/messages'
    headers['x-api-key'] = apiKey
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
    body = {
      model,
      max_tokens: 4500,
      system: 'You write accurate, evidence-based case studies.',
      messages: [{ role: 'user', content: prompt }],
    }
  } else if (provider === 'ollama') {
    endpoint = `${baseUrl.replace(/\/+$/, '')}/api/chat`
    body = {
      model,
      stream: false,
      messages: [
        { role: 'system', content: 'You write accurate, evidence-based case studies.' },
        { role: 'user', content: prompt },
      ],
    }
  } else {
    const root = provider === 'openai' ? 'https://api.openai.com' : baseUrl.replace(/\/+$/, '')
    endpoint = `${root}/v1/chat/completions`
    if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`
    body = {
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: 'You write accurate, evidence-based case studies.' },
        { role: 'user', content: prompt },
      ],
    }
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
  })
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null
    if (response.status === 401 || response.status === 403) {
      throw new Error('The provider rejected this key. Check the key and its model access.')
    }
    if (response.status === 429) throw new Error('The provider rate limit was reached. Wait a moment and try again.')
    throw new Error(errorBody?.error?.message ?? `${providerDetails[provider].label} returned HTTP ${response.status}.`)
  }
  const draft = extractResponse(provider, await response.json())
  if (!draft) throw new Error('The model returned an empty draft. Try a different model.')
  return draft
}

async function downloadPdf(text: string, project: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter' })
  const margin = 54
  const lineHeight = 17
  const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2
  let y = margin

  for (const line of text.split('\n')) {
    if (!line.trim()) {
      y += lineHeight * 0.55
      continue
    }
    const isTitle = line.startsWith('# ')
    const isHeading = line.startsWith('## ')
    const body = line.replace(/^#{1,2}\s*/, '')
    pdf.setFont('helvetica', isTitle || isHeading ? 'bold' : 'normal')
    pdf.setFontSize(isTitle ? 20 : isHeading ? 14 : 10)
    const wrappedLines = pdf.splitTextToSize(body, maxWidth) as string[]
    const currentLineHeight = isTitle ? 26 : isHeading ? 21 : lineHeight
    for (const wrappedLine of wrappedLines) {
      if (y + currentLineHeight > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage()
        y = margin
      }
      pdf.text(wrappedLine, margin, y)
      y += currentLineHeight
    }
    y += isHeading ? 4 : 0
  }

  const safeName = project.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'case-study'
  pdf.save(`${safeName}-case-study.pdf`)
}

export function TryNowPage() {
  const pageRef = useRef<HTMLElement>(null)
  const [details, setDetails] = useState<ProjectDetails>(blankDetails)
  const [companyName, setCompanyName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [publicProfileEvidence, setPublicProfileEvidence] = useState('')
  const [palette, setPalette] = useState<Palette>(defaultPalette)
  const [logoPreview, setLogoPreview] = useState('')
  const [provider, setProvider] = useState<Provider>('openai')
  const [model, setModel] = useState(providerDetails.openai.model)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')

  useGSAP(
    () => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      gsap.from('.workspace-intro > *, .launch-card, .workflow-row', {
        y: 22,
        opacity: 0,
        duration: 0.65,
        stagger: 0.08,
        ease: 'power3.out',
      })
    },
    { scope: pageRef },
  )

  const activeProvider = providerDetails[provider]

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  async function uploadLogo(file: File | undefined) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file to extract your brand palette.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a logo image smaller than 10 MB.')
      return
    }

    let image: ImageBitmap
    try {
      image = await createImageBitmap(file)
    } catch {
      setError('This logo could not be read. Try a PNG, JPEG, or WebP image.')
      return
    }

    try {
      const scale = Math.min(1, 96 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        setError('Your browser could not process this logo image.')
        return
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      const bins = new Map<string, { count: number; red: number; green: number; blue: number }>()
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3]
        const red = data[index]
        const green = data[index + 1]
        const blue = data[index + 2]
        if (alpha < 96 || (red > 242 && green > 242 && blue > 242)) continue
        const key = `${red >> 3},${green >> 3},${blue >> 3}`
        const bin = bins.get(key) ?? { count: 0, red: 0, green: 0, blue: 0 }
        bin.count += 1
        bin.red += red
        bin.green += green
        bin.blue += blue
        bins.set(key, bin)
      }
      const ranked = [...bins.values()].sort((left, right) => right.count - left.count)
      if (!ranked.length) {
        setError('No usable logo colors were found. Try an image with visible color.')
        return
      }
      const selected: string[] = []
      for (const bin of ranked) {
        const color = `#${[bin.red, bin.green, bin.blue]
          .map((channel) => Math.round(channel / bin.count).toString(16).padStart(2, '0'))
          .join('')}`
        const [red, green, blue] = color.match(/[a-f\d]{2}/gi)!.map((channel) => parseInt(channel, 16))
        const distinct = selected.every((existing) => {
          const [otherRed, otherGreen, otherBlue] = existing.match(/[a-f\d]{2}/gi)!.map((channel) => parseInt(channel, 16))
          return Math.hypot(red - otherRed, green - otherGreen, blue - otherBlue) > 42
        })
        if (distinct) selected.push(color)
        if (selected.length === 3) break
      }
      while (selected.length < 3) {
        const fallback = defaultPalette.find((color) => !selected.includes(color)) ?? defaultPalette[selected.length]
        selected.push(fallback)
      }
      setPalette([selected[0], selected[1], selected[2]])
      setLogoPreview(URL.createObjectURL(file))
      setStatus('Logo palette extracted and applied to your workspace.')
    } catch {
      setError('This logo could not be processed. Try a PNG, JPEG, or WebP image.')
    } finally {
      image.close()
    }
  }

  function updateDetails(field: ProjectField, value: string) {
    setDetails((previous) => ({ ...previous, [field]: value }))
  }

  function changeProvider(value: Provider) {
    setProvider(value)
    setModel(providerDetails[value].model)
    setApiKey('')
    setError('')
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatus('')
    if (Object.entries(details).filter(([key]) => key !== 'quote').every(([, value]) => !value.trim())) {
      setError('Add a little project context before generating your case study.')
      return
    }
    if (provider !== 'ollama' && provider !== 'openai-compatible' && !apiKey.trim()) {
      setError(`Add your ${activeProvider.label} API key to continue.`)
      return
    }
    if ((provider === 'ollama' || provider === 'openai-compatible') && !baseUrl.trim()) {
      setError('Enter the base URL for this model provider.')
      return
    }

    setLoading(true)
    try {
      const result = await requestDraft(
        provider,
        model.trim(),
        apiKey,
        baseUrl,
        getPrompt(details, {
          companyName,
          websiteUrl,
          githubUrl,
          googleBusinessUrl,
          facebookUrl,
          publicProfileEvidence,
          palette,
          hasUploadedLogo: Boolean(logoPreview),
        }),
      )
      setDraft(result)
      setStatus('Draft generated. Review and edit it before sharing.')
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'The model request failed.'
      setError(
        message.includes('Failed to fetch')
          ? `${message} Check your network and provider browser/CORS settings. Your key is only sent to the selected provider.`
          : message,
      )
    } finally {
      setLoading(false)
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft)
      setStatus('Case study copied to clipboard.')
    } catch {
      setError('Clipboard access was blocked. Select the draft text and copy it manually.')
    }
  }

  async function savePdf() {
    setError('')
    setDownloadingPdf(true)
    try {
      await downloadPdf(draft, details.project)
      setStatus('PDF downloaded.')
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Could not create the PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <main
      className="workspace-page"
      ref={pageRef}
      style={{
        '--brand-primary': palette[0],
        '--brand-secondary': palette[1],
        '--brand-accent': palette[2],
        '--brand-on-primary': getTextColor(palette[0]),
        '--brand-on-secondary': getTextColor(palette[1]),
        '--brand-on-accent': getTextColor(palette[2]),
      } as CSSProperties}
    >
      <div className="workspace-top">
        <SiteHeader />
      </div>
      <div className="workspace-layout launch-layout">
        <section className="workspace-main">
          <div className="workspace-intro">
            <Link className="back-link" to="/">
              <span aria-hidden="true">←</span> BACK TO THE STUDIO
            </Link>
            <span className="eyebrow"><span className="eyebrow__dot" /> CASE STUDY GENERATOR / BRING YOUR OWN MODEL</span>
            <h1>
              Make the
              <br />
              <span className="serif-accent">evidence</span> speak.
            </h1>
            <p>
              Add the facts, choose a model, then shape the generated story.
              Your API key stays in this page session and is sent only to the
              provider you select.
            </p>
          </div>

          <form className="launch-card generator-form" onSubmit={generate}>
            <div className="launch-card__header">
              <span className="field-index">01 / PROJECT EVIDENCE</span>
              <span className="launch-status"><i /> GROUNDED IN YOUR FACTS</span>
              <h2>Tell the true story.</h2>
              <p>Unknown numbers can stay unknown. The draft will flag gaps instead of filling them in.</p>
            </div>

            <div className="generator-fields">
              <section aria-labelledby="brand-heading" className="brand-fields">
                <div className="brand-fields__heading">
                  <span className="field-index">YOUR BRAND / OPTIONAL</span>
                  <h3 id="brand-heading">Make this story yours.</h3>
                  <p>Add a name and logo to apply your colors to this workspace.</p>
                </div>
                <div className="brand-fields__controls">
                  <div className="generator-field">
                    <label htmlFor="company-name">Company or brand name</label>
                    <input
                      autoComplete="organization"
                      id="company-name"
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="Your company name"
                      value={companyName}
                    />
                  </div>
                  <div className="generator-field">
                    <label htmlFor="logo-upload">Upload a logo image</label>
                    <input
                      accept="image/*"
                      id="logo-upload"
                      onChange={(event) => void uploadLogo(event.target.files?.[0])}
                      type="file"
                    />
                  </div>
                </div>
                <div className="brand-palette" aria-live="polite">
                  {logoPreview && <img alt="Uploaded company logo" src={logoPreview} />}
                  <div className="brand-palette__swatches">
                    {palette.map((color, index) => (
                      <span key={`${color}-${index}`} style={{ backgroundColor: color }}>
                        <span>{color}</span>
                      </span>
                    ))}
                  </div>
                  <span className="brand-palette__caption">
                    {logoPreview ? '3 COLORS EXTRACTED · WORKSPACE THEME UPDATED' : 'UPLOAD A LOGO TO EXTRACT 3 COLORS'}
                  </span>
                </div>
              </section>

              <section aria-labelledby="references-heading" className="reference-fields">
                <div className="brand-fields__heading">
                  <span className="field-index">ANALYSIS INPUTS / OPTIONAL</span>
                  <h3 id="references-heading">Bring a live reference.</h3>
                  <p>Share a website, GitHub repository, Google Business Profile, or public Facebook page as model context.</p>
                </div>
                <div className="reference-fields__controls">
                  <div className="generator-field">
                    <label htmlFor="website-url">Website URL</label>
                    <input
                      autoComplete="url"
                      id="website-url"
                      onChange={(event) => setWebsiteUrl(event.target.value)}
                      placeholder="https://yourcompany.com"
                      type="url"
                      value={websiteUrl}
                    />
                  </div>
                  <div className="generator-field">
                    <label htmlFor="github-url">GitHub repository</label>
                    <input
                      autoComplete="url"
                      id="github-url"
                      onChange={(event) => setGithubUrl(event.target.value)}
                      placeholder="https://github.com/owner/repository"
                      type="url"
                      value={githubUrl}
                    />
                  </div>
                  <div className="generator-field">
                    <label htmlFor="google-business-url">Google Business Profile</label>
                    <input
                      autoComplete="url"
                      id="google-business-url"
                      onChange={(event) => setGoogleBusinessUrl(event.target.value)}
                      placeholder="Paste a public Google Maps or Business Profile link"
                      type="url"
                      value={googleBusinessUrl}
                    />
                  </div>
                  <div className="generator-field">
                    <label htmlFor="facebook-url">Public Facebook page</label>
                    <input
                      autoComplete="url"
                      id="facebook-url"
                      onChange={(event) => setFacebookUrl(event.target.value)}
                      placeholder="https://facebook.com/yourpage"
                      type="url"
                      value={facebookUrl}
                    />
                  </div>
                  <div className="generator-field reference-fields__evidence">
                    <label htmlFor="public-profile-evidence">Public figures or source notes (optional)</label>
                    <textarea
                      id="public-profile-evidence"
                      onChange={(event) => setPublicProfileEvidence(event.target.value)}
                      placeholder="Paste visible ratings, review/follower counts, reactions, source links, and the date observed. Do not include private customer data."
                      rows={3}
                      value={publicProfileEvidence}
                    />
                  </div>
                </div>
                <p className="reference-fields__note">
                  Links are passed to your chosen model, but this app does not scrape profiles and some models cannot open links. Add visible figures and when you saw them above. Private Google/Facebook analytics require authorized account access and cannot be inferred from public pages.
                </p>
              </section>

              {(['project', 'business', 'challenge', 'goal', 'role', 'decisions', 'results', 'timeframe', 'quote'] as ProjectField[]).map((field) => (
                <div className={`generator-field generator-field--${field}`} key={field}>
                  <label htmlFor={`field-${field}`}>{fieldLabels[field]}</label>
                  {['project', 'business', 'results', 'timeframe'].includes(field) ? (
                    <input
                      autoComplete="off"
                      id={`field-${field}`}
                      onChange={(event) => updateDetails(field, event.target.value)}
                      placeholder={field === 'results' ? 'Example: conversion rate 1.2% → 2.8%, GA4, 4 weeks each; or public Google rating/review count with observation date. Or: no numbers yet.' : 'Add details you can stand behind…'}
                      required={field === 'project'}
                      value={details[field]}
                    />
                  ) : (
                    <textarea
                      id={`field-${field}`}
                      onChange={(event) => updateDetails(field, event.target.value)}
                      placeholder={field === 'quote' ? 'Skip if you do not have an approved quote.' : 'Add details you can stand behind…'}
                      rows={field === 'decisions' || field === 'results' ? 3 : 2}
                      value={details[field]}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="provider-panel">
              <div className="provider-panel__heading">
                <span className="field-index">02 / MODEL CONNECTION</span>
                <span>BYOK · NO KEY SAVED</span>
              </div>
              <div className="provider-fields">
                <div className="generator-field">
                  <label htmlFor="provider">Choose your provider</label>
                  <select
                    id="provider"
                    onChange={(event) => changeProvider(event.target.value as Provider)}
                    value={provider}
                  >
                    {Object.entries(providerDetails).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
                <div className="generator-field">
                  <label htmlFor="model">Model</label>
                  <input id="model" list={`models-${provider}`} onChange={(event) => setModel(event.target.value)} required value={model} />
                  <datalist id={`models-${provider}`}>
                    {modelSuggestions[provider].map((suggestion) => <option key={suggestion} value={suggestion} />)}
                  </datalist>
                </div>
                {provider !== 'ollama' && (
                  <div className="generator-field provider-field--wide">
                    <label htmlFor="api-key">{provider === 'openai-compatible' ? 'API key (optional)' : `${activeProvider.label} API key`}</label>
                    <input
                      autoComplete="new-password"
                      id="api-key"
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={provider === 'openai-compatible' ? 'Leave blank for a local server without auth' : 'Paste your key; it will not be saved'}
                      required={provider !== 'openai-compatible'}
                      type="password"
                      value={apiKey}
                    />
                  </div>
                )}
                {(provider === 'ollama' || provider === 'openai-compatible') && (
                  <div className="generator-field provider-field--wide">
                    <label htmlFor="base-url">Provider base URL</label>
                    <input
                      autoComplete="url"
                      id="base-url"
                      onChange={(event) => setBaseUrl(event.target.value)}
                      placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234'}
                      value={baseUrl}
                    />
                  </div>
                )}
              </div>
              <p className="provider-disclaimer">
                {activeProvider.hosted
                  ? `Your project details and key are sent directly to ${activeProvider.label} to generate the draft. This app does not store your key.`
                  : 'Your project details are sent to the model endpoint above. For Ollama, use a model installed on your machine.'}
              </p>
            </div>

            {error && <p className="form-message form-message--error" role="alert">{error}</p>}
            {status && <p className="form-message form-message--status" role="status">{status}</p>}

            <div className="launch-card__actions">
              <span><CheckMark /> No invented performance numbers</span>
              <button className="button-link button-link--bright generate-button" disabled={loading} type="submit">
                {loading ? 'Writing your draft…' : 'Generate case study'}
                <span aria-hidden="true">{loading ? '···' : '↗'}</span>
              </button>
            </div>
          </form>

          {draft && (
            <section aria-labelledby="draft-title" className="draft-panel">
              <div className="draft-panel__header">
                <div>
                  <span className="field-index">03 / REVIEW & EDIT</span>
                  <h2 id="draft-title">Your working draft.</h2>
                </div>
                <span className="draft-panel__tag"><i /> EDITABLE</span>
              </div>
              <label className="sr-only" htmlFor="case-study-output">Edit your generated case study</label>
              <textarea
                className="draft-editor"
                id="case-study-output"
                onChange={(event) => setDraft(event.target.value)}
                spellCheck
                value={draft}
              />
              <div className="draft-panel__actions">
                <span>Every word is editable before export.</span>
                <div>
                  <button className="draft-action" onClick={copyDraft} type="button">Copy text <span>▣</span></button>
                  <button className="draft-action draft-action--download" disabled={downloadingPdf} onClick={savePdf} type="button">
                    {downloadingPdf ? 'Creating PDF…' : 'Download PDF'} <span>↓</span>
                  </button>
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="workflow-title" className="workflow-section">
            <div className="workflow-section__heading">
              <span className="eyebrow">YOUR PROCESS, WITH A MODEL YOU CHOOSE</span>
              <h2 id="workflow-title">Evidence first.<br />Then the narrative.</h2>
            </div>
            <div className="workflow-list">
              {workflow.map(([number, title, description]) => (
                <article className="workflow-row" key={number}>
                  <span className="workflow-row__number">{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <span className="workflow-row__mark">↗</span>
                </article>
              ))}
            </div>
          </section>
        </section>

        <aside aria-label="Generator privacy and output" className="workspace-aside">
          <div className="aside-card">
            <span className="aside-card__icon"><Sparkle /></span>
            <span className="eyebrow">YOUR KEY, YOUR MODEL</span>
            <h2>Bring your<br /><em>own intelligence.</em></h2>
            <p>
              Choose a hosted provider with your own API key, or connect
              directly to a local model. Keys live only in this page session:
              they are never written to storage by this app.
            </p>
            <div className="aside-divider" />
            <span className="aside-card__label">FROM DRAFT TO DELIVERABLE</span>
            <ol className="outline-list">
              <li className="outline-list__active"><span>01</span>Review the generated text<i /></li>
              <li className="outline-list__active"><span>02</span>Edit it in place<i /></li>
              <li className="outline-list__active"><span>03</span>Copy the final draft<i /></li>
              <li className="outline-list__active"><span>04</span>Download a PDF<i /></li>
            </ol>
          </div>
          <div className="workspace-aside__note">
            <span>✳</span>
            <p>Unknown numbers stay unknown. No invented wins, ever.</p>
          </div>
        </aside>
      </div>
      <footer className="workspace-footer">
        <Link to="/">CASE STUDY STUDIO</Link>
        <span>YOUR KEY. YOUR WORDS. YOUR WORK.</span>
        <ButtonLink arrow={false} to="/" variant="text">BACK TO HOME</ButtonLink>
      </footer>
    </main>
  )
}
