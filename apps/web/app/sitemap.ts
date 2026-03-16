import type { MetadataRoute } from 'next'

const BASE_URL = 'https://leetscuda.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '/',
    '/problems',
    '/roadmap',
    '/learn',
    '/faq',
    '/about',
    '/contributing',
    '/whats-coming',
    '/support',
    '/contact',
    '/impressum',
    '/privacy',
    '/terms',
    '/cookies',
  ]

  return staticRoutes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '/' ? 1 : 0.8,
  }))
}
