/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * standalone 模式：npm run build 生成 .next/standalone，方便生产部署
   * 不影响 npm run dev 的本地开发体验
   */
  output: "standalone",
};

module.exports = nextConfig;
