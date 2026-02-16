# Electrical Simulation Dashboard

A real-time smart grid visualization and simulation platform for India's high-voltage transmission network. This project visualizes electrical infrastructure data, mapping grid topology, and provides interactive tools for fault simulation, sensor placement, and grid energization analysis.

## Features

- **Real-time Visualization**: Interactive Leaflet map displaying towers, lines, substations, and cables.
- **Grid Simulation**: Energize/De-energize grid segments and simulate electrical flow.
- **Fault Analysis**: Inject faults into transmission lines and visualize the impact.
- **Sensor Intelligence**: Automated sensor placement using the `sqrt(n)` algorithm for optimal coverage.
- **Premium UI**: Dark/Light mode capable interface with a modern, high-contrast design.

### Project Structure

```
Electric_simulation/
|-- dashboard/               # React + Vite + Leaflet frontend
|   |-- src/
|   |   |-- pages/           # Application pages (Landing, Dashboard)
|   |   |-- components/      # Reusable UI components
|   |   |-- simulation/      # Simulation logic (grid, sensors)
|   |-- public/              # Static assets and grid data
|   |-- vite.config.js       # Vite configuration
|-- core/                    # Python modules for data processing
|   |-- geojson_loader.py    # Loader for grid GeoJSON data
|   |-- grid_builder.py      # Logic for building grid topology
|-- export_grid_data.py      # Script to export grid data
|-- requirements.txt         # Python dependencies
|-- apparent_logo.jpeg       # Project logo
|-- README.md                # Project documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm (Node Package Manager)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/HEMANT2027/Electric_grid_simulation.git
    cd Electric_grid_simulation
    ```

2.  **Navigate to the dashboard directory:**
    ```bash
    cd dashboard
    ```

3.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```

2.  **Open in Browser:**
    The application will be available at `http://localhost:5173/`.

## Usage

1.  **Landing Page**: The entry point provides an overview of the platform's capabilities. Click **Dashboard** to enter the simulation view.
2.  **Dashboard**:
    -   **Map View**: Browse the grid topology.
    -   **Control Panel**: Use the right-hand panel to toggle layers, energize the grid, or inject faults.
    -   **Simulation**: Monitor voltage levels and sensor status.

## License

This project is part of the Apparent Energy research initiative.

