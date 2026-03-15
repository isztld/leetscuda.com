/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow pure-ESM packages to be imported in Server Components via Node.js native import()
  serverExternalPackages: ['marked', 'highlight.js'],
}

export default nextConfig
