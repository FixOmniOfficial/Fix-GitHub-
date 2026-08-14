/**
 * +html.tsx — Expo Router web HTML shell
 *
 * Sets the dark background on <html> and <body> so the phone's safe-area
 * inset (home-indicator bar on iOS, gesture pill on Android) shows the
 * app's dark colour instead of a white strip.
 *
 * Also enables `viewport-fit=cover` so the layout can extend edge-to-edge
 * and use `env(safe-area-inset-*)` to place content correctly.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover lets us use env(safe-area-inset-bottom) */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* Reset ScrollView margins (Expo recommendation) */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              background-color: #121212;
              margin: 0;
              padding: 0;
              min-height: 100%;
            }
          `,
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
