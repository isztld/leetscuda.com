/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allow pure-ESM packages (marked, highlight.js) to be imported in Server Components
    // via Node.js native import() rather than webpack bundling
    serverComponentsExternalPackages: ['marked', 'highlight.js'],
  },
  // Allow Tailscale / LAN dev access
  allowedDevOrigins: ['100.101.56.41'],
}

export default nextConfig
