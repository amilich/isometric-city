# Multiplayer Implementation Research

## Executive Summary

This document analyzes how multiplayer functionality could be implemented for the isometric-city project by examining successful implementations in similar codebases: **Bloc**, **Colyseus**, **Starpeace**, and **3D.City**. Each codebase demonstrates different architectural patterns for real-time multiplayer city-building games, providing valuable insights for our implementation.

## Current Architecture Overview

The isometric-city project is a Next.js 16 + React 19 application with:
- **Client-side simulation**: Game state managed in `GameContext` with periodic saves to `localStorage`
- **Simulation engine**: Tick-based simulation in `src/lib/simulation.ts` that updates buildings, zones, economy, and services
- **State management**: Centralized in `GameContext.tsx` with React state and localStorage persistence
- **Rendering**: Canvas-based isometric rendering with React components
- **Game state**: Comprehensive `GameState` type including grid, stats, budget, services, notifications, and multi-city support

## Multiplayer Architecture Patterns Analyzed

### 1. Bloc - Simple Room-Based Multiplayer

**Architecture:**
- **Transport**: Socket.io for WebSocket communication
- **State Management**: Server-authoritative with room-based isolation
- **Synchronization**: Event-driven updates with `updateWorld` broadcasts
- **Persistence**: MongoDB for saves, in-memory for active games
- **Authentication**: Passport.js with session sharing between HTTP and WebSocket

**Key Components:**
- `Room` class manages players, messages, and game controller per session
- `GameController` coordinates shape operations (add/delete blocks)
- Client emits actions (`add_block`, `delete_block`), server validates and broadcasts
- Simple broadcast model: all clients receive full world state updates

**Relevant Patterns:**
```javascript
// Server-side: Process action and broadcast
socket.on('add_block', (data) => {
  gameController.createShape(data);
  io.to(roomId).emit('updateWorld', gameController.getAllShapes());
});

// Client-side: Receive and redraw
socket.on('updateWorld', (shapes) => {
  // Update local state and redraw canvas
});
```

**Pros:**
- Simple to implement and understand
- Good for small-scale multiplayer (2-10 players)
- Minimal client-side prediction needed
- Easy to debug

**Cons:**
- Full state broadcasts can be bandwidth-intensive
- No built-in conflict resolution
- Limited scalability for large games
- No reconnection handling beyond basic socket.io features

### 2. Colyseus - Enterprise-Grade Multiplayer Framework

**Architecture:**
- **Transport**: Pluggable (WebSocket, TCP, HTTP/3, uWebSockets)
- **State Management**: Authoritative server with delta compression
- **Synchronization**: Schema-based serialization with patch-based updates
- **Persistence**: Pluggable drivers (Redis, MongoDB, MikroORM)
- **Matchmaking**: Built-in room discovery and seat reservation system

**Key Components:**
- `Room` class with lifecycle hooks (`onCreate`, `onJoin`, `onLeave`, `onDispose`)
- `Serializer` interface for state encoding (full state + patches)
- `MatchMaker` for room discovery and client assignment
- `Presence` system for distributed state (local or Redis-backed)

**Relevant Patterns:**
```typescript
// Room definition with state schema
class CityRoom extends Room<CityState> {
  onCreate(options: any) {
    this.setState(new CityState());
    this.setPatchRate(50); // 20 updates/second
  }
  
  onJoin(client: Client, options: any) {
    // Send full state on join
    this.send(client, Protocol.ROOM_STATE, this.serializer.getFullState());
  }
  
  onMessage(client: Client, message: any) {
    // Process action, state updates automatically broadcast as patches
    this.state.handleAction(client.sessionId, message);
  }
}
```

**Pros:**
- Production-ready with battle-tested architecture
- Efficient delta compression reduces bandwidth
- Built-in reconnection with token-based system
- Scalable with multi-process support
- Type-safe with TypeScript
- Excellent documentation and community

**Cons:**
- Requires learning Colyseus-specific patterns
- More complex setup than simple Socket.io
- Schema definitions needed for state
- May be overkill for simple use cases

### 3. Starpeace - Complex MMO-Style Architecture

**Architecture:**
- **Transport**: Socket.io for WebSocket, ZeroMQ for inter-process communication
- **State Management**: Multi-process with separate model and simulation servers
- **Synchronization**: Tick-based simulation (500ms intervals) with event-driven updates
- **Persistence**: SQLite per-planet with in-memory caches
- **Authentication**: JWT-based with visa system for planet access

**Key Components:**
- `Simulation` engine runs at fixed 500ms intervals
- `ModelEventServer` handles data mutations via ZeroMQ
- `BusManager` manages WebSocket connections and broadcasts simulation frames
- `Cache-DAO-Store` pattern for data access with dirty tracking

