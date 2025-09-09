# GitHub Setup Guide for Manyanza Website

## 📋 Prerequisites

1. **GitHub Account**: Ensure you have a GitHub account
2. **Git Installed**: Verify Git is installed on your system
3. **Terminal Access**: Command line access to the project directory

## 🚀 Step-by-Step GitHub Setup

### Step 1: Stop the Development Server
If the Python development server is running, stop it first:
```bash
# Press Ctrl+C in the terminal running the server
```

### Step 2: Initialize Git Repository
```bash
cd "/Users/baamrecs/Driver website"
git init
```

### Step 3: Configure Git (if not already done)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 4: Add All Files to Git
```bash
git add .
```

### Step 5: Create Initial Commit
```bash
git commit -m "Initial commit: Manyanza Company Limited website with pricing calculator

- Complete website with 6 pages (Home, About, Services, Pricing, Become Driver, Contact)
- Advanced pricing calculator with per-kilometer model
- WhatsApp integration for quotes and support
- Mobile-responsive design
- Professional UI/UX with Tanzanian market focus
- Form validation and interactive features
- SEO optimized and performance focused

Features:
✅ Transparent pricing engine (TSh 1,500/km)
✅ Corridor-specific return allowances
✅ Real-time quote calculations
✅ WhatsApp quote sharing
✅ Driver application system
✅ Contact forms with validation
✅ Mobile-first responsive design"
```

### Step 6: Create GitHub Repository

1. **Go to GitHub.com** and sign in
2. **Click the "+" icon** in the top right corner
3. **Select "New repository"**
4. **Repository Settings:**
   - **Repository name:** `manyanza-website` (or your preferred name)
   - **Description:** `Professional website for Manyanza Company Limited - Tanzania's trusted vehicle transit marketplace`
   - **Visibility:** Choose Public or Private
   - **Do NOT initialize** with README, .gitignore, or license (we already have these)
5. **Click "Create repository"**

### Step 7: Connect Local Repository to GitHub
```bash
# Replace 'yourusername' and 'repository-name' with your actual values
git remote add origin https://github.com/yourusername/manyanza-website.git

# Verify the remote
git remote -v
```

### Step 8: Push to GitHub
```bash
# Push the main branch
git branch -M main
git push -u origin main
```

### Step 9: Verify Upload
1. **Refresh your GitHub repository page**
2. **Verify all files are present:**
   - `index.html`
   - `about.html`
   - `services.html`
   - `pricing-calculator.html`
   - `become-driver.html`
   - `contact.html`
   - `css/styles.css`
   - `js/script.js`
   - `js/pricing-calculator.js`
   - `README.md`
   - `.gitignore`

## 🌐 Enable GitHub Pages (Optional)

To host your website directly from GitHub:

1. **Go to repository Settings**
2. **Scroll down to "Pages" section**
3. **Under "Source", select "Deploy from a branch"**
4. **Choose "main" branch and "/ (root)"**
5. **Click "Save"**
6. **Your website will be available at:** `https://yourusername.github.io/manyanza-website`

## 🔄 Future Updates Workflow

When making changes to the website:

```bash
# Make your changes to files
# Then commit and push:

git add .
git commit -m "Describe your changes here"
git push origin main
```

## 🛡️ Security Notes

- **Never commit sensitive data** (API keys, passwords, etc.)
- **Use environment variables** for configuration
- **Review .gitignore** to ensure proper file exclusion
- **Consider private repository** for proprietary code

## 📞 Troubleshooting

### Common Issues:

1. **Authentication Error:**
   ```bash
   # Use GitHub Personal Access Token instead of password
   # Generate token at: GitHub Settings > Developer settings > Personal access tokens
   ```

2. **Permission Denied:**
   ```bash
   # Check repository URL and permissions
   git remote set-url origin https://github.com/yourusername/manyanza-website.git
   ```

3. **Merge Conflicts:**
   ```bash
   # If you initialized with README on GitHub
   git pull origin main --allow-unrelated-histories
   ```

## ✅ Verification Checklist

- [ ] Git repository initialized
- [ ] All files committed
- [ ] GitHub repository created
- [ ] Local repository connected to GitHub
- [ ] Files successfully pushed
- [ ] README displays correctly on GitHub
- [ ] GitHub Pages enabled (if desired)
- [ ] Website accessible via GitHub Pages URL

## 🎯 Next Steps

1. **Update contact information** in all HTML files
2. **Set up WhatsApp Business** account
3. **Configure real phone numbers** in JavaScript files
4. **Set up domain** (if using custom domain)
5. **Configure email** for form submissions
6. **Set up analytics** tracking
7. **Plan Phase 2** development features

---

**Repository URL Format:**
`https://github.com/yourusername/manyanza-website`

**GitHub Pages URL Format:**
`https://yourusername.github.io/manyanza-website`