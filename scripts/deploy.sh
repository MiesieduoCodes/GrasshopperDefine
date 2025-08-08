#!/bin/bash

echo "🚀 Deploying Grasshopper Viewer Production Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "⚠️  .env.production not found. Creating from template..."
    cat > .env.production << EOF
# Production Environment Variables
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Rhino.Compute Configuration
RHINO_COMPUTE_URL=https://compute.rhino3d.com
RHINO_COMPUTE_API_KEY=your_api_key_here

# Optional: Sentry for error tracking
SENTRY_DSN=your_sentry_dsn_here
MONITORING_TOKEN=your_monitoring_token_here
EOF
    echo "📝 Please edit .env.production with your actual values before continuing."
    echo "Press Enter when ready..."
    read
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the application
echo "🏗️  Building application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# Start the application
echo "🚀 Starting application..."
npm start &

# Wait for application to start
echo "⏳ Waiting for application to start..."
sleep 10

# Check application health
echo "🔍 Checking application health..."

# Check if the application is responding
if curl -f http://localhost:3000/api/health &> /dev/null; then
    echo "✅ Application is healthy"
else
    echo "❌ Application is not responding"
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Application running:"
echo "  - Main App: http://localhost:3000"
echo "  - Health Check: http://localhost:3000/api/health"
echo ""
echo "Next steps:"
echo "1. Visit http://localhost:3000"
echo "2. Upload a .gh file to test"
echo ""
echo "To view logs: tail -f logs/app.log"
echo "To stop application: pkill -f 'npm start'"
