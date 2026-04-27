# Contributing to GemiDesk 🚀

Thank you for your interest in contributing to **GemiDesk**. Community contributions are essential for improving the project and providing a better experience for all users.

## 🌈 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful and helpful to others.

## 🛠️ Setting Up Your Development Environment

GemiDesk uses **Nix** to ensure a consistent development environment across all machines. 

### 1. Requirements
- **Nix** with Flakes enabled (Required).
- **Git**.

### 2. Getting Started
```bash
# 1. Clone the repo
git clone https://github.com/TimH-DE/GemiDesk.git
cd GemiDesk

# 2. Enter the development shell
# This will automatically install Node.js, Electron, and all build tools.
nix develop

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

## 📜 Contribution Workflow

1. **Find an Issue:** Look for open issues or open a new one to discuss your ideas.
2. **Fork & Branch:** Fork the repository and create a branch for your feature or fix: `git checkout -b feature/cool-new-stuff`.
3. **Commit:** Write clean, descriptive commit messages.
4. **Test:** Ensure your changes don't break existing functionality. Run `nix build` to verify the package still builds correctly.
5. **Push & PR:** Push to your fork and submit a Pull Request.

## 🎨 Style Guide

- **TypeScript:** Use strict types where possible.
- **Tailwind:** Follow the existing design system in `App.tsx`.
- **Comments:** Keep comments minimal, professional, and in English.

## 🏗️ Project Structure

- `src/main`: Electron main process (Window management, IPC).
- `src/preload`: DOM injections and scraping logic for Gemini.
- `src/renderer`: React-based UI shell.
- `assets/`: Icons and static branding.

## 💎 Nix Tips

If you update the `package.json` dependencies, you'll need to update the `npmDepsHash` in `flake.nix`:
1. Change `npmDepsHash` to an empty string `""`.
2. Run `nix build`.
3. Copy the "got" hash from the error message back into `flake.nix`.

---

**Questions?** Please open a GitHub Issue for discussion. We look forward to your contributions.
