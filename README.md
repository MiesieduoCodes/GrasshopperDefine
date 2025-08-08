# Grasshopper Definition Viewer

A production-ready web application to upload and visualize Grasshopper (.gh) files in 3D with real-time parameter controls.

## Features

- **Upload .gh files** - Drag & drop or click to upload
- **3D Visualization** - View your Grasshopper definitions in 3D
- **Real-time Parameter Controls** - Adjust parameters and see changes instantly
- **Real Rhino.Compute Integration** - Uses actual Rhino.Compute server for geometry processing
- **No Database Required** - Everything runs in memory
- **Production Ready** - Simple deployment with real compute services

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   # Create .env.local for development
   RHINO_COMPUTE_URL=https://compute.rhino3d.com
   RHINO_COMPUTE_API_KEY=your_api_key_here
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Visit `http://localhost:3000`

5. **Upload a .gh file:**
   - Drag & drop your Grasshopper file onto the upload area
   - Or click to browse and select a file

6. **Interact with your model:**
   - Use the parameter controls to adjust values
   - See real-time updates in the 3D viewer
   - Reset parameters to default values

## How It Works

- **File Upload** → Parses .gh file and extracts real parameters
- **3D Rendering** → Uses Three.js for visualization
- **Parameter Controls** → Real-time updates via API calls
- **Rhino.Compute** → Real geometry computation from actual .gh files
- **In-Memory Storage** → No database, resets on server restart

## API Endpoints

- `POST /api/upload` - Upload .gh files
- `POST /api/compute` - Compute geometry with new parameters
- `GET /api/health` - Health check
- `GET /api/metrics` - System metrics (requires auth)

## Production Deployment

1. **Set up environment variables:**
   ```bash
   # .env.production
   NODE_ENV=production
   RHINO_COMPUTE_URL=https://compute.rhino3d.com
   RHINO_COMPUTE_API_KEY=your_api_key_here
   ```

2. **Deploy using the script:**
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

3. **Or deploy manually:**
   ```bash
   npm install
   npm run build
   npm start
   ```

## Technology Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **3D Rendering:** Three.js, React Three Fiber
- **UI Components:** Radix UI, Tailwind CSS
- **Backend:** Next.js API routes
- **Compute:** Rhino.Compute API
- **Storage:** In-memory (no database)

## Requirements

- **Rhino.Compute Server** - Must be running and accessible
- **Node.js 18+** - For running the application
- **Valid .gh files** - Grasshopper definition files

## Development

This application requires a real Rhino.Compute server for geometry processing. No mock data or fallback geometry is used - all computation is real.

For production use, ensure:
- Rhino.Compute server is properly configured
- Environment variables are set correctly
- Valid API keys are provided "# GrasshopperDefine" 
