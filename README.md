# UGS Map Viewer

<p align="center">
  <img src="public/logo_main.png" alt="Utah Geological Survey Logo" width="200"/>
</p>

A modern, modular geospatial mapping platform for exploring Utah's geological, hydrological, and environmental data. Built by the [Utah Geological Survey](https://geology.utah.gov).

## Overview

UGS Map Viewer provides interactive tools for visualizing and analyzing geoscience data across multiple domains:

- **Geological Hazards** - Earthquakes, landslides, flooding, and seismic risk
- **Minerals & Energy** - Mining operations, energy resources, and geological formations
- **Water Resources** - Wetlands, water quality, and hydrological data
- **Geophysics** - Gravity, magnetic, and subsurface mapping
- **Carbon Storage** - CO₂ sequestration and geothermal resources
- **Botanical** - Wetland plants and vegetation mapping

Each application shares a common mapping infrastructure with independent layer configurations and domain-specific features.

## Key Features

- 🗺️ **Interactive Mapping** - Pan, zoom, and explore geological data with multiple basemaps
- 📊 **Layer Management** - Toggle and configure layers with advanced filtering
- 🎨 **Light/Dark Mode** - Responsive UI with theme support
- ♿ **Accessibility** - WCAG 2.1 compliant for inclusive access
- 📱 **Responsive Design** - Works seamlessly on desktop, tablet, and mobile
- 🔗 **Shareable States** - Deep linking support for saved map views
- 🔍 **Feature Queries** - Click features to view detailed attributes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI Framework** | [React 18](https://react.dev) |
| **UI Components** | [Shadcn/ui](https://ui.shadcn.com) (TailwindCSS + Radix UI) |
| **Mapping** | [ArcGIS JS SDK](https://developers.arcgis.com/javascript/latest/) |
| **Routing** | [TanStack Router](https://tanstack.com/router) |
| **Data Fetching** | [TanStack Query](https://tanstack.com/query) |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Type Safety** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [TailwindCSS](https://tailwindcss.com) |
| **Code Quality** | [ESLint](https://eslint.org) & [Prettier](https://prettier.io) |
| **Icons** | [Lucide React](https://lucide.dev) |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/ugs-gio/ugs-map-viewer.git
cd ugs-map-viewer

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

Visit `http://localhost:5173` to see your changes live.

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

### Linting

```bash
# Type check with TypeScript
npm run build

# Lint code
npm run lint

# Format code
npm run format
npm run format:check

# Run tests
npm test
```

## Contributing

We welcome contributions! Please:

1. Create a feature branch (`git checkout -b feature/your-feature`)
2. Make your changes
3. Run tests and linting: `npm run lint && npm test`
4. Commit with clear messages
5. Push and open a Pull Request

## Support

For issues, questions, or suggestions:
- [Open an issue](https://github.com/ugs-gio/ugs-map-viewer/issues)
- [Contact UGS](https://geology.utah.gov/contact/)

## License

Licensed under the [MIT License](LICENSE)

## About

Maintained with ❤️ by the [Utah Geological Survey](https://geology.utah.gov)

A modern geospatial platform for data visualization, analysis, and exploration.
