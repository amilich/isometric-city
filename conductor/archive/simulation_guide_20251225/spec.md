# Spec: Simulation Dynamics Player Guide

## Overview
To improve the understanding of IsoCity's simulation complexity, we will create a comprehensive `PLAYER_GUIDE.md`. This document will serve as the definitive "manual" for the current simulation state, detailing building attributes, zoning behaviors, and economic systems. It is intended to be a static source of truth for players and developers to understand the "why" and "how" of the game's simulation, distinct from the technical implementation details.

## Functional Requirements

### 1. Guide Location & Format
- **File:** Create a new file `PLAYER_GUIDE.md` in the project root.
- **Format:** Standard Markdown with clear hierarchy (headings, tables for stats, bullet points for rules).

### 2. Content Sections
The guide must be manually authored based on a deep analysis of the current codebase (`src/game/constants.ts`, `simulation.ts`, etc.) and cover the following:

#### A. Building Catalog
- **Service Buildings:** For each type (Police, Fire, Hospital, School, etc.):
    - Cost & Dimensions.
    - Resource Consumption (Power/Water).
    - Effect Radius and Magnitude (e.g., "Increases land value by X within Y tiles").
- **Infrastructure:** Roads, Power Lines, Pipes (costs, connectivity rules).

#### B. Zoning & Growth Mechanics
- **Zone Types:** Residential, Commercial, Industrial.
- **Growth Logic:**
    - What allows a zone to develop (e.g., "Needs road access + power").
    - **Leveling Up:** specific requirements for density increases (e.g., "Requires nearby park + water").
    - **Abandonment:** Conditions that cause buildings to decay (e.g., "High pollution," "No power").

#### C. System Mechanics (Gameplay Focus)
- **Traffic:** How congestion is calculated and its effect on the city (e.g., "Does traffic reduce land value?").
- **Land Value:** Factors that increase or decrease land desirability.
- **Crime & Safety:** How crime generates and how police coverage mitigates it.

#### D. Economy
- **Income:** Sources of revenue (Taxes, specific building outputs).
- **Expenses:** Maintenance costs for services and infrastructure.

## Non-Functional Requirements
- **Readability:** Content should be written for a player audience, avoiding technical jargon (e.g., "Agents use A*") in favor of behavioral descriptions (e.g., "Commuters prefer the shortest route but will avoid jams").
- **Accuracy:** Data points in the guide must strictly match the current values in `src/game/constants.ts` and `simulation.ts`.

## Out of Scope
- Creating an in-game UI for this guide (Phase 2).
- Automated script generation of the guide (Phase 2).
- Changing simulation mechanics (this track is purely documentation).

## Acceptance Criteria
- [ ] `PLAYER_GUIDE.md` exists in the project root.
- [ ] The "Building Catalog" includes a table or list for every buildable entity in the game.
- [ ] "Zoning & Growth" accurately describes the conditions for all 3 zone types.
- [ ] All numeric values (costs, radii) match the current source code.
