# Temporary external review preview

`render.yaml` creates a temporary, passcode-gated review deployment in Frankfurt. It uses a separate Render PostgreSQL database seeded only with fictional demo data; it never connects to `.local/database`. The server requires HTTP Basic credentials before serving the application or API, except the non-sensitive database health check. Render generates the shared passcode and the Better Auth secret; retrieve the passcode from the private service environment and share it with reviewers through a separate channel.

The preview image excludes `/design-lab` static assets, and the server returns 404 for its routes. The source archive, local routes, experiments and fonts are unchanged. The public product UI uses only the selected production font files; the user confirmed distribution rights for those exact files.

Create the Blueprint from the dedicated review branch in Render. The free web service sleeps after 15 minutes without traffic; free Postgres expires 30 days after creation and should be deleted when review ends. This is a disposable product preview, not a production deployment: canonical demo accounts remain writable, and MFA, mail delivery, proxy/rate-limit review, backup/retention and operational hardening are not included. Do not enter real student or staff data. Delete both Render resources after review.
