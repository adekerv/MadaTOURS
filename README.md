# 📍 MADA-TOURS

Welcome to **MADA-TOURS**, an interactive location-based web application built specifically for the island of Martinique. This project was developed from scratch during an intensive **4-day Hackathon**. 

MADA-TOURS helps users easily explore nearby restaurants and outdoor activities within a **5km to 10km radius** of their location. The core philosophy behind the app is simplicity: providing a highly tactile, user-friendly mapping experience without relying on heavily restricted, expensive external GPS mapping APIs.

---

##  Core Features

- **Tactile & Responsive UI:** Modern, mobile-first screens tailored for seamless on-the-go navigation.
- **Dynamic Homepage:** A welcoming landing page introducing the application's concept and functionality.
- **Smart Geolocation Fetching:** - Automatically requests browser permissions to pinpoint the user's exact coordinates.
  - Features a clean manual address/location input fallback if permissions are denied.
- **Interactive Martinique Map:** A clean map displaying a custom marker for the user's location surrounded by available destinations.
- **Dual-Tab Filtering System:** Effortless toggling between a **Restaurants Tab** and an **Activities Tab**.
- **Instant Navigation Link:** Clicking "More Info" on any list item opens the location's official Google Maps page instantly for routing.
- **Direct Database Synchronization:** Smooth backend connection to a custom local MySQL database holding structured latitude and longitude coordinates.

---

##  Tech Stack & Requirements

- **Frontend:** React, TypeScript, Tailwind CSS
- **Mapping:** Leaflet / React-Leaflet (API key-free, lightweight map engine)
- **Backend:** Node.js, Express, `tsx` (TypeScript Execute)
- **Database:** MySQL (Relational structure managed via local SQL files)

---

##  The 4-Day Hackathon Roadmap

Building an application with a synchronized database layer and coordinate-filtering geometry in 4 days was an intense sprint. We ran into a few technical difficulties here and there—especially iron out environment mismatches and architecture bugs—but we pushed through it and delivered a fully functional application!

* **Day 1: Ideation, Wireframing & DB Setup**
    * Designed the responsive component UI structure.
    * Imported the initial SQL database tables and mapped out structural location coordinates.
* **Day 2: Core Map Integration & State Management**
    * Integrated the open-source map view centered on Martinique.
    * Configured browser Geolocation permissions and designed the fallback input forms.
* **Day 3: Backend Routes & Radius Math**
    * Connected the Node.js API layer to pull straight from the MySQL tables.
    * Implemented calculations to filter destinations within a strict 5–10km bubble from the user's marker.
* **Day 4: Fine-Tuning & Deployment Sprint**
    * Squashed TypeScript typing conflicts and cleaned up Tailwind utility classes.
    * Configured the environment variables and finalized production-ready builds.

---

##  Database Quick-Start

To hook up your local environment to the MADA-TOURS database:
1. Open your local MySQL instance (such as phpMyAdmin or CLI).
2. Create a clean database schema.
3. Import the custom configuration `.sql` file included in this repository.

---

## Installation & Local Launch

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/MADA-TOURS.git](https://github.com/your-username/MADA-TOURS.git)
cd MADA-TOURS