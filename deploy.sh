#!/bin/bash

# Manyanza Website Deployment Configuration Script
# This script configures and deploys the website to GitHub

echo "🚗 Configuring Manyanza Company Limited Website for GitHub Deployment"
echo "=================================================================="

# Check if Git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Initializing..."
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository found"
fi

# Check if files are staged
if git diff-index --quiet HEAD --; then
    echo "📁 Staging all files..."
    git add .
    echo "✅ All files staged"
else
    echo "✅ Files already staged"
fi

# Create initial commit if needed
if ! git log --oneline -1 >/dev/null 2>&1; then
    echo "📝 Creating initial commit..."
    git commit -m "Initial commit: Manyanza Company Limited website v1.0.0

🎉 Complete Phase 1 MVP with advanced pricing calculator
✅ 6-page professional website
✅ Per-kilometer pricing engine (TSh 1,500/km)
✅ WhatsApp-first communication strategy
✅ Mobile-responsive design for Tanzanian market
✅ Professional, trustworthy, and approachable tone
✅ Transparent pricing with detailed cost breakdowns
✅ Driver application system with document uploads
✅ Real-time quote calculations and WhatsApp sharing

Technical Features:
- Lightweight static site (HTML/CSS/JS)
- Python built-in server for development
- Corridor-specific return allowances
- Platform commission tiers (15%/18%/20%)
- Professional UI/UX with clear CTAs
- SEO optimized and performance focused"
    echo "✅ Initial commit created"
else
    echo "✅ Repository already has commits"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Create GitHub repository at: https://github.com/new"
echo "2. Repository name: manyanza-website"
echo "3. Description: Professional website for Manyanza Company Limited - Tanzania's trusted vehicle transit marketplace"
echo "4. Choose Public or Private"
echo "5. Do NOT initialize with README (we already have comprehensive docs)"
echo ""
echo "📡 Then run these commands:"
echo "git remote add origin https://github.com/YOUR_USERNAME/manyanza-website.git"
echo "git branch -M main"
echo "git push -u origin main"
echo ""
echo "🌐 For GitHub Pages hosting:"
echo "Go to repository Settings > Pages > Deploy from branch > main > Save"
echo ""
echo "✅ Configuration complete! Your website is ready for GitHub deployment."