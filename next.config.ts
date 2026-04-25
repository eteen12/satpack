import withMdkCheckout, { type NextConfigOverrides } from "@moneydevkit/nextjs/next-plugin";
const nextConfig: NextConfigOverrides = {};

export default withMdkCheckout(nextConfig);
