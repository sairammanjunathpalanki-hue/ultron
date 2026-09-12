# Ultron Remote Cloud Backend Deployment Guide

This guide describes how to deploy the Ultron backend to a publicly reachable HTTPS service so the Android APK (`ULTRON.apk`) can communicate with it over 5G/LTE without requiring a local PC or Wi-Fi.

---

## Option 1: Render (Recommended — Free Tier & Automatic HTTPS)

1. **Push your repository** to GitHub or GitLab.
2. Sign in to [Render](https://render.com).
3. Click **New +** → **Web Service**.
4. Select your `ultron` repository.
5. Render detects the `Dockerfile` automatically (or `render.yaml`):
   - **Environment**: Docker
   - **Branch**: main
   - **Plan**: Free
6. Under **Environment Variables**, add:
   - `OPENAI_API_KEY`: Your OpenAI API key (`sk-proj-...`)
   - `MODEL`: `gpt-6-astra` (or `gpt-4o`)
   - `PORT`: `3001`
7. Click **Create Web Service**.
8. Once deployed, Render provides your public URL:
   `https://ultron-command-center.onrender.com`
9. In your **ULTRON Android App**:
   - Open **Settings** (gear icon).
   - In **REMOTE BACKEND URL (HTTPS)**, enter your Render URL.
   - Tap **SAVE CONFIGURATION**.

---

## Option 2: Railway (Fastest 1-Click Deployment)

1. Go to [Railway.app](https://railway.app).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository. Railway detects `railway.json` and `Dockerfile`.
4. Go to **Variables** and add:
   - `OPENAI_API_KEY`: `sk-proj-...`
   - `MODEL`: `gpt-6-astra`
   - `PORT`: `3001`
5. Click **Settings** → **Generate Domain** under Networking.
6. Copy the domain: e.g. `https://ultron-backend-production.up.railway.app`.
7. Paste into the Ultron Android app settings.

---

## Option 3: Fly.io CLI

```bash
fly launch
fly secrets set OPENAI_API_KEY=sk-proj-... MODEL=gpt-6-astra
fly deploy
```

---

## Security Architecture

- **Zero Secrets in APK**: The APK contains **no** OpenAI keys or private credentials.
- **Backend Owns AI Credentials**: All AI completions, speech synthesis, and tool dispatches run on the backend.
- **On-Device Vision**: Camera frames and hand/face tracking run locally on the phone using MediaPipe; only user-triggered high-level actions are sent over HTTPS.
