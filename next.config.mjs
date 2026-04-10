/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 开发环境下避免 StrictMode 双次挂载与部分本地环境冲突（可选）
  reactStrictMode: false,
  /** 内网穿透（localtunnel 等）下允许跨域加载 /_next 资源，否则外链打开会 403 */
  allowedDevOrigins: [
    "*.loca.lt",
    "*.localtunnel.me",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
