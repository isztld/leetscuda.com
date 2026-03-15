/** @type {import('next').NextConfig} */
const nextConfig = {
  // Moved out of experimental in Next.js 15+
  serverExternalPackages: ['marked', 'highlight.js'],
  // Allow Tailscale / LAN dev access
  allowedDevOrigins: ['100.101.56.41'],
}

export default nextConfig
