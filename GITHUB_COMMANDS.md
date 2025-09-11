# 🚀 GitHub Repository Setup Commands

## Step 1: Create GitHub Repository

1. **Go to GitHub:** [https://github.com/new](https://github.com/new)
2. **Fill in repository details:**
   - **Repository name:** `manyanza-website`
   - **Description:** `Professional website for Manyanza Company Limited - Tanzania's trusted vehicle transit marketplace with advanced pricing calculator`
   - **Visibility:** Choose Public (recommended) or Private
   - **Important:** Do NOT check "Add a README file" (we already have one)
   - **Important:** Do NOT check "Add .gitignore" (we already have one)
   - **Important:** Do NOT choose a license (we have proprietary content)

3. **Click "Create repository"**

## Step 2: Copy Your GitHub Username

After creating the repository, note your GitHub username from the repository URL:
`https://github.com/YOUR_USERNAME/manyanza-website`

## Step 3: Run These Commands

Replace `YOUR_USERNAME` with your actual GitHub username and run these commands in your terminal:

```bash
# Navigate to the project directory
cd "/Users/baamrecs/Driver website"

# Add GitHub repository as remote origin
git remote add origin https://github.com/YOUR_USERNAME/manyanza-website.git

# Verify the remote connection
git remote -v

# Set main branch and push to GitHub
git branch -M main
git push -u origin main
```

## Step 4: Verify Upload

1. Refresh your GitHub repository page
2. You should see all these files:
   - ✅ `index.html` - Home page
   - ✅ `about.html` - About page
   - ✅ `services.html` - Services page
   - ✅ `pricing-calculator.html` - Pricing calculator
   - ✅ `become-driver.html` - Driver application
   - ✅ `contact.html` - Contact page
   - ✅ `css/styles.css` - Styling
   - ✅ `js/script.js` - Main functionality
   - ✅ `js/pricing-calculator.js` - Pricing engine
   - ✅ `README.md` - Project documentation
   - ✅ `CHANGELOG.md` - Version history
   - ✅ `config.env` - Configuration
   - ✅ `.gitignore` - Git exclusions

## Step 5: Enable GitHub Pages (Optional)

To host your website directly from GitHub:

1. **Go to your repository on GitHub**
2. **Click "Settings" tab**
3. **Scroll down to "Pages" section**
4. **Under "Source":**
   - Select "Deploy from a branch"
   - Choose "main" branch
   - Choose "/ (root)" folder
5. **Click "Save"**

Your website will be available at:
`https://YOUR_USERNAME.github.io/manyanza-website`

## 🔧 Troubleshooting

### If you get authentication errors:
```bash
# You may need to use a Personal Access Token instead of password
# Generate one at: GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
```

### If you get permission denied:
```bash
# Make sure the repository URL is correct
git remote set-url origin https://github.com/YOUR_USERNAME/manyanza-website.git
```

### If you initialized the repository with README:
```bash
# Pull the remote changes first
git pull origin main --allow-unrelated-histories
```

## ✅ Success Indicators

You'll know everything worked when:
- ✅ No error messages during push
- ✅ All files visible on GitHub
- ✅ README displays properly on repository page
- ✅ GitHub Pages URL works (if enabled)

## 📞 Next Steps After GitHub Setup

1. **Update contact information** in the HTML files
2. **Set up WhatsApp Business** account
3. **Configure real phone numbers** in JavaScript files
4. **Test all functionality** on the live site
5. **Share the GitHub Pages URL** for testing

---

**Repository URL Format:**
`https://github.com/YOUR_USERNAME/manyanza-website`

**GitHub Pages URL Format:**
`https://YOUR_USERNAME.github.io/manyanza-website`