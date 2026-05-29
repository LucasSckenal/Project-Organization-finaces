/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  sassOptions: {
    // Each module file imports its own tokens via @use — no prependData needed
    includePaths: ['./styles'],
  },
}

module.exports = nextConfig
