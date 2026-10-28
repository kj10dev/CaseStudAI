#!/usr/bin/env node
// BEST PRACTICES APPLIED
// - Use a clear challenge / work / result story, then close with a relevant CTA.
// - Ask for before-and-after metrics, dates, windows, and tools; never infer results.
// - Prefer customer outcomes, plain language, useful specifics, and a scannable layout.
// - Separate observed evidence from inferred intent; identify missing facts with [ADD: ...].
// Research consulted:
// - Google Analytics, "Create and manage key events":
//   https://support.google.com/analytics/answer/12966437
//   Measurement depends on a defined event, reporting window, and attribution context.
// - Google Search Central, "Creating helpful, reliable, people-first content":
//   https://developers.google.com/search/docs/fundamentals/creating-helpful-content
//   Favor original, useful, trustworthy content and descriptive headings.
// - Shopify, "How to increase conversion rate":
//   https://www.shopify.com/enterprise/blog/how-to-increase-conversion-rate
//   Set measurable goals, study customer behavior, and compare analytics by page/channel.

import { execFile as execFileCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readFile, readdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const execFile = promisify(execFileCallback)
const VERSION = '1.0.0'
const UI_EXTENSIONS = /\.(css|scss|html|jsx|tsx|vue|svelte|kt|xml)$/i
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const LENGTH_WORDS = { short: 400, standard: 750, long: 1200 }
const HEADINGS = [
  'The project summary',
  'The challenge',
  'What we did',
  'The result',
]
const QUESTIONS = [
  ['client', 'Who is the business, what do they sell, and who are their customers? May we name them, or keep them anonymous?'],
  ['problem', 'In the client’s words, what was failing on the old site? For example: confusing navigation, a slow mobile experience, or unclear product pages.'],
  ['goal', 'What did the owner most want to change: sales, enquiries, bookings, customer trust, or something else?'],
  ['role', 'What did you personally design or build? Include the timeframe, tools, budget, or constraints you can share.'],
  ['decisions', 'What were the two or three most important design decisions, and why did you make them?'],
  ['metrics', 'What were the before and after numbers for conversion rate, bounce rate, speed, mobile conversion, leads, or orders? Include dates, measurement window, and tool. Type “none” if you have no metrics.'],
  ['proof', 'Is there a client quote or other qualitative proof? Is it verbatim and approved for use? You can skip this.'],
  ['cta', 'What should a reader do next? Default: reply to this email to start a project.'],
]

const USAGE = `Case Study Generator v${VERSION}

Usage:
  node case-study-generator.js [options]

Inputs (can be combined):
  --url <https://...>          Live website of the new site
  --repo <url|path>            GitHub URL or local Git repository
  --images <dir|files...>      Folder or screenshot paths (PNG/JPG/WebP)

Options:
  --provider <name>            auto | anthropic | openai | ollama | openai-compatible
  --model <name>               Model name for the selected provider
  --base-url <url>             Ollama/OpenAI-compatible base URL
  --out <path>                 Output path (default: ./case-study-<slug>-<date>.<ext>)
  --format <md|html|json>      Output format (default: md)
  --length <short|standard|long>  Target about 400 / 750 / 1200 words
  --facts <path>               Reuse a saved fact sheet; skips the interview
  --no-questions                Skip the interview and flag missing facts
  --yes                         Accept sensible defaults in prompts
  --dry-run                     Print the generation prompt without calling a model
  --help                        Show this help

Providers use environment keys only:
  ANTHROPIC_API_KEY, OPENAI_API_KEY
  Ollama defaults to http://localhost:11434
`

function parseArgs(argv) {
  const options = {
    provider: 'auto',
    format: 'md',
    length: 'standard',
    images: [],
    yes: false,
    noQuestions: false,
    dryRun: false,
    help: false,
  }
  const valueFlags = new Map([
    ['--url', 'url'],
    ['--repo', 'repo'],
    ['--provider', 'provider'],
    ['--model', 'model'],
    ['--base-url', 'baseUrl'],
    ['--out', 'out'],
    ['--format', 'format'],
    ['--length', 'length'],
    ['--facts', 'facts'],
  ])
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (valueFlags.has(argument)) {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}`)
      options[valueFlags.get(argument)] = value
    } else if (argument === '--images') {
      while (argv[index + 1] && !argv[index + 1].startsWith('--')) {
        options.images.push(argv[++index])
      }
      if (!options.images.length) throw new Error('--images requires a directory or file path')
    } else if (argument === '--yes') options.yes = true
    else if (argument === '--no-questions') options.noQuestions = true
    else if (argument === '--dry-run') options.dryRun = true
    else if (argument === '--help' || argument === '-h') options.help = true
    else throw new Error(`Unknown option: ${argument}`)
  }
  if (!['md', 'html', 'json'].includes(options.format)) throw new Error('--format must be md, html, or json')
  if (!Object.hasOwn(LENGTH_WORDS, options.length)) throw new Error('--length must be short, standard, or long')
  return options
}

function safeUrl(value) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Website URL must use http or https.')
  return parsed
}

function slugify(value) {
  return value.toLowerCase().replace(/https?:\/\//, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'project'
}

async function promptLine(rl, question, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : ''
  const answer = (await rl.question(`${question}${suffix}\n> `)).trim()
  return answer || fallback
}

async function confirm(rl, question, defaultValue = true, yes = false) {
  if (yes) return defaultValue
  const answer = (await rl.question(`${question} (${defaultValue ? 'Y/n' : 'y/N'}) `)).trim().toLowerCase()
  return answer ? answer === 'y' || answer === 'yes' : defaultValue
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function isDisallowedByRobots(robotsText, userAgent, targetPath) {
  const groups = []
  let agents = []
  let rules = []
  const saveGroup = () => {
    if (agents.length) groups.push({ agents, rules })
    agents = []
    rules = []
  }
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.split('#', 1)[0].trim()
    if (!line) continue
    const [rawKey, ...valueParts] = line.split(':')
    const key = rawKey.trim().toLowerCase()
    const value = valueParts.join(':').trim()
    if (key === 'user-agent') {
      if (rules.length) saveGroup()
      agents.push(value.toLowerCase())
    } else if ((key === 'allow' || key === 'disallow') && agents.length && value) {
      rules.push({ allow: key === 'allow', path: value })
    }
  }
  saveGroup()
  const token = userAgent.toLowerCase().split('/')[0]
  const applicable = groups.filter((group) => group.agents.includes('*') || group.agents.some((agent) => token.startsWith(agent)))
  const matchingRules = applicable.flatMap((group) => group.rules).filter(({ path }) => {
    const expressionPath = path.endsWith('$') ? path.slice(0, -1) : path
    const wildcardPattern = expressionPath.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')
    const expression = new RegExp(`^${wildcardPattern}${path.endsWith('$') ? '$' : ''}`)
    return expression.test(targetPath)
  })
  matchingRules.sort((a, b) =>
    b.path.replace(/[*$]/g, '').length - a.path.replace(/[*$]/g, '').length ||
    Number(b.allow) - Number(a.allow),
  )
  return matchingRules[0] ? !matchingRules[0].allow : false
}

async function readImages(paths) {
  const files = []
  for (const path of paths) {
    const absolutePath = resolve(path)
    let candidates
    try {
      const info = await readdir(absolutePath, { withFileTypes: true })
      candidates = info.filter((entry) => entry.isFile()).map((entry) => join(absolutePath, entry.name))
    } catch {
      candidates = [absolutePath]
    }
    for (const candidate of candidates) {
      const extension = extname(candidate).toLowerCase()
      if (!IMAGE_EXTENSIONS.has(extension)) {
        if (candidate === absolutePath) throw new Error(`Unsupported image type: ${candidate}`)
        continue
      }
      const fileInfo = await stat(candidate)
      if (fileInfo.size > 12 * 1024 * 1024) throw new Error(`Image exceeds the 12 MB per-file limit: ${candidate}`)
      const data = await readFile(candidate)
      files.push({
        path: candidate,
        name: basename(candidate),
        mimeType: extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg',
        base64: data.toString('base64'),
        size: data.length,
        side: /before|old|prior/i.test(basename(candidate)) ? 'before' : /after|new|redesign/i.test(basename(candidate)) ? 'after' : 'unconfirmed',
      })
    }
  }
  if (files.length && files.some((image) => image.side === 'unconfirmed')) {
    console.log('\nScreenshots are labeled using their filenames. Rename files with “before” or “after” when possible.')
  }
  return files
}

async function inspectWebsite(inputUrl) {
  const parsed = safeUrl(inputUrl)
  const robotsUrl = new URL('/robots.txt', parsed.origin)
  let robotsText = ''
  try {
    const robots = await fetchWithTimeout(robotsUrl, { headers: { 'User-Agent': 'CaseStudyGenerator/1.0 (+evidence review)' } })
    if (robots.ok) robotsText = await robots.text()
    else if (robots.status !== 404) {
      return { source: inputUrl, status: 'unavailable', note: `Could not read robots.txt (HTTP ${robots.status}); skipped URL evidence.` }
    }
  } catch (error) {
    console.warn(`Could not read robots.txt (${error.message}); skipping URL evidence.`)
    return { source: inputUrl, status: 'unavailable', note: 'Could not check robots.txt.' }
  }
  const disallowed = isDisallowedByRobots(
    robotsText,
    'CaseStudyGenerator/1.0',
    `${parsed.pathname}${parsed.search}`,
  )
  if (disallowed) return { source: inputUrl, status: 'blocked', note: 'robots.txt disallows crawling this site.' }
  try {
    const response = await fetchWithTimeout(inputUrl, { headers: { 'User-Agent': 'CaseStudyGenerator/1.0 (+evidence review)', Accept: 'text/html' } })
    if (!response.ok) return { source: inputUrl, status: 'unavailable', note: `Website returned HTTP ${response.status}.` }
    const html = (await response.text()).slice(0, 2_000_000)
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? ''
    const descriptionTag = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map((match) => match[0])
      .find((tag) => /\bname\s*=\s*["']description["']/i.test(tag))
    const description = descriptionTag?.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? ''
    const headings = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)]
      .slice(0, 30).map((match) => `H${match[1]}: ${match[2].replace(/<[^>]+>/g, '').trim()}`)
    const nav = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? ''
    const ctas = [...html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
      .map((match) => match[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean).slice(0, 30)
    const forms = [...html.matchAll(/<form\b/gi)].length
    const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0])
    const withAlt = images.filter((tag) => /\balt\s*=/i.test(tag)).length
    return {
      source: inputUrl,
      status: 'reviewed',
      title,
      description,
      headings,
      navLinkCount: [...nav.matchAll(/<a\b/gi)].length,
      linkLabels: ctas,
      forms,
      imageCount: images.length,
      imagesWithAlt: withAlt,
      imagesWithoutAlt: images.length - withAlt,
      viewportMeta: /<meta\b[^>]*name=["']viewport["']/i.test(html),
      structuredData: /application\/ld\+json/i.test(html),
      note: 'Current-site HTML only; this is not a before/after comparison.',
    }
  } catch (error) {
    return { source: inputUrl, status: 'unavailable', note: `Website fetch failed: ${error.message}` }
  }
}

function scoreCommit(message, stat, files) {
  const keywords = /redesign|rebuild|revamp|refactor ui|new design|v2|theme|migrate|rewrite|overhaul/i
  const uiFiles = files.filter((file) => UI_EXTENSIONS.test(file)).length
  const dependencyChanges = files.includes('package.json') ? 4 : 0
  const additions = [...stat.matchAll(/^\s*(\d+)\s+/gm)].reduce((sum, match) => sum + Number(match[1]), 0)
  return (keywords.test(message) ? 12 : 0) + Math.min(uiFiles * 2, 12) + dependencyChanges + Math.min(Math.round(additions / 30), 10)
}

async function git(args, cwd) {
  return (await execFile('git', args, { cwd, maxBuffer: 15 * 1024 * 1024, timeout: 60000 })).stdout.trim()
}

async function inspectRepository(repoInput, rl, yes) {
  let cwd = resolve(repoInput)
  let temporaryDirectory = null
  const githubUrl = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/
  if (/^https?:\/\//i.test(repoInput)) {
    const match = repoInput.match(githubUrl)
    if (!match) throw new Error('GitHub repository URLs must look like https://github.com/<owner>/<repo>.')
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'case-study-repo-'))
    cwd = join(temporaryDirectory, 'repository')
  }
  try {
    if (temporaryDirectory) {
      const match = repoInput.match(githubUrl)
      await execFile('git', ['clone', '--no-checkout', `https://github.com/${match[1]}/${match[2]}.git`, cwd], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 })
    }
    await git(['rev-parse', '--git-dir'], cwd)
    const log = await git(['log', '--date=short', '--format=%H%x09%ad%x09%s'], cwd)
    const candidates = []
    for (const line of log.split('\n').filter(Boolean)) {
      const [hash, date, ...messageParts] = line.split('\t')
      const message = messageParts.join('\t')
      const filesOutput = await git(['diff-tree', '--no-commit-id', '--name-only', '-r', hash], cwd)
      const files = filesOutput.split('\n').filter(Boolean)
      const stat = await git(['show', '--format=', '--numstat', hash], cwd)
      candidates.push({ hash, date, message, files, score: scoreCommit(message, stat, files) })
    }
    candidates.sort((a, b) => b.score - a.score)
    const top = candidates.slice(0, 3)
    if (!top.length) return { source: repoInput, status: 'reviewed', note: 'Repository has no commits to compare.' }
    console.log('\nCandidate major UI changes:')
    top.forEach((candidate, index) => {
      console.log(`${index + 1}. ${candidate.date} · ${candidate.message} · ${candidate.files.length} files · score ${candidate.score}`)
    })
    let selected = top[0]
    if (!yes && top.length > 1) {
      const answer = (await rl.question('Choose candidate 1–3, or press Enter for the top score: ')).trim()
      const candidateIndex = Number(answer) - 1
      if (Number.isInteger(candidateIndex) && candidateIndex >= 0 && candidateIndex < top.length) selected = top[candidateIndex]
    }
    const parent = await git(['rev-parse', `${selected.hash}^`], cwd).catch(() => '')
    if (!parent) return { source: repoInput, status: 'reviewed', selectedCommit: selected, note: 'Selected commit has no parent; no before revision is available.' }
    const afterHead = await git(['rev-parse', 'HEAD'], cwd)
    const beforeStat = await git(['diff', '--stat', `${parent}..${afterHead}`], cwd)
    const logMessages = await git(['log', '--format=%ad %s', '--date=short', `${parent}..${afterHead}`], cwd).catch(() => '')
    const packageDiff = await git(['diff', `${parent}..${afterHead}`, '--', 'package.json'], cwd).catch(() => '')
    const beforePackage = await git(['show', `${parent}:package.json`], cwd).then((content) => JSON.parse(content)).catch(() => ({}))
    const afterPackage = await git(['show', `${afterHead}:package.json`], cwd).then((content) => JSON.parse(content)).catch(() => ({}))
    const beforeDependencies = { ...beforePackage.dependencies, ...beforePackage.devDependencies }
    const afterDependencies = { ...afterPackage.dependencies, ...afterPackage.devDependencies }
    const dependencyChanges = {
      added: Object.keys(afterDependencies).filter((name) => !(name in beforeDependencies)),
      removed: Object.keys(beforeDependencies).filter((name) => !(name in afterDependencies)),
      changed: Object.keys(afterDependencies).filter((name) => name in beforeDependencies && afterDependencies[name] !== beforeDependencies[name]),
    }
    const changedTokens = await git(['diff', '-U0', `${parent}..${afterHead}`, '--', '*.css', '*.scss'], cwd).catch(() => '')
    const routeFiles = await git(['ls-tree', '-r', '--name-only', afterHead], cwd)
    const routes = routeFiles.split('\n').filter((file) => /(^|\/)(pages|routes|app)\//i.test(file) || /route/i.test(file)).slice(0, 40)
    const beforeRouteFiles = await git(['ls-tree', '-r', '--name-only', parent], cwd)
    const routesBefore = beforeRouteFiles.split('\n').filter((file) => /(^|\/)(pages|routes|app)\//i.test(file) || /route/i.test(file)).slice(0, 40)
    const readExcerpt = (revision, file) => git(['show', `${revision}:${file}`], cwd).then((text) => text.slice(0, 2500)).catch(() => '')
    const [readmeExcerpt, changelogExcerpt] = await Promise.all([
      readExcerpt(afterHead, 'README.md'),
      readExcerpt(afterHead, 'CHANGELOG.md'),
    ])
    return {
      source: repoInput,
      status: 'reviewed',
      before: parent,
      after: afterHead,
      selectedCommit: { hash: selected.hash, date: selected.date, message: selected.message, score: selected.score },
      candidates: top.map(({ hash, date, message, files, score }) => ({ hash, date, message, fileCount: files.length, score })),
      diffStat: beforeStat,
      commits: logMessages.slice(0, 6000),
      packageChanges: packageDiff.slice(0, 3000),
      dependencyChanges,
      styleChanges: changedTokens.split('\n').filter((line) => /^\+[^+]|^-[^-]/.test(line)).slice(0, 80).join('\n'),
      routesBefore,
      routesAfter: routes,
      readmeExcerpt,
      changelogExcerpt,
      note: 'Read-only git history review; project code was not executed.',
    }
  } finally {
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

async function maybeWayback(url, rl) {
  const date = await promptLine(rl, 'Approximate “before” date (YYYYMMDD, or blank to skip)', '')
  if (!date) return null
  const endpoint = new URL('https://archive.org/wayback/available/')
  endpoint.searchParams.set('url', url)
  endpoint.searchParams.set('timestamp', date.replace(/\D/g, '').slice(0, 8))
  const response = await fetchWithTimeout(endpoint, {}, 10000)
  if (!response.ok) throw new Error(`Wayback Machine returned HTTP ${response.status}.`)
  const result = await response.json()
  return result.archived_snapshots?.closest ?? { available: false, note: 'No matching snapshot found.' }
}

async function collectEvidence(options, rl) {
  const evidence = []
  if (options.url) {
    const website = await inspectWebsite(options.url)
    if (website.status === 'reviewed' && !options.yes && await confirm(rl, 'Look for a Wayback “before” snapshot?', false)) {
      website.beforeSnapshot = await maybeWayback(options.url, rl)
      if (website.beforeSnapshot?.available && website.beforeSnapshot.url) {
        website.beforeSnapshot.details = await inspectWebsite(website.beforeSnapshot.url)
      }
    }
    evidence.push(website)
  }
  if (options.repo) evidence.push(await inspectRepository(options.repo, rl, options.yes))
  if (options.images.length) {
    const images = await readImages(options.images)
    console.log('\nScreenshot roles inferred from filenames:')
    images.forEach((image) => console.log(`  ${image.name}: ${image.side}`))
    if (!await confirm(rl, 'Are these before/after labels correct?', true, options.yes)) {
      for (const image of images) {
        image.side = await promptLine(rl, `${image.name}: enter before, after, or reference`, 'reference')
      }
    }
    const unknownLabels = images.filter((image) => image.side === 'unconfirmed')
    if (unknownLabels.length && await confirm(rl, 'Label screenshots without before/after filenames now?', false, options.yes)) {
      for (const image of unknownLabels) {
        image.side = await promptLine(rl, `${image.name}: enter before, after, or reference`, 'reference')
      }
    }
    evidence.push({
      source: options.images,
      status: 'reviewed',
      images: images.map(({ name, side, size }) => ({ name, side, bytes: size })),
      note: 'Screenshots are available for visual review by a vision-capable provider. Filename labels are tentative.',
    })
    options.imagePayloads = images
  }
  return evidence
}

function missing(value) {
  return !value || /^(skip|none|n\/a|unknown)$/i.test(value.trim())
}

async function interview(rl, options, existingFacts = {}) {
  const facts = { ...existingFacts }
  if (options.noQuestions) {
    for (const [key] of QUESTIONS) if (facts[key] === undefined) facts[key] = ''
    facts.cta ||= 'Reply to this email to start a project.'
    facts.client ||= '[ADD: client and customer context]'
    facts.problem ||= '[ADD: specific problem from the old site]'
    facts.goal ||= '[ADD: client goal]'
    facts.role ||= '[ADD: role, timeframe, and constraints]'
    facts.decisions ||= '[ADD: design decisions and rationale]'
    facts.metrics ||= '[ADD: measured outcomes, or note that no metrics are available]'
    facts.proof ||= '[ADD: approved client quote or qualitative proof]'
    facts.nameConsent ??= false
    facts.logoConsent ??= false
    facts.quoteConsent ??= false
    facts.voice ||= 'I'
    facts.length = options.length
    facts.capturedAt = new Date().toISOString()
    return facts
  }
  let probes = 0
  for (const [key, question] of QUESTIONS) {
    if (!missing(facts[key])) continue
    facts[key] = await promptLine(rl, `${question}\nType “skip” if unknown.`)
    if (
      probes < 2 &&
      !missing(facts[key]) &&
      /^(it improved a lot|improved a lot|much better|a lot|not sure|better|faster|more sales)$/i.test(facts[key].trim())
    ) {
      probes += 1
      facts[key] = await promptLine(
        rl,
        key === 'metrics'
          ? 'Can you be more specific? Share an approximate number and label it as approximate, or type “skip”.'
          : 'Can you add one concrete example or detail? Approximate information is fine; type “skip” if you do not know.',
      )
    }
  }
  if (missing(facts.cta)) facts.cta = 'Reply to this email to start a project.'
  console.log('\nFact sheet for confirmation:')
  for (const [key] of QUESTIONS) console.log(`  ${key}: ${facts[key] || '[ADD: provide this detail or leave qualitative]'}`)
  if (!options.noQuestions && await confirm(rl, 'Edit any fact-sheet fields before generation?', false)) {
    for (const [key] of QUESTIONS) {
      facts[key] = await promptLine(rl, `${key} (Enter keeps current)`, facts[key] ?? '')
    }
  }
  if (missing(facts.metrics)) facts.metrics = '[ADD: measured outcomes, or note that no metrics are available]'
  if (missing(facts.proof)) facts.proof = '[ADD: approved client quote or qualitative proof]'
  if (missing(facts.client)) facts.client = '[ADD: client and customer context]'
  if (missing(facts.problem)) facts.problem = '[ADD: specific problem from the old site]'
  if (missing(facts.goal)) facts.goal = '[ADD: client goal]'
  if (missing(facts.role)) facts.role = '[ADD: role, timeframe, and constraints]'
  if (missing(facts.decisions)) facts.decisions = '[ADD: design decisions and rationale]'
  if (missing(facts.cta)) facts.cta = 'Reply to this email to start a project.'
  facts.nameConsent = await confirm(rl, 'May the case study use the client’s name?', false, options.yes)
  facts.quoteConsent = await confirm(rl, 'Is the client quote approved for publication?', false, options.yes)
  facts.logoConsent = await confirm(rl, 'May the case study show the client’s logo?', false, options.yes)
  facts.voice = await promptLine(rl, 'Writing voice: “I” or “we”?', 'I')
  facts.length = options.length
  facts.capturedAt = new Date().toISOString()
  return facts
}

async function getProvider(options) {
  const autoDetect = options.provider === 'auto'
  const provider = autoDetect
    ? process.env.ANTHROPIC_API_KEY ? 'anthropic'
      : process.env.OPENAI_API_KEY ? 'openai'
        : 'ollama'
    : options.provider
  const baseUrl = (options.baseUrl || (provider === 'ollama' ? 'http://localhost:11434' : 'https://api.openai.com')).replace(/\/+$/, '')
  const model = options.model || (
    provider === 'ollama' && options.imagePayloads?.length
      ? 'llama3.2-vision'
      : ({ anthropic: 'claude-3-5-sonnet-latest', openai: 'gpt-4o-mini', ollama: 'llama3.1', 'openai-compatible': 'local-model' })[provider]
  )
  if (!['anthropic', 'openai', 'ollama', 'openai-compatible'].includes(provider)) throw new Error(`Unsupported provider: ${provider}`)
  if (provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) throw new Error('Set ANTHROPIC_API_KEY or select another provider.')
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) throw new Error('Set OPENAI_API_KEY or select another provider.')
  if (autoDetect && provider === 'ollama' && !options.dryRun) {
    let reachable = false
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/tags`, {}, 2500)
      reachable = response.ok
    } catch {
      reachable = false
    }
    if (!reachable) {
      throw new Error('No hosted API key or reachable Ollama model was found. Set ANTHROPIC_API_KEY / OPENAI_API_KEY or start Ollama, then retry.')
    }
  }
  return { provider, baseUrl, model }
}

const systemPrompt = (wordCount) => `Write a truthful web redesign case study for a busy small-business owner in plain language (grade 8–10). Target about ${wordCount} words. Use past tense and the chosen first-person voice. Never invent names, quotes, dates, tools, or metrics. Ground claims only in the supplied evidence and fact sheet. Distinguish observed changes from inferred intent. If facts are missing, use visible [ADD: ...] placeholders. Always ask for before numbers; if unavailable, write qualitative results, never fabricated figures. Include a pull-quote slot and a visual image-plan. Include an honest caveat about short/unknown measurement windows and early results when relevant. Output exactly four sections in this order, followed by a concrete CTA:
## The project summary
## The challenge
## What we did
## The result`

async function generateWithProvider(config, system, prompt, images = []) {
  let endpoint
  let headers = { 'Content-Type': 'application/json' }
  let body
  if (config.provider === 'anthropic') {
    endpoint = 'https://api.anthropic.com/v1/messages'
    headers = { ...headers, 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
    const content = [{ type: 'text', text: prompt }, ...images.map((image) => ({
      type: 'image',
      source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
    }))]
    body = { model: config.model, max_tokens: 3500, system, messages: [{ role: 'user', content }] }
  } else if (config.provider === 'ollama') {
    endpoint = `${config.baseUrl}/api/chat`
    body = {
      model: config.model,
      stream: false,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt, images: images.map((image) => image.base64) }],
    }
  } else {
    endpoint = `${config.baseUrl}/v1/chat/completions`
    if (config.provider === "openai") headers.Authorization = ["Bearer", process.env.OPENAI_API_KEY].join(" ")
    const content = [{ type: 'text', text: prompt }, ...images.map((image) => ({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    }))]
    body = { model: config.model, temperature: 0.3, messages: [{ role: 'system', content: system }, { role: 'user', content }] }
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) })
      if (!response.ok) {
        if (response.status >= 500 || response.status === 429) {
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * 2 ** attempt))
          continue
        }
        throw new Error(`${config.provider} returned HTTP ${response.status}. Check provider settings and model access.`)
      }
      const result = await response.json()
      const text = config.provider === 'anthropic'
        ? result.content?.filter((part) => part.type === 'text').map((part) => part.text).join('\n')
        : config.provider === 'ollama' ? result.message?.content : result.choices?.[0]?.message?.content
      if (!text) throw new Error('The model returned an empty response.')
      return text
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'TimeoutError') break
      if (attempt < 2 && !/\bHTTP 4\d\d\b/.test(error.message)) {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * 2 ** attempt))
      } else break
    }
  }
  throw new Error(`Could not generate with ${config.provider}. Check the connection, model name, and provider settings.`)
}

