import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://elitium.com.br';
  return {
    rules: {
      userAgent: '*',
      allow: ['/login', '/register', '/'],
      disallow: ['/api/', '/admin/', '/sales/', '/inventory/', '/finance/', '/assistant/', '/quotes/', '/purchases/', '/reports/', '/demand-forecast/', '/notifications/', '/users/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
