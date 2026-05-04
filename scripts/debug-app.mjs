import { chromium } from '@playwright/test'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

const browser = await chromium.launch()
const ctx = await browser.newContext()
const page = await ctx.newPage()

const consoleMessages = []
const pageErrors = []
const failedRequests = []

page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }))
page.on('pageerror', (err) => pageErrors.push(err.message))
page.on('requestfailed', (req) =>
  failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }),
)

console.log(`\n=== Loading ${BASE}/ ===`)
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })

await page.waitForTimeout(2000)

const mapContainer = await page.locator('.leaflet-container').count()
const markers = await page.locator('.leaflet-interactive').count()
const legendVisible = await page.locator('text=Permit type').count()
const loadingVisible = await page.locator('text=Loading…').count()
const errorVisible = await page.locator('text=Data temporarily unavailable').count()

console.log('Map container present:', mapContainer)
console.log('Marker count:', markers)
console.log('Legend present:', legendVisible)
console.log('Loading still showing:', loadingVisible)
console.log('Error banner showing:', errorVisible)

console.log('\n=== Filter interaction ===')
const filterCheckboxes = await page.locator('input[type="checkbox"]').count()
console.log('Filter checkboxes:', filterCheckboxes)

const initialMarkers = await page.locator('.leaflet-interactive').count()
console.log('Markers before filtering:', initialMarkers)

await page.locator('input[type="checkbox"]').first().uncheck()
await page.waitForTimeout(200)
const afterUncheckMarkers = await page.locator('.leaflet-interactive').count()
console.log('Markers after unchecking first type:', afterUncheckMarkers)

await page.locator('input[type="checkbox"]').first().check()
await page.waitForTimeout(200)
const restored = await page.locator('.leaflet-interactive').count()
console.log('Markers after re-checking:', restored)

console.log('\n=== Sample API hit ===')
const apiResp = await page.evaluate(async () => {
  const r = await fetch('/api/permits?north=37.81&south=37.75&east=-122.39&west=-122.45')
  return { status: r.status, count: (await r.json()).length }
})
console.log('Bounded permits API:', apiResp)

console.log('\n=== Try a permit detail page ===')
const firstPermit = await page.evaluate(async () => {
  const r = await fetch('/api/permits')
  const data = await r.json()
  return data[0]?.permit_number
})
console.log('First permit number:', firstPermit)

if (firstPermit) {
  await page.goto(`${BASE}/permits/${firstPermit}`, { waitUntil: 'networkidle' })
  const detailHeading = await page.locator('h1').textContent()
  const detailBody = await page.textContent('main')
  console.log('Detail heading:', detailHeading)
  console.log('Has dl rows:', detailBody?.includes('Type') && detailBody?.includes('Status'))
  const iframeCount = await page.locator('iframe[title*="Map of"]').count()
  const sourceLinks = await page.locator('a[href*="socketsite.com"], a[href*="sfstandard.com"], a[href*="missionlocal.org"], a[href*="news.google.com"]').count()
  console.log('Maps iframe present:', iframeCount)
  console.log('External source links:', sourceLinks)
}

console.log('\n=== Console messages ===')
const importantConsole = consoleMessages.filter((m) => m.type !== 'log' && m.type !== 'debug')
if (importantConsole.length === 0) console.log('(none)')
else for (const m of importantConsole) console.log(`[${m.type}]`, m.text)

console.log('\n=== Page errors ===')
if (pageErrors.length === 0) console.log('(none)')
else for (const e of pageErrors) console.log('!!', e)

console.log('\n=== Failed requests ===')
if (failedRequests.length === 0) console.log('(none)')
else for (const r of failedRequests) console.log('!!', r.url, r.failure)

await browser.close()
