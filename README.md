# JollyPod website

A small static website for JollyPod. It uses plain HTML and CSS, has no build step, no frameworks, no remote fonts, no cookies, and no tracking.

## Pages

- `/` — Home
- `/features/` — Features
- `/support/` — Support and FAQ
- `/privacy/` — Privacy Policy
- `/terms/` — Terms and Conditions

## Run locally

Serve this folder with any static web server. The site uses root-relative links, so opening individual HTML files directly from Finder is not a reliable preview.

## Deploy on Cloudflare Pages

1. In Cloudflare, open **Workers & Pages** and create a Pages project.
2. Connect the GitHub repository containing this folder.
3. Choose **None** as the framework preset.
4. Leave the build command empty.
5. Set the build output directory to `/` if these files are at the repository root.
6. Deploy, then add `jollypod.app` under **Custom domains**.

Cloudflare Pages recognises the included `_headers` file automatically.

## Before a production launch

- Replace the TestFlight URL with the final App Store URL when available.
- Review the Privacy Policy and Terms whenever app data handling or subscription benefits change.
- Legal text is a practical starting point, not a substitute for advice from a qualified Swiss lawyer.
