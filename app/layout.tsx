import { ReactNode } from "react";

type RootLayoutProps = {
  children: ReactNode;
};

// Since we have a `not-found.tsx` page on the root, a layout file
// is required, even if it's just passing children through.
const RootLayout = ({ children }: RootLayoutProps) => {
  return children;
};

export default RootLayout;
