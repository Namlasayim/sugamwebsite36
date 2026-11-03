import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(projectRoot, 'dist')
const siteOrigin = 'https://sugamartz.com'
const staticPages = [
  { route: '/', title: 'Sugam Tamang | Contemporary Nepali Artist – Original Paintings | SugamArtz' },
  { route: '/gallery', title: 'Original Paintings by Sugam Tamang | Nepali Art for Sale | SugamArtz' },
  { route: '/about', title: 'About Sugam Tamang — Contemporary Nepali Artist | SugamArtz' },
  { route: '/contact', title: 'Buy Original Art & Enquiries | Sugam Tamang | SugamArtz' },
]

function readRoute(route) {
  const relativePath = route === '/' ? 'index.html' : path.join(route.slice(1), 'index.html')
  const filePath = path.join(distDir, relativePath)
  if (!fs.existsSync(filePath)) throw new Error(`Missing static route document for "${route}"`)
  return fs.readFileSync(filePath, 'utf8')
}

function getMeta(html, attribute, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matcher = new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${escapedValue}")[^>]*\\bcontent="([^"]*)"`, 'i')
  return html.match(matcher)?.[1] || null
}

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#x27;', "'")
}

function verifyRoute(route, expectedTitle, expectedType) {
  const html = readRoute(route)
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const decodedTitle = title && decodeHtml(title)
  const description = getMeta(html, 'name', 'description')
  const canonical = html.match(/<link\b(?=[^>]*\brel="canonical")[^>]*\bhref="([^"]*)"/i)?.[1]
  const ogTitle = getMeta(html, 'property', 'og:title')
  const ogUrl = getMeta(html, 'property', 'og:url')
  const ogType = getMeta(html, 'property', 'og:type')
  const twitterCard = getMeta(html, 'name', 'twitter:card')

  if (!title || !description || !canonical || !ogTitle || !ogUrl || !ogType || !twitterCard) {
    throw new Error(`Missing static SEO metadata for "${route}"`)
  }
  if (expectedTitle && decodedTitle !== expectedTitle) throw new Error(`Unexpected static title for "${route}": ${decodedTitle}`)
  if (canonical !== `${siteOrigin}${route}` || ogUrl !== canonical || decodeHtml(ogTitle) !== decodedTitle) {
    throw new Error(`Canonical or Open Graph metadata does not match "${route}"`)
  }
  if (expectedType && ogType !== expectedType) throw new Error(`Unexpected Open Graph type for "${route}": ${ogType}`)
  if (twitterCard !== 'summary_large_image' || !html.includes('application/ld+json')) {
    throw new Error(`Missing static social or structured metadata for "${route}"`)
  }
}

for (const page of staticPages) verifyRoute(page.route, page.title)

const sitemap = fs.readFileSync(path.join(distDir, 'sitemap.xml'), 'utf8')
const artworkRoutes = [...sitemap.matchAll(/<loc>https:\/\/sugamartz\.com(\/gallery\/[a-z0-9-]+)<\/loc>/g)]
  .map((match) => match[1])
for (const route of artworkRoutes) verifyRoute(route, undefined, route === '/gallery' ? 'website' : 'article')

const redirects = fs.readFileSync(path.join(distDir, '_redirects'), 'utf8')
const redirectRules = redirects.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
for (const rule of ['/admin /index.html 200', '/admin/* /index.html 200']) {
  if (!redirectRules.includes(rule)) throw new Error(`Missing Cloudflare admin route fallback: ${rule}`)
}
if (redirectRules.some((rule) => /(?:^|\s)404$/.test(rule) || rule.startsWith('/* '))) {
  throw new Error('Cloudflare _redirects contains an unsupported status or looping wildcard rule')
}
for (const asset of ['robots.txt', 'sitemap.xml', '404.html']) {
  if (!fs.existsSync(path.join(distDir, asset))) throw new Error(`Missing Cloudflare Pages asset: ${asset}`)
}
if (fs.existsSync(path.join(distDir, '.sitemap-artworks.json'))) {
  throw new Error('Temporary artwork metadata was not removed from the deployment output')
}

console.log(`Verified static SEO metadata for ${staticPages.length} public pages and ${artworkRoutes.length} artwork routes, plus Cloudflare routing assets.`)