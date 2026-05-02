import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block private dashboard routes from being indexed
        disallow: ['/dashboard', '/overview', '/history', '/settings', '/service-settings', '/projects/account'],
      },
    ],
    sitemap: 'https://apio.one/sitemap.xml',  // 🔁 Change to your real domain
    host: 'https://apio.one',
  };
}
