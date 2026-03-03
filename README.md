# 🎨 KGen Studio — AI Image Generation Hub

<p align="center">
  <img src="web-ui/favicon.svg" width="80" alt="KGen Studio Logo">
</p>

<p align="center">
  <strong>Khám phá 1,300+ AI Prompts · Tạo ảnh AI · Nâng cấp Prompt · Quản lý Workflow</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#authentication">Authentication</a> •
  <a href="#deployment">Deployment</a>
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🖼️ **Prompt Gallery** | Browse 1,300+ curated AI prompts with real-world examples |
| 🔐 **Auth System** | Email/Password + Google Sign-In authentication |
| 🎭 **Prompt Preview** | Guest users see 10% of prompts, login to unlock full content |
| 🎨 **Image Generation** | Generate images via KGen Cloud, OpenAI, or ComfyUI |
| ✍️ **Prompt Enhancer** | AI-powered prompt enhancement with multiple styles |
| ⚙️ **Workflow Manager** | Import and manage ComfyUI workflows |
| 🌙 **Premium Dark UI** | Glassmorphism design with smooth animations |
| 📱 **Responsive** | Works on desktop, tablet, and mobile |

## 🖥️ Demo

### Gallery (Guest Mode)

- Browse prompts with 10% preview
- Guest banner indicating limited access
- Lock badges on cards

### Gallery (Logged In)

- Full prompt access
- Copy & use prompts directly
- User profile in sidebar

### Authentication Modal

- Email/Password login & registration
- Google Sign-In integration
- Seamless switching between login/register

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for the dev server)
- A modern browser (Chrome, Firefox, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/KGen-Studio.git
cd KGen-Studio

# Install dependencies
npm install

# Start development server
npm start
```

The app will be available at `http://localhost:3456/web-ui/`

### Without Node.js

You can also open `web-ui/index.html` directly in a browser, but some features (CORS, Google Sign-In) require a local server.

## 🔐 Authentication

### Email/Password

- Register with name, email, and password
- Data stored in browser's localStorage
- Session persists across page reloads

### Google Sign-In

To enable Google Sign-In:

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project
3. Configure OAuth Consent Screen (External)
4. Create OAuth 2.0 Client ID (Web application)
5. Add your domain to **Authorized JavaScript origins**:
   - `http://localhost:3456` (for development)
   - `https://your-app.vercel.app` (for production)
6. In the app, go to **Settings → Google Sign-In** and paste your Client ID
7. Save and you're ready!

### Access Control

| State | Prompt Visibility | Actions |
|-------|-------------------|---------|
| 🔒 Guest | 10% of prompt text | Browse only |
| 🔓 Logged In | Full prompt text | Copy, Use, Browse all |

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript
- **Authentication**: localStorage + Google Identity Services
- **Design**: Custom CSS with CSS variables, glassmorphism, gradients
- **Fonts**: Inter, JetBrains Mono (Google Fonts)
- **APIs**: KGen Cloud, OpenAI, ComfyUI (optional)

## 📁 Project Structure

```
KGen-Studio/
├── web-ui/
│   ├── index.html          # Main HTML structure
│   ├── styles.css           # Complete design system
│   ├── app.js              # Application logic + auth
│   └── favicon.svg         # App icon
├── server.js               # Simple Node.js dev server
├── package.json            # Project metadata
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🚢 Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel
```

### Netlify

Simply drag the `web-ui/` folder to [Netlify Drop](https://app.netlify.com/drop)

### GitHub Pages

1. Go to Settings → Pages
2. Set source to `main` branch, `/web-ui` folder
3. Save and wait for deployment

## 📄 License

This project is proprietary. All rights reserved.

## 🤝 Contributing

This is a commercial product. Please contact the owner for collaboration inquiries.

---

<p align="center">
  Built with ❤️ by KGen Studio Team
</p>
