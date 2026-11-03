import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(projectRoot, 'dist')
const siteOrigin = 'https://sugamartz.com'
const defaultImage = `${siteOrigin}/og-image.jpg`

const staticPages = [
  {
    route: '/',
    title: 'Sugam Tamang | Contemporary Nepali Artist – Original Paintings | SugamArtz',
    description: 'Sugam Tamang creates contemporary paintings shaped by memory, landscape, and color. Discover original Nepali artwork in an intimate collection.',
    type: 'website',
  },
  {
    route: '/gallery',
    title: 'Original Paintings by Sugam Tamang | Nepali Art for Sale | SugamArtz',
    description: 'Browse original paintings by Sugam Tamang and discover contemporary Nepali art in acrylic, charcoal, and other expressive media.',
    type: 'website',
  },
  {
    route: '/about',
    title: 'About Sugam Tamang — Contemporary Nepali Artist | SugamArtz',
    description: 'Sugam Tamang is a Nepali contemporary artist exploring memory, landscape, and color through original paintings and slow, intentional work.',
    type: 'profile',
  },
  {
    route: '/contact',
    title: 'Buy Original Art & Enquiries | Sugam Tamang | SugamArtz',
    description: 'Contact Sugam Tamang to enquire about buying original artworks, commissions, and private sales of contemporary Nepali paintings.',
    type: 'website',
  },
]

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function upsertTag(html, tagName, attribute, value, tag) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matcher = new RegExp(`<${tagName}\\b(?=[^>]*\\b${attribute}="${escapedValue}")[^>]*>`, 'i')
  if (matcher.test(html)) return html.replace(matcher, tag)
  return html.replace('</head>', `    ${tag}\n  </head>`)
}

function setMeta(html, attribute, name, content) {
  const tag = `<meta ${attribute}="${escapeAttribute(name)}" content="${escapeAttribute(content)}" data-rh="true" />`
  return upsertTag(html, 'meta', attribute, name, tag)
}

function addSeo(html, page) {
  const url = new URL(page.route, siteOrigin).href
  const image = new URL(page.image || defaultImage, siteOrigin).href
  let output = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, `<title data-rh="true">${escapeAttribute(page.title)}</title>`)
  if (!/<title\b/i.test(output)) {
    output = output.replace('</head>', `    <title data-rh="true">${escapeAttribute(page.title)}</title>\n  </head>`)
  }
  output = setMeta(output, 'name', 'description', page.description)
  output = upsertTag(output, 'link', 'rel', 'canonical', `<link rel="canonical" href="${escapeAttribute(url)}" data-rh="true" />`)
  output = setMeta(output, 'property', 'og:title', page.title)
  output = setMeta(output, 'property', 'og:description', page.description)
  output = setMeta(output, 'property', 'og:url', url)
  output = setMeta(output, 'property', 'og:image', image)
  output = setMeta(output, 'property', 'og:type', page.type)
  output = setMeta(output, 'name', 'twitter:card', 'summary_large_image')
  output = setMeta(output, 'name', 'twitter:title', page.title)
  output = setMeta(output, 'name', 'twitter:description', page.description)
  output = setMeta(output, 'name', 'twitter:image', image)
  const jsonLd = JSON.stringify(page.jsonLd).replaceAll('<', '\\u003c')
  const schemaTag = `<script type="application/ld+json" data-rh="true">${jsonLd}</script>`
  if (/<script type="application\/ld\+json" data-static-seo>[\s\S]*?<\/script>/i.test(output)) {
    output = output.replace(/<script type="application\/ld\+json" data-static-seo>[\s\S]*?<\/script>/i, schemaTag)
  } else {
    output = output.replace('</head>', `    ${schemaTag}\n  </head>`)
  }
  return output
}

function readArtworkMetadata() {
  const metadataPath = path.join(distDir, '.sitemap-artworks.json')
  try {
    return JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  } finally {
    fs.rmSync(metadataPath, { force: true })
  }
}

function createArtworkPage(painting) {
  const title = String(painting.title || painting.slug.replaceAll('-', ' '))
  const medium = String(painting.medium || 'Painting')
  const description = String(painting.description || `${title} is an original ${medium.toLowerCase()} by Sugam Tamang, a contemporary Nepali artist.`)
  const route = `/gallery/${painting.slug}`
  const artist = { '@type': 'Person', name: 'Sugam Tamang', jobTitle: 'Artist', nationality: 'Nepali' }
  return {
    route,
    title: `${title} by Sugam Tamang | Original ${medium} Painting | SugamArtz`,
    description,
    image: painting.image_url || defaultImage,
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'VisualArtwork',
      name: title,
      artist,
      artMedium: medium,
      size: painting.size || 'Original painting',
      image: painting.image_url || defaultImage,
      description,
      url: `${siteOrigin}${route}`,
    },
  }
}

function writeRoutePage(template, page) {
  const html = addSeo(template, page)
  if (page.route === '/') {
    fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8')
    return
  }
  const pagePath = path.join(distDir, page.route.slice(1), 'index.html')
  fs.mkdirSync(path.dirname(pagePath), { recursive: true })
  fs.writeFileSync(pagePath, html, 'utf8')
}

const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')
const staticSchemas = [
  [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'SugamArtz', url: `${siteOrigin}/` }],
  [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Original Paintings by Sugam Tamang', url: `${siteOrigin}/gallery` }],
  [{ '@context': 'https://schema.org', '@type': 'ProfilePage', name: 'About Sugam Tamang', url: `${siteOrigin}/about` }],
  [{ '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact Sugam Tamang', url: `${siteOrigin}/contact` }],
]

staticPages.forEach((page, index) => {
  page.jsonLd = staticSchemas[index]
  writeRoutePage(template, page)
})

const paintings = readArtworkMetadata()
for (const painting of paintings) {
  if (!/^[a-z0-9-]+$/.test(painting.slug || '')) continue
  writeRoutePage(template, createArtworkPage(painting))
}

console.log(`Generated static SEO documents for ${staticPages.length} public routes and ${paintings.length} artwork routes.`)