function buildPrompt(facts, evidence, options) {
  return `Create the requested case study using this verified fact sheet and evidence summary.
Word target: about ${LENGTH_WORDS[options.length]}.
Do not claim an outcome that is not explicitly supported.
Consent: client name ${facts.nameConsent ? 'approved' : 'not approved'}; quote publication ${facts.quoteConsent ? 'approved' : 'not approved'}.
Facts:\n${JSON.stringify(redactSecrets(facts), null, 2)}
\nEvidence:\n${JSON.stringify(evidence, null, 2)}
\nIf client name usage is not approved, use “the client” instead. Omit an unapproved quote.`
}

function redactSecrets(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/g, '[REDACTED SECRET]')
      .replace(/\bBearer\s+[A-Za-z0-9._~-]+\b/gi, 'Bearer [REDACTED]')
      .replace(/\b(api[_-]?key|token|secret)\s*[:=]\s*["']?[^,\s"']{8,}/gi, '$1=[REDACTED]')
  }
  if (Array.isArray(value)) return value.map(redactSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactSecrets(entry)]))
  }
  return value
}

async function generateDraft(config, system, prompt, images, wordCount) {
  const sectionedProvider = config.provider === 'ollama' || config.provider === 'openai-compatible'
  if (!sectionedProvider) return generateWithProvider(config, system, prompt, images)

  let visualEvidence = ''
  if (images.length) {
    visualEvidence = await generateWithProvider(
      config,
      'Compare screenshots carefully. Return concise bullets tagged [observed] for visible facts and [inferred] for likely intent. Never state an inference as an observed fact.',
      'Compare these project screenshots. Describe only visible changes in layout, navigation, hierarchy, typography, color/contrast, CTA placement, mobile use, trust signals, and clutter. Label every point [observed] or [inferred].',
      images,
    )
  }
  const sectionSystem = `${system}\nWrite only the requested section body; do not write other sections. Keep it concise and consistent with the provided facts.`
  const sectionBody = `${prompt}${visualEvidence ? `\n\nVisual comparison notes (observed/inferred):\n${visualEvidence}` : ''}`
  const sections = []
  for (const [index, heading] of HEADINGS.entries()) {
    const isSummary = index === 0
    const isResult = heading === 'The result'
    const instruction = isSummary
      ? 'Start with a single # headline containing the strongest supported outcome (or problem-solved framing), followed by 2–4 summary sentences.'
      : isResult
        ? 'Include supported metrics with their dates/window/tool or state qualitatively that no metrics are available. End with the concrete CTA.'
        : 'Write a concise, specific narrative section. In “What we did”, include key design decisions and a visual plan.'
    const result = await generateWithProvider(
      config,
      sectionSystem,
      `${sectionBody}\n\nWrite only “${heading}” (about ${Math.round(wordCount / 4)} words). ${instruction}`,
      [],
    )
    sections.push(`## ${heading}\n${result.trim()}`)
  }
  const summary = sections[0].replace(/^## The project summary\n/, '')
  const headline = summary.match(/^# .+/)?.[0] ?? '# [ADD: problem-solved headline]'
  const summaryBody = summary.replace(/^# .+\n*/, '').trim()
  return `${headline}\n\n## The project summary\n${summaryBody}\n\n${sections.slice(1).join('\n\n')}`
}

function checkDraft(draft, facts, options) {
  const headings = HEADINGS.map((heading) => draft.indexOf(`## ${heading}`))
  const missingHeadings = HEADINGS.filter((_, index) => headings[index] < 0)
  const ordered = headings.every((position, index) => index === 0 || position > headings[index - 1])
  const words = draft.trim().split(/\s+/).length
  const allowedNumbers = new Set((JSON.stringify(facts).match(/\d+(?:\.\d+)?%?/g) ?? []))
  const numbers = draft.match(/\b\d+(?:\.\d+)?%?\b/g) ?? []
  const unsupportedNumbers = [...new Set(numbers.filter((number) => !allowedNumbers.has(number)))]
  const warnings = []
  if (missingHeadings.length) warnings.push(`Missing required sections: ${missingHeadings.join(', ')}.`)
  if (!missingHeadings.length && !ordered) warnings.push('Required sections are not in the requested order.')
  if (unsupportedNumbers.length) warnings.push(`Check unsupported number(s): ${unsupportedNumbers.join(', ')}.`)
  if (words < Math.floor(LENGTH_WORDS[options.length] * 0.5) || words > LENGTH_WORDS[options.length] * 1.6) warnings.push(`Word count ${words} is outside the approximate ${options.length} target.`)
  if (!/pull[\s-]?quote/i.test(draft)) warnings.push('Add a pull-quote slot.')
  if (!/image plan|visual plan|before\/after/i.test(draft)) warnings.push('Add a before/after image plan.')
  if (!/reply to this email|want this for your business|start a project/i.test(draft)) warnings.push('Add the concrete project CTA.')
  const placeholders = [...new Set(draft.match(/\[ADD:[^\]]+\]/g) ?? [])]
  if (placeholders.length) warnings.push(`${placeholders.length} visible [ADD: ...] placeholder(s) remain.`)
  return { words, warnings, placeholders }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
}

function markdownToHtml(markdown) {
  return markdown.split('\n').map((line) => {
    if (line.startsWith('# ')) return `<h1>${escapeHtml(line.slice(2))}</h1>`
    if (line.startsWith('## ')) return `<h2>${escapeHtml(line.slice(3))}</h2>`
    if (line.startsWith('### ')) return `<h3>${escapeHtml(line.slice(4))}</h3>`
    if (/^\s*[-*]\s/.test(line)) return `<p>• ${escapeHtml(line.replace(/^\s*[-*]\s/, ''))}</p>`
    if (!line.trim()) return ''
    return `<p>${escapeHtml(line)}</p>`
  }).join('\n')
}

function renderHtml(markdown) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Case study</title><style>
  :root{color-scheme:light;font:18px/1.7 system-ui,sans-serif;color:#20130e;background:#f4e8d1}
  body{max-width:820px;margin:0 auto;padding:clamp(24px,7vw,80px)}h1{font-size:clamp(2.5rem,8vw,5rem);line-height:1;letter-spacing:-.06em}
  h2{margin-top:2.5em;padding-top:.7em;border-top:4px solid #20130e;font-size:1.6rem}
  a{color:#7938a5}p{max-width:68ch}.sticky{position:fixed;right:20px;bottom:20px;background:#f15b31;color:#20130e;padding:12px 18px;border:2px solid #20130e;font-weight:700}
  </style><main>${markdownToHtml(markdown)}</main><a class="sticky" href="mailto:?subject=Start%20a%20project">Start a project ↗</a></html>`
}

function renderJson(draft, facts, evidence, check) {
  const sections = Object.fromEntries(HEADINGS.map((heading) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = draft.match(new RegExp(`## ${escaped}\\s*([\\s\\S]*?)(?=\\n## |\\n---|$)`))
    return [heading, match?.[1]?.trim() ?? '']
  }))
  return JSON.stringify({ title: draft.split('\n')[0].replace(/^#\s*/, ''), sections, cta: facts.cta, factSheet: facts, evidence, qualityCheck: check }, null, 2)
}

async function saveOutput(options, draft, facts, evidence, check) {
  const slug = slugify(facts.client || options.url || options.repo || 'case-study')
  const extension = options.format === 'html' ? 'html' : options.format === 'json' ? 'json' : 'md'
  const outputPath = resolve(options.out || `case-study-${slug}-${new Date().toISOString().slice(0, 10)}.${extension}`)
  const content = options.format === 'html' ? renderHtml(draft) : options.format === 'json' ? renderJson(draft, facts, evidence, check) : draft
  await writeFile(outputPath, `${content.trim()}\n`, 'utf8')
  const factsPath = `${outputPath}.facts.json`
  await writeFile(factsPath, `${JSON.stringify({ facts, evidence }, null, 2)}\n`, 'utf8')
  return { outputPath, factsPath }
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`Error: ${error.message}\n\nUse --help to see available options.`)
    process.exitCode = 2
    return
  }
  if (options.help) {
    console.log(USAGE)
    return
  }

  const rl = createInterface({ input, output })
  try {
    if (!options.url && !options.repo && !options.images.length && !options.facts) {
      console.log('Do you have a website URL, a GitHub repo, or screenshots? You can combine sources.')
      const source = await promptLine(rl, 'Add a website URL (or leave blank)')
      if (source) options.url = source
      const repository = await promptLine(rl, 'Add a GitHub URL or local repo path (or leave blank)')
      if (repository) options.repo = repository
      const screenshot = await promptLine(rl, 'Add a screenshot file or folder (or leave blank)')
      if (screenshot) options.images = screenshot.split(',').map((item) => item.trim()).filter(Boolean)
    }
    if (!options.url && !options.repo && !options.images.length && !options.facts) throw new Error('No input source provided.')
    const storedFacts = options.facts ? JSON.parse(await readFile(resolve(options.facts), 'utf8')) : null
    const evidence = options.facts
      ? storedFacts.evidence ?? []
      : await collectEvidence(options, rl)
    console.log('\nEvidence summary — correct these details during the interview if needed:\n')
    console.log(JSON.stringify(evidence, null, 2))

    const provider = await getProvider(options)
    const facts = options.facts
      ? storedFacts.facts ?? storedFacts
      : await interview(rl, options)
    const prompt = buildPrompt(facts, redactSecrets(evidence), options)
    const system = systemPrompt(LENGTH_WORDS[options.length])

    if (options.dryRun) {
      console.log(`\nDRY RUN — provider selected: ${provider.provider}; no model call was made.\n`)
      console.log('SYSTEM PROMPT:\n' + system)
      console.log('\nUSER PROMPT:\n' + prompt)
      return
    }
    if (options.repo && ['anthropic', 'openai', 'openai-compatible'].includes(provider.provider)) {
      const allowed = await confirm(rl, `Send summarized repository evidence to ${provider.provider} (third-party service)?`, false, options.yes)
      if (!allowed) {
        const index = evidence.findIndex((item) => item.source === options.repo)
        if (index >= 0) evidence[index] = { status: 'withheld', note: 'Repository evidence was not shared with the model.' }
      }
    }
    if (options.imagePayloads?.length && !['anthropic', 'openai', 'ollama'].includes(provider.provider)) {
      console.warn('The selected provider may not support images; image evidence will be omitted.')
    }
    if (['anthropic', 'openai', 'openai-compatible'].includes(provider.provider) && options.imagePayloads?.length) {
      const allowed = await confirm(rl, `Send project screenshots to ${provider.provider} (third-party service)?`, false, options.yes)
      if (!allowed) {
        options.imagePayloads = []
        const index = evidence.findIndex((item) => Array.isArray(item.source) && item.source.length > 0)
        if (index >= 0) evidence[index] = { status: 'withheld', note: 'Screenshot evidence was not shared with the model.' }
      }
    }
    const safePrompt = buildPrompt(facts, redactSecrets(evidence), options)
    const draft = await generateDraft(
      provider,
      system,
      safePrompt,
      options.imagePayloads ?? [],
      LENGTH_WORDS[options.length],
    )
    const check = checkDraft(draft, facts, options)
    const saved = await saveOutput(options, draft, facts, evidence, check)
    console.log(`\nSaved case study: ${saved.outputPath}`)
    console.log(`Saved fact sheet: ${saved.factsPath}`)
    console.log(`Word count: ${check.words}`)
    console.log(`Warnings: ${check.warnings.length ? check.warnings.join(' ') : 'none'}`)
    console.log(`Remaining [ADD: ...] items: ${check.placeholders.length ? check.placeholders.join(', ') : 'none'}`)
  } catch (error) {
    console.error(`\nCase study generation failed: ${error.message}`)
    process.exitCode = 1
  } finally {
    rl.close()
  }
}

main()
