module.exports = {
  apps: [
    {
      name: 'vaquejada-sistema',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -H 0.0.0.0 -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        COOKIE_SECURE: 'false', // false para LAN HTTP, true para HTTPS
        PLACAR_RATE_LIMIT_PER_MINUTE: '300',
      },
      env_production_ssl: {
        NODE_ENV: 'production',
        COOKIE_SECURE: 'true',
        PLACAR_RATE_LIMIT_PER_MINUTE: '300',
      },
    },
  ],
};
