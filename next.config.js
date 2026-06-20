/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        'node:stream': false,
        'node:buffer': false,
        'node:util': false,
        'node:url': false,
        'node:events': false,
        'node:path': false,
        'node:os': false,
        'node:http': false,
        'node:https': false,
        'node:zlib': false,
        'node:crypto': false,
        'node:child_process': false,
        'node:worker_threads': false,
        'node:readline': false,
        'node:vm': false,
        'node:module': false,
      }
    }
    return config
  },
  experimental: {
    esmExternals: false,
  },
}

module.exports = nextConfig