**Relevant Patterns:**
```typescript
// Simulation tick publishes frame
simulation.simulate() {
  const frame = new SimulationFrame({
    finances: this.financesFrame,
    buildings: this.buildingsFrame,
    // ... other domain updates
  });
  simulationEventPublisher.publish('SIMULATION', planetId, frame);
}

// Bus manager broadcasts to connected clients
busManager.notifySockets(planetId, frame) {
  const payload = new SimulationPayload(frame);
  io.to(`planet:${planetId}`).emit('simulation', payload);
}
```

**Pros:**
- Handles complex, persistent worlds
- Multi-process architecture scales well
- Efficient caching reduces database load
- Tick-based simulation ensures consistency
- Supports large player counts per planet

**Cons:**
- Very complex architecture
- Requires significant infrastructure
- Overkill for small-scale multiplayer
- Complex deployment and operations

### 4. 3D.City - Client-Side Simulation with Worker Threads

**Architecture:**
- **Transport**: None (single-player, but pattern applicable)
- **State Management**: Web Worker for simulation, main thread for rendering
- **Synchronization**: Message passing between worker and main thread
- **Persistence**: LocalStorage and file-based saves

**Relevant Patterns:**
```javascript
// Worker handles simulation
self.onmessage = (e) => {
  const { command, data } = e.data;
  if (command === 'TOOL') {
    // Process tool action
    processTool(data);
    // Send updated state back
    self.postMessage({ command: 'RUN', data: simulationState });
  }
};

// Main thread sends actions
worker.postMessage({ command: 'TOOL', data: toolAction });
```

**Pros:**
- Clean separation of simulation and rendering
- Non-blocking simulation keeps UI responsive
- Pattern could extend to server-side simulation

**Cons:**
- Not multiplayer by default
- Would need server-side simulation for multiplayer

## Recommended Architecture for isometric-city

Based on the analysis, I recommend a **hybrid approach** combining elements from Bloc and Colyseus:

### Phase 1: Simple Room-Based (Bloc-inspired)

**Initial Implementation:**
- Use Socket.io for WebSocket communication
- Server-authoritative game state
- Room-based isolation (one game per room)
- Event-driven updates with full state broadcasts initially
- Simple authentication (JWT or session-based)

