/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify is deprecated in Next.js 15, removing it
  // Configurar para permitir variáveis de ambiente no cliente
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  // Configurar headers de segurança

  async rewrites() {
    if (process.env.VERCEL === '1') {
      return {
        beforeFiles: [
          {
            source: '/api/:path*',
            destination: 'https://vaquejada.67.205.190.178.nip.io/api/:path*',
          },
        ],
      };
    }
    return [];
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ]
      }
    ];
  }
};

module.exports = nextConfig;