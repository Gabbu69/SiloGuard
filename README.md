# SiloGuard - Smart Rice Storage Monitoring System

A real-time IoT dashboard for monitoring rice storage conditions built with **React**, **TypeScript**, **Tailwind CSS v4**, and **Supabase**.

![Dashboard](https://img.shields.io/badge/Status-Production_Ready-22c55e?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=flat-square&logo=supabase)

## Features

- **Live Sensor Cards** - Temperature, Humidity, Air Quality (MQ-135), Moisture with animated pulse indicators and SAFE/WARNING/DANGER status badges
- **Mold Risk Index Gauge** - SVG radial arc gauge (0-100) with computed MRI formula and risk classification (Low/Moderate/High/Critical)
- **Real-time Line Chart** - Recharts-powered graph showing last 20 sensor readings with smooth animations
- **Alerts Panel** - Last 10 triggered alerts with timestamps, types, and sensor details
- **Actuator Control** - Fan and Buzzer toggle switches with real-time override capability
- **Historical Data Table** - Timestamped logs with MRI scores and aggregated status
- **Dark Glassmorphism UI** - Premium dark theme with green (#22c55e) accents and amber/red warning states
- **Demo Mode** - Runs with simulated data when Supabase credentials are not configured

## Supabase Schema

### sensor_readings table

| Column | Type | Description |
|--------|------|-------------|
| id | int8 (PK) | Auto-increment |
| created_at | timestamptz | Reading timestamp |
| temperature | float8 | Temperature in Celsius |
| humidity | float8 | Relative humidity % |
| gas_ppm | float8 | MQ-135 gas reading (ppm) |
| moisture | float8 | Moisture level % |
| fan_on | boolean | Fan actuator state |
| buzzer_on | boolean | Buzzer actuator state |

### alerts table

| Column | Type | Description |
|--------|------|-------------|
| id | int8 (PK) | Auto-increment |
| created_at | timestamptz | Alert timestamp |
| type | text | Fan Activated / Buzzer Triggered / Threshold Exceeded |
| sensor | text | Sensor that triggered the alert |
| value | float8 | Sensor value at trigger |
| mri_score | float8 | MRI score at trigger |

## Thresholds

| Sensor | Warning | Danger |
|--------|---------|--------|
| Temperature | > 32C | > 38C |
| Humidity | > 70% | > 85% |
| Gas PPM | > 200 | > 400 |
| Moisture | > 60% | > 80% |

## MRI Formula

```
MRI = (humidity_score x 0.4) + (temp_score x 0.3) + (gas_score x 0.2) + (moisture_score x 0.1)
```

Each score is normalized 0-100.

## Setup

```bash
# Install dependencies
npm install

# Configure Supabase (optional - runs in demo mode without)
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Start development server
npm run dev
```

## Tech Stack

- **Vite** - Build tooling
- **React 19** + **TypeScript**
- **Tailwind CSS v4** - Utility-first CSS
- **Supabase** - Real-time PostgreSQL
- **Recharts** - Data visualization
- **Lucide React** - Icons

## University of Southern Mindanao - IoT Research Project
