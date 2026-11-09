# Nova AI Frontend

Mobile-first web app/PWA frontend for the Nova AI backend.

## Configuration
`config.js` contains only browser-safe public values:
- Supabase project URL
- Supabase publishable key
- Render API base URL

Never put the Supabase secret key or OpenAI API key in this folder.

## Deploy as a Render Static Site
1. Push this folder to the `main` branch of `Philz-Tech56/Nova-ai`.
2. In Render choose **New + → Static Site** and connect the same repository.
3. Set Root Directory to `nova-ai-frontend`.
4. Leave Build Command empty.
5. Set Publish Directory to `.`.
6. Deploy.

After Render creates the frontend URL, add that exact URL to the backend service's `FRONTEND_ORIGIN` environment variable (not a secret). Then redeploy the backend. The backend currently disables browser CORS unless `FRONTEND_ORIGIN` is set.

## Included
- Email/password sign-up and login through Supabase Auth
- Conversation list and saved messages
- Chat requests to the Nova API
- Profile and coming-soon VIP screens

Supabase Auth email confirmation settings may require users to confirm their email before their first login. VIP checkout is intentionally not active yet.
