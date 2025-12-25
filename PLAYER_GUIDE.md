# IsoCity Player Guide

## Overview
This document serves as the definitive manual for IsoCity's simulation dynamics. It details building attributes, zoning behaviors, and economic systems to help players and developers understand the "why" and "how" of the game's simulation.

## Table of Contents
1. [Building Catalog](#building-catalog)
2. [Zoning & Growth Mechanics](#zoning--growth-mechanics)
3. [System Mechanics](#system-mechanics)
4. [Economy](#economy)

---

## Building Catalog

### Service Buildings
Service buildings provide essential coverage to your city. They function based on a **radius** system.

| Building | Cost | Size | Range (Tiles) | Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Police Station** | $500 | 1x1 | 13 | Reduces crime and increases safety. |
| **Fire Station** | $500 | 1x1 | 18 | Extinguishes fires and prevents them from starting. |
| **School** | $400 | 2x2 | 11 | Provides basic education coverage. |
| **University** | $2,000 | 3x3 | 19 | Provides advanced education coverage. |
| **Hospital** | $1,000 | 2x2 | 12 | Improves public health. |

### Infrastructure & Utilities
Utilities in IsoCity are broadcast wirelessly within a specific radius. You do not need to lay power lines or pipes.

| Building | Cost | Size | Range (Tiles) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Power Plant** | $3,000 | 2x2 | 15 | Generates electricity. Essential for most buildings to function. |
| **Water Tower** | $1,000 | 1x1 | 12 | Provides water. Essential for building growth. |
| **Road** | $25 | 1x1 | - | Connects zones. Zones must be within **8 tiles** of a road (connected by other zone tiles) to develop. |
| **Rail** | $40 | 1x1 | - | Increases Commercial and Industrial demand. |
| **Rail Station** | $1,000 | 2x2 | - | Required to access the rail network. |
| **Subway** | $50 | 1x1 | - | Underground transit. Boosts commercial job density. |
| **Subway Station** | $750 | 1x1 | - | Provides access to the subway network. |


## Zoning & Growth Mechanics

IsoCity uses a dynamic zoning system where buildings develop organically based on demand, services, and infrastructure.

### Zone Types
| Zone | Primary Purpose | Key Requirements |
| :--- | :--- | :--- |
| **Residential** | Provides housing for citizens. | Road access, Power, Water, Low Pollution. |
| **Commercial** | Provides jobs and shopping. | Road access, Power, Water, Customers (Pop), Employees (Pop). |
| **Industrial** | Provides heavy-duty jobs. | Road access, Power, Water, Rail/Airport connectivity. |

### Development Requirements
For a zoned tile to develop into a building, it must meet these criteria:
1.  **Road Access:** The tile must be within **8 tiles** of a road. Note: Adjacent zones of the same type can "pass through" road access to their neighbors.
2.  **Utilities:** Most buildings require both **Power** and **Water** to begin construction.
    -   *Exception:* **Starter Buildings** (Small Houses, Small Shops, and Small Factories/Farms) can develop without utilities, representing self-sufficient operations.

### Building Evolution (Leveling Up)
Buildings will gradually evolve into higher-density versions (up to **Level 5**) if conditions are favorable.
-   **Land Value:** High land value is the primary driver for high-density development.
-   **Service Coverage:** Proximity to Police, Fire, Health, and Education services boosts evolution.
-   **Building Age:** Older, stable buildings are more likely to densify.
-   **Demand:** High regional demand for a zone type encourages buildings to "level up" faster.

### Abandonment & Recovery
-   **Abandonment:** Buildings may become abandoned if demand for their zone type drops significantly (oversupply) or if they lack essential services for too long.
-   **Recovery:** Abandoned buildings will not produce population or jobs. They can recover or be replaced by new development once demand returns to positive levels.


## System Mechanics
*Coming soon...*

## Economy
*Coming soon...*