**Components Needed:**
1. **Server-side:**
   - Express server with Socket.io
   - Room manager (similar to Bloc's `Room` class)
   - Game state manager (validates actions, maintains authoritative state)
   - Authentication middleware

2. **Client-side:**
   - Socket.io client integration
   - State synchronization layer (merge server updates with local state)
   - Conflict resolution for simultaneous actions
   - Reconnection handling

**State Synchronization Strategy:**
```typescript
// Server maintains authoritative state
class GameRoom {
  private state: GameState;
  
  handleAction(clientId: string, action: GameAction) {
    // Validate action
    if (!this.validateAction(action)) return;
    
    // Apply to authoritative state
    this.applyAction(action);
    
    // Broadcast to all clients
    this.broadcast('stateUpdate', this.state);
  }
}

// Client receives and merges
socket.on('stateUpdate', (serverState) => {
  // Merge with local optimistic updates
  mergeGameState(localState, serverState);
});
```

### Phase 2: Optimized with Delta Compression (Colyseus-inspired)

**Optimization Phase:**
- Implement delta compression for state updates
- Add client-side prediction for smoother UX
- Implement proper reconnection with state recovery
- Add rate limiting and validation

**Delta Compression:**
```typescript
// Only send changed tiles
interface StateDelta {
  changedTiles: Array<{ x: number; y: number; tile: Tile }>;
  stats: Stats;
  timestamp: number;
}

// Client applies delta to local state
function applyDelta(localState: GameState, delta: StateDelta) {
  delta.changedTiles.forEach(({ x, y, tile }) => {
    localState.grid[y][x] = tile;
  });
  localState.stats = delta.stats;
}
```

## Implementation Considerations

### 1. Game State Synchronization

**Challenge:** The `GameState` is large (grid of tiles, stats, services, etc.)

**Solutions:**
- **Initial load**: Send full state on join
- **Updates**: Send only changed tiles and stats
- **Compression**: Use JSON compression or binary encoding
- **Throttling**: Limit update frequency (e.g., 10-20 updates/second)

### 2. Conflict Resolution

**Challenge:** Multiple players modifying the same tile simultaneously

**Solutions:**
- **Server authority**: Server validates and applies actions in order
- **Optimistic updates**: Client shows immediate feedback, reverts if rejected
- **Action queuing**: Queue actions and process sequentially
- **Locking**: Optional tile-level locks for critical operations

### 3. Simulation Consistency

**Challenge:** Ensuring all clients see the same simulation results

**Solutions:**
- **Server-side simulation**: Run simulation on server, broadcast results
- **Deterministic simulation**: Ensure simulation is deterministic (no random without seed)
- **Tick synchronization**: All clients receive same tick updates
- **Time synchronization**: Use server time for game time

### 4. Performance Optimization

**Challenge:** Large maps with many players

**Solutions:**
- **Spatial partitioning**: Only send updates for visible areas
- **Level of detail**: Reduce update frequency for distant areas
- **Batching**: Batch multiple updates into single message
- **Caching**: Cache unchanged tiles on client

### 5. Authentication and Authorization

**Challenge:** Managing player identity and permissions

**Solutions:**
- **JWT tokens**: Stateless authentication
- **Session management**: Track active sessions
- **Room ownership**: Define room creator permissions
- **Action validation**: Check permissions before applying actions

## Technical Stack Recommendations

### Server-Side
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for HTTP, Socket.io for WebSocket
- **Database**: PostgreSQL or MongoDB for persistence
- **Authentication**: JWT with Passport.js
- **Deployment**: Docker containers, scalable with Kubernetes

### Client-Side
- **Integration**: Socket.io client library
- **State Management**: Extend existing `GameContext` with sync layer
- **Error Handling**: Retry logic for failed actions
- **Offline Support**: Queue actions when disconnected

## Migration Path

### Step 1: Extract Simulation to Shared Module
- Move simulation logic to shared TypeScript module
- Ensure deterministic behavior (seed all randomness)
- Test simulation consistency across environments

### Step 2: Create Server Infrastructure
- Set up Express + Socket.io server
- Implement basic room management
- Add authentication system

### Step 3: Implement State Synchronization
- Create server-side game state manager
- Implement action validation
- Add state broadcasting

### Step 4: Client Integration
- Add Socket.io client to React app
- Implement state merge logic
- Add optimistic updates

### Step 5: Optimization
- Implement delta compression
- Add client-side prediction
- Optimize network usage

## Comparison Matrix

| Feature | Bloc | Colyseus | Starpeace | Recommended |
|---------|------|----------|-----------|-------------|
| **Complexity** | Low | Medium | High | Medium |
| **Scalability** | Low-Medium | High | Very High | Medium-High |
| **Setup Time** | Days | Weeks | Months | Weeks |
| **Bandwidth Efficiency** | Low | High | Medium | Medium-High |
| **Reconnection** | Basic | Advanced | Advanced | Advanced |
| **Type Safety** | Low | High | Medium | High |
| **Community Support** | Low | High | Low | High (Socket.io) |

## Risk Assessment

### High Risk
- **State synchronization bugs**: Could cause desyncs between clients
- **Performance at scale**: May need optimization for 10+ players
- **Network issues**: Handling disconnections gracefully

### Medium Risk
- **Migration complexity**: Moving from single-player to multiplayer
- **Testing**: Need comprehensive testing for concurrent actions
- **Backward compatibility**: Existing saves may need migration

### Low Risk
- **Authentication**: Well-established patterns available
- **Infrastructure**: Can use existing cloud services

## Next Steps

1. **Prototype**: Build minimal proof-of-concept with Socket.io
2. **Benchmark**: Test performance with 2-4 players
3. **Design**: Create detailed technical design document
4. **Implement**: Follow migration path step-by-step
5. **Test**: Comprehensive testing with multiple concurrent players

## Follow-Up Questions

1. **Scale Expectations**: How many players do you envision per game session? (2-4 players, 5-10, or 10+?)

2. **Game Mode**: Should multiplayer be:
   - **Cooperative**: Players work together on one city
   - **Competitive**: Players build separate cities and compete
   - **Shared World**: Players build in different areas of a large map
   - **All of the above**: Support multiple modes

3. **Persistence**: Should multiplayer games be:
   - **Ephemeral**: Games end when all players leave
   - **Persistent**: Games saved and can be resumed later
   - **Hybrid**: Option to save/load multiplayer games

4. **Authority Model**: Should the game be:
   - **Server-authoritative**: All actions validated on server (recommended)
   - **Client-authoritative**: Clients send actions, server trusts them (not recommended)
   - **Hybrid**: Some actions client-side, critical ones server-side

5. **Real-time Requirements**: How important is low latency?
   - **Critical**: <100ms latency required (competitive play)
   - **Important**: <500ms acceptable (cooperative play)
   - **Flexible**: Can tolerate higher latency (turn-based or slow-paced)

6. **Infrastructure**: Do you have preferences for:
   - **Self-hosted**: Run servers yourself
   - **Cloud-hosted**: Use cloud services (AWS, GCP, etc.)
   - **Hybrid**: Mix of both

7. **Monetization**: Will multiplayer be:
   - **Free**: No cost to players
   - **Premium**: Paid feature
   - **Freemium**: Free with optional paid features

8. **Backward Compatibility**: Should existing single-player saves:
   - **Convert**: Automatically convert to multiplayer format
   - **Separate**: Keep single-player and multiplayer separate
   - **Both**: Support both formats

9. **Moderation**: Do you need:
   - **Admin tools**: For moderating games
   - **Reporting system**: For player reports
   - **Automated moderation**: Bot-based content filtering

10. **Testing Strategy**: How should we test multiplayer?
    - **Local testing**: Test with multiple browser tabs
    - **Staging environment**: Deploy to staging for testing
    - **Beta program**: Limited beta with real players

---

*Research completed using Driver MCP tools to analyze Bloc, Colyseus, Starpeace, and 3D.City codebases.*

