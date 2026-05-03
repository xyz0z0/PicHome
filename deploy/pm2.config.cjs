const APP_NAME = "pichome";
const APP_PORT = 3000;

module.exports = {
  apps: [
    {
      name: APP_NAME,
      script: "pnpm",
      args: "start",
      cwd: "/var/www/pichome",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: APP_PORT,
      },
    },
  ],
};
