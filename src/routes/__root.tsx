import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import appCss from "../styles.css?url";

const APP_NAME = "Southern Girl Pots";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0b1218" },
      {
        name: "description",
        content: "A two-minute Chesapeake crab-pot run. Haul pots, read rival notes, grab the CAPSTILLER hat.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <a
          className="gear-home-cutout"
          href="https://landonthis.gearup.wtf"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Gear home — landonthis"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "0.75rem",
            transform: "translateX(-50%)",
            zIndex: 40,
            display: "inline-flex",
            opacity: 0.9,
            transition: "opacity 0.15s ease",
            lineHeight: 0,
          }}
        >
          <img
            src="/gear-logo-cutout.svg"
            alt=""
            height={56}
            width={213}
            style={{ height: 56, width: "auto", imageRendering: "pixelated" }}
          />
        </a>
        <Scripts />
      </body>
    </html>
  ),
});
