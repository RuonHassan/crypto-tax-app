#!/bin/bash
echo "Starting Vercel build process..."
echo "Using Node version: $(node -v)"
echo "Using NPM version: $(npm -v)"

# Clean install dependencies with legacy peer deps
echo "Installing dependencies..."
npm cache clean --force
rm -rf node_modules
npm install --no-package-lock --legacy-peer-deps

# Fix potential ajv resolution issues
echo "Ensuring correct ajv versions..."
npm install ajv@8.12.0 ajv-keywords@5.1.0 --legacy-peer-deps --no-package-lock

# Run the build
echo "Running build..."
npm run build

echo "Build completed!" 