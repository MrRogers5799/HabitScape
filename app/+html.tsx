import { ScrollViewStyleReset } from 'expo-router/html';

// Web-only root HTML config.
// This ensures the app fills 100% of the viewport on all screen sizes.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                /* Match the app's dark background so viewport edges never flash white */
                background-color: #070520;
                overflow: hidden;
              }
              #root {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
